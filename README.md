# SPARK — Ein Funke reicht

SPARK ist ein KI-Lebens-Copilot: Alltag ordnen, nebenbei schlauer werden, Geld im Blick behalten.
Die komplette Oberfläche ist auf **Deutsch**.

Die App läuft **vollständig ohne externe Schlüssel**: Persistenz über SQLite, Sprache über die
Browser-APIs (Web Speech API, MediaRecorder, WebAudio), Avatare als eigene SVGs. Alle externen
Dienste sind rein optionale Aufwertungen und werden im UI ehrlich als „Nicht konfiguriert" markiert.

Für **echte Live-Dienste** (KI-Antworten, Anbieter-Stimmen, Live-Avatar, Bank, Google) trägst du die
passenden Schlüssel in `.env` ein. Jeder Dienst ist einzeln zuschaltbar; was fehlt, wird im UI
ehrlich als „Nicht konfiguriert“ mit Angabe der fehlenden Variable angezeigt — SPARK erfindet
niemals Inhalte, Termine oder Kontodaten.

---

## Schnellstart

```bash
cd spark
npm install
cp .env.example .env      # Werte eintragen (alles optional)
npm run dev               # Entwicklung auf http://localhost:5000
```

Produktion:

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

Die Datenbank (`data.db`) wird beim ersten Start automatisch angelegt — keine Migration nötig.

---

## Schnellstart: Keys eintragen

Alle Werte kommen ausschließlich aus `.env` (Vorlage: `.env.example`). Nach jeder Änderung den
Server neu starten. Der Live-Status jeder Integration steht unter **Einstellungen → Integrationen**,
inklusive Knopf „Verbindung testen“, der einen echten Aufruf beim jeweiligen Anbieter macht.

1. **KI-Anbieter wählen** — `AI_PROVIDER=gemini|openai|anthropic`
   - Gemini-Schlüssel: <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`
   - OpenAI-Schlüssel: <https://platform.openai.com/api-keys> → `OPENAI_API_KEY`
   - Anthropic-Schlüssel: <https://console.anthropic.com/settings/keys> → `ANTHROPIC_API_KEY`
   - Fehlt der gewünschte Anbieter, weicht SPARK automatisch aus (Reihenfolge: Gemini → Anthropic →
     OpenAI) und schreibt das ins Server-Log sowie in die Integrationen-Karte.
2. **Stimme** — <https://elevenlabs.io/app/settings/api-keys> → `ELEVENLABS_API_KEY`
   (optional `ELEVENLABS_DEFAULT_VOICE_ID`). Ohne ElevenLabs übernimmt OpenAI-TTS, sonst der Browser.
3. **Live-Avatar** — <https://app.heygen.com/settings?nav=API> → `HEYGEN_API_KEY`,
   danach im Companion-Setup unter „Live-Avatar“ einen Avatar auswählen (setzt `HEYGEN_AVATAR_ID`
   pro Nutzer in der Datenbank; die Variable dient als Voreinstellung).
4. **Google** — <https://console.cloud.google.com/apis/credentials> → `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (exakt als Weiterleitungs-URI hinterlegen),
   optional `GOOGLE_MAPS_API_KEY`. Danach in den Integrationen auf „Mit Google verbinden“ tippen.
5. **Bank** — <https://dashboard.plaid.com/developers/keys> → `PLAID_CLIENT_ID`, `PLAID_SECRET`,
   `PLAID_ENV=sandbox`. Danach im Finanzen-Bereich „Bank verbinden“ (Plaid Link).
6. **Supabase (optional)** — <https://supabase.com/dashboard/project/_/settings/api> →
   `SUPABASE_URL` plus `SUPABASE_SERVICE_KEY` oder `SUPABASE_ANON_KEY`; zuvor
   `supabase/migration.sql` ausführen.

---

## Funktionsumfang

