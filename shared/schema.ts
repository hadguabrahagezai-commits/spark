import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/* ---------------------------------------------------------------------------
 * SPARK — Datenmodell
 * SQLite kennt keine Array-Spalten: Listen werden als JSON-Text gespeichert.
 * ------------------------------------------------------------------------- */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull().default(""),
  goal: text("goal").notNull().default("alles"),
  theme: text("theme").notNull().default("nachtlabor"),
  onboarded: integer("onboarded").notNull().default(0),
  googleId: text("google_id"),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const companions = sqliteTable("companions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("Spark"),
  preset: text("preset").notNull().default("abstrakt-funke"),
  style: text("style").notNull().default("anime"),
  skin: text("skin").notNull().default("#F1C7A8"),
  hair: text("hair").notNull().default("#2B2B3A"),
  hairstyle: text("hairstyle").notNull().default("kurz"),
  eyes: text("eyes").notNull().default("rund"),
  outfit: text("outfit").notNull().default("#4F46E5"),
  personality: text("personality").notNull().default("mentor"),
  directness: integer("directness").notNull().default(50),
  verbosity: integer("verbosity").notNull().default(50),
  humor: integer("humor").notNull().default(40),
  voiceName: text("voice_name").notNull().default(""),
  voiceRate: real("voice_rate").notNull().default(1),
  voicePitch: real("voice_pitch").notNull().default(1),
  voiceVolume: real("voice_volume").notNull().default(1),
  voiceConsent: integer("voice_consent").notNull().default(0),
  voiceProfile: text("voice_profile").notNull().default(""),
  voiceProvider: text("voice_provider").notNull().default(""),
  voiceId: text("voice_id").notNull().default(""),
  voiceStability: real("voice_stability").notNull().default(0.5),
  voiceSimilarity: real("voice_similarity").notNull().default(0.75),
  voiceStyle: real("voice_style").notNull().default(0),
  avatarMode: text("avatar_mode").notNull().default("svg"),
  liveAvatarId: text("live_avatar_id").notNull().default(""),
  liveAvatarName: text("live_avatar_name").notNull().default(""),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  reducedMotion: integer("reduced_motion").notNull().default(0),
  textScale: integer("text_scale").notNull().default(100),
  highContrast: integer("high_contrast").notNull().default(0),
  notifyDaily: integer("notify_daily").notNull().default(1),
  notifyStreak: integer("notify_streak").notNull().default(1),
  notifyReview: integer("notify_review").notNull().default(1),
  notifyMissions: integer("notify_missions").notNull().default(0),
  language: text("language").notNull().default("de-DE"),
  region: text("region").notNull().default("DE"),
  plan: text("plan").notNull().default("frei"),
  energy: text("energy").notNull().default("mittel"),
});

export const chats = sqliteTable("chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull().default("Neuer Chat"),
  pinned: integer("pinned").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  mood: text("mood").notNull().default("neutral"),
  rating: integer("rating").notNull().default(0),
  attachment: text("attachment").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const memories = sqliteTable("memories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull().default("fakt"),
  importance: integer("importance").notNull().default(3),
  embedding: text("embedding").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const subjects = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const levels = sqliteTable("levels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  subjectSlug: text("subject_slug").notNull(),
  stage: integer("stage").notNull(),
  status: text("status").notNull().default("gesperrt"),
  score: integer("score").notNull().default(0),
});

export const quizQuestions = sqliteTable("quiz_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectSlug: text("subject_slug").notNull(),
  stage: integer("stage").notNull().default(1),
  scenario: text("scenario").notNull().default(""),
  question: text("question").notNull(),
  options: text("options").notNull(),
  correct: integer("correct").notNull(),
  hint: text("hint").notNull().default(""),
  explanation: text("explanation").notNull().default(""),
  source: text("source").notNull().default("llm"),
  createdAt: integer("created_at").notNull(),
});

export const reviewCards = sqliteTable("review_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  questionId: integer("question_id").notNull(),
  subjectSlug: text("subject_slug").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  ease: real("ease").notNull().default(2.5),
  intervalDays: integer("interval_days").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: integer("due_at").notNull(),
  lastStatus: text("last_status").notNull().default("neu"),
  lastReviewedAt: integer("last_reviewed_at").notNull().default(0),
});

