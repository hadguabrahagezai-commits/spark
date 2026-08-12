import crypto from "node:crypto";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { raw } from "./db";

/**
 * Bankanbindung über Plaid — echt, nicht simuliert.
 *
 * Ohne PLAID_CLIENT_ID/PLAID_SECRET gibt es keine Kontodaten; die App nutzt dann
 * manuelle Einträge und CSV-Import und beschriftet das ehrlich als
 * „Bank nicht verbunden“. Es werden niemals Umsätze erfunden.
 */

const env = (k: string) => (process.env[k] || "").trim();

export function plaidConfigured() {
  return Boolean(env("PLAID_CLIENT_ID") && env("PLAID_SECRET"));
}
export function finapiConfigured() {
  return Boolean(env("FINAPI_CLIENT_ID") && env("FINAPI_CLIENT_SECRET"));
}
export function bankingConfigured() {
  return plaidConfigured() || finapiConfigured();
}

function plaidEnvName(): keyof typeof PlaidEnvironments {
  const v = (env("PLAID_ENV") || "sandbox").toLowerCase();
  if (v === "production") return "production";
  if (v === "development" && (PlaidEnvironments as any).development) return "development" as any;
  return "sandbox";
}

let client: PlaidApi | null = null;
export function plaid(): PlaidApi | null {
  if (!plaidConfigured()) return null;
  if (!client) {
    client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[plaidEnvName()],
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": env("PLAID_CLIENT_ID"),
            "PLAID-SECRET": env("PLAID_SECRET"),
          },
        },
      }),
    );
  }
  return client;
}

function products(): Products[] {
  return (env("PLAID_PRODUCTS") || "transactions")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Products[];
}
function countryCodes(): CountryCode[] {
  return (env("PLAID_COUNTRY_CODES") || "DE")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean) as CountryCode[];
}

/* ------------------------------------------------------------ Verschlüsselung */