| Bereich | Inhalt |
| --- | --- |
| **Onboarding** | 5 Schritte: Start mit Funken-Canvas, Registrierung/Anmeldung, Zielwahl, Theme-Wahl mit Live-Vorschau, Companion-Setup (Gesicht / Live-Avatar / Charakter / Stimme) |
| **Heute** | Proaktiver Tagesvorschlag mit Quellenanzeige, Energie-Auswahl, Sparks-Fortschrittsring, Wiederholungs-Banner, Schnellzugriffe, abhakbares Widget, Rang + XP |
| **Genius** | 8 Fächer mit Level-Baum (6 Stufen + Boss), LLM-Quiz mit Cache, Tipp, Erklärungstiefe ELI5/Normal/Experte, Fokus-Timer mit WebAudio-Klängen, Scan-zu-Quiz, Live-Quiz-Lobby (SSE) |
| **Missionen** | 6 vorgefertigte Missionen + eigene Missionen per LLM, Teilschritte, XP, Sammelkarten |
| **Wiederholung** | Spaced Repetition mit SM-2 serverseitig, Bewertung Nochmal / Schwer / Gut / Einfach |
| **Chats** | Chatliste (anpinnbar, durchsuchbar), SSE-Streaming, Markdown + Code-Blöcke mit Kopieren, Regenerieren, Stop, Anhang-Kontext, Daumen hoch/runter, Sprachchat-Modal mit Avatar-Lippensynchronisation |
| **Bestenliste** | Freunde / Klasse / Global, eigene Position hervorgehoben, Wochen-Reset-Countdown |
| **Finanzen** | Abo-Checker mit Recharts, „Bank verbinden“ über Plaid Link, echte Abo-Erkennung via `transactionsRecurringGet`, doppelte/ungenutzte Abos, manuelle Eingabe + CSV-Import |
| **Einstellungen** | Abo, Personalisierung, Konto, Barrierefreiheit (wirksam), Benachrichtigungen, Integrationen mit Live-Status und „Verbindung testen“, Gedächtnisverwaltung, JSON-Export, Sorgen-Modus |
| **Profil & Wrapped** | Rang, Statistiken, Streak-Heatmap, animierter Wochen-Rückblick mit Bild-Download (Canvas) |
| **Chaos-Modal** | Bis 30 Sekunden sprechen oder tippen → LLM sortiert in priorisierte Aufgaben mit Ziel |

Vier Themes (Nachtlabor, Aurora Light, Retro-Terminal, Bio-Grün) sind jederzeit umschaltbar und
werden in der Datenbank gespeichert. Kein `localStorage`, kein `sessionStorage`, keine Cookies —
das Session-Token lebt ausschließlich im React-State und wird als `Authorization: Bearer …` gesendet.

---

## `.env`-Variablen

Alle Variablen sind optional — die App startet und läuft auch ohne jede einzelne davon.
Vorlage: `.env.example`.

| Variable | Konsole / Quelle | Zweck | Ohne Wert |
| --- | --- | --- | --- |
| `PORT` | – | Serverport | 5000 |
| `SQLITE_PATH` | – | Pfad der SQLite-Datei | `data.db` |
| `APP_BASE_URL` | – | öffentliche Basis-URL für OAuth-Rücksprünge | `http://localhost:5000` |
| `SESSION_SECRET` | selbst erzeugen (`openssl rand -hex 32`) | Schlüssel zur Verschlüsselung der Plaid-Access-Tokens | Ableitung aus `PLAID_SECRET`, sonst lokaler Standardwert |
| `AI_PROVIDER` | – | Anbieterwahl `gemini` \| `openai` \| `anthropic` | `gemini`, mit automatischem Ausweichen |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> | Gemini für Chat, Quiz, Analyse, Bild-Scan | Gemini steht nicht zur Verfügung |
| `GEMINI_MODEL` | – | Modell-ID | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | <https://platform.openai.com/api-keys> | OpenAI für Chat/Vision, TTS und Whisper-STT | Kein OpenAI, kein Server-STT |
| `OPENAI_MODEL` / `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` / `OPENAI_STT_MODEL` | – | Modelle und Standardstimme | `gpt-4o`, `gpt-4o-mini-tts`, `alloy`, `whisper-1` |
| `OPENAI_BASE_URL` | – | optionaler OpenAI-kompatibler Endpunkt (Proxy/Gateway) | offizielle OpenAI-API |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com/settings/keys> | Claude als Anbieter oder Fallback | Anthropic steht nicht zur Verfügung |
| `ANTHROPIC_MODEL` | – | Modell-ID | `claude-sonnet-4-5` |
| `ELEVENLABS_API_KEY` | <https://elevenlabs.io/app/settings/api-keys> | echte Stimmliste (`/v2/voices`), Streaming-TTS, Instant Voice Cloning | Ausweichen auf OpenAI-TTS, sonst Browser-Sprachausgabe; **kein** Stimmklonen |
| `ELEVENLABS_MODEL` | – | TTS-Modell | `eleven_multilingual_v2` |
| `ELEVENLABS_DEFAULT_VOICE_ID` | Stimmliste im Companion-Setup | Standardstimme | erste Stimme des Kontos |
| `ELEVENLABS_STABILITY` / `_SIMILARITY` / `_STYLE` | – | Startwerte der drei Feinregler | `0.5` / `0.75` / `0.0` |
| `HEYGEN_API_KEY` | <https://app.heygen.com/settings?nav=API> | Live-Avatar (Avatar-Liste + Sitzungs-Token) | eigener SVG-Avatar mit Viseme-Lip-Sync |
| `HEYGEN_AVATAR_ID` / `HEYGEN_VOICE_ID` | Avatar-Liste im Companion-Setup | Voreinstellung für Avatar und Stimme | Auswahl erfolgt im UI |
| `DID_API_KEY` | <https://studio.d-id.com/account-settings> | optionaler Zweitanbieter | HeyGen bzw. SVG-Avatar |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | <https://console.cloud.google.com/apis/credentials> | OAuth für Gmail, Kalender, Drive, YouTube, Tasks | „Mit Google fortfahren“ deaktiviert, „Heute“ zeigt keine Termine/Mails |
| `GOOGLE_REDIRECT_URI` | – | muss exakt in der Google-Konsole hinterlegt sein | `http://localhost:5000/api/google/callback` |
| `GOOGLE_MAPS_API_KEY` | <https://console.cloud.google.com/google/maps-apis/credentials> | Geocoding und Routen für Anfahrtszeiten | keine Anfahrtszeiten |
| `GOOGLE_API_KEY` | <https://console.cloud.google.com/apis/credentials> | serverseitige Google-Aufrufe ohne OAuth; gilt auch als Ersatz für `GEMINI_API_KEY` | nicht genutzt |
| `SUPABASE_URL` | <https://supabase.com/dashboard/project/_/settings/api> | Ziel des Sync | reiner SQLite-Betrieb |
| `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY` | dieselbe Seite | Zugriff für den Sync-Layer | reiner SQLite-Betrieb |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | <https://dashboard.plaid.com/developers/keys> | Link-Token, Konten, Umsätze, Abo-Erkennung | „Bank nicht verbunden“; manuelle Abos + CSV |
| `PLAID_ENV` | – | `sandbox` \| `development` \| `production` | `sandbox` |
| `PLAID_PRODUCTS` / `PLAID_COUNTRY_CODES` | – | Produkte und Länder für Plaid Link | `transactions`, `DE` |
| `PLAID_REDIRECT_URI` | Plaid-Dashboard | OAuth-Rücksprung für europäische Banken | wird weggelassen |
| `FINAPI_CLIENT_ID` / `FINAPI_CLIENT_SECRET` / `FINAPI_API_URL` | <https://finapi.io> | optionaler Zweitanbieter | Plaid bzw. manuelle Eingabe |

