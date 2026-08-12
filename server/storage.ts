import { db, ensureSchema } from "./db";
import {
  users, sessions, companions, settings, chats, messages, memories, subjects, levels,
  quizQuestions, reviewCards, missions, missionSteps, subscriptions, tasks, streaks,
  xpEvents, SUBJECTS,
} from "@shared/schema";
import type {
  User, Companion, Settings, Chat, Message, Memory, Level, QuizQuestion, ReviewCard,
  Mission, MissionStep, Subscription, Task, Streak,
} from "@shared/schema";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

ensureSchema();

export const today = () => new Date().toISOString().slice(0, 10);
const now = () => Date.now();

export interface IStorage {
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  createUser(email: string, passwordHash: string, name: string): User;
  createSession(userId: number): string;
  getUserByToken(token: string): User | undefined;
  deleteSession(token: string): void;
}

class Storage implements IStorage {
  /* ---------- Nutzer & Sessions ---------- */
  getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  createUser(email: string, passwordHash: string, name = "") {
    const user = db
      .insert(users)
      .values({ email: email.toLowerCase(), password: passwordHash, name, createdAt: now() })
      .returning()
      .get();
    db.insert(companions).values({ userId: user.id }).run();
    db.insert(settings).values({ userId: user.id }).run();
    this.seedUserContent(user.id);
    return user;
  }
  updateUser(id: number, patch: Partial<User>) {
    db.update(users).set(patch).where(eq(users.id, id)).run();
    return this.getUser(id)!;
  }
  deleteUser(id: number) {
    for (const t of [chats, memories, levels, reviewCards, missions, subscriptions, tasks, streaks, xpEvents] as any[]) {
      db.delete(t).where(eq(t.userId, id)).run();
    }
    db.delete(companions).where(eq(companions.userId, id)).run();
    db.delete(settings).where(eq(settings.userId, id)).run();
    db.delete(sessions).where(eq(sessions.userId, id)).run();
    db.delete(users).where(eq(users.id, id)).run();
  }
  createSession(userId: number) {
    const token = randomBytes(32).toString("hex");
    db.insert(sessions).values({ token, userId, createdAt: now() }).run();
    return token;
  }
  getUserByToken(token: string) {
    const s = db.select().from(sessions).where(eq(sessions.token, token)).get();
    if (!s) return undefined;
    return this.getUser(s.userId);
  }
  deleteSession(token: string) {
    db.delete(sessions).where(eq(sessions.token, token)).run();
  }

  /* ---------- Companion & Einstellungen ---------- */
  getCompanion(userId: number): Companion {
    let c = db.select().from(companions).where(eq(companions.userId, userId)).get();
    if (!c) c = db.insert(companions).values({ userId }).returning().get();
    return c;
  }
  updateCompanion(userId: number, patch: Partial<Companion>) {
    this.getCompanion(userId);
    db.update(companions).set(patch).where(eq(companions.userId, userId)).run();
    return this.getCompanion(userId);
  }
  getSettings(userId: number): Settings {
    let s = db.select().from(settings).where(eq(settings.userId, userId)).get();
    if (!s) s = db.insert(settings).values({ userId }).returning().get();
    return s;
  }
  updateSettings(userId: number, patch: Partial<Settings>) {
    this.getSettings(userId);
    db.update(settings).set(patch).where(eq(settings.userId, userId)).run();
    return this.getSettings(userId);
  }

