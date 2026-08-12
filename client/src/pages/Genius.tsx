import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Atom, Beaker, Check, Cog, Globe, Lightbulb, Loader2, Lock, MessageSquare, Moon, Pause,
  Play, RotateCcw, ScanLine, ScrollText, Sigma, Sprout, Timer, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Page, PageHeader } from "@/components/Layout";
import { Markdown } from "@/components/Markdown";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const ICONS: Record<string, any> = {
  atom: Atom, scroll: ScrollText, flask: Beaker, leaf: Sprout, sigma: Sigma, moon: Moon, cog: Cog, globe: Globe,
};

type SubjectRow = {
  slug: string; name: string; icon: string; color: string; progress: number;
  levels: { stage: number; status: string; score: number }[];
};
type Question = { id: number; scenario: string; question: string; options: string[]; hint: string; explanation: string };

/* --------------------------- WebAudio-Hintergrundgeräusche ---------------- */
function useAmbient() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<any[]>([]);
  const [current, setCurrent] = useState("keins");

  const stop = () => {
    nodesRef.current.forEach((n) => { try { n.stop?.(); n.disconnect?.(); } catch { /* egal */ } });
    nodesRef.current = [];
    setCurrent("keins");
  };

  const play = (kind: string) => {
    stop();
    if (kind === "keins") return;
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = ctxRef.current || new AC();
    ctxRef.current = ctx;
    void ctx.resume();
    const out = ctx.createGain();
    out.gain.value = 0.12;
    out.connect(ctx.destination);

    if (kind === "lofi") {
      const notes = [220, 277, 330, 415];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.value = 0.08;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.06 + i * 0.03;
        lfoGain.gain.value = 0.06;
        lfo.connect(lfoGain).connect(gain.gain);
        osc.connect(gain).connect(out);
        osc.start(); lfo.start();
        nodesRef.current.push(osc, lfo);
      });
    } else {
      // Rauschbasis für Regen und Wald
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = kind === "regen" ? "highpass" : "lowpass";
      filter.frequency.value = kind === "regen" ? 900 : 700;
      noise.connect(filter).connect(out);
      noise.start();
      nodesRef.current.push(noise);
      if (kind === "wald") {
        const chirp = ctx.createOscillator();
        const cg = ctx.createGain();
        chirp.type = "triangle";
        chirp.frequency.value = 1800;
        cg.gain.value = 0;
        chirp.connect(cg).connect(out);
        chirp.start();
        const iv = window.setInterval(() => {
          cg.gain.setValueAtTime(0.05, ctx.currentTime);
          cg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        }, 2600);
        nodesRef.current.push(chirp, { stop: () => window.clearInterval(iv), disconnect: () => {} });
      }
    }
    setCurrent(kind);
  };

  useEffect(() => () => stop(), []);
  return { play, stop, current };
}

