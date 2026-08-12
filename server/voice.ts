import { Readable } from "node:stream";
import { openaiClientOrNull } from "./llm";

/**
 * Stimme: echte Anbieter, ehrlich beschriftet.
 *
 * Fallback-Kette: ElevenLabs → OpenAI-TTS → Browser-Sprachausgabe.
 * Alle Schlüssel kommen aus der Umgebung. Ohne Schlüssel wird nichts erfunden —
 * das UI zeigt an, welcher Modus tatsächlich läuft.
 */

const env = (k: string) => (process.env[k] || "").trim();
const openaiBase = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const num = (k: string, d: number) => {
  const v = parseFloat(env(k));
  return Number.isFinite(v) ? v : d;
};

export function elevenConfigured() {
  return Boolean(env("ELEVENLABS_API_KEY"));
}
export function openaiVoiceConfigured() {
  return Boolean(env("OPENAI_API_KEY"));
}

export type VoiceSource = "elevenlabs" | "openai" | "browser";

export type VoiceEntry = {
  id: string;
  name: string;
  vorschauUrl?: string;
  kategorie?: string;
  labels?: Record<string, string>;
  beschreibung?: string;
};

export type VoiceListResult = {
  source: VoiceSource;
  voices: VoiceEntry[];
  hinweis: string;
  standardStimme: string;
  regler: { stability: number; similarity: number; style: number };
  fehler?: string;
};

/** OpenAI-TTS-Stimmen (fest dokumentierte Auswahl der Text-to-Speech-API). */
const OPENAI_VOICES: VoiceEntry[] = [
  { id: "alloy", name: "Alloy", beschreibung: "neutral, ruhig" },
  { id: "ash", name: "Ash", beschreibung: "warm, erzählend" },
  { id: "ballad", name: "Ballad", beschreibung: "weich, melodisch" },
  { id: "coral", name: "Coral", beschreibung: "hell, freundlich" },
  { id: "echo", name: "Echo", beschreibung: "sachlich, klar" },
  { id: "fable", name: "Fable", beschreibung: "erzählend" },
  { id: "onyx", name: "Onyx", beschreibung: "tief, ruhig" },
  { id: "nova", name: "Nova", beschreibung: "hell, energisch" },
  { id: "sage", name: "Sage", beschreibung: "ruhig, bedacht" },
  { id: "shimmer", name: "Shimmer", beschreibung: "leicht, freundlich" },
];

export async function listVoices(): Promise<VoiceListResult> {
  const regler = {
    stability: num("ELEVENLABS_STABILITY", 0.5),
    similarity: num("ELEVENLABS_SIMILARITY", 0.75),
    style: num("ELEVENLABS_STYLE", 0),
  };
  if (elevenConfigured()) {
    try {
      const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
        headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 200);
        return {
          source: "openai",
          voices: openaiVoiceConfigured() ? OPENAI_VOICES : [],
          standardStimme: env("OPENAI_TTS_VOICE") || "alloy",
          regler,
          hinweis: "ElevenLabs antwortete mit einem Fehler — es wird auf OpenAI bzw. den Browser ausgewichen.",
          fehler: `ElevenLabs ${res.status}: ${text}`,
        };
      }
      const data: any = await res.json();
      const voices: VoiceEntry[] = (data?.voices || []).map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        vorschauUrl: v.preview_url,
        kategorie: v.category,
        labels: v.labels || {},
      }));
      return {
        source: "elevenlabs",
        voices,
        standardStimme: env("ELEVENLABS_DEFAULT_VOICE_ID") || voices[0]?.id || "",
        regler,
        hinweis: `ElevenLabs verbunden — ${voices.length} echte Stimmen, Modell ${env("ELEVENLABS_MODEL") || "eleven_multilingual_v2"}.`,
      };
    } catch (e: any) {
      return {
        source: "browser",
        voices: [],
        standardStimme: "",
        regler,
        hinweis: "ElevenLabs nicht erreichbar — SPARK nutzt die Sprachausgabe deines Browsers.",
        fehler: String(e?.message || e),
      };
    }
  }
  if (openaiVoiceConfigured()) {
    return {
      source: "openai",
      voices: OPENAI_VOICES,
      standardStimme: env("OPENAI_TTS_VOICE") || "alloy",
      regler,
      hinweis: `OpenAI-TTS aktiv (${env("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts"}). Für echtes Stimmklonen ELEVENLABS_API_KEY eintragen.`,
    };
  }
  return {
    source: "browser",
    voices: [],
    standardStimme: "",
    regler,
    hinweis:
      "Keine Sprach-API konfiguriert — SPARK nutzt die Stimmen deines Browsers. Für echte Stimmen ELEVENLABS_API_KEY oder OPENAI_API_KEY in die .env eintragen.",
  };
}

