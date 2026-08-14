# SPARK auf Railway deployen

Deine Schlüssel trägst du im Railway-Dashboard ein. Sie liegen dann in deinem
Railway-Konto, nicht in einer Datei, nicht in Git und nicht in einem Chat.

Im Projekt liegen bereits `railway.json` und `nixpacks.toml` — Railway liest
beide automatisch. Du musst nichts konfigurieren, was dort schon steht.

---

## Schritt 1 — Code zu GitHub

Railway baut aus einem Git-Repository. Falls noch nicht geschehen:

```bash
cd spark
git init
git add .
git commit -m "SPARK"
```

Dann auf [github.com/new](https://github.com/new) ein **privates** Repository anlegen
und hochladen:

```bash
git remote add origin https://github.com/DEIN-NAME/spark.git
git branch -M main
git push -u origin main
```

Prüfe vorher einmal, dass `.env` wirklich ignoriert wird:

```bash
git check-ignore -v .env
```

Kommt eine Ausgabe, ist alles gut. Kommt nichts, **nicht pushen** — dann steht
`.env` nicht in der `.gitignore`.

---

## Schritt 2 — Projekt in Railway anlegen

1. [railway.com/new](https://railway.com/new) öffnen
2. **Deploy from GitHub repo** wählen
3. Dein `spark`-Repository auswählen

Railway startet sofort einen ersten Build. Der wird noch ohne Schlüssel laufen —
das ist in Ordnung, die App startet trotzdem.

---

## Schritt 3 — Volume für die Datenbank anhängen

**Diesen Schritt nicht überspringen.** SPARK speichert alles in einer
SQLite-Datei. Ohne Volume liegt sie im Container-Dateisystem und ist bei jedem
neuen Deploy weg — samt Nutzerkonten, Chats, Gedächtnis und Streaks.

1. Im Service auf **Settings → Volumes → New Volume**
2. Mount-Pfad: `/data`
3. Speichern

Danach in den Variablen (Schritt 4) `SQLITE_PATH=/data/spark.db` setzen.

---

## Schritt 4 — Variablen eintragen

Im Service auf **Variables → Raw Editor**. Dort kannst du alles auf einmal
einfügen. Nimm deine ausgefüllte `.env`, ändere aber diese vier Zeilen:

```
SQLITE_PATH=/data/spark.db
NODE_ENV=production
APP_BASE_URL=https://DEINE-DOMAIN.up.railway.app
GOOGLE_REDIRECT_URI=https://DEINE-DOMAIN.up.railway.app/api/google/callback
```

`PORT` und `HOST` **weglassen**. Railway setzt `PORT` selbst, und der Server
bindet in Produktion automatisch auf `0.0.0.0`.

Deine echte Domain findest du unter **Settings → Networking → Public Networking**.
Falls dort noch keine steht, auf **Generate Domain** klicken.

---

## Schritt 5 — Weiterleitungs-URLs bei den Anbietern nachziehen

Das ist der Punkt, an dem die meisten Deploys hängen bleiben. Die URLs müssen
zeichengenau übereinstimmen, inklusive `https` und ohne Schrägstrich am Ende.

| Anbieter | Wo eintragen | Wert |
| --- | --- | --- |
| Google Cloud | Konsole → APIs & Dienste → Anmeldedaten → dein OAuth-Client → Autorisierte Weiterleitungs-URIs | `https://DEINE-DOMAIN.up.railway.app/api/google/callback` |
| Plaid | Dashboard → Developers → API → Allowed redirect URIs | `https://DEINE-DOMAIN.up.railway.app/api/bank/callback` |
| Supabase | Dashboard → Authentication → URL Configuration | `https://DEINE-DOMAIN.up.railway.app` |

Bei Google zusätzlich unter **OAuth-Zustimmungsbildschirm** die Domain als
autorisierte Domain hinterlegen. Solange die App im Testmodus steht, musst du
deine eigene Adresse dort außerdem als Testnutzer eintragen.

---

## Schritt 6 — Neu deployen und prüfen

Nach dem Speichern der Variablen deployt Railway automatisch neu.

Im **Deploy-Log** solltest du diese Zeile sehen:

```
[spark] KI-Anbieter: gemini · OpenAI an · Google an · Plaid an · Supabase an
```

Steht bei einem Dienst „aus", fehlt die passende Variable.

Dann die Domain im Browser öffnen und unter **Einstellungen → Integrationen**
bei jedem Dienst auf **Verbindung testen** klicken. Das macht einen echten
Aufruf und zeigt dir den Fehler im Klartext, falls etwas nicht stimmt.

Der Health-Check liegt unter `/api/health` und antwortet mit
`{"status":"ok","uptime":…}`. Railway nutzt ihn automatisch.

---

## Wenn etwas klemmt

| Symptom | Ursache | Lösung |
| --- | --- | --- |
| Build bricht bei `better-sqlite3` ab | Node-Version passt nicht zum vorkompilierten Baustein | `nixpacks.toml` pinnt Node 20. Prüfe, dass die Datei mit hochgeladen wurde. |
| Deploy läuft, Domain zeigt „Application failed to respond" | Server bindet nicht auf `0.0.0.0` | `HOST` aus den Variablen entfernen, `NODE_ENV=production` setzen |
| Nach jedem Deploy sind alle Daten weg | Kein Volume angehängt | Schritt 3 nachholen und `SQLITE_PATH=/data/spark.db` setzen |
| Google-Login endet mit `redirect_uri_mismatch` | URI weicht ab | Schritt 5, Wert exakt kopieren |
| Plaid meldet `INVALID_API_KEYS` | `PLAID_ENV` passt nicht zum Schlüsselpaar | Produktionsschlüssel brauchen `PLAID_ENV=production` |
| Health-Check schlägt fehl, Container startet endlos neu | Volume nicht beschreibbar | Mount-Pfad muss exakt `/data` sein |

---

## Kosten

Railway rechnet nach Verbrauch. SPARK ist ein einzelner kleiner Node-Prozess;
für den Eigengebrauch liegt das erfahrungsgemäß im Bereich weniger Euro pro Monat.
Das Volume kostet zusätzlich nach Größe — 1 GB reicht hier weit.

Die eigentlichen Kosten entstehen bei den genutzten KI- und Medienanbietern. Behalte besonders
OpenAI/Anhänge (TTS, STT) und externe Avatar-/Medien-Provider im Auge; diese rechnen pro Nutzung ab.
