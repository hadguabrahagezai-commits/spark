/**
 * Live-Avatar (HeyGen / LiveAvatar).
 *
 * Bevorzugter Weg: Das Frontend nutzt das offizielle SDK
 * `@heygen/liveavatar-web-sdk` (Nachfolger von `@heygen/streaming-avatar`)
 * und holt sich das kurzlebige Sitzungs-Token über `POST /api/avatar/token`.
 * Der API-Schlüssel verlässt niemals den Server.
 *
 * Zusätzlich stehen die klassischen HeyGen-Streaming-Endpunkte
 * (`streaming.new` / `.start` / `.task` / `.stop`) als Proxy bereit.
 *
 * Ohne HEYGEN_API_KEY bleibt alles beim eigenen SVG-Avatar mit Viseme-Lip-Sync —
 * das UI beschriftet das ehrlich.
 */

const env = (k: string) => (process.env[k] || "").trim();

const LIVEAVATAR_API = "https://api.liveavatar.com";
const HEYGEN_API = "https://api.heygen.com";

export function heygenConfigured() {
  return Boolean(env("HEYGEN_API_KEY"));
}
export function didConfigured() {
  return Boolean(env("DID_API_KEY"));
}

export type AvatarStatus = {
  konfiguriert: boolean;
  anbieter: "heygen" | "d-id" | "keiner";
  avatarId: string;
  voiceId: string;
  modus: string;
  hinweis: string;
};

export function avatarStatus(): AvatarStatus {
  if (heygenConfigured()) {
    return {
      konfiguriert: true,
      anbieter: "heygen",
      avatarId: env("HEYGEN_AVATAR_ID"),
      voiceId: env("HEYGEN_VOICE_ID"),
      modus: "HeyGen Live",
      hinweis: env("HEYGEN_AVATAR_ID")
        ? "HeyGen ist konfiguriert. Der Live-Avatar spricht per WebRTC-Video."
        : "HEYGEN_API_KEY ist gesetzt, aber HEYGEN_AVATAR_ID fehlt — bitte einen Avatar in der Liste auswählen.",
    };
  }
  if (didConfigured()) {
    return {
      konfiguriert: true,
      anbieter: "d-id",
      avatarId: "",
      voiceId: "",
      modus: "D-ID",
      hinweis: "D-ID ist konfiguriert. HeyGen wird bevorzugt, sobald HEYGEN_API_KEY gesetzt ist.",
    };
  }
  return {
    konfiguriert: false,
    anbieter: "keiner",
    avatarId: "",
    voiceId: "",
    modus: "SPARK-Avatar (lokal)",
    hinweis:
      "Kein Live-Avatar konfiguriert (HEYGEN_API_KEY fehlt). SPARK nutzt den eigenen SVG-Avatar mit Viseme-Lip-Sync.",
  };
}

export type LiveAvatarEntry = { id: string; name: string; vorschauUrl?: string; quelle: "liveavatar" | "heygen" };

export type AvatarListResult = {
  ok: boolean;
  avatare: LiveAvatarEntry[];
  quelle: "liveavatar" | "heygen" | "keine";
  nachricht: string;
};

/** Echte Avatar-Liste. Erst LiveAvatar (neue API), dann HeyGen v2 als Rückfall. */
export async function listAvatars(): Promise<AvatarListResult> {
  if (!heygenConfigured()) {
    return {
      ok: false,
      avatare: [],
      quelle: "keine",
      nachricht: "Nicht konfiguriert — HEYGEN_API_KEY in der .env eintragen (https://app.heygen.com/settings?nav=API).",
    };
  }
  const key = env("HEYGEN_API_KEY");
  try {
    const res = await fetch(`${LIVEAVATAR_API}/v1/avatars/public?page_size=50`, {
      headers: { "X-API-KEY": key, Accept: "application/json" },
    });
    if (res.ok) {
      const data: any = await res.json();
      const results = data?.data?.results || [];
      if (Array.isArray(results) && results.length) {
        return {
          ok: true,
          quelle: "liveavatar",
          avatare: results.map((a: any) => ({
            id: a.id,
            name: a.name,
            vorschauUrl: a.preview_url,
            quelle: "liveavatar" as const,
          })),
          nachricht: `${results.length} Live-Avatare von LiveAvatar (HeyGen) geladen.`,
        };
      }
    }
  } catch {
    /* weiter zum HeyGen-Rückfall */
  }
  try {
    const res = await fetch(`${HEYGEN_API}/v2/avatars`, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, avatare: [], quelle: "keine", nachricht: `HeyGen antwortete mit ${res.status}. ${detail}` };
    }
    const data: any = await res.json();
    const list = data?.data?.avatars || [];
    return {
      ok: true,
      quelle: "heygen",
      avatare: list.map((a: any) => ({
        id: a.avatar_id,
        name: a.avatar_name || a.avatar_id,
        vorschauUrl: a.preview_image_url,
        quelle: "heygen" as const,
      })),
      nachricht: `${list.length} Avatare von HeyGen geladen.`,
    };
  } catch (e: any) {
    return { ok: false, avatare: [], quelle: "keine", nachricht: `HeyGen nicht erreichbar: ${String(e?.message || e)}` };
  }
}