  /* ---------- Chats ---------- */
  listChats(userId: number): Chat[] {
    return db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.pinned), desc(chats.updatedAt))
      .all();
  }
  createChat(userId: number, title = "Neuer Chat") {
    return db.insert(chats).values({ userId, title, createdAt: now(), updatedAt: now() }).returning().get();
  }
  getChat(id: number) {
    return db.select().from(chats).where(eq(chats.id, id)).get();
  }
  updateChat(id: number, patch: Partial<Chat>) {
    db.update(chats).set({ ...patch, updatedAt: now() }).where(eq(chats.id, id)).run();
    return this.getChat(id)!;
  }
  deleteChat(id: number) {
    db.delete(messages).where(eq(messages.chatId, id)).run();
    db.delete(chats).where(eq(chats.id, id)).run();
  }
  listMessages(chatId: number): Message[] {
    return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.id)).all();
  }
  addMessage(chatId: number, role: string, content: string, mood = "neutral", attachment = "") {
    const m = db
      .insert(messages)
      .values({ chatId, role, content, mood, attachment, createdAt: now() })
      .returning()
      .get();
    db.update(chats).set({ updatedAt: now() }).where(eq(chats.id, chatId)).run();
    return m;
  }
  updateMessage(id: number, patch: Partial<Message>) {
    db.update(messages).set(patch).where(eq(messages.id, id)).run();
    return db.select().from(messages).where(eq(messages.id, id)).get()!;
  }
  deleteMessagesFrom(chatId: number, fromId: number) {
    db.delete(messages).where(and(eq(messages.chatId, chatId), sql`id >= ${fromId}`)).run();
  }

  /* ---------- GedÃ¤chtnis ---------- */
  listMemories(userId: number): Memory[] {
    return db.select().from(memories).where(eq(memories.userId, userId)).orderBy(desc(memories.createdAt)).all();
  }
  deleteMemory(userId: number, id: number) {
    db.delete(memories).where(and(eq(memories.userId, userId), eq(memories.id, id))).run();
  }
  clearMemories(userId: number) {
    db.delete(memories).where(eq(memories.userId, userId)).run();
  }

  /* ---------- Genius ---------- */
  ensureSubjects() {
    const existing = db.select().from(subjects).all();
    if (existing.length === 0) {
      SUBJECTS.forEach((s) => db.insert(subjects).values(s).run());
    }
    return db.select().from(subjects).all();
  }
  listLevels(userId: number): Level[] {
    return db.select().from(levels).where(eq(levels.userId, userId)).all();
  }
  ensureLevels(userId: number) {
    const have = this.listLevels(userId);
    if (have.length > 0) return have;
    SUBJECTS.forEach((s) => {
      for (let stage = 1; stage <= 6; stage++) {
        db.insert(levels)
          .values({ userId, subjectSlug: s.slug, stage, status: stage === 1 ? "offen" : "gesperrt" })
          .run();
      }
    });
    return this.listLevels(userId);
  }
  completeLevel(userId: number, subjectSlug: string, stage: number, score: number) {
    db.update(levels)
      .set({ status: "geschafft", score })
      .where(and(eq(levels.userId, userId), eq(levels.subjectSlug, subjectSlug), eq(levels.stage, stage)))
      .run();
    db.update(levels)
      .set({ status: "offen" })
      .where(
        and(
          eq(levels.userId, userId),
          eq(levels.subjectSlug, subjectSlug),
          eq(levels.stage, stage + 1),
          eq(levels.status, "gesperrt"),
        ),
      )
      .run();
    return this.listLevels(userId);
  }
  cachedQuestions(subjectSlug: string, stage: number): QuizQuestion[] {
    return db
      .select()
      .from(quizQuestions)
      .where(and(eq(quizQuestions.subjectSlug, subjectSlug), eq(quizQuestions.stage, stage)))
      .all();
  }
  saveQuestion(q: Omit<QuizQuestion, "id" | "createdAt">) {
    return db.insert(quizQuestions).values({ ...q, createdAt: now() }).returning().get();
  }
  getQuestion(id: number) {
    return db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).get();
  }

  /* ---------- Wiederholung (SM-2) ---------- */
  listDueCards(userId: number): ReviewCard[] {
    return db
      .select()
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), lte(reviewCards.dueAt, now())))
      .orderBy(asc(reviewCards.dueAt))
      .all();
  }
  listCards(userId: number): ReviewCard[] {
    return db.select().from(reviewCards).where(eq(reviewCards.userId, userId)).orderBy(asc(reviewCards.dueAt)).all();
  }
  addCard(userId: number, questionId: number, subjectSlug: string, front: string, back: string) {
    const existing = db
      .select()
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), eq(reviewCards.front, front)))
      .get();
    if (existing) return existing;
    return db
      .insert(reviewCards)
      .values({ userId, questionId, subjectSlug, front, back, dueAt: now() })
      .returning()
      .get();
  }
  /** SM-2: quality 0..5 */
  gradeCard(userId: number, id: number, quality: number) {
    const card = db
      .select()
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), eq(reviewCards.id, id)))
      .get();
    if (!card) return undefined;
    let { ease, intervalDays, repetitions } = card;
    if (quality < 3) {
      repetitions = 0;
      intervalDays = 0;
    } else {
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 6;
      else intervalDays = Math.round(intervalDays * ease);
      ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (ease < 1.3) ease = 1.3;
    }
    const dueAt = now() + Math.max(intervalDays, 0) * 86400000 + (intervalDays === 0 ? 600000 : 0);
    const statusMap: Record<number, string> = { 0: "nochmal", 3: "schwer", 4: "gut", 5: "einfach" };
    db.update(reviewCards)
      .set({ ease, intervalDays, repetitions, dueAt, lastStatus: statusMap[quality] || "gut", lastReviewedAt: now() })
      .where(eq(reviewCards.id, id))
      .run();
    return db.select().from(reviewCards).where(eq(reviewCards.id, id)).get();
  }

  /* ---------- Missionen ---------- */
  listMissions(userId: number) {
    const ms = db.select().from(missions).where(eq(missions.userId, userId)).orderBy(asc(missions.id)).all();
    return ms.map((m) => ({
      ...m,
      steps: db.select().from(missionSteps).where(eq(missionSteps.missionId, m.id)).orderBy(asc(missionSteps.position)).all(),
    }));
  }
  createMission(userId: number, m: Partial<Mission>, steps: { title: string; kind?: string }[]) {
    const mission = db
      .insert(missions)
      .values({
        userId,
        title: m.title || "Neue Mission",
        description: m.description || "",
        category: m.category || "alltag",
        icon: m.icon || "target",
        xpReward: m.xpReward || 120,
        collectible: m.collectible || "",
        createdAt: now(),
      })
      .returning()
      .get();
    steps.forEach((s, i) =>
      db.insert(missionSteps).values({ missionId: mission.id, title: s.title, kind: s.kind || "todo", position: i }).run(),
    );
    return mission;
  }
  toggleStep(userId: number, stepId: number) {
    const step = db.select().from(missionSteps).where(eq(missionSteps.id, stepId)).get();
    if (!step) return undefined;
    const mission = db.select().from(missions).where(eq(missions.id, step.missionId)).get();
    if (!mission || mission.userId !== userId) return undefined;
    db.update(missionSteps).set({ done: step.done ? 0 : 1 }).where(eq(missionSteps.id, stepId)).run();
    const steps = db.select().from(missionSteps).where(eq(missionSteps.missionId, mission.id)).all();
    const allDone = steps.every((s) => s.done);
    if (allDone && mission.status !== "geschafft") {
      db.update(missions).set({ status: "geschafft" }).where(eq(missions.id, mission.id)).run();
      this.addXp(userId, mission.xpReward, `Mission: ${mission.title}`);
    } else if (!allDone && mission.status === "geschafft") {
      db.update(missions).set({ status: "laufend" }).where(eq(missions.id, mission.id)).run();
    } else if (mission.status === "offen") {
      db.update(missions).set({ status: "laufend" }).where(eq(missions.id, mission.id)).run();
    }
    return true;
  }
  deleteMission(userId: number, id: number) {
    const mission = db.select().from(missions).where(eq(missions.id, id)).get();
    if (!mission || mission.userId !== userId) return;
    db.delete(missionSteps).where(eq(missionSteps.missionId, id)).run();
    db.delete(missions).where(eq(missions.id, id)).run();
  }

  /* ---------- Abos ---------- */
  listSubscriptions(userId: number): Subscription[] {
    return db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.amount)).all();
  }
  addSubscription(userId: number, s: Partial<Subscription>) {
    return db
      .insert(subscriptions)
      .values({
        userId,
        name: s.name || "Abo",
        category: s.category || "sonstiges",
        amount: s.amount ?? 0,
        cycle: s.cycle || "monatlich",
        lastUsed: s.lastUsed || "",
        source: s.source || "manuell",
        active: s.active ?? 1,
        externalId: s.externalId || "",
      })
      .returning()
      .get();
  }
  /** Legt ein Abo an oder aktualisiert es anhand der externen Kennung (z. B. Plaid-Stream). */
  upsertSubscriptionByExternalId(userId: number, externalId: string, s: Partial<Subscription>) {
    const vorhanden = db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.externalId, externalId)))
      .get();
    if (vorhanden) {
      db.update(subscriptions).set(s).where(eq(subscriptions.id, vorhanden.id)).run();
      return { eintrag: db.select().from(subscriptions).where(eq(subscriptions.id, vorhanden.id)).get()!, neu: false };
    }
    return { eintrag: this.addSubscription(userId, { ...s, externalId }), neu: true };
  }
  updateSubscription(userId: number, id: number, patch: Partial<Subscription>) {
    db.update(subscriptions).set(patch).where(and(eq(subscriptions.userId, userId), eq(subscriptions.id, id))).run();
    return db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
  }
  deleteSubscription(userId: number, id: number) {
    db.delete(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.id, id))).run();
  }

  /* ---------- Aufgaben / Tag ---------- */
  listTasks(userId: number, day?: string): Task[] {
    const rows = db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.priority), desc(tasks.id)).all();
    return day ? rows.filter((t) => t.day === day) : rows;
  }
  addTask(userId: number, title: string, target = "todo", priority = 2, day = today()) {
    return db.insert(tasks).values({ userId, title, target, priority, day, createdAt: now() }).returning().get();
  }
  toggleTask(userId: number, id: number) {
    const t = db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.id, id))).get();
    if (!t) return undefined;
    db.update(tasks).set({ done: t.done ? 0 : 1 }).where(eq(tasks.id, id)).run();
    if (!t.done) this.addXp(userId, 15, `Aufgabe: ${t.title}`);
    return db.select().from(tasks).where(eq(tasks.id, id)).get();
  }
  deleteTask(userId: number, id: number) {
    db.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.id, id))).run();
  }

  /* ---------- XP, Streak, Bestenliste ---------- */
  addXp(userId: number, amount: number, reason: string) {
    db.insert(xpEvents).values({ userId, amount, reason, createdAt: now() }).run();
    const d = today();
    const row = db.select().from(streaks).where(and(eq(streaks.userId, userId), eq(streaks.day, d))).get();
    if (row) db.update(streaks).set({ xp: row.xp + amount }).where(eq(streaks.id, row.id)).run();
    else db.insert(streaks).values({ userId, day: d, xp: amount, minutes: 0 }).run();
    return this.getStats(userId);
  }
  addMinutes(userId: number, minutes: number) {
    const d = today();
    const row = db.select().from(streaks).where(and(eq(streaks.userId, userId), eq(streaks.day, d))).get();
    if (row) db.update(streaks).set({ minutes: row.minutes + minutes }).where(eq(streaks.id, row.id)).run();
    else db.insert(streaks).values({ userId, day: d, xp: 0, minutes }).run();
  }
  listStreaks(userId: number): Streak[] {
    return db.select().from(streaks).where(eq(streaks.userId, userId)).orderBy(asc(streaks.day)).all();
  }
  getStats(userId: number) {
    const rows = this.listStreaks(userId);
    const totalXp = rows.reduce((a, b) => a + b.xp, 0);
    const days = new Set(rows.filter((r) => r.xp > 0 || r.minutes > 0).map((r) => r.day));
    let streak = 0;
    const d = new Date();
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (streak === 0 && key === today()) {
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return {
      totalXp,
      streak,
      minutes: rows.reduce((a, b) => a + b.minutes, 0),
      days: rows,
    };
  }

  /* ---------- Seed ---------- */
  seedUserContent(userId: number) {
    this.ensureSubjects();
    this.ensureLevels(userId);
  }

  exportAll(userId: number) {
    return {
      exportiertAm: new Date().toISOString(),
      nutzer: this.getUser(userId),
      companion: this.getCompanion(userId),
      einstellungen: this.getSettings(userId),
      chats: this.listChats(userId).map((c) => ({ ...c, nachrichten: this.listMessages(c.id) })),
      gedaechtnis: this.listMemories(userId),
      missionen: this.listMissions(userId),
      wiederholungskarten: this.listCards(userId),
      abos: this.listSubscriptions(userId),
      aufgaben: this.listTasks(userId),
      level: this.listLevels(userId),
      statistik: this.getStats(userId),
    };
  }
}

export const storage = new Storage();
storage.ensureSubjects();