function secretKey(): Buffer {
  const base = env("SESSION_SECRET") || env("PLAID_SECRET") || "spark-lokal";
  return crypto.createHash("sha256").update(base).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptToken(stored: string): string {
  const [iv, tag, data] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/* -------------------------------------------------------------- Item-Speicher */

export type BankItem = { id: number; userId: number; itemId: string; institution: string; cursor: string; createdAt: number };

export const bankStore = {
  save(userId: number, itemId: string, accessToken: string, institution: string) {
    raw
      .prepare(
        `INSERT INTO bank_items (user_id, item_id, access_token, institution, cursor, created_at)
         VALUES (?, ?, ?, ?, '', ?)`,
      )
      .run(userId, itemId, encryptToken(accessToken), institution, Date.now());
  },
  list(userId: number): BankItem[] {
    return raw
      .prepare(`SELECT id, user_id as userId, item_id as itemId, institution, cursor, created_at as createdAt FROM bank_items WHERE user_id = ?`)
      .all(userId) as BankItem[];
  },
  accessTokens(userId: number): { id: number; token: string; institution: string; cursor: string }[] {
    const rows = raw.prepare(`SELECT id, access_token, institution, cursor FROM bank_items WHERE user_id = ?`).all(userId) as any[];
    return rows.map((r) => ({ id: r.id, token: decryptToken(r.access_token), institution: r.institution, cursor: r.cursor || "" }));
  },
  setCursor(id: number, cursor: string) {
    raw.prepare(`UPDATE bank_items SET cursor = ? WHERE id = ?`).run(cursor, id);
  },
  remove(userId: number, id: number) {
    raw.prepare(`DELETE FROM bank_items WHERE user_id = ? AND id = ?`).run(userId, id);
  },
};

/* ------------------------------------------------------------------- Status */

export type BankStatus = {
  configured: boolean;
  anbieter: "plaid" | "finapi" | "keiner";
  umgebung: string;
  verbundeneBanken: number;
  message: string;
};

export function bankingStatus(userId?: number): BankStatus {
  const verbunden = userId && plaidConfigured() ? bankStore.list(userId).length : 0;
  if (plaidConfigured()) {
    return {
      configured: true,
      anbieter: "plaid",
      umgebung: String(plaidEnvName()),
      verbundeneBanken: verbunden,
      message: verbunden
        ? `Plaid verbunden (${plaidEnvName()}) — ${verbunden} Bankverbindung(en). Abos kommen aus /transactions/recurring/get.`
        : `Plaid ist konfiguriert (${plaidEnvName()}), aber noch keine Bank verbunden. Auf „Bank verbinden“ tippen.`,
    };
  }
  if (finapiConfigured()) {
    return {
      configured: true,
      anbieter: "finapi",
      umgebung: env("FINAPI_API_URL") || "https://sandbox.finapi.io",
      verbundeneBanken: 0,
      message: "finAPI ist als Zweitanbieter konfiguriert. Plaid wird bevorzugt, sobald PLAID_CLIENT_ID gesetzt ist.",
    };
  }
  return {
    configured: false,
    anbieter: "keiner",
    umgebung: "-",
    verbundeneBanken: 0,
    message:
      "Bank nicht verbunden (PLAID_CLIENT_ID / PLAID_SECRET fehlen). Abos bitte manuell anlegen oder als CSV importieren — SPARK erfindet keine Kontodaten.",
  };
}

/* ------------------------------------------------------------------ Aufrufe */

export async function createLinkToken(userId: number): Promise<{ ok: true; linkToken: string } | { ok: false; status: number; nachricht: string }> {
  const api = plaid();
  if (!api) return { ok: false, status: 503, nachricht: "Plaid nicht konfiguriert (PLAID_CLIENT_ID / PLAID_SECRET)." };
  try {
    const res = await api.linkTokenCreate({
      user: { client_user_id: `spark-${userId}` },
      client_name: "SPARK",
      products: products(),
      country_codes: countryCodes(),
      language: "de",
      ...(env("PLAID_REDIRECT_URI") ? { redirect_uri: env("PLAID_REDIRECT_URI") } : {}),
    });
    return { ok: true, linkToken: res.data.link_token };
  } catch (e: any) {
    return { ok: false, status: 502, nachricht: plaidError(e) };
  }
}

export async function exchangePublicToken(
  userId: number,
  publicToken: string,
  institution: string,
): Promise<{ ok: true; itemId: string } | { ok: false; status: number; nachricht: string }> {
  const api = plaid();
  if (!api) return { ok: false, status: 503, nachricht: "Plaid nicht konfiguriert." };
  try {
    const res = await api.itemPublicTokenExchange({ public_token: publicToken });
    bankStore.save(userId, res.data.item_id, res.data.access_token, institution || "Bank");
    return { ok: true, itemId: res.data.item_id };
  } catch (e: any) {
    return { ok: false, status: 502, nachricht: plaidError(e) };
  }
}

export async function getAccounts(userId: number) {
  const api = plaid();
  if (!api) return { ok: false as const, status: 503, nachricht: "Plaid nicht konfiguriert." };
  const items = bankStore.accessTokens(userId);
  if (!items.length) return { ok: false as const, status: 400, nachricht: "Noch keine Bank verbunden." };
  const konten: any[] = [];
  for (const item of items) {
    try {
      const res = await api.accountsGet({ access_token: item.token });
      res.data.accounts.forEach((a) =>
        konten.push({
          id: a.account_id,
          name: a.name,
          offiziellerName: a.official_name,
          typ: a.subtype || a.type,
          waehrung: a.balances.iso_currency_code,
          saldo: a.balances.current,
          verfuegbar: a.balances.available,
          bank: item.institution,
        }),
      );
    } catch (e: any) {
      return { ok: false as const, status: 502, nachricht: plaidError(e) };
    }
  }
  return { ok: true as const, konten };
}

export async function syncTransactions(userId: number) {
  const api = plaid();
  if (!api) return { ok: false as const, status: 503, nachricht: "Plaid nicht konfiguriert." };
  const items = bankStore.accessTokens(userId);
  if (!items.length) return { ok: false as const, status: 400, nachricht: "Noch keine Bank verbunden." };
  const umsaetze: any[] = [];
  for (const item of items) {
    try {
      let cursor = item.cursor || undefined;
      let hasMore = true;
      let guard = 0;
      while (hasMore && guard++ < 10) {
        const res = await api.transactionsSync({ access_token: item.token, cursor });
        res.data.added.forEach((t) =>
          umsaetze.push({
            id: t.transaction_id,
            datum: t.date,
            name: t.merchant_name || t.name,
            betrag: t.amount,
            waehrung: t.iso_currency_code,
            kategorie: (t.personal_finance_category as any)?.primary || "",
            bank: item.institution,
          }),
        );
        cursor = res.data.next_cursor;
        hasMore = res.data.has_more;
      }
      if (cursor) bankStore.setCursor(item.id, cursor);
    } catch (e: any) {
      return { ok: false as const, status: 502, nachricht: plaidError(e) };
    }
  }
  return { ok: true as const, umsaetze };
}

export type RecurringStream = {
  id: string;
  name: string;
  betrag: number;
  waehrung: string;
  frequenz: string;
  letzteBuchung: string;
  aktiv: boolean;
  kategorie: string;
  bank: string;
  richtung: "ausgabe" | "einnahme";
};

const FREQ_DE: Record<string, string> = {
  WEEKLY: "wöchentlich",
  BIWEEKLY: "zweiwöchentlich",
  SEMI_MONTHLY: "halbmonatlich",
  MONTHLY: "monatlich",
  ANNUALLY: "jährlich",
  UNKNOWN: "unregelmäßig",
};

/** Echte Abo-Erkennung über /transactions/recurring/get. */
export async function getRecurring(userId: number) {
  const api = plaid();
  if (!api) return { ok: false as const, status: 503, nachricht: "Plaid nicht konfiguriert." };
  const items = bankStore.accessTokens(userId);
  if (!items.length) return { ok: false as const, status: 400, nachricht: "Noch keine Bank verbunden." };
  const streams: RecurringStream[] = [];
  for (const item of items) {
    try {
      const accounts = await api.accountsGet({ access_token: item.token });
      const res = await api.transactionsRecurringGet({
        access_token: item.token,
        account_ids: accounts.data.accounts.map((a) => a.account_id),
      });
      const map = (s: any, richtung: "ausgabe" | "einnahme"): RecurringStream => ({
        id: s.stream_id,
        name: s.merchant_name || s.description,
        betrag: Math.abs(Number(s.last_amount?.amount ?? s.average_amount?.amount ?? 0)),
        waehrung: s.last_amount?.iso_currency_code || "EUR",
        frequenz: FREQ_DE[s.frequency] || String(s.frequency || "").toLowerCase(),
        letzteBuchung: s.last_date,
        aktiv: s.is_active !== false && s.status !== "TOMBSTONED",
        kategorie: s.personal_finance_category?.primary || s.category?.[0] || "sonstiges",
        bank: item.institution,
        richtung,
      });
      (res.data.outflow_streams || []).forEach((s: any) => streams.push(map(s, "ausgabe")));
      (res.data.inflow_streams || []).forEach((s: any) => streams.push(map(s, "einnahme")));
    } catch (e: any) {
      return { ok: false as const, status: 502, nachricht: plaidError(e) };
    }
  }
  return { ok: true as const, streams };
}

function plaidError(e: any): string {
  const d = e?.response?.data;
  if (d?.error_message) return `Plaid: ${d.error_code || ""} ${d.error_message}`.trim();
  return `Plaid nicht erreichbar: ${String(e?.message || e).slice(0, 200)}`;
}

/** Echter Testcall für die Integrationsseite (ohne Bankverbindung). */
export async function testPlaid(): Promise<{ ok: boolean; nachricht: string }> {
  const api = plaid();
  if (!api) return { ok: false, nachricht: "PLAID_CLIENT_ID / PLAID_SECRET nicht gesetzt." };
  try {
    const res = await api.categoriesGet({});
    return {
      ok: true,
      nachricht: `Plaid erreichbar (${plaidEnvName()}), ${res.data.categories?.length ?? 0} Kategorien geladen.`,
    };
  } catch (e: any) {
    return { ok: false, nachricht: plaidError(e) };
  }
}

/* --------------------------------------------------------------- CSV-Import */

/** CSV-Import: name,betrag,zyklus,kategorie */
export function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const rows: { name: string; amount: number; cycle: string; category: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/[;,]/).map((p) => p.trim());
    if (parts.length < 2) continue;
    if (/name/i.test(parts[0]) && /betrag|amount/i.test(parts[1])) continue;
    const amount = parseFloat(parts[1].replace(",", "."));
    if (!isFinite(amount)) continue;
    rows.push({
      name: parts[0],
      amount,
      cycle: (parts[2] || "monatlich").toLowerCase().startsWith("j") ? "jährlich" : "monatlich",
      category: parts[3] || "sonstiges",
    });
  }
  return rows;
}
