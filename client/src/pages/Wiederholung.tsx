import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Repeat, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Page, PageHeader } from "../components/Layout";
import { useApp } from "../state";

type Card = {
  id: number; subjectSlug: string; front: string; back: string; dueAt: number;
  lastStatus: string; lastReviewedAt: number; intervalDays: number; ease: number;
};

const GRADES = [
  { q: 0, label: "Nochmal", variant: "destructive" as const },
  { q: 3, label: "Schwer", variant: "outline" as const },
  { q: 4, label: "Gut", variant: "secondary" as const },
  { q: 5, label: "Einfach", variant: "default" as const },
];

export default function Wiederholung() {
  const { api, refresh } = useApp();
  const [data, setData] = useState<{ faellig: Card[]; alle: Card[] } | null>(null);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  const load = async () => {
    try { setData(await api("GET", "/api/review")); setError(""); }
    catch (e: any) { setError(e.message); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  async function grade(q: number) {
    const card = session![index];
    await api("POST", `/api/review/${card.id}/grade`, { quality: q });
    await refresh();
    setDone((d) => d + 1);
    setFlipped(false);
    if (index + 1 >= session!.length) { setSession(null); setIndex(0); await load(); }
    else setIndex((i) => i + 1);
  }

  if (session && session[index]) {
    const card = session[index];
    return (
      <Page>
        <PageHeader title="Wiederholung läuft" subtitle={`Karte ${index + 1} von ${session.length}`} />
        <motion.div key={card.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-xl rounded-lg border border-card-border bg-card p-6" data-testid="card-review">
          <Badge variant="secondary" className="text-[11px]">{card.subjectSlug}</Badge>
          <p className="mt-4 text-base font-medium" data-testid="text-card-front">{card.front}</p>
          {flipped ? (
            <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm" data-testid="text-card-back">{card.back}</p>
          ) : (
            <Button className="mt-4 w-full" variant="outline" onClick={() => setFlipped(true)} data-testid="button-flip">Antwort zeigen</Button>
          )}
          {flipped && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g) => (
                <Button key={g.q} variant={g.variant} onClick={() => void grade(g.q)} data-testid={`button-grade-${g.q}`}>{g.label}</Button>
              ))}
            </div>
          )}
        </motion.div>
        <p className="mt-4 text-center text-xs text-muted-foreground">SM-2-Algorithmus: Intervall und Leichtigkeitsfaktor werden serverseitig berechnet.</p>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Wiederholung"
        subtitle="Spaced Repetition nach SM-2 — Karten entstehen automatisch aus deinen Quizfragen."
        action={
          <Button disabled={!data?.faellig.length} onClick={() => { setSession(data!.faellig); setIndex(0); setFlipped(false); setDone(0); }} data-testid="button-start-review">
            <Repeat className="mr-1 h-4 w-4" /> Wiederholung starten
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {done > 0 && <p className="mb-4 rounded-md border border-chart-3/40 bg-chart-3/10 p-3 text-sm">{done} Karten in dieser Sitzung bearbeitet.</p>}

      {!data && <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}

      {data && data.faellig.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center" data-testid="status-empty-review">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-chart-3" />
          <p className="text-sm font-medium">Alles wiederholt</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.alle.length ? "Komm später wieder — die nächsten Karten sind terminiert." : "Beantworte Genius-Quizfragen, dann entstehen hier automatisch Karten."}
          </p>
        </div>
      )}

      {data && data.faellig.length > 0 && (
        <div className="space-y-2">
          {data.faellig.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border border-card-border bg-card p-3" data-testid={`row-card-${c.id}`}>
              <Badge variant="secondary" className="shrink-0 text-[11px]">{c.subjectSlug}</Badge>
              <p className="min-w-0 flex-1 truncate text-sm">{c.front}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {c.lastReviewedAt ? `${c.lastStatus} · ${new Date(c.lastReviewedAt).toLocaleDateString("de-DE")}` : "neu"}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && data.alle.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium">Alle Karten ({data.alle.length})</h2>
          <div className="space-y-1.5">
            {data.alle.slice(0, 30).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-md border border-card-border bg-background p-2.5 text-xs" data-testid={`row-allcard-${c.id}`}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{c.front}</span>
                <span className="shrink-0 text-muted-foreground">fällig {new Date(c.dueAt).toLocaleDateString("de-DE")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}
