import { openaiClientOrNull } from "./llm";

const env = (k: string) => (process.env[k] || "").trim();

export function openaiVoiceConfigured() {
  return Boolean(env("OPENAI_API_KEY"));
}

export type VoiceEntry = { id: string; name: string; provider?: string; beschreibung?: string };

export type VoiceListResult = {
  source: "browser" | "openai";
  voices: VoiceEntry[];
  hinweis: string;
  standardStimme: string;
};

export async function listVoices(): Promise<VoiceListResult> {
  if (openaiVoiceConfigured()) {
    return { source: "openai", voices: [], hinweis: "OpenAI-TTS ist konfiguriert auf dem Server.", standardStimme: env("OPENAI_TTS_VOICE") || "alloy" };
  }
  return { source: "browser", voices: [], hinweis: "Browser-Sprachausgabe verwenden (empfohlen)", standardStimme: "browser" };
}

export type TtsStream = { mode: "browser"; text: string } | { mode: "openai"; url?: string } | { mode: "fehler"; reason: string };

export async function synthesizeStream(text: string): Promise<TtsStream> {
  return { mode: "browser", text: String(text).slice(0, 10000) };
}

export type SttResult = { ok: true; text: string; quelle: "browser" | "openai" } | { ok: false; nachricht: string; status?: number };

export async function transcribe(_audioBase64: string, _mimeType = "audio/webm"): Promise<SttResult> {
  const client = openaiClientOrNull();
  if (!client) return { ok: false, nachricht: "Server-STT nicht konfiguriert." };
  return { ok: false, nachricht: "Server-STT ist derzeit deaktiviert in dieser Revision." };
}

export async function cloneVoice(): Promise<{ ok: false; nachricht: string }> {
  return { ok: false, nachricht: "Stimmklonen ist deaktiviert. Browser-TTS wird verwendet." };
}

export async function testEleven(): Promise<{ ok: boolean; nachricht: string }> {
  return { ok: false, nachricht: "Externe Anbieter deaktiviert. Browser-Sprachausgabe aktiv." };
}
