import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/**
 * Multi-Provider-KI-Schicht für SPARK.
 *
 * Unterstützt Google Gemini (@google/genai), OpenAI (openai) und Anthropic.
 * Alle Zugangsdaten kommen ausschließlich aus der Umgebung — im Quellcode
 * steht kein einziger Schlüssel. Ohne Schlüssel wird kein Dummy-Text erzeugt;
 * die Aufrufer bekommen einen klaren Fehler und das UI beschriftet das ehrlich.
 */

export type ProviderId = "gemini" | "openai" | "anthropic";

export type ChatMsg = { role: "user" | "assistant"; content: string };
/** Bildeingabe für Scan-zu-Quiz: reines Base64 ohne data:-Präfix. */
export type ImageInput = { base64: string; mimeType: string };

const env = (k: string) => (process.env[k] || "").trim();

export const MODELS = {
  get gemini() {
    return env("GEMINI_MODEL") || "gemini-2.5-flash";
  },
  get openai() {
    return env("OPENAI_MODEL") || "gpt-4o";
  },
  get anthropic() {
    return env("ANTHROPIC_MODEL") || env("LLM_MODEL") || "claude-sonnet-4-5";
  },
};

export function providerConfigured(p: ProviderId): boolean {
  if (p === "gemini") return Boolean(env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"));
  if (p === "openai") return Boolean(env("OPENAI_API_KEY"));
  return Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN"));
}

/** Der tatsächlich verwendete Anbieter. Es gibt keinen stillen Anbieterwechsel. */
export function activeProvider(): ProviderId | null {
  const wanted = (env("AI_PROVIDER").toLowerCase() as ProviderId) || "openai";
  if (["gemini", "openai", "anthropic"].includes(wanted) && providerConfigured(wanted)) return wanted;
  return null;
}

export function llmConfigured(): boolean {
  return activeProvider() !== null;
}

export function modelFor(p: ProviderId): string {
  return p === "gemini" ? MODELS.gemini : p === "openai" ? MODELS.openai : MODELS.anthropic;
}

/** Aktuelles Modell des aktiven Anbieters (für Anzeigen im UI). */
export function currentModel(): string {
  const p = activeProvider();
  return p ? modelFor(p) : "nicht konfiguriert";
}

export type ProviderStatus = {
  aktiv: ProviderId | null;
  modell: string;
  anbieter: { id: ProviderId; name: string; konfiguriert: boolean; modell: string; variable: string; konsole: string }[];
  gewuenscht: string;
};

export function providerStatus(): ProviderStatus {
  const aktiv = activeProvider();
  return {
    aktiv,
    modell: aktiv ? modelFor(aktiv) : "nicht konfiguriert",
    gewuenscht: env("AI_PROVIDER") || "openai",
    anbieter: [
      {
        id: "gemini",
        name: "Google Gemini",
        konfiguriert: providerConfigured("gemini"),
        modell: MODELS.gemini,
        variable: "GEMINI_API_KEY",
        konsole: "https://aistudio.google.com/apikey",
      },
      {
        id: "openai",
        name: "OpenAI",
        konfiguriert: providerConfigured("openai"),
        modell: MODELS.openai,
        variable: "OPENAI_API_KEY",
        konsole: "https://platform.openai.com/api-keys",
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        konfiguriert: providerConfigured("anthropic"),
        modell: MODELS.anthropic,
        variable: "ANTHROPIC_API_KEY",
        konsole: "https://console.anthropic.com/settings/keys",
      },
    ],
  };
}

/* ------------------------------------------------------------------ Clients */

let geminiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function gemini(): GoogleGenAI {
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") || env("GOOGLE_API_KEY") });
  return geminiClient;
}
export function openaiClientOrNull(): OpenAI | null {
  if (!env("OPENAI_API_KEY")) return null;
  if (!openaiClient)
    openaiClient = new OpenAI({
      apiKey: env("OPENAI_API_KEY"),
      baseURL: env("OPENAI_BASE_URL") || undefined,
      maxRetries: 1,
    });
  return openaiClient;
}
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN"),
      baseURL: env("ANTHROPIC_BASE_URL") || undefined,
      maxRetries: 1,
    });
  }
  return anthropicClient;
}

function noProvider(): never {
  throw new Error(
    "Kein KI-Anbieter konfiguriert. Trage GEMINI_API_KEY, OPENAI_API_KEY oder ANTHROPIC_API_KEY in die .env ein.",
  );
}


/**
 * Ruft Anthropic auf. Manche Anthropic-kompatiblen Gateways erwarten
 * Modellnamen mit Unterstrichen (claude_sonnet_4_5) statt Bindestrichen.
 * Bei einem 404 wird deshalb genau einmal mit der Unterstrich-Schreibweise erneut versucht.
 */
async function anthropicCall<T>(fn: (model: string) => Promise<T>): Promise<T> {
  const model = MODELS.anthropic;
  try {
    return await fn(model);
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    const alt = model.includes("-") ? model.replace(/-/g, "_") : model.replace(/_/g, "-");
    if (status === 404 && alt !== model) {
      console.warn(`[llm] Anthropic-Modell "${model}" unbekannt — Wiederholung mit "${alt}".`);
      return await fn(alt);
    }
    throw e;
  }
}

