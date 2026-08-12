import { db } from "./db";
import { memories } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { complete, parseJson, llmConfigured } from "./llm";
import { syncMemory } from "./supabase";

const STOP = new Set(
  "der die das und oder aber ich du er sie es wir ihr mit für von auf in im am ist sind war bin bist hat habe haben ein eine einen einem eines dem den des zu zum zur nicht kein keine als auch noch nur mal so wie was wer wann warum dass weil wenn dann mich mir dich dir sich uns euch dass's".split(
    /\s+/,
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** TF-IDF-artiges Keyword-Scoring — kein externer Embedding-Dienst nötig. */
export function retrieveMemories(userId: number, query: string, limit = 6) {
  const all = db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.createdAt))
    .all();
  if (all.length === 0) return [];
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return all.slice(0, limit);

  const docTokens = all.map((m) => tokenize(m.text));
  const df = new Map<string, number>();
  docTokens.forEach((tokens) => {
    new Set(tokens).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  });

  const scored = all.map((m, i) => {
    const tokens = docTokens[i];
    let score = 0;
    qTokens.forEach((q) => {
      const tf = tokens.filter((t) => t === q || t.startsWith(q.slice(0, 4))).length;
      if (tf > 0) {
        const idf = Math.log(1 + all.length / (1 + (df.get(q) || 0)));
        score += (tf / tokens.length) * idf;
      }
    });
    score += m.importance * 0.02;
    return { m, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}

export function addMemory(userId: number, text: string, kind = "fakt", importance = 3) {
  const existing = db.select().from(memories).where(eq(memories.userId, userId)).all();
  const norm = text.trim().toLowerCase();
  if (!norm) return null;
  if (existing.some((m) => m.text.trim().toLowerCase() === norm)) return null;
  const row = db
    .insert(memories)
    .values({
      userId,
      text: text.trim(),
      kind,
      importance,
      embedding: JSON.stringify(tokenize(text).slice(0, 24)),
      createdAt: Date.now(),
    })
    .returning()
    .get();
  void syncMemory(row);
  return row;
}

/** Zweiter, kurzer LLM-Call: extrahiert 0–3 dauerhafte Fakten über den Nutzer. */
export async function extractMemories(userId: number, userText: string, assistantText: string) {
  if (!llmConfigured()) return [];
  try {
    const out = await complete(
      "Du extrahierst dauerhafte Fakten über den Nutzer aus einem Dialog. Antworte AUSSCHLIESSLICH mit JSON-Array. " +
        'Format: [{"text":"kurzer Fakt auf Deutsch","kind":"fakt|vorliebe|ziel|person|routine","importance":1-5}]. ' +
        "Nur wirklich dauerhafte, nützliche Informationen über den Nutzer. Keine Smalltalk-Inhalte. Maximal 3 Einträge. Leeres Array wenn nichts Relevantes.",
      [{ role: "user", content: `Nutzer: ${userText}\n\nAssistent: ${assistantText}` }],
      400,
    );
    const facts = parseJson<{ text: string; kind?: string; importance?: number }[]>(out, []);
    const saved = facts
      .slice(0, 3)
      .map((f) => addMemory(userId, f.text, f.kind || "fakt", Math.min(5, Math.max(1, f.importance || 3))))
      .filter(Boolean);
    return saved;
  } catch {
    return [];
  }
}
