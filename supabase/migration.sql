-- ---------------------------------------------------------------------------
-- SPARK — optionale Supabase-Migration
-- Nur nötig, wenn du den optionalen Sync-Layer nutzen willst
-- (SUPABASE_URL + SUPABASE_SERVICE_KEY in .env).
-- Ohne Supabase läuft SPARK vollständig über die lokale SQLite-Datenbank.
-- ---------------------------------------------------------------------------

-- Vom Sync-Layer genutzte Tabellen -----------------------------------------

create table if not exists memory_vectors (
  id            bigint primary key,
  user_id       bigint not null,
  content       text   not null,
  kind          text   not null default 'fakt',
  importance    int    not null default 3,
  embedding     jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists events (
  id          bigserial primary key,
  user_id     bigint not null,
  kind        text   not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists relationships (
  id           bigserial primary key,
  user_id      bigint not null,
  person       text   not null,
  relation     text,
  notes        text,
  last_contact timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists financial_summary (
  user_id     bigint primary key,
  summary     jsonb,
  updated_at  timestamptz not null default now()
);

-- Spiegel der App-Tabellen ---------------------------------------------------

create table if not exists users (
  id bigint primary key, email text unique not null, name text default '',
  goal text default 'alles', theme text default 'nachtlabor',
  onboarded int default 0, created_at timestamptz default now()
);

create table if not exists companions (
  id bigint primary key, user_id bigint not null, name text, preset text, style text,
  skin text, hair text, hairstyle text, eyes text, outfit text, personality text,
  directness int, verbosity int, humor int, voice_name text, voice_rate real,
  voice_pitch real, voice_volume real, voice_consent int, voice_profile text
);

create table if not exists settings (
  id bigint primary key, user_id bigint not null, reduced_motion int, text_scale int,
  high_contrast int, notify_daily int, notify_streak int, notify_review int,
  notify_missions int, language text, region text, plan text, energy text
);

create table if not exists chats (
  id bigint primary key, user_id bigint not null, title text, pinned int,
  created_at timestamptz, updated_at timestamptz
);

create table if not exists messages (
  id bigint primary key, chat_id bigint not null, role text, content text,
  mood text, rating int, attachment text, created_at timestamptz
);

create table if not exists subjects (
  id bigint primary key, slug text unique, name text, icon text, color text
);

create table if not exists levels (
  id bigint primary key, user_id bigint, subject_slug text, stage int, status text, score int
);

create table if not exists quiz_questions (
  id bigint primary key, subject_slug text, stage int, scenario text, question text,
  options jsonb, correct int, hint text, explanation text, source text, created_at timestamptz
);

create table if not exists review_cards (
  id bigint primary key, user_id bigint, question_id bigint, subject_slug text,
  front text, back text, ease real, interval_days int, repetitions int,
  due_at timestamptz, last_status text, last_reviewed_at timestamptz
);

create table if not exists missions (
  id bigint primary key, user_id bigint, title text, description text, category text,
  icon text, xp_reward int, collectible text, status text, created_at timestamptz
);

create table if not exists mission_steps (
  id bigint primary key, mission_id bigint, title text, kind text, position int, done int
);

create table if not exists subscriptions (
  id bigint primary key, user_id bigint, name text, category text, amount real,
  cycle text, last_used text, source text, active int
);

create table if not exists tasks (
  id bigint primary key, user_id bigint, title text, target text, priority int,
  done int, day date, created_at timestamptz
);

create table if not exists streaks (
  id bigint primary key, user_id bigint, day date, xp int, minutes int
);

create table if not exists xp_events (
  id bigint primary key, user_id bigint, amount int, reason text, created_at timestamptz
);

create table if not exists leaderboard (
  id bigint primary key, user_id bigint, name text, scope text, xp int,
  avatar_seed text, is_seed int
);

create index if not exists idx_memory_user on memory_vectors (user_id);
create index if not exists idx_events_user on events (user_id);
create index if not exists idx_messages_chat on messages (chat_id);
