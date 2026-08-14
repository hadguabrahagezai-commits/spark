import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import JarvisSphere from "../components/JarvisSphere";
import {
  AlertTriangle, Battery, BatteryFull, BatteryLow, Brain, CalendarDays, ChevronDown, ListChecks, Mail,
  MessageSquare, RefreshCw, Repeat, Sparkles, Wallet,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton } from "../components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { Page, PageHeader } from "../components/Layout";
import { SparkAvatar } from "../components/Avatar";
import { Markdown } from "../components/Markdown";
import { useApp } from "../state";

type Today = {
  stats: { totalXp: number; streak: number; minutes: number };
  tasks: { id: number; title: string; done: number; target: string; priority: number }[];
  faelligeKarten: number;
  energie: string;
  sparpotenzial: number;
  ungenutzteAbos: number;
  missionen: number;
  google: {
    verbunden: boolean;
    konfiguriert: boolean;
    hinweis: string;
    termine: { id: string; titel: string; start: string; ende: string; ganztags: boolean; ort: string }[];
    ungelesen: number;
    mails: { id: string; betreff: string; von: string }[];
    kalenderFehler?: string;
    mailFehler?: string;
  };
};

const ENERGY = [
  { id: "niedrig", label: "Niedrig", icon: BatteryLow },
  { id: "mittel", label: "Mittel", icon: Battery },
  { id: "hoch", label: "Hoch", icon: BatteryFull },
];

