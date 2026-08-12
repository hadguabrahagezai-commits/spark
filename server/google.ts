import { google } from "googleapis";
import { raw } from "./db";

/** Der googleapis-Typ kommt aus einer eigenen Kopie von google-auth-library — daher lose typisiert. */
type OAuth2Client = any;

/**
 * Echte Google-Dienste: OAuth2, Gmail, Kalender, Drive, YouTube, Maps.
 * Alle Zugangsdaten kommen aus der Umgebung. Ohne GOOGLE_CLIENT_ID/SECRET
 * bleibt der Google-Knopf deaktiviert und die App läuft unverändert weiter.
 */

const env = (k: string) => (process.env[k] || "").trim();

export const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/tasks",
];

export function googleConfigured() {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}
export function mapsConfigured() {
  return Boolean(env("GOOGLE_MAPS_API_KEY"));
}
export function redirectUri() {
  return env("GOOGLE_REDIRECT_URI") || `${env("APP_BASE_URL") || "http://localhost:5000"}/api/google/callback`;
}

export function oauthClient(): OAuth2Client | null {
  if (!googleConfigured()) return null;
  return new google.auth.OAuth2(env("GOOGLE_CLIENT_ID"), env("GOOGLE_CLIENT_SECRET"), redirectUri());
}

export function authUrl(state: string): string | null {
  const client = oauthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

/* ------------------------------------------------------------ Token-Speicher */

export const tokenStore = {
  save(userId: number, tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null; scope?: string | null; email?: string }) {
    const existing = raw.prepare(`SELECT id, refresh_token FROM google_tokens WHERE user_id = ?`).get(userId) as any;
    const refresh = tokens.refresh_token || existing?.refresh_token || "";
    if (existing) {
      raw
        .prepare(`UPDATE google_tokens SET access_token = ?, refresh_token = ?, expiry = ?, scope = ?, email = ?, updated_at = ? WHERE user_id = ?`)
        .run(tokens.access_token || "", refresh, tokens.expiry_date || 0, tokens.scope || "", tokens.email || "", Date.now(), userId);
    } else {
      raw
        .prepare(`INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry, scope, email, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, tokens.access_token || "", refresh, tokens.expiry_date || 0, tokens.scope || "", tokens.email || "", Date.now());
    }
  },
  get(userId: number) {
    return raw.prepare(`SELECT * FROM google_tokens WHERE user_id = ?`).get(userId) as any;
  },
  remove(userId: number) {
    raw.prepare(`DELETE FROM google_tokens WHERE user_id = ?`).run(userId);
  },
};

/** OAuth-Client mit gespeicherten Tokens und automatischem Refresh. */
export function clientFor(userId: number): OAuth2Client | null {
  const client = oauthClient();
  if (!client) return null;
  const row = tokenStore.get(userId);
  if (!row || (!row.access_token && !row.refresh_token)) return null;
  client.setCredentials({
    access_token: row.access_token || undefined,
    refresh_token: row.refresh_token || undefined,
    expiry_date: row.expiry || undefined,
  });
  client.on("tokens", (t: any) => tokenStore.save(userId, t as any));
  return client;
}

export function googleStatus(userId?: number) {
  if (!googleConfigured()) {
    return {
      konfiguriert: false,
      verbunden: false,
      email: "",
      nachricht: "Nicht konfiguriert — GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET in der .env eintragen.",
      redirectUri: redirectUri(),
    };
  }
  const row = userId ? tokenStore.get(userId) : null;
  return {
    konfiguriert: true,
    verbunden: Boolean(row?.refresh_token || row?.access_token),
    email: row?.email || "",
    nachricht: row
      ? `Google-Konto verbunden${row.email ? ` (${row.email})` : ""}.`
      : "Schlüssel gesetzt, aber noch kein Konto verbunden — auf „Mit Google verbinden“ tippen.",
    redirectUri: redirectUri(),
  };
}

type Fail = { ok: false; status: number; nachricht: string };
const nichtVerbunden: Fail = {
  ok: false,
  status: 401,
  nachricht: "Kein Google-Konto verbunden. Unter Einstellungen → Integrationen verbinden.",
};

function fehler(e: any): Fail {
  const msg = e?.response?.data?.error?.message || e?.message || String(e);
  return { ok: false, status: 502, nachricht: `Google-Dienst meldet: ${String(msg).slice(0, 200)}` };
}

/* -------------------------------------------------------------- Kalender */

export type Termin = { id: string; titel: string; start: string; ende: string; ganztags: boolean; ort: string; link: string };

export async function calendarEvents(userId: number, tage = 7) {
  const client = clientFor(userId);
  if (!client) return nichtVerbunden;
  try {
    const cal = google.calendar({ version: "v3", auth: client });
    const now = new Date();
    const end = new Date(now.getTime() + tage * 86400000);
    const res = await cal.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 25,
    });
    const termine: Termin[] = (res.data.items || []).map((e) => ({
      id: e.id || "",
      titel: e.summary || "(ohne Titel)",
      start: e.start?.dateTime || e.start?.date || "",
      ende: e.end?.dateTime || e.end?.date || "",
      ganztags: Boolean(e.start?.date && !e.start?.dateTime),
      ort: e.location || "",
      link: e.htmlLink || "",
    }));
    return { ok: true as const, termine };
  } catch (e) {
    return fehler(e);
  }
}

/* ----------------------------------------------------------------- Gmail */

export type MailKopf = { id: string; betreff: string; von: string; datum: string; auszug: string };

export async function gmailSummary(userId: number) {
  const client = clientFor(userId);
  if (!client) return nichtVerbunden;
  try {
    const gmail = google.gmail({ version: "v1", auth: client });
    const list = await gmail.users.messages.list({ userId: "me", q: "is:unread newer_than:1d", maxResults: 15 });
    const ids = (list.data.messages || []).map((m) => m.id!).filter(Boolean);
    const mails: MailKopf[] = [];
    for (const id of ids) {
      const msg = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Subject", "From", "Date"] });
      const headers = msg.data.payload?.headers || [];
      const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n)?.value || "";
      mails.push({ id, betreff: h("subject") || "(kein Betreff)", von: h("from"), datum: h("date"), auszug: msg.data.snippet || "" });
    }
    return { ok: true as const, ungelesen: mails.length, mails };
  } catch (e) {
    return fehler(e);
  }
}

export async function gmailSend(userId: number, an: string, betreff: string, text: string) {
  const client = clientFor(userId);
  if (!client) return nichtVerbunden;
  try {
    const gmail = google.gmail({ version: "v1", auth: client });
    const raw64 = Buffer.from(
      [`To: ${an}`, `Subject: =?UTF-8?B?${Buffer.from(betreff, "utf8").toString("base64")}?=`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", text].join("\r\n"),
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw: raw64 } });
    return { ok: true as const, id: res.data.id || "" };
  } catch (e) {
    return fehler(e);
  }
}

/* ------------------------------------------------------- Drive & YouTube */

export async function driveRecent(userId: number) {
  const client = clientFor(userId);
  if (!client) return nichtVerbunden;
  try {
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.files.list({
      pageSize: 10,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    return {
      ok: true as const,
      dateien: (res.data.files || []).map((f) => ({
        id: f.id || "",
        name: f.name || "",
        typ: f.mimeType || "",
        geaendert: f.modifiedTime || "",
        link: f.webViewLink || "",
      })),
    };
  } catch (e) {
    return fehler(e);
  }
}

export async function youtubeSubscriptions(userId: number) {
  const client = clientFor(userId);
  if (!client) return nichtVerbunden;
  try {
    const yt = google.youtube({ version: "v3", auth: client });
    const res = await yt.subscriptions.list({ part: ["snippet"], mine: true, maxResults: 15 });
    return {
      ok: true as const,
      kanaele: (res.data.items || []).map((i) => ({
        id: i.id || "",
        name: i.snippet?.title || "",
        bild: i.snippet?.thumbnails?.default?.url || "",
      })),
    };
  } catch (e) {
    return fehler(e);
  }
}

/* ------------------------------------------------------------------- Maps */

export async function geocode(adresse: string) {
  if (!mapsConfigured()) return { ok: false as const, status: 503, nachricht: "GOOGLE_MAPS_API_KEY nicht gesetzt." };
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(adresse)}&language=de&key=${env("GOOGLE_MAPS_API_KEY")}`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (data.status !== "OK") return { ok: false as const, status: 502, nachricht: `Google Maps: ${data.status} ${data.error_message || ""}` };
    const first = data.results[0];
    return { ok: true as const, adresse: first.formatted_address, position: first.geometry.location };
  } catch (e: any) {
    return { ok: false as const, status: 502, nachricht: `Google Maps nicht erreichbar: ${String(e?.message || e)}` };
  }
}

export async function directions(von: string, nach: string, modus = "driving") {
  if (!mapsConfigured()) return { ok: false as const, status: 503, nachricht: "GOOGLE_MAPS_API_KEY nicht gesetzt." };
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(von)}&destination=${encodeURIComponent(nach)}` +
      `&mode=${encodeURIComponent(modus)}&language=de&key=${env("GOOGLE_MAPS_API_KEY")}`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (data.status !== "OK") return { ok: false as const, status: 502, nachricht: `Google Maps: ${data.status} ${data.error_message || ""}` };
    const leg = data.routes[0].legs[0];
    return { ok: true as const, dauer: leg.duration.text, strecke: leg.distance.text, start: leg.start_address, ziel: leg.end_address };
  } catch (e: any) {
    return { ok: false as const, status: 502, nachricht: `Google Maps nicht erreichbar: ${String(e?.message || e)}` };
  }
}

/** Echter Testcall für die Integrationsseite. */
export async function testGoogle(userId: number): Promise<{ ok: boolean; nachricht: string }> {
  if (!googleConfigured()) return { ok: false, nachricht: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nicht gesetzt." };
  const client = clientFor(userId);
  if (!client) return { ok: false, nachricht: "Schlüssel gesetzt, aber noch kein Google-Konto verbunden." };
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const cal = await calendarEvents(userId, 1);
    const anzahl = "ok" in cal && cal.ok ? cal.termine.length : 0;
    return { ok: true, nachricht: `Verbunden als ${me.data.email}. Termine in den nächsten 24 h: ${anzahl}.` };
  } catch (e: any) {
    return { ok: false, nachricht: `Google meldet: ${String(e?.message || e).slice(0, 200)}` };
  }
}
