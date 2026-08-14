import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optionaler Sync-Layer. Wird NUR aktiv, wenn SUPABASE_URL und SUPABASE_SERVICE_KEY
 * gesetzt sind. Ohne Keys läuft die gesamte App unverändert lokal über SQLite weiter.
 */
let client: SupabaseClient | null = null;

const env = (k: string) => (process.env[k] || "").trim();

/** Es genügt SUPABASE_URL plus SERVICE- oder ANON-Key. */
export function supabaseEnabled() {
  return Boolean(env("SUPABASE_URL") && (env("SUPABASE_SERVICE_KEY") || env("SUPABASE_ANON_KEY")));
}

export function supabaseKeyKind(): "service" | "anon" | "keiner" {
  if (env("SUPABASE_SERVICE_KEY")) return "service";
  if (env("SUPABASE_ANON_KEY")) return "anon";
  return "keiner";
}

function getClient(): SupabaseClient | null {
  if (!supabaseEnabled()) return null;
  if (!client) {
    client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY") || env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false },
    });
  }
  return client;
}

function getServiceClient(): SupabaseClient | null {
  if (!supabaseEnabled() || !env("SUPABASE_SERVICE_KEY")) return null;
  // Use a client initialized explicitly with the service_role key for write operations
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } });
}

const TABELLEN = ["memory_vectors", "events", "relationships", "financial_summary"];

/** Prüft beim Start, ob die vier Tabellen existieren, und meldet sonst klar. */
export async function checkSupabaseTables() {
  const c = getClient();
  if (!c) return { enabled: false, fehlend: [] as string[] };
  const fehlend: string[] = [];
  for (const t of TABELLEN) {
    const { error } = await c.from(t).select("*").limit(1);
    if (error) fehlend.push(t);
  }
  if (fehlend.length) {
    console.warn(
      `[supabase] Diese Tabellen fehlen oder sind nicht lesbar: ${fehlend.join(", ")}. ` +
        "Bitte supabase/migration.sql im Supabase-SQL-Editor ausführen.",
    );
  } else {
    console.log(`[supabase] Verbunden (${supabaseKeyKind()}-Key), alle ${TABELLEN.length} Tabellen vorhanden.`);
  }
  return { enabled: true, fehlend };
}

/** Zweiweg-Sync: liest Zeilen eines Nutzers aus Supabase zurück. */
export async function pullTable(table: string, userId: number) {
  const c = getClient();
  if (!c) return { ok: false as const, nachricht: "Supabase nicht konfiguriert." };
  const { data, error } = await c.from(table).select("*").eq("user_id", userId).limit(500);
  if (error) return { ok: false as const, nachricht: error.message };
  return { ok: true as const, rows: data || [] };
}

async function safeUpsert(table: string, row: Record<string, unknown>) {
  // For writes we prefer the service_role key (bypasses RLS). If not available,
  // return a helpful message so the operator can either supply SUPABASE_SERVICE_KEY
  // or add appropriate RLS policies in the Supabase dashboard.
  const c = getServiceClient();
  if (!c) return { skipped: true as const, error: "SUPABASE_SERVICE_KEY fehlt. Schreib-Operation übersprungen. Entweder SUPABASE_SERVICE_KEY setzen oder RLS-Policy anpassen." };
  try {
    const { error } = await c.from(table).upsert(row);
    if (error) return { skipped: false as const, error: error.message };
    return { skipped: false as const };
  } catch (e: any) {
    return { skipped: false as const, error: String(e?.message || e) };
  }
}

export async function syncMemory(row: {
  id: number;
  userId: number;
  text: string;
  kind: string;
  importance: number;
  createdAt: number;
}) {
  return safeUpsert("memory_vectors", {
    id: row.id,
    user_id: row.userId,
    content: row.text,
    kind: row.kind,
    importance: row.importance,
    created_at: new Date(row.createdAt).toISOString(),
  });
}

export async function syncEvent(userId: number, kind: string, payload: unknown) {
  return safeUpsert("events", {
    user_id: userId,
    kind,
    payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
  });
}

export async function syncFinancialSummary(userId: number, summary: unknown) {
  return safeUpsert("financial_summary", {
    user_id: userId,
    summary: JSON.stringify(summary),
    updated_at: new Date().toISOString(),
  });
}

export async function syncRelationship(userId: number, row: Record<string, unknown>) {
  return safeUpsert("relationships", { user_id: userId, ...row, updated_at: new Date().toISOString() });
}

export async function supabaseStatus() {
  if (!supabaseEnabled()) {
    return {
      enabled: false,
      reachable: false,
      message: "Nicht konfiguriert (SUPABASE_URL und SUPABASE_SERVICE_KEY bzw. SUPABASE_ANON_KEY fehlen)",
    };
  }
  const c = getClient()!;
  try {
    const { error } = await c.from("events").select("id").limit(1);
    if (error) return { enabled: true, reachable: false, message: error.message };
    return { enabled: true, reachable: true, message: "Verbunden" };
  } catch (e: any) {
    return { enabled: true, reachable: false, message: String(e?.message || e) };
  }
}
