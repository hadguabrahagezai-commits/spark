import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Auf Railway/Render zeigt SQLITE_PATH auf ein eingehängtes Volume,
// z. B. /data/spark.db. Ohne Volume wäre die Datenbank nach jedem Deploy weg.
const dbPfad = resolve(process.env.SQLITE_PATH || "data.db");

// Zielordner anlegen, falls er noch nicht existiert (frisch eingehängtes Volume).
try {
  mkdirSync(dirname(dbPfad), { recursive: true });
} catch {
  /* Ordner existiert bereits oder ist nicht anlegbar — better-sqlite3 meldet es gleich deutlicher. */
}

const sqlite = new Database(dbPfad);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

export const datenbankPfad = dbPfad;

export const raw = sqlite;
export const db = drizzle(sqlite);

/** Tabellen werden beim Start angelegt — die App läuft ohne weitere Einrichtung. */
export function ensureSchema() {
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'alles',
  theme TEXT NOT NULL DEFAULT 'nachtlabor',
  onboarded INTEGER NOT NULL DEFAULT 0,
  google_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Spark',
  preset TEXT NOT NULL DEFAULT 'abstrakt-funke',
  style TEXT NOT NULL DEFAULT 'anime',
  skin TEXT NOT NULL DEFAULT '#F1C7A8',
  hair TEXT NOT NULL DEFAULT '#2B2B3A',
  hairstyle TEXT NOT NULL DEFAULT 'kurz',
  eyes TEXT NOT NULL DEFAULT 'rund',
  outfit TEXT NOT NULL DEFAULT '#4F46E5',
  personality TEXT NOT NULL DEFAULT 'mentor',
  directness INTEGER NOT NULL DEFAULT 50,
  verbosity INTEGER NOT NULL DEFAULT 50,
  humor INTEGER NOT NULL DEFAULT 40,
  voice_name TEXT NOT NULL DEFAULT '',
  voice_rate REAL NOT NULL DEFAULT 1,
  voice_pitch REAL NOT NULL DEFAULT 1,
  voice_volume REAL NOT NULL DEFAULT 1,
  voice_consent INTEGER NOT NULL DEFAULT 0,
  voice_profile TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reduced_motion INTEGER NOT NULL DEFAULT 0,
  text_scale INTEGER NOT NULL DEFAULT 100,
  high_contrast INTEGER NOT NULL DEFAULT 0,
  notify_daily INTEGER NOT NULL DEFAULT 1,
  notify_streak INTEGER NOT NULL DEFAULT 1,
  notify_review INTEGER NOT NULL DEFAULT 1,
  notify_missions INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'de-DE',
  region TEXT NOT NULL DEFAULT 'DE',
  plan TEXT NOT NULL DEFAULT 'frei',
  energy TEXT NOT NULL DEFAULT 'mittel'
);
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Neuer Chat',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT 'neutral',
  rating INTEGER NOT NULL DEFAULT 0,
  attachment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fakt',
  importance INTEGER NOT NULL DEFAULT 3,
  embedding TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_slug TEXT NOT NULL,
  stage INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'gesperrt',
  score INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_slug TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 1,
  scenario TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct INTEGER NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'llm',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS review_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  subject_slug TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL,
  last_status TEXT NOT NULL DEFAULT 'neu',
  last_reviewed_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'alltag',
  icon TEXT NOT NULL DEFAULT 'target',
  xp_reward INTEGER NOT NULL DEFAULT 120,
  collectible TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'offen',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sonstiges',
  amount REAL NOT NULL DEFAULT 0,
  cycle TEXT NOT NULL DEFAULT 'monatlich',
  last_used TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manuell',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'todo',
  priority INTEGER NOT NULL DEFAULT 2,
  done INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  cursor TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS google_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL DEFAULT '',
  expiry INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
`);

  /* Nachträglich ergänzte Spalten (bestehende Datenbanken bleiben nutzbar). */
  const spalten = (tabelle: string) =>
    (sqlite.prepare(`PRAGMA table_info(${tabelle})`).all() as any[]).map((c) => c.name as string);
  const ergaenze = (tabelle: string, name: string, definition: string) => {
    if (!spalten(tabelle).includes(name)) sqlite.exec(`ALTER TABLE ${tabelle} ADD COLUMN ${name} ${definition}`);
  };
  ergaenze("companions", "voice_provider", "TEXT NOT NULL DEFAULT ''");
  ergaenze("companions", "voice_id", "TEXT NOT NULL DEFAULT ''");
  ergaenze("companions", "voice_stability", "REAL NOT NULL DEFAULT 0.5");
  ergaenze("companions", "voice_similarity", "REAL NOT NULL DEFAULT 0.75");
  ergaenze("companions", "voice_style", "REAL NOT NULL DEFAULT 0");
  ergaenze("companions", "avatar_mode", "TEXT NOT NULL DEFAULT 'svg'");
  ergaenze("companions", "live_avatar_id", "TEXT NOT NULL DEFAULT ''");
  ergaenze("companions", "live_avatar_name", "TEXT NOT NULL DEFAULT ''");
  ergaenze("subscriptions", "external_id", "TEXT NOT NULL DEFAULT ''");
  // Entfernt ausschließlich die frühere simulierte Ranglisten-Tabelle.
  sqlite.exec("DROP TABLE IF EXISTS leaderboard");
  // Einmalige Bereinigung der bekannten Musterinhalte aus früheren Builds.
  sqlite.exec("DELETE FROM subscriptions WHERE source = 'beispiel'");
  sqlite.exec("DELETE FROM tasks WHERE title IN ('10 Minuten Genius: Physik', 'Abo-Check: 2 ungenutzte Abos prüfen', 'Kopf leeren vor dem Feierabend')");
  sqlite.exec("DELETE FROM mission_steps WHERE mission_id IN (SELECT id FROM missions WHERE title IN ('Reise Lissabon', 'Sparziel', 'Morgenroutine', 'Bewerbung', 'Fit in 30 Tagen', 'Digital entrümpeln'))");
  sqlite.exec("DELETE FROM missions WHERE title IN ('Reise Lissabon', 'Sparziel', 'Morgenroutine', 'Bewerbung', 'Fit in 30 Tagen', 'Digital entrümpeln')");
}
