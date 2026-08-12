import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Brain, Check, Eye, EyeOff, Loader2, Mic, Palette, Sparkles, Square,
  Upload, Volume2, Wallet, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SparkLogo, SparkMark } from "@/components/Logo";
import { AVATAR_PRESETS, SparkAvatar, deriveFromPhoto, useSpeech } from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";
import { rawApi, useApp } from "@/state";
import { StimmeAuswahl } from "@/components/StimmeAuswahl";
import { LiveAvatarAuswahl } from "@/components/LiveAvatarAuswahl";
import { useToast } from "@/hooks/use-toast";

const GOALS = [
  { id: "alltag", title: "Alltag ordnen", desc: "Aufgaben, Termine, Kopf frei.", icon: Sparkles },
  { id: "lernen", title: "Nebenbei schlauer werden", desc: "Kleine Lernhäppchen, echtes Wissen.", icon: Brain },
  { id: "geld", title: "Geld im Blick", desc: "Abos prüfen, Sparziele erreichen.", icon: Wallet },
  { id: "alles", title: "Alles ein bisschen", desc: "Der ausgewogene Weg.", icon: Palette },
];

const THEME_CARDS = [
  { id: "nachtlabor", name: "Nachtlabor", bg: "#0B0E14", fg: "#E6F1FF", accent: "#22D3EE", desc: "Tiefes Blaugrau, Elektro-Cyan." },
  { id: "aurora", name: "Aurora Light", bg: "#FAF9F6", fg: "#1A1F2B", accent: "#0E9488", desc: "Hell und luftig, Türkis→Rosa." },
  { id: "terminal", name: "Retro-Terminal", bg: "#070B08", fg: "#9CFFC4", accent: "#35E36B", desc: "Phosphorgrün, Monospace." },
  { id: "bio", name: "Bio-Grün", bg: "#0F1F17", fg: "#F2F0E4", accent: "#E0A44E", desc: "Waldgrün mit warmem Sand." },
];

const PERSONALITIES = [
  { id: "mentor", name: "Ruhiger Mentor", desc: "Bedacht, strukturiert, ermutigend." },
  { id: "coach", name: "Motivierender Coach", desc: "Energisch, klar, zielorientiert." },
  { id: "freund", name: "Trocken-witziger Freund", desc: "Locker, ehrlich, mit Humor." },
  { id: "analyst", name: "Sachlicher Analyst", desc: "Nüchtern, faktenbasiert, präzise." },
  { id: "entdeckerin", name: "Neugierige Entdeckerin", desc: "Fragt nach, denkt weiter, begeistert." },
  { id: "stuetze", name: "Stille Stütze", desc: "Behutsam, geduldig, urteilsfrei." },
];

const CONSENT_SENTENCE =
  "Ich stimme zu, dass SPARK meine Stimme für ein persönliches Stimmprofil verwenden darf.";

function SparkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const particles = Array.from({ length: 46 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.0006, vy: -Math.random() * 0.0009 - 0.0002,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = getComputedStyle(document.documentElement).getPropertyValue("--spark-glow").trim() || "186 92% 52%";
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, p.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${color} / ${0.15 + p.r * 0.25})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export default function Onboarding() {
  const { login, patchUser, patchCompanion, previewTheme, setTheme, user, companion, token } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState(0); // 0 Start, 1 Auth, 2 Ziel, 3 Design, 4 Companion
  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<AvatarConfig>({ preset: "abstrakt-funke", ...AVATAR_PRESETS[6].config });
  const [personality, setPersonality] = useState("mentor");
  const [directness, setDirectness] = useState(50);
  const [verbosity, setVerbosity] = useState(50);
  const [humor, setHumor] = useState(40);
  const [companionName, setCompanionName] = useState("Spark");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [recording, setRecording] = useState(false);
  const [consentDone, setConsentDone] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const speech = useSpeech();

  useEffect(() => {
    void rawApi<any>("GET", "/api/config").then((c) => setGoogleReady(Boolean(c?.google?.configured))).catch(() => {});
    const load = () => setVoices(window.speechSynthesis?.getVoices?.() || []);
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (token && user && step < 2) setStep(user.onboarded ? 4 : 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  useEffect(() => {
    if (companion && step === 4) {
      setConfig({ preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit });
      setPersonality(companion.personality);
      setDirectness(companion.directness); setVerbosity(companion.verbosity); setHumor(companion.humor);
      setCompanionName(companion.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const pwStrength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  async function submitAuth() {
    setBusy(true); setError("");
    try {
      const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await rawApi<any>("POST", url, { email, password, name });
      await login(data.token);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(later: boolean) {
    setBusy(true);
    try {
      if (!later) {
        await patchCompanion({
          ...config, name: companionName, personality, directness, verbosity, humor,
          voiceName, voiceRate: rate, voicePitch: pitch, voiceVolume: volume,
        });
      }
      await patchUser({ onboarded: 1 } as any);
    } finally {
      setBusy(false);
    }
  }

  function previewLine() {
    const base: Record<string, string> = {
      mentor: "Lass uns in Ruhe anfangen — ein Schritt reicht für heute.",
      coach: "Auf geht's! Ein Block Fokus jetzt, dann hast du den Tag im Griff.",
      freund: "Also gut. Der Wäscheberg läuft nicht weg — aber du auch nicht. Fünf Minuten?",
      analyst: "Drei offene Punkte, einer davon zeitkritisch. Ich schlage die Reihenfolge vor.",
      entdeckerin: "Spannend — willst du wissen, warum genau das heute so schwerfällt?",
      stuetze: "Ich bin da. Wir nehmen nur das, was du gerade tragen kannst.",
    };
    let line = base[personality] || base.mentor;
    if (directness < 35) line = line.replace(/^/, "Ohne Umschweife: ");
    if (directness > 70) line = line.replace(/^/, "Ganz behutsam: ");
    if (verbosity > 70) line += " Ich erkläre dir gern jeden Schritt und warum er hilft.";
    if (verbosity < 30) line = line.split(".")[0] + ".";
    if (humor > 70) line += " (Und ja, Kaffee zählt als Vorbereitung.)";
    return line;
  }

  async function onPhoto(file: File) {
    try {
      const derived = await deriveFromPhoto(file);
      setConfig((c) => ({ ...c, ...derived, preset: "eigenes-foto" }));
      toast({ title: "Avatar abgeleitet", description: "Aus deinem Foto wurden nur Farben übernommen — kein Abbild, keine Speicherung des Bildes." });
    } catch {
      toast({ title: "Foto konnte nicht gelesen werden", description: "Bitte ein anderes Bild versuchen." });
    }
  }

  async function toggleRecording() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const buf = await blob.arrayBuffer();
        // Grobe Tonhöhenanalyse zur Auswahl der passendsten Systemstimme
        const ctx = new AudioContext();
        let suggested = voiceName;
        try {
          const audio = await ctx.decodeAudioData(buf.slice(0));
          const data = audio.getChannelData(0);
          let crossings = 0;
          for (let i = 1; i < data.length; i++) if (data[i - 1] < 0 && data[i] >= 0) crossings++;
          const freq = (crossings * audio.sampleRate) / data.length / 2;
          const de = voices.filter((v) => v.lang?.startsWith("de"));
          if (de.length) {
            const idx = freq > 165 ? 0 : de.length - 1;
            suggested = de[idx].name;
            setVoiceName(suggested);
          }
        } catch { /* Analyse optional */ }
        void ctx.close();
        const bytes = new Uint8Array(buf).slice(0, 200000);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const res = await rawApi<any>("POST", "/api/voice/clone", { name: companionName, audioBase64: base64, profile: `zerocross:${suggested}` }, token);
        setConsentDone(true);
        toast({
          title: res.mode === "elevenlabs" ? "Stimmprofil erstellt" : "Stimmprofil lokal gespeichert",
          description: res.reason || "Deine Einwilligung wurde protokolliert.",
        });
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      window.setTimeout(() => { if (rec.state === "recording") { rec.stop(); setRecording(false); } }, 8000);
    } catch {
      toast({ title: "Mikrofon nicht verfügbar", description: "Bitte Zugriff erlauben oder Schritt überspringen." });
    }
  }

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  /* ------------------------------------------------------------ Start */
  if (step === 0) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 text-center">
        <SparkCanvas />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 max-w-md">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-primary">
            <SparkMark size={38} />
          </span>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">SPARK</h1>
          <p className="mt-3 text-2xl font-medium spark-gradient-text">Ein Funke reicht.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Dein KI-Copilot für Alltag, Wissen und Geld. Läuft lokal — externe Dienste sind optional.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button size="lg" onClick={() => { setMode("register"); setStep(1); }} data-testid="button-start-register">
              Mit E-Mail registrieren
            </Button>
            <Button size="lg" variant="ghost" onClick={() => { setMode("login"); setStep(1); }} data-testid="button-start-login">
              Schon ein Konto? Anmelden
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------------------------------------------------- Gerüst ab Schritt 1 */
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SparkLogo />
        <div className="ml-auto text-xs text-muted-foreground">Schritt {step + 1} von {totalSteps}</div>
      </header>
      <div className="h-1 w-full bg-muted">
        <motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {step === 1 && (
          <div className="mx-auto max-w-sm">
            <h2 className="font-display text-xl font-semibold">{mode === "register" ? "Konto erstellen" : "Willkommen zurück"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Deine Daten bleiben in deiner SPARK-Instanz.</p>
            <div className="mt-6 space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wie sollen wir dich nennen?" data-testid="input-name" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" data-testid="input-email" />
                {email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (
                  <p className="text-xs text-destructive">Bitte eine gültige E-Mail-Adresse eingeben.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Passwort</Label>
                <div className="relative">
                  <Input id="pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mindestens 8 Zeichen" data-testid="input-password" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw((v) => !v)} aria-label="Passwort anzeigen" data-testid="button-toggle-password">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "register" && password && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full transition-all ${pwStrength < 2 ? "bg-destructive" : pwStrength < 4 ? "bg-chart-4" : "bg-chart-3"}`} style={{ width: `${(pwStrength / 4) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground" data-testid="text-password-strength">
                      {["sehr schwach", "schwach", "okay", "gut", "stark"][pwStrength]}
                    </span>
                  </div>
                )}
              </div>
              {mode === "login" && (
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => toast({ title: "Passwort zurücksetzen", description: "In dieser Instanz gibt es keinen E-Mail-Versand. Bitte über die Einstellungen im angemeldeten Zustand ändern." })}
                  data-testid="button-forgot-password"
                >
                  Passwort vergessen?
                </button>
              )}
              {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive" data-testid="status-auth-error">{error}</p>}
              <Button className="w-full" onClick={submitAuth} disabled={busy || !email || !password} data-testid="button-submit-auth">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "register" ? "Konto erstellen" : "Anmelden"}
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button variant="outline" className="w-full" disabled={!googleReady} data-testid="button-google"
                      onClick={() => { window.location.href = "/api/google/auth"; }}>
                      Mit Google fortfahren
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{googleReady ? "Gmail, Kalender, Drive und YouTube verbinden" : "Google-Anbindung in .env konfigurieren"}</TooltipContent>
              </Tooltip>

              <button className="w-full text-center text-xs text-muted-foreground underline underline-offset-2" onClick={() => setMode(mode === "register" ? "login" : "register")} data-testid="button-switch-mode">
                {mode === "register" ? "Ich habe schon ein Konto" : "Neues Konto erstellen"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-xl font-semibold">Worauf soll SPARK zuerst schauen?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Du kannst das jederzeit ändern.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => void patchUser({ goal: g.id })}
                  className={`rounded-lg border p-5 text-left transition hover-elevate ${user?.goal === g.id ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
                  data-testid={`button-goal-${g.id}`}
                >
                  <g.icon className="mb-3 h-6 w-6 text-primary" />
                  <p className="font-medium">{g.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{g.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-xl font-semibold">Wähle dein Design</h2>
            <p className="mt-1 text-sm text-muted-foreground">Vorschau beim Überfahren, Auswahl per Klick.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {THEME_CARDS.map((t) => (
                <button
                  key={t.id}
                  onMouseEnter={() => previewTheme(t.id)}
                  onMouseLeave={() => previewTheme(null)}
                  onFocus={() => previewTheme(t.id)}
                  onBlur={() => previewTheme(null)}
                  onClick={() => void setTheme(t.id)}
                  className={`overflow-hidden rounded-lg border text-left transition hover-elevate ${user?.theme === t.id ? "border-primary" : "border-card-border"}`}
                  data-testid={`button-theme-${t.id}`}
                >
                  <div className="p-4" style={{ background: t.bg, color: t.fg }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: t.accent }}><SparkMark size={18} /></span>
                      <span className="text-sm font-semibold">{t.name}</span>
                      {user?.theme === t.id && <Check className="ml-auto h-4 w-4" style={{ color: t.accent }} />}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="h-2 w-3/4 rounded-full" style={{ background: t.accent, opacity: 0.9 }} />
                      <div className="h-2 w-1/2 rounded-full" style={{ background: t.fg, opacity: 0.25 }} />
                      <div className="h-2 w-2/3 rounded-full" style={{ background: t.fg, opacity: 0.15 }} />
                    </div>
                  </div>
                  <div className="bg-card p-3 text-xs text-muted-foreground">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-display text-xl font-semibold">Dein Companion</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gesicht, Charakter und Stimme — alles änderbar.</p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="rounded-lg border border-card-border bg-card p-4 text-center lg:sticky lg:top-4 lg:self-start">
                <SparkAvatar config={config} size={190} mood="freudig" speaking={speech.speaking} amplitude={speech.amplitude} className="mx-auto" />
                <Input value={companionName} onChange={(e) => setCompanionName(e.target.value)} className="mt-3 text-center" data-testid="input-companion-name" />
                <p className="mt-3 rounded-md bg-muted/60 p-2 text-left text-xs italic text-muted-foreground" data-testid="text-preview-line">
                  „{previewLine()}"
                </p>
                <Button size="sm" variant="secondary" className="mt-3 w-full" data-testid="button-preview-voice"
                  onClick={() => speech.speak(previewLine(), { voice: voiceName, rate, pitch, volume })}>
                  <Volume2 className="mr-1 h-4 w-4" /> Vorschau anhören
                </Button>
              </div>

              <Tabs defaultValue="gesicht">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
                  <TabsTrigger value="gesicht" data-testid="tab-gesicht">Gesicht</TabsTrigger>
                  <TabsTrigger value="liveavatar" data-testid="tab-liveavatar">Live-Avatar</TabsTrigger>
                  <TabsTrigger value="charakter" data-testid="tab-charakter">Charakter</TabsTrigger>
                  <TabsTrigger value="stimme" data-testid="tab-stimme">Stimme</TabsTrigger>
                </TabsList>

                <TabsContent value="liveavatar" className="mt-4 space-y-4">
                  <LiveAvatarAuswahl />
                </TabsContent>

                <TabsContent value="gesicht" className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {AVATAR_PRESETS.map((p) => (
                      <button key={p.id} onClick={() => setConfig({ preset: p.id, ...p.config })}
                        className={`rounded-md border p-1.5 hover-elevate ${config.preset === p.id ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
                        data-testid={`button-preset-${p.id}`} title={p.label}>
                        <SparkAvatar config={{ preset: p.id, ...p.config }} size={54} animate={false} className="mx-auto" />
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{p.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Hautton</Label>
                      <Input type="color" value={config.skin} onChange={(e) => setConfig({ ...config, skin: e.target.value })} className="h-9 p-1" data-testid="input-skin" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Haarfarbe</Label>
                      <Input type="color" value={config.hair} onChange={(e) => setConfig({ ...config, hair: e.target.value })} className="h-9 p-1" data-testid="input-hair" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Kleidung</Label>
                      <Input type="color" value={config.outfit} onChange={(e) => setConfig({ ...config, outfit: e.target.value })} className="h-9 p-1" data-testid="input-outfit" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Stil</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["anime", "realistisch", "abstrakt"].map((s) => (
                          <Button key={s} size="sm" variant={config.style === s ? "default" : "outline"} onClick={() => setConfig({ ...config, style: s })} data-testid={`button-style-${s}`}>
                            {s === "realistisch" ? "Realistisch-stilisiert" : s[0].toUpperCase() + s.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Frisur</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["kurz", "lang", "bob", "zopf", "locken", "kahl"].map((h) => (
                          <Button key={h} size="sm" variant={config.hairstyle === h ? "default" : "outline"} onClick={() => setConfig({ ...config, hairstyle: h })} data-testid={`button-hair-${h}`}>{h}</Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Augenform</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["rund", "mandel", "schmal"].map((e2) => (
                          <Button key={e2} size="sm" variant={config.eyes === e2 ? "default" : "outline"} onClick={() => setConfig({ ...config, eyes: e2 })} data-testid={`button-eyes-${e2}`}>{e2}</Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-border p-4">
                    <Label htmlFor="photo" className="flex cursor-pointer items-center gap-2 text-sm">
                      <Upload className="h-4 w-4" /> Eigenes Foto verwenden
                    </Label>
                    <input id="photo" type="file" accept="image/*" className="mt-2 text-xs" data-testid="input-photo"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }} />
                    <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Das Bild verlässt deinen Browser nicht. SPARK liest nur dominante Farben aus und zeichnet daraus einen eigenen Avatar — kein Abbild deiner Person.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="charakter" className="mt-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PERSONALITIES.map((p) => (
                      <button key={p.id} onClick={() => setPersonality(p.id)}
                        className={`rounded-md border p-3 text-left hover-elevate ${personality === p.id ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
                        data-testid={`button-personality-${p.id}`}>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                  {[
                    { label: "Direkt ↔ Sanft", value: directness, set: setDirectness, id: "directness" },
                    { label: "Kurz ↔ Ausführlich", value: verbosity, set: setVerbosity, id: "verbosity" },
                    { label: "Ernst ↔ Humorvoll", value: humor, set: setHumor, id: "humor" },
                  ].map((s) => (
                    <div key={s.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Label>{s.label}</Label>
                        <span className="text-xs text-muted-foreground">{s.value}</span>
                      </div>
                      <Slider value={[s.value]} onValueChange={(v) => s.set(v[0])} max={100} step={1} data-testid={`slider-${s.id}`} />
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="stimme" className="mt-4 space-y-5">
                  <StimmeAuswahl companionName={companionName} />

                  <div className="rounded-md border border-card-border bg-card p-3">
                    <p className="text-sm font-medium">Browser-Sprachausgabe (immer verfügbar)</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Wird genutzt, wenn kein Anbieter konfiguriert ist oder ein Anbieter-Aufruf fehlschlägt.
                    </p>
                    {voices.length === 0 && (
                      <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Dein Browser meldet aktuell keine Stimmen. Die Sprachausgabe funktioniert trotzdem, sobald der Browser Stimmen bereitstellt.
                      </p>
                    )}
                    <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto spark-scroll sm:grid-cols-2">
                      {[...voices].sort((a, b) => Number(b.lang?.startsWith("de")) - Number(a.lang?.startsWith("de"))).slice(0, 24).map((v) => (
                        <div key={v.name} className={`flex items-center gap-2 rounded-md border p-2 ${voiceName === v.name ? "border-primary bg-primary/10" : "border-card-border bg-background"}`}>
                          <button className="min-w-0 flex-1 text-left" onClick={() => setVoiceName(v.name)} data-testid={`button-voice-${v.name}`}>
                            <p className="truncate text-xs font-medium">{v.name}</p>
                            <p className="text-[11px] text-muted-foreground">{v.lang}</p>
                          </button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Stimme anhören"
                            onClick={() => speech.speak("Hallo, ich bin dein SPARK-Companion.", { voice: v.name, rate, pitch, volume })}>
                            <Volume2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-3">
                      {[
                        { label: "Tempo", value: rate, set: setRate, min: 0.5, max: 1.6, id: "rate" },
                        { label: "Tonlage", value: pitch, set: setPitch, min: 0.5, max: 1.8, id: "pitch" },
                        { label: "Betonung / Lautstärke", value: volume, set: setVolume, min: 0.2, max: 1, id: "volume" },
                      ].map((s) => (
                        <div key={s.id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <Label>{s.label}</Label>
                            <span className="text-xs text-muted-foreground">{s.value.toFixed(2)}</span>
                          </div>
                          <Slider value={[s.value]} onValueChange={(v) => s.set(v[0])} min={s.min} max={s.max} step={0.05} data-testid={`slider-${s.id}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {step > 1 && (
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} data-testid="button-back">
            <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {step === 4 && (
            <Button variant="ghost" size="sm" onClick={() => void finish(true)} data-testid="button-later">Später einrichten</Button>
          )}
          {step >= 2 && step < 4 && (
            <Button onClick={() => setStep((s) => s + 1)} data-testid="button-next">
              Weiter <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => void finish(false)} disabled={busy} data-testid="button-finish">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Los geht's
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