export type VoiceSettings = { stability?: number; similarity?: number; style?: number; speakerBoost?: boolean };

export type TtsStream =
  | { mode: "elevenlabs" | "openai"; body: NodeJS.ReadableStream; mimeType: string }
  | { mode: "browser"; reason: string }
  | { mode: "fehler"; reason: string; status: number };

const clamp01 = (v: unknown, d: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d;
};

/** Echtes Streaming-TTS. Reicht den Audio-Stream unverändert an den Client durch. */
export async function synthesizeStream(
  text: string,
  voiceId?: string,
  settings: VoiceSettings = {},
): Promise<TtsStream> {
  if (elevenConfigured()) {
    const voice = voiceId || env("ELEVENLABS_DEFAULT_VOICE_ID");
    if (!voice) {
      return {
        mode: "fehler",
        status: 400,
        reason: "Keine ElevenLabs-Stimme gewählt. Bitte im Companion-Setup eine Stimme auswählen oder ELEVENLABS_DEFAULT_VOICE_ID setzen.",
      };
    }
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream`, {
        method: "POST",
        headers: {
          "xi-api-key": env("ELEVENLABS_API_KEY"),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: env("ELEVENLABS_MODEL") || "eleven_multilingual_v2",
          voice_settings: {
            stability: clamp01(settings.stability, num("ELEVENLABS_STABILITY", 0.5)),
            similarity_boost: clamp01(settings.similarity, num("ELEVENLABS_SIMILARITY", 0.75)),
            style: clamp01(settings.style, num("ELEVENLABS_STYLE", 0)),
            use_speaker_boost: settings.speakerBoost !== false,
          },
        }),
      });
      if (!res.ok || !res.body) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        // Ehrlicher Hinweis + Ausweichen auf OpenAI, falls vorhanden.
        const fallback = await openAiTts(text);
        if (fallback.mode === "openai") return fallback;
        return { mode: "fehler", status: res.status, reason: `ElevenLabs antwortete mit ${res.status}. ${detail}` };
      }
      return { mode: "elevenlabs", body: Readable.fromWeb(res.body as any), mimeType: "audio/mpeg" };
    } catch (e: any) {
      const fallback = await openAiTts(text);
      if (fallback.mode === "openai") return fallback;
      return { mode: "fehler", status: 502, reason: `ElevenLabs nicht erreichbar: ${String(e?.message || e)}` };
    }
  }
  const oa = await openAiTts(text);
  if (oa.mode !== "browser") return oa;
  return {
    mode: "browser",
    reason:
      "Keine Sprach-API konfiguriert (ELEVENLABS_API_KEY / OPENAI_API_KEY fehlen) — SPARK spricht über die Browser-Sprachausgabe.",
  };
}

async function openAiTts(text: string): Promise<TtsStream> {
  if (!openaiVoiceConfigured()) return { mode: "browser", reason: "OPENAI_API_KEY nicht gesetzt." };
  try {
    const res = await fetch(`${openaiBase()}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts",
        voice: env("OPENAI_TTS_VOICE") || "alloy",
        input: text,
        response_format: "mp3",
      }),
    });
    if (!res.ok || !res.body) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { mode: "fehler", status: res.status, reason: `OpenAI-TTS antwortete mit ${res.status}. ${detail}` };
    }
    return { mode: "openai", body: Readable.fromWeb(res.body as any), mimeType: "audio/mpeg" };
  } catch (e: any) {
    return { mode: "fehler", status: 502, reason: `OpenAI-TTS nicht erreichbar: ${String(e?.message || e)}` };
  }
}