function Ring({ value, label }: { value: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.min(100, value) / 100) * c }} transition={{ duration: 0.8 }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-sm font-semibold">{Math.round(value)}%</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Heute() {
  const { api, companion, settings, patchSettings, refresh, user } = useApp();
  const [data, setData] = useState<Today | null>(null);
  const [suggestion, setSuggestion] = useState<{ vorschlag: string; quellen: string[]; schnellantworten: string[]; hinweis?: string } | null>(null);
  const [sugError, setSugError] = useState("");
  const [sugLoading, setSugLoading] = useState(false);
  const [error, setError] = useState("");
  const [lifeBriefing, setLifeBriefing] = useState<{ briefing: string; datenstand: { termine: number; ungeleseneMails: number } } | null>(null);
  const [lifeLoading, setLifeLoading] = useState(false);
  const [lifeError, setLifeError] = useState("");

  const load = async () => {
    try {
      setData(await api<Today>("GET", "/api/today"));
      setError("");
    } catch (e: any) { setError(e.message); }
  };

  const loadSuggestion = async () => {
    setSugLoading(true); setSugError("");
    try { setSuggestion(await api("POST", "/api/today/suggestion", {})); }
    catch (e: any) { setSugError(e.message); }
    finally { setSugLoading(false); }
  };

  const loadLifeBriefing = async () => {
    setLifeLoading(true); setLifeError("");
    try { setLifeBriefing(await api("POST", "/api/life/briefing", {})); }
    catch (e: any) { setLifeError(e.message); }
    finally { setLifeLoading(false); }
  };

  useEffect(() => { void load(); void loadSuggestion(); /* eslint-disable-next-line */ }, []);

  const tasksToday = data?.tasks || [];
  const doneCount = tasksToday.filter((t) => t.done).length;
  const progress = tasksToday.length ? (doneCount / tasksToday.length) * 100 : 0;
  const avatar = companion && { preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit };

  async function toggleTask(id: number) {
    await api("POST", `/api/tasks/${id}/toggle`, {});
    await load(); await refresh();
  }

  const sortedTasks = [...tasksToday].sort((a, b) =>
    settings?.energy === "niedrig" ? b.priority - a.priority : a.priority - b.priority,
  );

  return (
    <Page>
      <PageHeader
        title={`Hallo${user?.name ? `, ${user.name}` : ""}`}
        subtitle="Ein Funke reicht — hier ist dein Tag."
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" /> {error}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void load()}>Erneut laden</Button>
        </div>
      )}

      <section className="spark-panel mb-5 rounded-2xl p-5" data-testid="card-auto-life">
        <div className="flex flex-wrap items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Auto-Life-Manager</p>
            <p className="mt-1 text-xs text-muted-foreground">Prüft auf Wunsch deine echten Google-Kalender- und Gmail-Daten der nächsten Tage. Es werden keine Aktionen ohne deine Bestätigung ausgeführt.</p>
          </div>
          <Button size="sm" variant="outline" disabled={lifeLoading} onClick={() => void loadLifeBriefing()} data-testid="button-auto-life">
            {lifeLoading ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Jetzt prüfen
          </Button>
        </div>
        {lifeError && <p className="mt-3 text-sm text-destructive">{lifeError}</p>}
        {lifeBriefing && <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm"><Markdown>{lifeBriefing.briefing}</Markdown><p className="mt-2 text-[11px] text-muted-foreground">Datenbasis: {lifeBriefing.datenstand.termine} Termine, {lifeBriefing.datenstand.ungeleseneMails} ungelesene E-Mails.</p></div>}
      </section>

      {/* Copilot-Zeile */}
      <section className="spark-hero rounded-2xl p-5 md:p-6" data-testid="card-copilot">
        <div className="flex gap-3">
          {avatar && <JarvisSphere size={56} className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{companion?.name || "Spark"} schlägt vor</p>
            {sugLoading && <Skeleton className="mt-2 h-10 w-full" />}
            {!sugLoading && sugError && (
              <div className="mt-1 text-sm">
                <p className="text-destructive">{sugError}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void loadSuggestion()} data-testid="button-retry-suggestion">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Erneut versuchen
                </Button>
              </div>
            )}
            {!sugLoading && suggestion && (
              <>
                <div className="mt-1 text-sm leading-relaxed" data-testid="text-suggestion"><Markdown>{suggestion.vorschlag}</Markdown></div>
                {suggestion.hinweis && <p className="mt-1 text-xs text-muted-foreground">{suggestion.hinweis}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestion.schnellantworten.map((a) => (
                    <Button key={a} size="sm" variant="secondary" onClick={() => void loadSuggestion()} data-testid={`button-quick-${a}`}>{a}</Button>
                  ))}
                </div>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="mt-3 flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline" data-testid="button-why">
                      <ChevronDown className="h-3.5 w-3.5" /> Warum schlägt SPARK das vor?
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-2 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      {suggestion.quellen.map((q) => <li key={q}>• {q}</li>)}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Energie + Ring */}
      <section className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-lg border border-card-border bg-card p-4">
          <p className="text-sm font-medium">Wie ist deine Energie heute?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ENERGY.map((e) => (
              <Button key={e.id} size="sm" variant={settings?.energy === e.id ? "default" : "outline"}
                onClick={() => void patchSettings({ energy: e.id })} data-testid={`button-energy-${e.id}`}>
                <e.icon className="mr-1 h-4 w-4" /> {e.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {settings?.energy === "niedrig"
              ? "Priorisierung angepasst: leichte Aufgaben zuerst, große Blöcke nach hinten."
              : settings?.energy === "hoch"
                ? "Priorisierung angepasst: schwerste Aufgabe zuerst, danach der Rest."
                : "Ausgewogene Reihenfolge nach Priorität."}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-card-border bg-card p-4">
          <Ring value={progress} label="Sparks" />
          <div>
            <p className="text-sm font-medium">Heutige Sparks</p>
            <p className="text-xs text-muted-foreground">{doneCount} von {tasksToday.length} erledigt</p>
            <p className="mt-2 text-xs text-muted-foreground">{data?.stats.totalXp ?? 0} XP aus erledigten Aktivitäten</p>
          </div>
        </div>
      </section>

      {/* Wiederholungs-Banner */}
      {(data?.faelligeKarten ?? 0) > 0 && (
        <Link href="/wiederholung">
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 hover-elevate" data-testid="banner-review">
            <Repeat className="h-5 w-5 text-primary" />
            <p className="text-sm"><strong>{data?.faelligeKarten} Karten</strong> warten auf Wiederholung.</p>
            <Badge variant="secondary" className="ml-auto">Jetzt üben</Badge>
          </div>
        </Link>
      )}

      {/* Echte Google-Daten */}
      <section className="mt-4 rounded-lg border border-card-border bg-card p-4" data-testid="card-google-heute">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm font-medium">Termine & Nachrichten</p>
          <Badge variant={data?.google?.verbunden ? "default" : "secondary"} className="text-[10px]" data-testid="badge-google-heute">
            {data?.google?.verbunden ? "Google verbunden" : data?.google?.konfiguriert ? "Nicht verbunden" : "Nicht konfiguriert"}
          </Badge>
        </div>

        {!data && <Skeleton className="mt-3 h-16 w-full" />}

        {data && !data.google?.verbunden && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words" data-testid="text-google-hint">
            {data.google?.hinweis} SPARK zeigt hier ausschließlich echte Kalender- und Gmail-Daten — es werden keine
            Beispieltermine erfunden.
          </p>
        )}

        {data?.google?.verbunden && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Nächste 24 Stunden</p>
              <div className="mt-1.5 space-y-1.5">
                {data.google.termine.length === 0 && <p className="text-xs text-muted-foreground">Keine Termine.</p>}
                {data.google.termine.slice(0, 5).map((t) => (
                  <div key={t.id} className="rounded-md border border-card-border bg-background p-2" data-testid={`row-termin-${t.id}`}>
                    <p className="text-xs font-medium break-words">{t.titel}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.ganztags
                        ? "ganztägig"
                        : new Date(t.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      {t.ort ? ` · ${t.ort}` : ""}
                    </p>
                  </div>
                ))}
                {data.google.kalenderFehler && <p className="text-[11px] text-destructive break-words">{data.google.kalenderFehler}</p>}
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {data.google.ungelesen} ungelesen (24 h)
              </p>
              <div className="mt-1.5 space-y-1.5">
                {data.google.mails.length === 0 && <p className="text-xs text-muted-foreground">Keine neuen Nachrichten.</p>}
                {data.google.mails.map((m) => (
                  <div key={m.id} className="rounded-md border border-card-border bg-background p-2" data-testid={`row-mail-${m.id}`}>
                    <p className="text-xs font-medium break-words">{m.betreff}</p>
                    <p className="text-[11px] text-muted-foreground break-words">{m.von}</p>
                  </div>
                ))}
                {data.google.mailFehler && <p className="text-[11px] text-destructive break-words">{data.google.mailFehler}</p>}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Schnellzugriffe */}
      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { href: "/chats", label: "Chat starten", icon: MessageSquare, hint: "Frag SPARK alles" },
          { href: "/genius", label: "Genius", icon: Brain, hint: "Nano-Quiz in 2 Min" },
          { href: "/missionen", label: "Missionen", icon: ListChecks, hint: `${data?.missionen ?? 0} offen` },
          { href: "/finanzen", label: "Abo-Check", icon: Wallet, hint: `${data?.sparpotenzial ?? 0} € Potenzial` },
        ].map((t) => (
          <Link key={t.href} href={t.href}>
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="h-full rounded-lg border border-card-border bg-card p-4 hover-elevate" data-testid={`tile-${t.label}`}>
              <t.icon className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-medium leading-tight">{t.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
            </motion.div>
          </Link>
        ))}
      </section>

      {/* Widget-Vorschau */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-card-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Aufgaben heute</p>
            <Badge variant="secondary">{tasksToday.length}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {!data && <><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></>}
            {data && sortedTasks.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-6 text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nichts geplant. Nutze „Kopf leeren", um zu starten.</p>
              </div>
            )}
            {sortedTasks.map((t) => (
              <label key={t.id} className="flex items-center gap-3 rounded-md border border-card-border bg-background p-2.5 hover-elevate" data-testid={`row-task-${t.id}`}>
                <Checkbox checked={Boolean(t.done)} onCheckedChange={() => void toggleTask(t.id)} data-testid={`checkbox-task-${t.id}`} />
                <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">{t.target}</Badge>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-4">
          <p className="text-sm font-medium">Homescreen-Widget (Vorschau)</p>
          <p className="text-xs text-muted-foreground">So sähe SPARK auf deinem Startbildschirm aus — hier direkt abhakbar.</p>
          <div className="mt-3 rounded-xl border border-border bg-background p-4 shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold">SPARK</span>
              <Badge variant="secondary" className="gap-1 text-[11px]">🔥 {data?.stats.streak ?? 0}</Badge>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 space-y-1.5">
              {sortedTasks.slice(0, 3).map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-xs" data-testid={`widget-task-${t.id}`}>
                  <Checkbox className="h-3.5 w-3.5" checked={Boolean(t.done)} onCheckedChange={() => void toggleTask(t.id)} />
                  <span className={`min-w-0 flex-1 truncate ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                </label>
              ))}
              {sortedTasks.length === 0 && <p className="text-xs text-muted-foreground">Keine Aufgaben.</p>}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