export type TokenResult =
  | { ok: true; token: string; sessionId?: string; sdk: "liveavatar" | "streaming-avatar"; avatarId: string }
  | { ok: false; status: number; nachricht: string };

/**
 * Kurzlebiges Sitzungs-Token für das Frontend-SDK.
 * Erst LiveAvatar (`/v1/sessions/token`), sonst HeyGen (`/v1/streaming.create_token`).
 */
export async function createSessionToken(opts: {
  avatarId?: string;
  voiceId?: string;
  stability?: number;
  similarity?: number;
  style?: number;
  quality?: "low" | "medium" | "high";
}): Promise<TokenResult> {
  if (!heygenConfigured()) {
    return { ok: false, status: 503, nachricht: "HEYGEN_API_KEY nicht gesetzt — Live-Avatar ist nicht verfügbar." };
  }
  const key = env("HEYGEN_API_KEY");
  const avatarId = opts.avatarId || env("HEYGEN_AVATAR_ID");
  if (!avatarId) {
    return {
      ok: false,
      status: 400,
      nachricht: "Kein Avatar gewählt. Bitte im Companion-Setup unter „Live-Avatar“ einen Avatar auswählen oder HEYGEN_AVATAR_ID setzen.",
    };
  }
  const voiceId = opts.voiceId || env("HEYGEN_VOICE_ID");
  const body: Record<string, unknown> = {
    mode: "FULL",
    avatar_id: avatarId,
    video_settings: { quality: opts.quality || "high", encoding: "H264" },
    avatar_persona: {
      ...(voiceId ? { voice_id: voiceId } : {}),
      language: "de",
      voice_settings: {
        provider: "elevenLabs",
        stability: clamp(opts.stability, 0.75),
        similarity_boost: clamp(opts.similarity, 0.75),
        style: clamp(opts.style, 0),
        use_speaker_boost: true,
        model: "eleven_multilingual_v2",
      },
    },
    interactivity_type: "PUSH_TO_TALK",
  };
  try {
    const res = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data: any = await res.json();
      const token = data?.data?.session_token;
      if (token) return { ok: true, token, sessionId: data?.data?.session_id, sdk: "liveavatar", avatarId };
    }
  } catch {
    /* weiter zum HeyGen-Rückfall */
  }
  try {
    const res = await fetch(`${HEYGEN_API}/v1/streaming.create_token`, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, status: res.status, nachricht: `HeyGen antwortete mit ${res.status}. ${detail}` };
    }
    const data: any = await res.json();
    const token = data?.data?.token;
    if (!token) return { ok: false, status: 502, nachricht: "HeyGen lieferte kein Token zurück." };
    return { ok: true, token, sdk: "streaming-avatar", avatarId };
  } catch (e: any) {
    return { ok: false, status: 502, nachricht: `HeyGen nicht erreichbar: ${String(e?.message || e)}` };
  }
}

function clamp(v: unknown, d: number) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d;
}

/* --------------------------- klassische HeyGen-Streaming-Endpunkte (Proxy) */

async function heygen(path: string, body: unknown) {
  if (!heygenConfigured()) {
    return { ok: false as const, status: 503, data: { message: "HEYGEN_API_KEY nicht gesetzt." } };
  }
  try {
    const res = await fetch(`${HEYGEN_API}${path}`, {
      method: "POST",
      headers: { "x-api-key": env("HEYGEN_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false as const, status: 502, data: { message: `HeyGen nicht erreichbar: ${String(e?.message || e)}` } };
  }
}

export const streaming = {
  neu: (body: unknown) => heygen("/v1/streaming.new", body),
  start: (body: unknown) => heygen("/v1/streaming.start", body),
  task: (body: unknown) => heygen("/v1/streaming.task", body),
  stop: (body: unknown) => heygen("/v1/streaming.stop", body),
};

/** Echter Testcall für die Integrationsseite. */
export async function testAvatar(): Promise<{ ok: boolean; nachricht: string }> {
  if (!heygenConfigured()) return { ok: false, nachricht: "HEYGEN_API_KEY nicht gesetzt." };
  const list = await listAvatars();
  return { ok: list.ok, nachricht: list.nachricht };
}