/* ---------------------------------------------------------- Stimmklon (IVC) */

export type CloneResult =
  | { mode: "elevenlabs"; voiceId: string; nachricht: string }
  | { mode: "nicht_konfiguriert"; nachricht: string }
  | { mode: "fehler"; nachricht: string; status: number };

/** Echtes Instant Voice Cloning über POST /v1/voices/add. */
export async function cloneVoice(name: string, audioBase64?: string, mimeType = "audio/webm"): Promise<CloneResult> {
  if (!elevenConfigured()) {
    return {
      mode: "nicht_konfiguriert",
      nachricht:
        "Echtes Stimmklonen erfordert ELEVENLABS_API_KEY in der .env. SPARK klont nichts im Verborgenen und nutzt bis dahin die gewählte Standardstimme.",
    };
  }
  if (!audioBase64) return { mode: "fehler", status: 400, nachricht: "Keine Aufnahme übermittelt.", };
  try {
    const form = new FormData();
    form.append("name", name);
    form.append("description", "Von SPARK mit ausdrücklicher Einwilligung des Nutzers erstellt.");
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "webm";
    form.append("files", new Blob([new Uint8Array(Buffer.from(audioBase64, "base64"))], { type: mimeType }), `sample.${ext}`);
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
      body: form as any,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { mode: "fehler", status: res.status, nachricht: `ElevenLabs antwortete mit ${res.status}. ${detail}` };
    }
    const data: any = await res.json();
    return { mode: "elevenlabs", voiceId: data.voice_id, nachricht: "Stimme erfolgreich geklont und mit deinem Profil verknüpft." };
  } catch (e: any) {
    return { mode: "fehler", status: 502, nachricht: `ElevenLabs nicht erreichbar: ${String(e?.message || e)}` };
  }
}

/* ------------------------------------------------------------------- STT */

export type SttResult =
  | { ok: true; text: string; quelle: "openai" }
  | { ok: false; nachricht: string; status: number; browserFallback: boolean };

/** Serverseitige Spracherkennung über OpenAI Whisper. */
export async function transcribe(audioBase64: string, mimeType = "audio/webm"): Promise<SttResult> {
  const client = openaiClientOrNull();
  if (!client) {
    return {
      ok: false,
      status: 503,
      browserFallback: true,
      nachricht:
        "Keine Server-Spracherkennung konfiguriert (OPENAI_API_KEY fehlt) — SPARK nutzt die Web-Speech-API deines Browsers.",
    };
  }
  try {
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "webm";
    const file = new File([new Uint8Array(Buffer.from(audioBase64, "base64"))], `aufnahme.${ext}`, { type: mimeType });
    const res = await client.audio.transcriptions.create({
      file,
      model: env("OPENAI_STT_MODEL") || "whisper-1",
      language: "de",
    });
    return { ok: true, text: (res as any).text || "", quelle: "openai" };
  } catch (e: any) {
    return {
      ok: false,
      status: 502,
      browserFallback: true,
      nachricht: `Spracherkennung fehlgeschlagen: ${String(e?.message || e).slice(0, 200)}`,
    };
  }
}

/** Echter Testcall für die Integrationsseite. */
export async function testEleven(): Promise<{ ok: boolean; nachricht: string }> {
  if (!elevenConfigured()) return { ok: false, nachricht: "ELEVENLABS_API_KEY nicht gesetzt." };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY") },
    });
    if (!res.ok) return { ok: false, nachricht: `ElevenLabs antwortete mit ${res.status}.` };
    const data: any = await res.json();
    return {
      ok: true,
      nachricht: `Verbunden. Tarif: ${data?.tier || "unbekannt"}, Zeichen genutzt: ${data?.character_count ?? "?"} von ${data?.character_limit ?? "?"}.`,
    };
  } catch (e: any) {
    return { ok: false, nachricht: `Nicht erreichbar: ${String(e?.message || e).slice(0, 160)}` };
  }
}
