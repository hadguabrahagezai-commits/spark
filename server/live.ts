import type { Express, Request, RequestHandler, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { google as googleapis } from "googleapis";
import { storage } from "./storage";
import { llmConfigured, providerStatus, currentModel, testProvider } from "./llm";
import {
  listVoices,
  synthesizeStream,
  cloneVoice,
  transcribe,
  elevenConfigured,
  openaiVoiceConfigured,
  testEleven,
} from "./voice";
import { avatarStatus, listAvatars, createSessionToken, streaming, heygenConfigured, testAvatar } from "./avatar";
import {
  bankingStatus,
  plaidConfigured,
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  syncTransactions,
  getRecurring,
  bankStore,
  testPlaid,
} from "./banking";
import {
  googleConfigured,
  mapsConfigured,
  googleStatus,
  authUrl,
  oauthClient,
  tokenStore,
  calendarEvents,
  gmailSummary,
  gmailSend,
  driveRecent,
  youtubeSubscriptions,
  geocode,
  directions,
  testGoogle,
  redirectUri,
} from "./google";
import { supabaseEnabled, supabaseStatus, supabaseKeyKind } from "./supabase";
import type { User } from "@shared/schema";

type AuthedRequest = Request & { user?: User };

/** Merkt sich den OAuth-„state“ kurzzeitig: state → userId (0 = Anmeldung per Google). */
const oauthStates = new Map<string, { userId: number; erstellt: number }>();
function neuerState(userId: number) {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { userId, erstellt: Date.now() });
  Array.from(oauthStates.entries()).forEach(([k, v]) => {
    if (Date.now() - v.erstellt > 15 * 60 * 1000) oauthStates.delete(k);
  });
  return state;
}

const zahl = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