/* --------------------------------- Seite ---------------------------------- */
export default function Genius() {
  const { api, refresh } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [subjects, setSubjects] = useState<SubjectRow[] | null>(null);
  const [error, setError] = useState("");
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizSubject, setQuizSubject] = useState<SubjectRow | null>(null);
  const [quizStage, setQuizStage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; richtigeOption: string; explanation: string } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [depth, setDepth] = useState<string>("");
  const [depthText, setDepthText] = useState("");
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [score, setScore] = useState(0);
  const [scanText, setScanText] = useState("");
  const [scanBild, setScanBild] = useState<string>("");
  const [scanBildName, setScanBildName] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const load = async () => {
    try { setSubjects(await api<SubjectRow[]>("GET", "/api/subjects")); setError(""); }
    catch (e: any) { setError(e.message); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  async function startQuiz(subject: SubjectRow, stage: number, count = 3) {
    setQuizSubject(subject); setQuizStage(stage); setQuizOpen(true);
    setQuestions([]); setQIndex(0); setChosen(null); setResult(null); setScore(0);
    setDepth(""); setDepthText(""); setShowHint(false); setQuizError("");
    setLoadingQuiz(true);
    try {
      setQuestions(await api<Question[]>("POST", "/api/quiz/generate", { subject: subject.slug, stage, count }));
    } catch (e: any) { setQuizError(e.message); }
    finally { setLoadingQuiz(false); }
  }

  async function answer(index: number) {
    setChosen(index);
    const q = questions[qIndex];
    const res = await api<any>("POST", "/api/quiz/answer", { questionId: q.id, answer: index });
    setResult(res);
    if (res.correct) setScore((s) => s + 1);
    await refresh();
  }

  async function nextQuestion() {
    if (qIndex + 1 >= questions.length) {
      if (quizSubject) {
        await api("POST", "/api/level/complete", { subject: quizSubject.slug, stage: quizStage, score });
        await load(); await refresh();
      }
      setQuizOpen(false);
      toast({ title: "Runde beendet", description: `${score} von ${questions.length} richtig.` });
      return;
    }
    setQIndex((i) => i + 1); setChosen(null); setResult(null); setShowHint(false); setDepth(""); setDepthText("");
  }

  async function loadDepth(level: string) {
    setDepth(level); setDepthText("");
    try {
      const q = questions[qIndex];
      const res = await api<{ text: string }>("POST", "/api/quiz/explain", { level, question: q.question, answer: result?.richtigeOption });
      setDepthText(res.text);
    } catch (e: any) { setDepthText(`Erklärung nicht verfügbar: ${e.message}`); }
  }

  async function scanToQuiz() {
    setScanBusy(true);
    try {
      const qs = await api<Question[]>("POST", "/api/quiz/scan", { text: scanText, image: scanBild });
      setQuestions(qs); setQuizSubject(subjects?.[7] || null); setQuizStage(1);
      setQIndex(0); setChosen(null); setResult(null); setScore(0); setQuizError(""); setQuizOpen(true);
    } catch (e: any) {
      toast({ title: "Scan fehlgeschlagen", description: e.message });
    } finally { setScanBusy(false); }
  }

  return (
    <Page>
      <PageHeader title="Genius" subtitle="Wissen in kleinen Portionen — vom Nano-Quiz bis zum Boss-Level." />

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="faecher">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="faecher" data-testid="tab-faecher">Fächer</TabsTrigger>
          <TabsTrigger value="fokus" data-testid="tab-fokus">Fokus</TabsTrigger>
          <TabsTrigger value="scan" data-testid="tab-scan">Scan-zu-Quiz</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- Fächer */}
        <TabsContent value="faecher" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!subjects && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
            {subjects?.map((s) => {
              const Icon = ICONS[s.icon] || Globe;
              return (
                <motion.div key={s.slug} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="rounded-lg border border-card-border bg-card p-4" data-testid={`card-subject-${s.slug}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: `hsl(${s.color} / 0.18)`, color: `hsl(${s.color})` }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</p>
                    <Badge variant="secondary" className="text-[11px]">{s.progress}%</Badge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: `hsl(${s.color})` }} />
                  </div>
                  {/* Level-Baum */}
                  <div className="mt-3 flex items-center gap-1">
                    {s.levels.map((l) => (
                      <button key={l.stage} disabled={l.status === "gesperrt"}
                        onClick={() => void startQuiz(s, l.stage, l.stage === 6 ? 5 : 3)}
                        title={l.stage === 6 ? "Boss-Quiz" : `Stufe ${l.stage}`}
                        className={`flex h-8 flex-1 items-center justify-center rounded-md border text-xs transition ${
                          l.status === "geschafft" ? "border-primary bg-primary/20 text-primary"
                            : l.status === "offen" ? "border-border bg-background hover-elevate"
                            : "border-dashed border-border text-muted-foreground opacity-60"}`}
                        data-testid={`button-level-${s.slug}-${l.stage}`}>
                        {l.status === "geschafft" ? <Check className="h-3.5 w-3.5" /> : l.status === "gesperrt" ? <Lock className="h-3 w-3" /> : l.stage === 6 ? <Trophy className="h-3.5 w-3.5" /> : l.stage}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[2, 5, 10].map((m) => (
                      <Button key={m} size="sm" variant="outline" onClick={() => void startQuiz(s, Math.max(1, s.levels.find((l) => l.status === "offen")?.stage || 1), m === 2 ? 2 : m === 5 ? 3 : 5)}
                        data-testid={`button-nano-${s.slug}-${m}`}>
                        {m} Min
                      </Button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- Fokus */}
        <TabsContent value="fokus" className="mt-4"><FocusTimer /></TabsContent>

        {/* ------------------------------------------------------- Scan */}
        <TabsContent value="scan" className="mt-4">
          <div className="max-w-2xl rounded-lg border border-card-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Scan zu Quiz</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Lade ein Foto deines Lernmaterials hoch — das Bild geht direkt an das Vision-Modell des aktiven
              KI-Anbieters. Zusätzlicher Text ist möglich, aber nicht nötig.
            </p>
            <input type="file" accept="image/*" className="mt-3 text-xs" data-testid="input-scan-photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setScanBild(String(reader.result || ""));
                  setScanBildName(f.name);
                  toast({ title: "Foto geladen", description: "Das Bild wird direkt ausgewertet." });
                };
                reader.readAsDataURL(f);
              }} />
            {scanBild && (
              <div className="mt-3 flex items-center gap-3">
                <img src={scanBild} alt="Vorschau des Lernmaterials" className="h-20 w-20 rounded-md border border-card-border object-cover" data-testid="img-scan-preview" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{scanBildName}</p>
                  <Button size="sm" variant="ghost" onClick={() => { setScanBild(""); setScanBildName(""); }} data-testid="button-scan-clear">Bild entfernen</Button>
                </div>
              </div>
            )}
            <Textarea className="mt-3" rows={5} value={scanText} onChange={(e) => setScanText(e.target.value)}
              placeholder="Optional: zusätzlicher Text aus deinem Material …" data-testid="input-scan-text" />
            <Button className="mt-3" disabled={(!scanText.trim() && !scanBild) || scanBusy} onClick={() => void scanToQuiz()} data-testid="button-scan-generate">
              {scanBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Quiz erzeugen
            </Button>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- Live */}
      </Tabs>

      {/* ------------------------------------------------------- Quiz-Dialog */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-quiz">
          <DialogHeader>
            <DialogTitle className="text-base">
              {quizSubject?.name || "Quiz"} · Stufe {quizStage} {quizStage === 6 && <Badge className="ml-2">Boss</Badge>}
            </DialogTitle>
          </DialogHeader>

          {loadingQuiz && <div className="space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /></div>}
          {quizError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="text-destructive">{quizError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => quizSubject && void startQuiz(quizSubject, quizStage)}>Erneut versuchen</Button>
            </div>
          )}

          {!loadingQuiz && questions[qIndex] && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Frage {qIndex + 1} von {questions.length}</p>
              {questions[qIndex].scenario && <p className="rounded-md bg-muted/60 p-2 text-sm italic">{questions[qIndex].scenario}</p>}
              <p className="text-sm font-medium" data-testid="text-question">{questions[qIndex].question}</p>
              <div className="space-y-2">
                {questions[qIndex].options.map((o, i) => {
                  const isChosen = chosen === i;
                  const isRight = result && o === result.richtigeOption;
                  return (
                    <button key={i} disabled={chosen !== null} onClick={() => void answer(i)}
                      className={`w-full rounded-md border p-3 text-left text-sm transition hover-elevate ${
                        isRight ? "border-chart-3 bg-chart-3/15" : isChosen ? "border-destructive bg-destructive/10" : "border-card-border bg-card"}`}
                      data-testid={`button-option-${i}`}>
                      {o}
                    </button>
                  );
                })}
              </div>

              {!result && (
                <Button size="sm" variant="ghost" onClick={() => setShowHint(true)} data-testid="button-hint">
                  <Lightbulb className="mr-1 h-4 w-4" /> Tipp anzeigen
                </Button>
              )}
              {showHint && !result && <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">{questions[qIndex].hint || "Kein Tipp verfügbar."}</p>}

              {result && (
                <div className="space-y-3 rounded-md border border-card-border bg-card p-3">
                  <p className="text-sm font-medium">{result.correct ? "Richtig! +20 XP" : `Nicht ganz — richtig wäre: ${result.richtigeOption}`}</p>
                  {result.explanation && <p className="text-sm text-muted-foreground">{result.explanation}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {[["eli5", "ELI5"], ["normal", "Normal"], ["experte", "Experte"]].map(([id, label]) => (
                      <Button key={id} size="sm" variant={depth === id ? "default" : "outline"} onClick={() => void loadDepth(id)} data-testid={`button-depth-${id}`}>{label}</Button>
                    ))}
                  </div>
                  {depth && (depthText ? <div className="text-sm text-muted-foreground"><Markdown>{depthText}</Markdown></div> : <Skeleton className="h-12 w-full" />)}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate("/chats")} data-testid="button-ask-copilot">
                      <MessageSquare className="mr-1 h-4 w-4" /> Frag den Copiloten
                    </Button>
                    <Button size="sm" onClick={() => void nextQuestion()} data-testid="button-next-question">
                      {qIndex + 1 >= questions.length ? "Runde beenden" : "Weiter"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

/* ------------------------------- Focus-Timer ------------------------------ */
function FocusTimer() {
  const { api, refresh } = useApp();
  const ambient = useAmbient();
  const [minutes, setMinutes] = useState(5);
  const [left, setLeft] = useState(300);
  const [running, setRunning] = useState(false);
  const [goal, setGoal] = useState("");
  const [coach, setCoach] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const ref = useRef<number>();

  useEffect(() => { setLeft(minutes * 60); }, [minutes]);
  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          window.clearInterval(ref.current);
          setRunning(false);
          ambient.stop();
          void api("POST", "/api/focus/session", { minutes }).then(() => refresh());
          if (goal.trim()) void api<any>("POST", "/api/focus/coach", { phase: "abschluss", goal }).then((r) => setCoach(r.coach)).catch(() => {});
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => window.clearInterval(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, minutes]);

  const pct = 1 - left / (minutes * 60 || 1);
  return (
    <div className="max-w-md rounded-lg border border-card-border bg-card p-5 text-center">
      <div className="flex items-center justify-center gap-2 text-sm font-medium"><Timer className="h-4 w-4 text-primary" /> Fokus-Modus</div>
      <div className="relative mx-auto mt-4 h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - pct)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-xl font-semibold" data-testid="text-timer">
          {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-1.5">
        {[2, 5, 10, 25].map((m) => (
          <Button key={m} size="sm" variant={minutes === m ? "default" : "outline"} onClick={() => { setMinutes(m); setRunning(false); }} data-testid={`button-minutes-${m}`}>{m} Min</Button>
        ))}
      </div>
      <div className="mt-4 text-left">
        <p className="text-xs font-medium">Fokus-Coach</p>
        <div className="mt-2 flex gap-2"><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Woran arbeitest du jetzt?" /><Button size="sm" disabled={!goal.trim() || coachBusy} onClick={async () => { setCoachBusy(true); try { const r = await api<any>("POST", "/api/focus/coach", { phase: "start", goal }); setCoach(r.coach); } finally { setCoachBusy(false); } }}>Coach fragen</Button></div>
        {coach && <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm"><Markdown>{coach}</Markdown></div>}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button onClick={() => setRunning((r) => !r)} data-testid="button-timer-toggle">
          {running ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{running ? "Pause" : "Start"}
        </Button>
        <Button variant="outline" onClick={() => { setRunning(false); setLeft(minutes * 60); }} data-testid="button-timer-reset">
          <RotateCcw className="mr-1 h-4 w-4" /> Zurücksetzen
        </Button>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs text-muted-foreground">Hintergrundgeräusch (im Browser synthetisiert)</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {[["keins", "Kein Sound"], ["lofi", "Lo-Fi"], ["regen", "Regen"], ["wald", "Wald"]].map(([id, label]) => (
            <Button key={id} size="sm" variant={ambient.current === id ? "default" : "outline"} onClick={() => ambient.play(id)} data-testid={`button-sound-${id}`}>{label}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}