export const missions = sqliteTable("missions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("alltag"),
  icon: text("icon").notNull().default("target"),
  xpReward: integer("xp_reward").notNull().default(120),
  collectible: text("collectible").notNull().default(""),
  status: text("status").notNull().default("offen"),
  createdAt: integer("created_at").notNull(),
});

export const missionSteps = sqliteTable("mission_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("todo"),
  position: integer("position").notNull().default(0),
  done: integer("done").notNull().default(0),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("sonstiges"),
  amount: real("amount").notNull().default(0),
  cycle: text("cycle").notNull().default("monatlich"),
  lastUsed: text("last_used").notNull().default(""),
  source: text("source").notNull().default("manuell"),
  active: integer("active").notNull().default(1),
  externalId: text("external_id").notNull().default(""),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  target: text("target").notNull().default("todo"),
  priority: integer("priority").notNull().default(2),
  done: integer("done").notNull().default(0),
  day: text("day").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const streaks = sqliteTable("streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  day: text("day").notNull(),
  xp: integer("xp").notNull().default(0),
  minutes: integer("minutes").notNull().default(0),
});

export const xpEvents = sqliteTable("xp_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const leaderboard = sqliteTable("leaderboard", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("global"),
  xp: integer("xp").notNull().default(0),
  avatarSeed: text("avatar_seed").notNull().default("a"),
  isSeed: integer("is_seed").notNull().default(1),
});

export type User = typeof users.$inferSelect;
export type Companion = typeof companions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type ReviewCard = typeof reviewCards.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type MissionStep = typeof missionSteps.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
export type XpEvent = typeof xpEvents.$inferSelect;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertChat = typeof chats.$inferInsert;
export type InsertMessage = typeof messages.$inferInsert;
export type InsertMemory = typeof memories.$inferInsert;
export type InsertMission = typeof missions.$inferInsert;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type InsertTask = typeof tasks.$inferInsert;

export const SUBJECTS = [
  { slug: "physik", name: "Physik", icon: "atom", color: "199 89% 55%" },
  { slug: "geschichte", name: "Geschichte", icon: "scroll", color: "31 90% 58%" },
  { slug: "chemie", name: "Chemie", icon: "flask", color: "280 70% 62%" },
  { slug: "biologie", name: "Biologie", icon: "leaf", color: "142 60% 48%" },
  { slug: "mathematik", name: "Mathematik", icon: "sigma", color: "221 83% 62%" },
  { slug: "astronomie", name: "Astronomie", icon: "moon", color: "255 70% 68%" },
  { slug: "technik", name: "Erfindungen & Technik", icon: "cog", color: "12 80% 60%" },
  { slug: "allgemein", name: "Allgemeinwissen", icon: "globe", color: "173 60% 46%" },
] as const;

export const PERSONALITIES = [
  { id: "mentor", name: "Ruhiger Mentor", desc: "Bedacht, strukturiert, ermutigend." },
  { id: "coach", name: "Motivierender Coach", desc: "Energisch, klar, zielorientiert." },
  { id: "freund", name: "Trocken-witziger Freund", desc: "Locker, ehrlich, mit Humor." },
  { id: "analyst", name: "Sachlicher Analyst", desc: "Nüchtern, faktenbasiert, präzise." },
  { id: "entdeckerin", name: "Neugierige Entdeckerin", desc: "Fragt nach, denkt weiter, begeistert." },
  { id: "stuetze", name: "Stille Stütze", desc: "Behutsam, geduldig, urteilsfrei." },
] as const;

export const THEMES = [
  { id: "nachtlabor", name: "Nachtlabor", desc: "Tiefes Blaugrau, Elektro-Cyan.", dark: true },
  { id: "aurora", name: "Aurora Light", desc: "Helles Off-White, Türkis→Rosa.", dark: false },
  { id: "terminal", name: "Retro-Terminal", desc: "Phosphorgrün, Monospace.", dark: true },
  { id: "bio", name: "Bio-Grün", desc: "Waldgrün, warmer Sand.", dark: true },
] as const;