export function registerLiveRoutes(app: Express, auth: RequestHandler) {
  /* =================================================== Integrationen-Status */

  app.get("/api/integrations/status", async (req: AuthedRequest, res: Response) => {
    // Optionale Anmeldung: ohne Token werden nur die Server-Einstellungen gezeigt.
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const user = token ? storage.getUserByToken(token) : undefined;
    const ki = providerStatus();
    const avatar = avatarStatus();
    const bank = bankingStatus(user?.id);
    const g = googleStatus(user?.id);
    res.json({
      integrationen: [
        {
          id: "ki",
          name: "KI-Anbieter",
          status: ki.aktiv ? "verbunden" : "nicht_konfiguriert",
          detail: ki.aktiv
            ? `${ki.anbieter.find((a) => a.id === ki.aktiv)?.name} · ${ki.modell}`
            : "Kein Schlüssel gesetzt",
          hinweis: ki.aktiv
            ? ki.aktiv !== ki.gewuenscht
              ? `AI_PROVIDER=${ki.gewuenscht} hat keinen Schlüssel — SPARK nutzt stattdessen ${ki.aktiv}.`
              : "Chat, Quiz, Missionen und Analysen laufen über diesen Anbieter."
            : "Variablen GEMINI_API_KEY, OPENAI_API_KEY oder ANTHROPIC_API_KEY in .env eintragen.",
          variablen: ["AI_PROVIDER", "GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
          konsole: "https://aistudio.google.com/apikey",
          anbieter: ki.anbieter,
        },
        {
          id: "elevenlabs",
          name: "ElevenLabs (Stimme)",
          status: elevenConfigured() ? "verbunden" : openaiVoiceConfigured() ? "teilweise" : "nicht_konfiguriert",
          detail: elevenConfigured()
            ? `Modell ${process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2"}`
            : openaiVoiceConfigured()
              ? `Ersatz: OpenAI-TTS (${process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"})`
              : "Browser-Sprachausgabe",
          hinweis: elevenConfigured()
            ? "Echte Stimmen, Streaming-TTS und Stimmklonen sind aktiv."
            : "Ohne ELEVENLABS_API_KEY gibt es kein Stimmklonen; SPARK spricht über OpenAI oder den Browser.",
          variablen: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID"],
          konsole: "https://elevenlabs.io/app/settings/api-keys",
        },
        {
          id: "heygen",
          name: "HeyGen (Live-Avatar)",
          status: heygenConfigured() ? (avatar.avatarId ? "verbunden" : "teilweise") : "nicht_konfiguriert",
          detail: avatar.modus,
          hinweis: avatar.hinweis,
          variablen: ["HEYGEN_API_KEY", "HEYGEN_AVATAR_ID", "HEYGEN_VOICE_ID"],
          konsole: "https://app.heygen.com/settings?nav=API",
        },
        {
          id: "google",
          name: "Google (Gmail, Kalender, Drive, YouTube)",
          status: !googleConfigured() ? "nicht_konfiguriert" : g.verbunden ? "verbunden" : "teilweise",
          detail: g.verbunden ? g.email || "Konto verbunden" : googleConfigured() ? "Kein Konto verbunden" : "Kein Schlüssel gesetzt",
          hinweis: g.nachricht,
          variablen: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
          konsole: "https://console.cloud.google.com/apis/credentials",
        },
        {
          id: "maps",
          name: "Google Maps",
          status: mapsConfigured() ? "verbunden" : "nicht_konfiguriert",
          detail: mapsConfigured() ? "Geocoding und Routen verfügbar" : "Keine Anfahrtszeiten",
          hinweis: mapsConfigured()
            ? "Termine können Anfahrtszeiten anzeigen."
            : "GOOGLE_MAPS_API_KEY eintragen und Geocoding- sowie Directions-API aktivieren.",
          variablen: ["GOOGLE_MAPS_API_KEY"],
          konsole: "https://console.cloud.google.com/google/maps-apis/credentials",
        },
        {
          id: "plaid",
          name: "Plaid (Bank)",
          status: plaidConfigured() ? (bank.verbundeneBanken ? "verbunden" : "teilweise") : "nicht_konfiguriert",
          detail: plaidConfigured() ? `Umgebung ${bank.umgebung} · ${bank.verbundeneBanken} Bank(en)` : "Bank nicht verbunden",
          hinweis: bank.message,
          variablen: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
          konsole: "https://dashboard.plaid.com/developers/keys",
        },
        {
          id: "supabase",
          name: "Supabase (Sync)",
          status: supabaseEnabled() ? "verbunden" : "nicht_konfiguriert",
          detail: supabaseEnabled() ? `${supabaseKeyKind()}-Key aktiv` : "Reiner SQLite-Betrieb",
          hinweis: supabaseEnabled()
            ? "Gedächtnis, Ereignisse, Beziehungen und Finanzübersicht werden gespiegelt."
            : "SUPABASE_URL plus SUPABASE_SERVICE_KEY oder SUPABASE_ANON_KEY eintragen.",
          variablen: ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_ANON_KEY"],
          konsole: "https://supabase.com/dashboard/project/_/settings/api",
        },
      ],
      ki: { ...ki, modell: currentModel(), konfiguriert: llmConfigured() },
      google: g,
      bank,
      avatar,
      angemeldet: Boolean(user),
    });
  });

  app.post("/api/integrations/test/:id", auth, async (req: AuthedRequest, res: Response) => {
    const id = String(req.params.id);
    try {
      if (id === "ki") return res.json(await testProvider());
      if (id === "elevenlabs") return res.json(await testEleven());
      if (id === "heygen") return res.json(await testAvatar());
      if (id === "google") return res.json(await testGoogle(req.user!.id));
      if (id === "plaid") return res.json(await testPlaid());
      if (id === "maps") {
        if (!mapsConfigured()) return res.json({ ok: false, nachricht: "GOOGLE_MAPS_API_KEY nicht gesetzt." });
        const r = await geocode("Brandenburger Tor, Berlin");
        return res.json({ ok: r.ok, nachricht: r.ok ? `Geocoding erfolgreich: ${r.adresse}` : r.nachricht });
      }
      if (id === "supabase") {
        const s = await supabaseStatus();
        return res.json({ ok: s.reachable, nachricht: s.message });
      }
      return res.status(404).json({ ok: false, nachricht: "Unbekannte Integration." });
    } catch (e: any) {
      res.status(500).json({ ok: false, nachricht: String(e?.message || e).slice(0, 200) });
    }
  });

  /* ============================================================== Stimme */

  app.get("/api/voice/voices", auth, async (_req, res) => res.json(await listVoices()));

  app.post("/api/voice/tts", auth, async (req: AuthedRequest, res) => {
    const text = String(req.body?.text || "").slice(0, 2500);
    if (!text) return res.status(400).json({ message: "Kein Text übergeben." });
    const companion = storage.getCompanion(req.user!.id);
    // HeyGen-Voice-IDs gelten ausschließlich für den Live-Avatar und werden nie an ElevenLabs/OpenAI gesendet.
    const requestedVoice = String(req.body?.voiceId || "");
    const provider = req.body?.voiceProvider === "openai" || req.body?.voiceProvider === "elevenlabs"
      ? req.body.voiceProvider
      : companion.voiceProvider === "openai" || companion.voiceProvider === "elevenlabs" ? companion.voiceProvider : undefined;
    const voiceId = requestedVoice || (provider ? companion.voiceId : undefined);
    const result = await synthesizeStream(text, voiceId || undefined, {
      stability: zahl(req.body?.stability) ?? companion.voiceStability,
      similarity: zahl(req.body?.similarity) ?? companion.voiceSimilarity,
      style: zahl(req.body?.style) ?? companion.voiceStyle,
    }, provider);
    if (result.mode === "fehler") return res.status(result.status || 502).json({ mode: "fehler", message: result.reason });
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("X-Spark-Voice-Source", result.mode);
    res.setHeader("Cache-Control", "no-store");
    result.body.pipe(res);
    result.body.on("error", () => res.end());
  });

  app.post("/api/voice/clone", auth, async (req: AuthedRequest, res) => {
    if (!req.body?.consent) return res.status(400).json({ message: "Ohne ausdrückliche Einwilligung wird keine Stimme geklont." });
    const result = await cloneVoice(
      String(req.body?.name || "SPARK-Stimme"),
      req.body?.audioBase64,
      String(req.body?.mimeType || "audio/webm"),
    );
    if (result.mode === "elevenlabs") {
      storage.updateCompanion(req.user!.id, {
        voiceProfile: result.voiceId,
        voiceId: result.voiceId,
        voiceProvider: "elevenlabs",
        voiceConsent: 1,
      });
      return res.json(result);
    }
    if (result.mode === "fehler") return res.status(result.status).json(result);
    res.status(503).json(result);
  });

  app.post("/api/voice/stt", auth, async (req, res) => {
    const audio = String(req.body?.audioBase64 || "");
    if (!audio) return res.status(400).json({ message: "Keine Aufnahme übermittelt." });
    const result = await transcribe(audio, String(req.body?.mimeType || "audio/webm"));
    if (!result.ok) return res.status(result.status).json({ message: result.nachricht, browserFallback: result.browserFallback });
    res.json(result);
  });

  /* ============================================================== Avatar */

  app.get("/api/avatar/status", auth, (req: AuthedRequest, res) => {
    const companion = storage.getCompanion(req.user!.id);
    res.json({ ...avatarStatus(), gewaehlt: { modus: companion.avatarMode, id: companion.liveAvatarId, name: companion.liveAvatarName } });
  });

  app.get("/api/avatar/list", auth, async (_req, res) => res.json(await listAvatars()));

  app.post("/api/avatar/token", auth, async (req: AuthedRequest, res) => {
    const companion = storage.getCompanion(req.user!.id);
    const result = await createSessionToken({
      avatarId: req.body?.avatarId || companion.liveAvatarId || undefined,
      voiceId: req.body?.voiceId || (companion.voiceProvider === "heygen" ? companion.voiceId : undefined),
      stability: companion.voiceStability,
      similarity: companion.voiceSimilarity,
      style: companion.voiceStyle,
      quality: req.body?.quality,
    });
    if (!result.ok) return res.status(result.status).json({ message: result.nachricht });
    res.json(result);
  });

  app.post("/api/avatar/session/new", auth, async (req, res) => {
    const r = await streaming.neu(req.body || {});
    res.status(r.ok ? 200 : r.status).json(r.data);
  });
  app.post("/api/avatar/session/start", auth, async (req, res) => {
    const r = await streaming.start(req.body || {});
    res.status(r.ok ? 200 : r.status).json(r.data);
  });
  app.post("/api/avatar/task", auth, async (req, res) => {
    const r = await streaming.task(req.body || {});
    res.status(r.ok ? 200 : r.status).json(r.data);
  });
  app.post("/api/avatar/session/stop", auth, async (req, res) => {
    const r = await streaming.stop(req.body || {});
    res.status(r.ok ? 200 : r.status).json(r.data);
  });

  /* ================================================================ Bank */

  app.get("/api/bank/status", auth, (req: AuthedRequest, res) => res.json(bankingStatus(req.user!.id)));

  app.post("/api/bank/link-token", auth, async (req: AuthedRequest, res) => {
    const r = await createLinkToken(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json({ linkToken: r.linkToken });
  });

  app.post("/api/bank/exchange", auth, async (req: AuthedRequest, res) => {
    const publicToken = String(req.body?.publicToken || "");
    if (!publicToken) return res.status(400).json({ message: "Kein public_token übergeben." });
    const r = await exchangePublicToken(req.user!.id, publicToken, String(req.body?.institution || "Bank"));
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json({ ok: true, itemId: r.itemId, status: bankingStatus(req.user!.id) });
  });

  app.get("/api/bank/accounts", auth, async (req: AuthedRequest, res) => {
    const r = await getAccounts(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r.konten);
  });

  app.get("/api/bank/transactions", auth, async (req: AuthedRequest, res) => {
    const r = await syncTransactions(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r.umsaetze);
  });

  app.get("/api/bank/recurring", auth, async (req: AuthedRequest, res) => {
    const r = await getRecurring(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    const userId = req.user!.id;
    let uebernommen = 0;
    const ausgaben = r.streams.filter((s) => s.richtung === "ausgabe");
    for (const s of ausgaben) {
      const cycle = s.frequenz === "jährlich" ? "jährlich" : "monatlich";
      const { neu } = storage.upsertSubscriptionByExternalId(userId, s.id, {
        name: s.name,
        category: s.kategorie.toLowerCase(),
        amount: Number(s.betrag.toFixed(2)),
        cycle,
        lastUsed: s.letzteBuchung || "",
        source: "plaid",
        active: s.aktiv ? 1 : 0,
      });
      if (neu) uebernommen++;
    }
    // Doppelte Anbieter im selben Namensstamm markieren
    const namen = new Map<string, number>();
    ausgaben.forEach((s) => {
      const key = s.name.toLowerCase().split(/[\s*]/)[0];
      namen.set(key, (namen.get(key) || 0) + 1);
    });
    const doppelte = Array.from(namen.entries()).filter(([, n]) => n > 1).map(([k]) => k);
    const ungenutzt = ausgaben
      .filter((s) => s.letzteBuchung && Date.now() - new Date(s.letzteBuchung).getTime() > 60 * 86400000)
      .map((s) => s.name);
    res.json({ streams: r.streams, uebernommen, doppelte, ungenutzt, abos: storage.listSubscriptions(userId) });
  });

  app.delete("/api/bank/item/:id", auth, (req: AuthedRequest, res) => {
    bankStore.remove(req.user!.id, Number(req.params.id));
    res.json({ ok: true, status: bankingStatus(req.user!.id) });
  });

  /* ============================================================== Google */

  app.get("/api/google/status", auth, (req: AuthedRequest, res) => res.json(googleStatus(req.user!.id)));

  /** Anmeldung/Verknüpfung starten. Ohne Anmeldung = „Mit Google fortfahren“. */
  app.get("/api/google/auth", (req: AuthedRequest, res) => {
    if (!googleConfigured())
      return res
        .status(503)
        .json({ message: "Google-Anbindung in .env konfigurieren (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." });
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : String(req.query.token || "");
    const user = bearer ? storage.getUserByToken(bearer) : undefined;
    const url = authUrl(neuerState(user?.id || 0));
    if (!url) return res.status(503).json({ message: "Google-Anbindung nicht konfiguriert." });
    res.redirect(url);
  });

  app.get("/api/google/callback", async (req, res) => {
    if (!googleConfigured()) return res.status(503).send("Google-Anbindung nicht konfiguriert.");
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code) return res.status(400).send("Kein Autorisierungscode erhalten.");
    const merk = oauthStates.get(state);
    oauthStates.delete(state);
    try {
      const client = oauthClient()!;
      const { tokens } = await client.getToken({ code, redirect_uri: redirectUri() });
      client.setCredentials(tokens);
      const oauth2 = googleapis.oauth2({ version: "v2", auth: client });
      const prof = (await oauth2.userinfo.get()).data;
      let userId = merk?.userId || 0;
      if (!userId) {
        let user = prof.email ? storage.getUserByEmail(prof.email) : undefined;
        if (!user) user = storage.createUser(prof.email || `google-${prof.id}@spark.local`, bcrypt.hashSync(crypto.randomUUID(), 10), prof.name || "");
        storage.updateUser(user.id, { googleId: prof.id || "" });
        userId = user.id;
      }
      tokenStore.save(userId, { ...tokens, email: prof.email || "" } as any);
      const sessionToken = storage.createSession(userId);
      res.redirect(`/#/anmelden?token=${sessionToken}&google=verbunden`);
    } catch (e: any) {
      res.status(502).send(`Google-Anmeldung fehlgeschlagen: ${e?.message || e}`);
    }
  });

  app.post("/api/google/disconnect", auth, (req: AuthedRequest, res) => {
    tokenStore.remove(req.user!.id);
    res.json({ ok: true, status: googleStatus(req.user!.id) });
  });

  app.get("/api/google/calendar/events", auth, async (req: AuthedRequest, res) => {
    const r = await calendarEvents(req.user!.id, Number(req.query.tage) || 7);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r.termine);
  });

  app.get("/api/google/gmail/summary", auth, async (req: AuthedRequest, res) => {
    const r = await gmailSummary(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r);
  });

  app.post("/api/google/gmail/send", auth, async (req: AuthedRequest, res) => {
    if (!req.body?.bestaetigt) return res.status(400).json({ message: "E-Mails werden nur nach ausdrücklicher Bestätigung gesendet." });
    const r = await gmailSend(req.user!.id, String(req.body?.an || ""), String(req.body?.betreff || ""), String(req.body?.text || ""));
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r);
  });

  app.get("/api/google/drive/recent", auth, async (req: AuthedRequest, res) => {
    const r = await driveRecent(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r.dateien);
  });

  app.get("/api/google/youtube/subscriptions", auth, async (req: AuthedRequest, res) => {
    const r = await youtubeSubscriptions(req.user!.id);
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r.kanaele);
  });

  app.get("/api/google/maps/geocode", auth, async (req, res) => {
    const r = await geocode(String(req.query.adresse || ""));
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r);
  });

  app.get("/api/google/maps/directions", auth, async (req, res) => {
    const r = await directions(String(req.query.von || ""), String(req.query.nach || ""), String(req.query.modus || "driving"));
    if (!r.ok) return res.status(r.status).json({ message: r.nachricht });
    res.json(r);
  });
}