**Niemals Secrets committen.** `.env` steht in `.gitignore`; im Repository liegt nur `.env.example`.
Alle Schlüssel werden ausschließlich serverseitig über `process.env` gelesen — das Frontend erhält
lediglich Statusflags über `GET /api/config` und `GET /api/integrations/status`.

---

## Was ist wirklich live?

| Bereich | Echt genutzte Schnittstelle |
| --- | --- |
| Chat, Quiz, Missionen, Chaos-Sortierung | Gemini `generateContent(Stream)`, OpenAI `chat.completions`, Anthropic `messages` — inkl. Streaming |
| Scan-zu-Quiz | Bildeingabe direkt an das Vision-Modell des aktiven Anbieters |
| Stimmliste | `GET https://api.elevenlabs.io/v2/voices` (sonst OpenAI-Stimmen, sonst Browser) |
| Sprachausgabe | `POST https://api.elevenlabs.io/v1/text-to-speech/{id}/stream` mit `voice_settings` aus den drei Reglern |
| Stimmklon | `POST https://api.elevenlabs.io/v1/voices/add` (Instant Voice Cloning, nur mit Einwilligung) |
| Spracherkennung | OpenAI-Whisper über `/v1/audio/transcriptions`, Fallback Web-Speech-API |
| Live-Avatar | `POST https://api.liveavatar.com/v1/sessions/token` + `@heygen/liveavatar-web-sdk` im Frontend; Fallback `POST https://api.heygen.com/v1/streaming.create_token`; Avatar-Liste über `/v1/avatars/public` bzw. `GET https://api.heygen.com/v2/avatars` |
| Bank | Plaid `linkTokenCreate`, `itemPublicTokenExchange`, `accountsGet`, `transactionsSync`, **`transactionsRecurringGet`** (echte Abo-Erkennung) |
| Google | `googleapis`: OAuth2 mit Refresh, Gmail (lesen + senden), Kalender, Drive, YouTube, Maps Geocoding/Directions |

---

## Supabase-Migration (optional)

1. Neues Supabase-Projekt anlegen.
2. Im SQL-Editor die Datei `supabase/migration.sql` ausführen. Sie legt die Tabellen
   `memory_vectors`, `events`, `relationships`, `financial_summary` sowie Spiegel der App-Tabellen an.
3. `SUPABASE_URL` und `SUPABASE_SERVICE_KEY` (Service-Role-Key, nur serverseitig!) in `.env` eintragen.
4. Server neu starten. Der Sync-Layer in `server/supabase.ts` schreibt dann zusätzlich nach Supabase;
   SQLite bleibt die führende lokale Datenbank. Den Verbindungsstatus zeigt
   `GET /api/config/supabase` sowie die Sektion „Integrationen" in den Einstellungen.

