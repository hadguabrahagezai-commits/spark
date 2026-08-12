import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { storage, today, rankFor, RANKS } from "./storage";
import { complete, completeJson, stream, llmConfigured, currentModel, providerStatus, visionJson } from "./llm";
import type { ImageInput } from "./llm";
import { retrieveMemories, extractMemories, addMemory } from "./memory";
import { supabaseEnabled, supabaseStatus, syncEvent } from "./supabase";
import { elevenConfigured } from "./voice";
import { avatarStatus, heygenConfigured } from "./avatar";
import { bankingStatus, parseCsv, plaidConfigured } from "./banking";
import { googleConfigured, mapsConfigured, googleStatus, calendarEvents, gmailSummary } from "./google";
import { registerLiveRoutes } from "./live";
import { raw } from "./db";
import { PERSONALITIES, SUBJECTS } from "@shared/schema";
import type { User } from "@shared/schema";

type AuthedRequest = Request & { user?: User };

function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? storage.getUserByToken(token) : undefined;
  if (!user) return res.status(401).json({ message: "Nicht angemeldet." });
  req.user = user;
  next();
}

function personaPrompt(userId: number, extra = "") {
  const c = storage.getCompanion(userId);
  const s = storage.getSettings(userId);
  const user = storage.getUser(userId)!;
  const stats = storage.getStats(userId);
  const p = PERSONALITIES.find((x) => x.id === c.personality) || PERSONALITIES[0];
  const tone = [
    c.directness < 40 ? "Formuliere sehr direkt und ohne Umschweife." : c.directness > 60 ? "Formuliere sanft, behutsam und einladend." : "Formuliere ausgewogen zwischen direkt und sanft.",
    c.verbosity < 40 ? "Antworte sehr knapp, höchstens 3 Sätze." : c.verbosity > 60 ? "Antworte ausführlich mit Beispielen und Struktur." : "Antworte in mittlerer Länge.",
    c.humor < 30 ? "Bleibe ernst und sachlich." : c.humor > 65 ? "Nutze trockenen, freundlichen Humor." : "Erlaube dir gelegentlich einen leichten Scherz.",
  ].join(" ");
  const tasks = storage.listTasks(userId, today()).filter((t) => !t.done);
  const due = storage.listDueCards(userId).length;
  return [
    `Du bist ${c.name}, der persönliche KI-Copilot der App SPARK. Du sprichst ausschließlich Deutsch.`,
    `Deine Rolle: ${p.name} — ${p.desc}`,
    tone,
    `Nutzer: ${user.name || "unbekannter Name"} (Ziel: ${user.goal}). Energielevel heute: ${s.energy}.`,
    `Streak: ${stats.streak} Tage, Rang ${stats.rank}, ${stats.totalXp} XP. Fällige Wiederholungskarten: ${due}.`,
    tasks.length ? `Offene Aufgaben heute: ${tasks.map((t) => t.title).join("; ")}.` : "Heute sind keine Aufgaben offen.",
    extra,
    "Beende jede Antwort mit einer eigenen letzten Zeile im Format [mood: freudig|neutral|nachdenklich|besorgt] — sie wird vom UI entfernt und steuert den Avatar.",
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanTitle(raw: string) {
  return (
    raw
      .split("\n")[0]
      .replace(/[*_`#"]/g, "")
      .split(/(?<=[.!?])\s/)[0]
      .trim()
      .slice(0, 42) || "Neuer Chat"
  );
}

function splitMood(text: string) {
  const match = text.match(/\[mood:\s*(freudig|neutral|nachdenklich|besorgt)\s*\]/i);
  const mood = match ? match[1].toLowerCase() : "neutral";
  return { content: text.replace(/\[mood:[^\]]*\]/gi, "").trim(), mood };
}

function llmError(res: Response, e: unknown) {
  const msg = String((e as any)?.message || e);
  return res.status(502).json({ message: `KI-Dienst nicht erreichbar: ${msg}` });
}


/** Echte Kalender-/Mail-Daten für die „Heute“-Seite — ohne Verbindung ehrlich leer. */
async function heutigeGoogleDaten(userId: number) {
  const status = googleStatus(userId);
  if (!status.verbunden) {
    return {
      verbunden: false,
      konfiguriert: status.konfiguriert,
      hinweis: status.nachricht,
      termine: [] as any[],
      ungelesen: 0,
      mails: [] as any[],
    };
  }
  const cal = await calendarEvents(userId, 1);
  const mail = await gmailSummary(userId);
  return {
    verbunden: true,
    konfiguriert: true,
    hinweis: status.nachricht,
    termine: "ok" in cal && cal.ok ? cal.termine : [],
    kalenderFehler: "ok" in cal && !cal.ok ? cal.nachricht : "",
    ungelesen: "ok" in mail && mail.ok ? mail.ungelesen : 0,
    mails: "ok" in mail && mail.ok ? mail.mails.slice(0, 5) : [],
    mailFehler: "ok" in mail && !mail.ok ? mail.nachricht : "",
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /* ------------------------------------------------------------------ Status */

  // Health-Check für Railway/Render. Bewusst schlank: prüft nur, ob der Prozess
  // steht und die Datenbank antwortet — keine externen Dienste, damit ein
  // ausgefallener Fremdanbieter nicht den ganzen Container neu starten lässt.
  app.get("/api/health", (_req, res) => {
    try {
      raw.prepare("select 1").get();
      res.json({ status: "ok", uptime: Math.round(process.uptime()) });
    } catch (fehler) {
      res.status(503).json({
        status: "datenbank-fehler",
        message: fehler instanceof Error ? fehler.message : String(fehler),
      });
    }
  });

  app.get("/api/config", async (_req, res) => {
    const ki = providerStatus();
    res.json({
      llm: { configured: llmConfigured(), model: currentModel(), anbieter: ki.aktiv, alle: ki.anbieter },
      google: {
        configured: googleConfigured(),
        scopes: ["gmail.readonly", "gmail.send", "calendar", "drive.readonly", "youtube.readonly", "tasks"],
      },
      supabase: { configured: supabaseEnabled() },
      elevenlabs: { configured: elevenConfigured() },
      banking: bankingStatus(),
      avatar: avatarStatus(),
      avatarApi: { configured: heygenConfigured() },
      maps: { configured: mapsConfigured() },
    });
  });

  app.get("/api/config/supabase", async (_req, res) => res.json(await supabaseStatus()));

  /* -------------------------------------------------------------------- Auth */
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body || {};
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ message: "Bitte eine gültige E-Mail-Adresse eingeben." });
    if (typeof password !== "string" || password.length < 8)
      return res.status(400).json({ message: "Das Passwort braucht mindestens 8 Zeichen." });
    if (storage.getUserByEmail(email)) return res.status(409).json({ message: "Diese E-Mail ist bereits registriert." });
    const user = storage.createUser(email, bcrypt.hashSync(password, 10), typeof name === "string" ? name : "");
    storage.ensureLeaderboardEntry(user);
    const token = storage.createSession(user.id);
    void syncEvent(user.id, "registrierung", { email: user.email });
    res.json({ token, user: { ...user, password: undefined } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    const user = typeof email === "string" ? storage.getUserByEmail(email) : undefined;
    if (!user || typeof password !== "string" || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ message: "E-Mail oder Passwort stimmt nicht." });
    storage.ensureLeaderboardEntry(user);
    const token = storage.createSession(user.id);
    res.json({ token, user: { ...user, password: undefined } });
  });

  app.post("/api/auth/logout", auth, async (req: AuthedRequest, res) => {
    const token = (req.headers.authorization || "").slice(7);
    storage.deleteSession(token);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", auth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    res.json({
      user: { ...user, password: undefined },
      companion: storage.getCompanion(user.id),
      settings: storage.getSettings(user.id),
      stats: storage.getStats(user.id),
    });
  });

  app.patch("/api/auth/password", auth, async (req: AuthedRequest, res) => {
    const { current, next } = req.body || {};
    const user = req.user!;
    if (!bcrypt.compareSync(String(current || ""), user.password))
      return res.status(400).json({ message: "Aktuelles Passwort stimmt nicht." });
    if (String(next || "").length < 8) return res.status(400).json({ message: "Neues Passwort braucht mindestens 8 Zeichen." });
    storage.updateUser(user.id, { password: bcrypt.hashSync(String(next), 10) });
    res.json({ ok: true });
  });

  /* ------------------------------------------------- Profil / Einstellungen */
  app.patch("/api/user", auth, async (req: AuthedRequest, res) => {
    const { name, goal, theme, onboarded } = req.body || {};
    const patch: any = {};
    if (typeof name === "string") patch.name = name;
    if (typeof goal === "string") patch.goal = goal;
    if (typeof theme === "string") patch.theme = theme;
    if (typeof onboarded === "number" || typeof onboarded === "boolean") patch.onboarded = onboarded ? 1 : 0;
    const user = storage.updateUser(req.user!.id, patch);
    res.json({ ...user, password: undefined });
  });

  app.patch("/api/companion", auth, async (req: AuthedRequest, res) => {
    const allowed = ["name","preset","style","skin","hair","hairstyle","eyes","outfit","personality","directness","verbosity","humor","voiceName","voiceRate","voicePitch","voiceVolume","voiceConsent","voiceProfile","voiceProvider","voiceId","voiceStability","voiceSimilarity","voiceStyle","avatarMode","liveAvatarId","liveAvatarName"];
    const patch: any = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    res.json(storage.updateCompanion(req.user!.id, patch));
  });

  app.patch("/api/settings", auth, async (req: AuthedRequest, res) => {
    const allowed = ["reducedMotion","textScale","highContrast","notifyDaily","notifyStreak","notifyReview","notifyMissions","language","region","plan","energy"];
    const patch: any = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    res.json(storage.updateSettings(req.user!.id, patch));
  });

  /* -------------------------------------------------------------- Chats */
  app.get("/api/chats", auth, (req: AuthedRequest, res) => {
    const list = storage.listChats(req.user!.id).map((c) => {
      const msgs = storage.listMessages(c.id);
      return { ...c, preview: msgs.length ? msgs[msgs.length - 1].content.slice(0, 90) : "", count: msgs.length };
    });
    res.json(list);
  });

  app.post("/api/chats", auth, (req: AuthedRequest, res) => {
    res.json(storage.createChat(req.user!.id, req.body?.title || "Neuer Chat"));
  });

  app.get("/api/chats/:id/messages", auth, (req: AuthedRequest, res) => {
    const chat = storage.getChat(Number(req.params.id));
    if (!chat || chat.userId !== req.user!.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    res.json(storage.listMessages(chat.id));
  });

  app.patch("/api/chats/:id", auth, (req: AuthedRequest, res) => {
    const chat = storage.getChat(Number(req.params.id));
    if (!chat || chat.userId !== req.user!.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    const patch: any = {};
    if (typeof req.body?.title === "string") patch.title = req.body.title;
    if (typeof req.body?.pinned === "number") patch.pinned = req.body.pinned;
    res.json(storage.updateChat(chat.id, patch));
  });

  app.delete("/api/chats/:id", auth, (req: AuthedRequest, res) => {
    const chat = storage.getChat(Number(req.params.id));
    if (!chat || chat.userId !== req.user!.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    storage.deleteChat(chat.id);
    res.json({ ok: true });
  });

  app.patch("/api/messages/:id/rating", auth, (req: AuthedRequest, res) => {
    res.json(storage.updateMessage(Number(req.params.id), { rating: Number(req.body?.rating || 0) }));
  });

  /* ------------------------------------------------------- Chat-Streaming */
  app.post("/api/chat", auth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    const chatId = Number(req.body?.chatId);
    const text = String(req.body?.message || "").trim();
    const attachment = String(req.body?.attachment || "");
    const regenerate = Boolean(req.body?.regenerate);
    const chat = storage.getChat(chatId);
    if (!chat || chat.userId !== user.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    if (!llmConfigured())
      return res.status(503).json({ message: "Kein KI-Zugang konfiguriert. Der Chat benötigt einen LLM-Schlüssel in der Server-Umgebung." });

    if (!regenerate) {
      if (!text && !attachment) return res.status(400).json({ message: "Leere Nachricht." });
      storage.addMessage(chatId, "user", text, "neutral", attachment);
    }

    const history = storage.listMessages(chatId).filter((m) => m.role !== "system");
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const hits = retrieveMemories(user.id, lastUser?.content || text, 6);
    const memoryBlock = hits.length
      ? `Langzeitgedächtnis über den Nutzer:\n${hits.map((m) => `- ${m.text}`).join("\n")}`
      : "Langzeitgedächtnis: noch keine passenden Einträge.";
    const system = personaPrompt(user.id, memoryBlock + (attachment ? `\nDer Nutzer hat einen Anhang beschrieben: ${attachment}` : ""));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let full = "";
    try {
      const msgs = history.slice(-16).map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content || "(Anhang)" }));
      for await (const delta of stream(system, msgs)) {
        full += delta;
        const visible = delta.replace(/\[mood:[^\]]*\]/gi, "");
        if (visible) res.write(`data: ${JSON.stringify({ delta: visible })}\n\n`);
      }
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ error: `KI-Dienst nicht erreichbar: ${e?.message || e}` })}\n\n`);
      return res.end();
    }

    const { content, mood } = splitMood(full);
    const saved = storage.addMessage(chatId, "assistant", content, mood);
    storage.addXp(user.id, 5, "Chat");
    res.write(`data: ${JSON.stringify({ done: true, mood, messageId: saved.id })}\n\n`);
    res.end();

    void extractMemories(user.id, lastUser?.content || text, content);
    if (storage.getChat(chatId)?.title === "Neuer Chat") {
      try {
        const title = await complete(
          "Erzeuge AUSSCHLIESSLICH einen kurzen deutschen Chat-Titel: maximal 4 Wörter, keine Anführungszeichen, keine Emojis, keine Erklärung, keine Begrüßung.",
          [{ role: "user", content: (lastUser?.content || text).slice(0, 400) }],
          40,
        );
        storage.updateChat(chatId, { title: cleanTitle(title) || "Neuer Chat" });
      } catch { /* Titel bleibt */ }
    }
  });

  app.post("/api/chat/title", auth, async (req: AuthedRequest, res) => {
    const chatId = Number(req.body?.chatId);
    const chat = storage.getChat(chatId);
    if (!chat || chat.userId !== req.user!.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    const msgs = storage.listMessages(chatId);
    if (!msgs.length) return res.json(chat);
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert." });
    try {
      const title = await complete(
        "Erzeuge AUSSCHLIESSLICH einen kurzen deutschen Chat-Titel: maximal 4 Wörter, keine Anführungszeichen, keine Emojis, keine Erklärung.",
        [{ role: "user", content: msgs.slice(0, 4).map((m) => m.content).join("\n").slice(0, 600) }],
        40,
      );
      res.json(storage.updateChat(chatId, { title: cleanTitle(title) }));
    } catch (e) { llmError(res, e); }
  });

  app.post("/api/chat/regenerate", auth, async (req: AuthedRequest, res) => {
    const chatId = Number(req.body?.chatId);
    const chat = storage.getChat(chatId);
    if (!chat || chat.userId !== req.user!.id) return res.status(404).json({ message: "Chat nicht gefunden." });
    const msgs = storage.listMessages(chatId);
    const last = msgs[msgs.length - 1];
    if (last?.role === "assistant") storage.deleteMessagesFrom(chatId, last.id);
    res.json({ ok: true });
  });

  /* ---------------------------------------------------------- Gedächtnis */
  app.get("/api/memories", auth, (req: AuthedRequest, res) => res.json(storage.listMemories(req.user!.id)));
  app.post("/api/memories", auth, (req: AuthedRequest, res) => {
    const m = addMemory(req.user!.id, String(req.body?.text || ""), String(req.body?.kind || "fakt"), Number(req.body?.importance || 3));
    res.json(m || { message: "Eintrag existiert bereits." });
  });
  app.delete("/api/memories/:id", auth, (req: AuthedRequest, res) => {
    storage.deleteMemory(req.user!.id, Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete("/api/memories", auth, (req: AuthedRequest, res) => {
    storage.clearMemories(req.user!.id);
    res.json({ ok: true });
  });

  /* --------------------------------------------------------------- Genius */
  app.get("/api/subjects", auth, (req: AuthedRequest, res) => {
    const levels = storage.ensureLevels(req.user!.id);
    res.json(
      SUBJECTS.map((s) => {
        const own = levels.filter((l) => l.subjectSlug === s.slug);
        const done = own.filter((l) => l.status === "geschafft").length;
        return { ...s, levels: own.sort((a, b) => a.stage - b.stage), progress: Math.round((done / 6) * 100) };
      }),
    );
  });

  app.post("/api/quiz/generate", auth, async (req: AuthedRequest, res) => {
    const subject = String(req.body?.subject || "allgemein");
    const stage = Number(req.body?.stage || 1);
    const count = Math.min(Number(req.body?.count || 3), 6);
    const meta = SUBJECTS.find((s) => s.slug === subject) || SUBJECTS[7];
    const cached = storage.cachedQuestions(subject, stage);
    if (cached.length >= count) {
      const shuffled = [...cached].sort(() => Math.random() - 0.5).slice(0, count);
      return res.json(shuffled.map((q) => ({ ...q, options: JSON.parse(q.options) })));
    }
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert — Quizfragen können nicht erzeugt werden." });
    try {
      const data = await completeJson<any[]>(
        "Du erstellst deutschsprachige Quizfragen. Antworte ausschließlich mit JSON-Array.",
        `Erzeuge ${count} Quizfragen für das Fach ${meta.name}, Schwierigkeitsstufe ${stage} von 6.
Format je Eintrag: {"scenario":"1 Satz Alltagsszenario","question":"Frage","options":["A","B","C","D"],"correct":0,"hint":"kurzer Tipp","explanation":"kurze Erklärung"}.
correct ist der Index der richtigen Option. Deutsch, korrekt, abwechslungsreich.`,
        [],
        2000,
      );
      const saved = data
        .filter((q) => q && Array.isArray(q.options) && q.options.length === 4)
        .map((q) =>
          storage.saveQuestion({
            subjectSlug: subject, stage,
            scenario: String(q.scenario || ""), question: String(q.question || ""),
            options: JSON.stringify(q.options.map(String)), correct: Number(q.correct) || 0,
            hint: String(q.hint || ""), explanation: String(q.explanation || ""), source: "llm",
          }),
        );
      if (!saved.length) return res.status(502).json({ message: "Die KI lieferte keine verwertbaren Fragen. Bitte erneut versuchen." });
      res.json(saved.map((q) => ({ ...q, options: JSON.parse(q.options) })));
    } catch (e) { llmError(res, e); }
  });

  app.post("/api/quiz/answer", auth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const q = storage.getQuestion(Number(req.body?.questionId));
    if (!q) return res.status(404).json({ message: "Frage nicht gefunden." });
    const correct = Number(req.body?.answer) === q.correct;
    if (correct) storage.addXp(user.id, 20, `Quiz ${q.subjectSlug}`);
    storage.addCard(user.id, q.id, q.subjectSlug, q.question, JSON.parse(q.options)[q.correct] + (q.explanation ? ` — ${q.explanation}` : ""));
    res.json({ correct, explanation: q.explanation, richtigeOption: JSON.parse(q.options)[q.correct], stats: storage.getStats(user.id) });
  });

  app.post("/api/quiz/explain", auth, async (req: AuthedRequest, res) => {
    const level = String(req.body?.level || "normal");
    const question = String(req.body?.question || "");
    const answer = String(req.body?.answer || "");
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert." });
    const styles: Record<string, string> = {
      eli5: "Erkläre es so, dass ein 8-jähriges Kind es versteht. Maximal 4 Sätze, ein Alltagsbild.",
      normal: "Erkläre es klar und verständlich in 4-6 Sätzen.",
      experte: "Erkläre es fachlich präzise mit Fachbegriffen und Kontext, 6-8 Sätze.",
    };
    try {
      const text = await complete(
        `Du erklärst auf Deutsch. ${styles[level] || styles.normal} Nutze reinen Fließtext ohne Überschriften.`,
        [{ role: "user", content: `Frage: ${question}\nRichtige Antwort: ${answer}` }],
        700,
      );
      res.json({ text });
    } catch (e) { llmError(res, e); }
  });

  app.post("/api/quiz/scan", auth, async (req: AuthedRequest, res) => {
    const description = String(req.body?.text || "").slice(0, 4000);
    // Bild als data:-URL oder reines Base64 — wird direkt an das Vision-Modell gereicht.
    const bildRoh = String(req.body?.image || "");
    const bilder: ImageInput[] = [];
    if (bildRoh) {
      const match = bildRoh.match(/^data:([^;]+);base64,(.*)$/);
      bilder.push(
        match
          ? { mimeType: match[1], base64: match[2] }
          : { mimeType: String(req.body?.mimeType || "image/jpeg"), base64: bildRoh },
      );
    }
    if (!description && !bilder.length)
      return res.status(400).json({ message: "Kein Material erkannt. Bitte ein Foto hochladen oder Text einfügen." });
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert." });
    try {
      const data = await visionJson<any[]>(
        "Du erstellst deutschsprachige Quizfragen aus Lernmaterial. Antworte ausschließlich mit JSON-Array.",
        `Erzeuge 3 Quizfragen aus diesem Material${bilder.length ? " (siehe angehängtes Foto)" : ""}:\n${description}\nFormat: {"scenario":"","question":"","options":["","","",""],"correct":0,"hint":"","explanation":""}`,
        bilder,
        [],
        1800,
      );
      const saved = data
        .filter((q) => q && Array.isArray(q.options) && q.options.length === 4)
        .map((q) =>
          storage.saveQuestion({
            subjectSlug: "allgemein", stage: 1, scenario: String(q.scenario || ""), question: String(q.question || ""),
            options: JSON.stringify(q.options.map(String)), correct: Number(q.correct) || 0,
            hint: String(q.hint || ""), explanation: String(q.explanation || ""), source: "scan",
          }),
        );
      if (!saved.length) return res.status(502).json({ message: "Aus dem Material ließen sich keine Fragen erzeugen." });
      res.json(saved.map((q) => ({ ...q, options: JSON.parse(q.options) })));
    } catch (e) { llmError(res, e); }
  });

  app.post("/api/level/complete", auth, (req: AuthedRequest, res) => {
    const { subject, stage, score } = req.body || {};
    const levels = storage.completeLevel(req.user!.id, String(subject), Number(stage), Number(score || 0));
    storage.addXp(req.user!.id, 40, `Level ${stage} in ${subject}`);
    res.json(levels);
  });

  app.post("/api/focus/session", auth, (req: AuthedRequest, res) => {
    const minutes = Math.max(1, Math.min(120, Number(req.body?.minutes || 5)));
    storage.addMinutes(req.user!.id, minutes);
    storage.addXp(req.user!.id, minutes * 2, `Fokus ${minutes} Min`);
    res.json(storage.getStats(req.user!.id));
  });

  /* ------------------------------------------------------------ Live-Quiz */
  app.get("/api/live/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.flushHeaders?.();
    const names = ["Mira", "Jonas", "Alina", "Ben", "Yusuf", "Lea", "Nora", "Timo"];
    const players = names.map((n) => ({ name: n, xp: Math.floor(Math.random() * 40) }));
    let countdown = 20;
    const tick = setInterval(() => {
      countdown = countdown > 0 ? countdown - 1 : 0;
      players.forEach((p) => { if (Math.random() > 0.55) p.xp += Math.floor(Math.random() * 25); });
      const payload = {
        countdown,
        teilnehmer: players.length + 1,
        rangliste: [...players].sort((a, b) => b.xp - a.xp),
        hinweis: "Mitspieler-Werte werden serverseitig simuliert — dies ist kein echtes Mehrspieler-Netzwerk.",
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 1000);
    req.on("close", () => clearInterval(tick));
  });

  /* ------------------------------------------------------------ Missionen */
  app.get("/api/missions", auth, (req: AuthedRequest, res) => res.json(storage.listMissions(req.user!.id)));
  app.post("/api/missions/step/:id", auth, (req: AuthedRequest, res) => {
    const ok = storage.toggleStep(req.user!.id, Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Schritt nicht gefunden." });
    res.json({ missions: storage.listMissions(req.user!.id), stats: storage.getStats(req.user!.id) });
  });
  app.delete("/api/missions/:id", auth, (req: AuthedRequest, res) => {
    storage.deleteMission(req.user!.id, Number(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/missions/generate", auth, async (req: AuthedRequest, res) => {
    const wish = String(req.body?.wish || "").slice(0, 500);
    if (!wish) return res.status(400).json({ message: "Bitte beschreibe dein Ziel." });
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert." });
    try {
      const data = await completeJson<any>(
        "Du entwirfst mehrstufige Alltagsmissionen auf Deutsch. Antworte ausschließlich mit JSON-Objekt.",
        `Ziel des Nutzers: ${wish}
Format: {"title":"kurz","description":"1 Satz","category":"alltag|finanzen|gesundheit|karriere|reise|lernen","xpReward":120-320,"collectible":"optionaler Sammelkartenname","steps":[{"title":"Schritt","kind":"todo|lektion|finanzen|chat"}]}
5 bis 7 Schritte, davon mindestens einer vom Typ "lektion".`,
        null,
        1400,
      );
      if (!data?.title || !Array.isArray(data?.steps)) return res.status(502).json({ message: "Die KI lieferte keine verwertbare Mission." });
      storage.createMission(req.user!.id, data, data.steps.map((s: any) => ({ title: String(s.title), kind: String(s.kind || "todo") })));
      res.json(storage.listMissions(req.user!.id));
    } catch (e) { llmError(res, e); }
  });

  /* --------------------------------------------------------- Wiederholung */
  app.get("/api/review", auth, (req: AuthedRequest, res) =>
    res.json({ faellig: storage.listDueCards(req.user!.id), alle: storage.listCards(req.user!.id) }));
  app.post("/api/review/:id/grade", auth, (req: AuthedRequest, res) => {
    const quality = Number(req.body?.quality);
    const card = storage.gradeCard(req.user!.id, Number(req.params.id), quality);
    if (!card) return res.status(404).json({ message: "Karte nicht gefunden." });
    if (quality >= 3) storage.addXp(req.user!.id, 10, "Wiederholung");
    res.json({ card, faellig: storage.listDueCards(req.user!.id) });
  });

  /* ----------------------------------------------------------- Bestenliste */
  app.get("/api/leaderboard", auth, (req: AuthedRequest, res) => {
    const scope = String(req.query.scope || "global");
    storage.ensureLeaderboardEntry(req.user!);
    const entries = storage.listLeaderboard(scope, req.user!.id);
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);
    res.json({ entries, resetAt: nextMonday.getTime(), ownUserId: req.user!.id });
  });

  /* -------------------------------------------------------------- Aufgaben */
  app.get("/api/tasks", auth, (req: AuthedRequest, res) => res.json(storage.listTasks(req.user!.id)));
  app.post("/api/tasks", auth, (req: AuthedRequest, res) =>
    res.json(storage.addTask(req.user!.id, String(req.body?.title || "Aufgabe"), String(req.body?.target || "todo"), Number(req.body?.priority || 2))));
  app.post("/api/tasks/:id/toggle", auth, (req: AuthedRequest, res) => {
    const t = storage.toggleTask(req.user!.id, Number(req.params.id));
    if (!t) return res.status(404).json({ message: "Aufgabe nicht gefunden." });
    res.json({ task: t, stats: storage.getStats(req.user!.id) });
  });
  app.delete("/api/tasks/:id", auth, (req: AuthedRequest, res) => {
    storage.deleteTask(req.user!.id, Number(req.params.id));
    res.json({ ok: true });
  });

  /* ----------------------------------------------------------- Heute-Seite */
  app.get("/api/today", auth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    const stats = storage.getStats(user.id);
    const tasks = storage.listTasks(user.id, today());
    const due = storage.listDueCards(user.id);
    const settings = storage.getSettings(user.id);
    const subs = storage.listSubscriptions(user.id);
    const unused = subs.filter((s) => /Monat|Woche/i.test(s.lastUsed) && !/heute|Tag/i.test(s.lastUsed));
    res.json({
      stats, tasks, faelligeKarten: due.length, energie: settings.energy,
      sparpotenzial: Number(unused.reduce((a, b) => a + (b.cycle === "jährlich" ? b.amount / 12 : b.amount), 0).toFixed(2)),
      ungenutzteAbos: unused.length,
      missionen: storage.listMissions(user.id).filter((m) => m.status !== "geschafft").length,
      google: await heutigeGoogleDaten(user.id),
    });
  });

  app.post("/api/today/suggestion", auth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    const stats = storage.getStats(user.id);
    const settings = storage.getSettings(user.id);
    const tasks = storage.listTasks(user.id, today()).filter((t) => !t.done);
    const due = storage.listDueCards(user.id).length;
    const quellen = [
      `Energielevel: ${settings.energy}`,
      `Streak: ${stats.streak} Tage`,
      `Offene Aufgaben: ${tasks.length}`,
      `Fällige Wiederholungskarten: ${due}`,
      `Ungenutzte Abos: ${storage.listSubscriptions(user.id).filter((s) => /Monat/i.test(s.lastUsed)).length}`,
    ];

    /* Echte Google-Daten, sofern das Konto verbunden ist. */
    let terminZeile = "";
    let mailZeile = "";
    const gStatus = googleStatus(user.id);
    if (gStatus.verbunden) {
      const cal = await calendarEvents(user.id, 1);
      if ("ok" in cal && cal.ok) {
        terminZeile = cal.termine.length
          ? `Google Kalender: ${cal.termine
              .slice(0, 4)
              .map((t) => `${t.titel} (${new Date(t.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})`)
              .join(", ")}`
          : "Google Kalender: heute keine Termine";
        quellen.push(terminZeile);
      }
      const mail = await gmailSummary(user.id);
      if ("ok" in mail && mail.ok) {
        mailZeile = `Gmail: ${mail.ungelesen} ungelesene Nachricht(en) der letzten 24 h${
          mail.mails.length ? ` — z. B. „${mail.mails[0].betreff}“ von ${mail.mails[0].von}` : ""
        }`;
        quellen.push(mailZeile);
      }
    } else {
      quellen.push(
        gStatus.konfiguriert
          ? "Google: Konto nicht verbunden — Kalender und Mails fließen noch nicht ein"
          : "Google: nicht konfiguriert — Kalender und Mails fließen nicht ein",
      );
    }
    if (!llmConfigured()) {
      return res.json({
        vorschlag:
          tasks.length > 0
            ? `Starte mit „${tasks[0].title}“ — das passt zu deinem Energielevel ${settings.energy}.`
            : due > 0
              ? `${due} Karten warten auf Wiederholung. 5 Minuten reichen.`
              : "Leg eine kleine Aufgabe fest und mach den ersten Schritt.",
        quellen,
        schnellantworten: ["Klingt gut", "Lieber etwas anderes", "Zeig mir Details"],
        hinweis: "Ohne KI-Zugang zeigt SPARK eine regelbasierte Empfehlung.",
      });
    }
    try {
      const text = await complete(
        personaPrompt(user.id, "Formuliere GENAU EINEN proaktiven Tagesvorschlag, maximal 2 Sätze. Kein Mood-Tag nötig."),
        [{ role: "user", content: `Datenlage: ${quellen.join(", ")}. Was soll ich heute zuerst tun?` }],
        200,
      );
      res.json({
        vorschlag: splitMood(text).content,
        quellen,
        schnellantworten: ["Los geht's", "Später", "Anderer Vorschlag"],
      });
    } catch (e) { llmError(res, e); }
  });

  /* ------------------------------------------------------------ Chaos-Modus */
  app.post("/api/chaos/sort", auth, async (req: AuthedRequest, res) => {
    const text = String(req.body?.text || "").slice(0, 4000);
    if (!text.trim()) return res.status(400).json({ message: "Bitte zuerst etwas sprechen oder tippen." });
    if (!llmConfigured()) return res.status(503).json({ message: "Kein KI-Zugang konfiguriert — die Sortierung braucht die KI." });
    try {
      const data = await completeJson<any[]>(
        "Du zerlegst wirre Gedanken in klare Einzelaufgaben. Antworte ausschließlich mit JSON-Array auf Deutsch.",
        `Text: ${text}
Format je Eintrag: {"title":"klare Aufgabe","target":"kalender|erinnerung|lektion|todo","priority":1-3,"begruendung":"kurz"}
priority 1 = zuerst. Maximal 8 Einträge.`,
        [],
        1200,
      );
      res.json(data.slice(0, 8));
    } catch (e) { llmError(res, e); }
  });

  app.post("/api/chaos/apply", auth, (req: AuthedRequest, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    items.forEach((i: any) => storage.addTask(req.user!.id, String(i.title), String(i.target || "todo"), Number(i.priority || 2)));
    storage.addXp(req.user!.id, 10, "Kopf geleert");
    res.json(storage.listTasks(req.user!.id, today()));
  });

  /* -------------------------------------------------------------- Finanzen */
  app.get("/api/subscriptions", auth, (req: AuthedRequest, res) => {
    const subs = storage.listSubscriptions(req.user!.id);
    const monthly = subs.filter((s) => s.active).reduce((a, b) => a + (b.cycle === "jährlich" ? b.amount / 12 : b.amount), 0);
    const doppelte: string[] = [];
    const byCat = new Map<string, number>();
    subs.forEach((s) => byCat.set(s.category, (byCat.get(s.category) || 0) + 1));
    byCat.forEach((n, cat) => { if (n > 1) doppelte.push(cat); });
    res.json({
      subs,
      monatlich: Number(monthly.toFixed(2)),
      jaehrlich: Number((monthly * 12).toFixed(2)),
      doppelteKategorien: doppelte,
      banking: bankingStatus(req.user!.id),
    });
  });
  app.post("/api/subscriptions", auth, (req: AuthedRequest, res) => res.json(storage.addSubscription(req.user!.id, req.body || {})));
  app.patch("/api/subscriptions/:id", auth, (req: AuthedRequest, res) => res.json(storage.updateSubscription(req.user!.id, Number(req.params.id), req.body || {})));
  app.delete("/api/subscriptions/:id", auth, (req: AuthedRequest, res) => {
    storage.deleteSubscription(req.user!.id, Number(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/subscriptions/import", auth, (req: AuthedRequest, res) => {
    const rows = parseCsv(String(req.body?.csv || ""));
    rows.forEach((r) => storage.addSubscription(req.user!.id, { ...r, source: "csv" }));
    res.json({ importiert: rows.length });
  });

  /* --------------------------------------------------------------- Wrapped */
  app.get("/api/wrapped", auth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const stats = storage.getStats(user.id);
    const last7 = stats.days.slice(-7);
    const best = [...last7].sort((a, b) => b.xp - a.xp)[0];
    const subs = storage.listSubscriptions(user.id);
    const gespart = subs.filter((s) => !s.active).reduce((a, b) => a + (b.cycle === "jährlich" ? b.amount / 12 : b.amount), 0);
    res.json({
      lernminuten: last7.reduce((a, b) => a + b.minutes, 0),
      xp: last7.reduce((a, b) => a + b.xp, 0),
      aktiveTage: last7.filter((d) => d.xp > 0 || d.minutes > 0).length,
      geloesteAufgaben: storage.listTasks(user.id).filter((t) => t.done).length,
      gespartesGeld: Number(gespart.toFixed(2)),
      besterTag: best?.day || today(),
      besterTagGrund: best ? `${best.xp} XP und ${best.minutes} Fokusminuten an diesem Tag.` : "Noch keine Daten für diese Woche.",
      rang: stats.rank,
      streak: stats.streak,
    });
  });

  /* ------------------------------------------------------- Export & Löschen */
  app.get("/api/export", auth, (req: AuthedRequest, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="spark-export.json"');
    res.send(JSON.stringify(storage.exportAll(req.user!.id), null, 2));
  });

  app.delete("/api/account", auth, (req: AuthedRequest, res) => {
    storage.deleteUser(req.user!.id);
    res.json({ ok: true });
  });

  /* ----------------------------------------------------------------- Ränge */
  app.get("/api/ranks", (_req, res) => res.json({ ranks: RANKS, beispiel: rankFor(0) }));

  /* ---------------------------------------- Live-Dienste (Stimme, Avatar, Bank, Google) */
  registerLiveRoutes(app, auth as any);

  return httpServer;
}