/* --------------------------------------------------------------- Konvertierung */

function toGeminiContents(messages: ChatMsg[], images?: ImageInput[]) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  })) as any[];
  if (images?.length && contents.length) {
    const last = contents[contents.length - 1];
    for (const img of images) last.parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
  }
  return contents;
}

function toOpenAiMessages(system: string, messages: ChatMsg[], images?: ImageInput[]) {
  const msgs: any[] = [{ role: "system", content: system }];
  messages.forEach((m, i) => {
    const isLast = i === messages.length - 1;
    if (isLast && images?.length && m.role === "user") {
      msgs.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
        ],
      });
    } else {
      msgs.push({ role: m.role, content: m.content });
    }
  });
  return msgs;
}

function toAnthropicMessages(messages: ChatMsg[], images?: ImageInput[]) {
  return messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    if (isLast && images?.length && m.role === "user") {
      return {
        role: m.role,
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mimeType as any, data: img.base64 },
          })),
          { type: "text" as const, text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  }) as any[];
}

/* ------------------------------------------------------------------ complete */

export async function complete(system: string, messages: ChatMsg[], maxTokens = 900): Promise<string> {
  return visionComplete(system, messages, [], maxTokens);
}

/** Wie `complete`, zusätzlich mit Bildern (Scan-zu-Quiz). */
export async function visionComplete(
  system: string,
  messages: ChatMsg[],
  images: ImageInput[] = [],
  maxTokens = 900,
): Promise<string> {
  const provider = activeProvider();
  if (!provider) noProvider();

  if (provider === "gemini") {
    const res = await gemini().models.generateContent({
      model: MODELS.gemini,
      contents: toGeminiContents(messages, images),
      config: { systemInstruction: system, maxOutputTokens: maxTokens },
    });
    return (res.text || "").trim();
  }

  if (provider === "openai") {
    const client = openaiClientOrNull()!;
    const res = await client.chat.completions.create({
      model: MODELS.openai,
      messages: toOpenAiMessages(system, messages, images),
      max_completion_tokens: maxTokens,
    } as any);
    return (res.choices?.[0]?.message?.content || "").trim();
  }

  const res = await anthropicCall((model) =>
    anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: toAnthropicMessages(messages, images),
    }),
  );
  return res.content
    .map((c: any) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
}

/* -------------------------------------------------------------------- stream */

/** Streamt Text-Deltas. Fehler werden nach oben durchgereicht (kein stiller Dummy-Text). */
export async function* stream(system: string, messages: ChatMsg[], maxTokens = 1200): AsyncGenerator<string> {
  const provider = activeProvider();
  if (!provider) noProvider();

  if (provider === "gemini") {
    const s = await gemini().models.generateContentStream({
      model: MODELS.gemini,
      contents: toGeminiContents(messages),
      config: { systemInstruction: system, maxOutputTokens: maxTokens },
    });
    for await (const chunk of s) {
      const text = chunk.text;
      if (text) yield text;
    }
    return;
  }

  if (provider === "openai") {
    const client = openaiClientOrNull()!;
    const s = await client.chat.completions.create({
      model: MODELS.openai,
      messages: toOpenAiMessages(system, messages),
      max_completion_tokens: maxTokens,
      stream: true,
    } as any);
    for await (const chunk of s as any) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) yield delta as string;
    }
    return;
  }

  const s = await anthropicCall((model) =>
    anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: toAnthropicMessages(messages),
      stream: true,
    }),
  );
  for await (const event of s as any) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      yield event.delta.text as string;
    }
  }
}

/* ---------------------------------------------------------------------- JSON */

/** Robustes JSON-Parsing für LLM-Antworten. */
export function parseJson<T>(text: string, fallback: T): T {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return fallback;
  const candidate = cleaned.slice(start);
  for (let end = candidate.length; end > 1; end--) {
    try {
      return JSON.parse(candidate.slice(0, end)) as T;
    } catch {
      /* weiter kürzen */
    }
  }
  return fallback;
}

export async function completeJson<T>(system: string, prompt: string, fallback: T, maxTokens = 1400): Promise<T> {
  const text = await complete(system, [{ role: "user", content: prompt }], maxTokens);
  return parseJson<T>(text, fallback);
}

export async function visionJson<T>(
  system: string,
  prompt: string,
  images: ImageInput[],
  fallback: T,
  maxTokens = 1800,
): Promise<T> {
  const text = await visionComplete(system, [{ role: "user", content: prompt }], images, maxTokens);
  return parseJson<T>(text, fallback);
}

/** Kurzer, echter Testaufruf für die Integrationsseite. */
export async function testProvider(): Promise<{ ok: boolean; nachricht: string }> {
  const provider = activeProvider();
  if (!provider) return { ok: false, nachricht: "Kein KI-Anbieter konfiguriert." };
  try {
    const text = await complete("Antworte mit genau einem Wort: OK", [{ role: "user", content: "Testlauf" }], 20);
    return { ok: true, nachricht: `${provider} (${modelFor(provider)}) antwortet: ${text.slice(0, 40) || "OK"}` };
  } catch (e: any) {
    return { ok: false, nachricht: `${provider}: ${String(e?.message || e).slice(0, 200)}` };
  }
}