---

## Google-OAuth einrichten (optional)

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen.
2. Unter *APIs & Dienste → OAuth-Zustimmungsbildschirm* den Bildschirm konfigurieren (Typ „Extern"),
   Testnutzer eintragen.
3. Unter *Anmeldedaten → OAuth-Client-ID erstellen → Webanwendung* eine Client-ID anlegen.
4. Autorisierter Weiterleitungs-URI: `http://localhost:5000/api/google/callback`
   (bzw. deine Domain + `/api/google/callback`).
5. Folgende Scopes freigeben: `openid`, `userinfo.email`, `userinfo.profile`,
   `gmail.readonly`, `gmail.send`, `calendar`, `drive.readonly`, `youtube.readonly`, `tasks`.
6. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` und `GOOGLE_REDIRECT_URI` in `.env` eintragen.
7. Nach dem Neustart ist der Button „Mit Google fortfahren" aktiv. Der Callback erzeugt ein
   Session-Token und leitet zurück in die App.

---

## Projektstruktur

```
client/src/
  components/   Avatar (SVG + Lip-Sync), Layout (Sidebar/Tabs/Command-Palette), ChaosModal,
                VoiceModal, Markdown, Logo
  pages/        Onboarding, Heute, Genius, Missionen, Chats, Wiederholung, Bestenliste,
                Finanzen, Einstellungen, Profil, Wrapped
  state.tsx     Auth-Token, Nutzer, Companion, Einstellungen, Theme-Anwendung
server/
  routes.ts     Alle API-Routen (Auth, Chat-SSE, Quiz, Missionen, Review, Finanzen, Export …)
  storage.ts    Datenzugriff über Drizzle + Seed-Daten + SM-2
  db.ts         SQLite-Verbindung und Schema-Anlage
  llm.ts        Multi-Provider-KI (Gemini / OpenAI / Anthropic, Streaming, JSON, Vision)
  memory.ts     Langzeitgedächtnis: TF-IDF-Retrieval + LLM-Faktenextraktion
  voice.ts      Stimmliste, Streaming-TTS, Instant Voice Cloning, Whisper-STT
  avatar.ts     Live-Avatar (LiveAvatar/HeyGen): Status, Liste, Sitzungs-Token, Streaming-Proxy
  google.ts     Google OAuth, Gmail, Kalender, Drive, YouTube, Maps
  live.ts       Routen für Integrationen-Status, Stimme, Avatar, Bank und Google
  supabase.ts   Optionaler Sync-Layer
  banking.ts    Plaid (Link, Konten, Umsätze, wiederkehrende Buchungen) + CSV-Parser
shared/schema.ts  Gemeinsames Datenmodell (Drizzle, SQLite)
supabase/migration.sql
```

---

## Deploy-Hinweise

```bash
npm run build
NODE_ENV=production node dist/index.cjs   # Port 5000
```

Das gebaute Frontend liegt in `dist/public`, der Server in `dist/index.cjs`. Beim Deployment als
statisches Bundle mit Backend-Proxy wird `__PORT_5000__` in `client/src/lib/queryClient.ts`
automatisch ersetzt; API-Aufrufe funktionieren dadurch lokal und deployed.

## Ehrliche Hinweise

- Live-Quiz-Mitspieler und Bestenlisten-Einträge sind Beispieldaten dieser Instanz und im UI als
  „Beispiel" bzw. als serverseitige Simulation gekennzeichnet.
- Es gibt keine Push-Nachrichten und keinen E-Mail-Versand (auch kein Passwort-Reset per Mail).
- Scan-zu-Quiz schickt das Foto an das Vision-Modell des aktiven KI-Anbieters; ohne KI-Zugang gibt es
  eine klare Fehlermeldung statt erfundener Fragen.
- Ohne `ELEVENLABS_API_KEY` findet **kein** echtes Stimmklonen statt — SPARK sagt das ausdrücklich und
  nutzt weiterhin die gewählte Standardstimme.
- Ohne `HEYGEN_API_KEY` gibt es keinen Live-Avatar; das Voice-Modal zeigt dann „SPARK-Avatar (lokal)“.
- Ohne Plaid-Schlüssel gibt es keine Kontodaten; die Abo-Liste bleibt manuell bzw. CSV-basiert.
- Ohne verbundenes Google-Konto zeigt „Heute“ keine Termine und keine Mails — es werden keine
  Beispieltermine erfunden.
- Der Foto-Upload im Companion-Setup verlässt den Browser nicht: Es werden nur dominante Farben
  ausgelesen und auf den eigenen SVG-Avatar gemappt — es entsteht kein Abbild der Person.
