import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Loader2, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page, PageHeader } from "@/components/Layout";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";

type Step = { id: number; title: string; kind: string; done: number };
type Mission = {
  id: number; title: string; description: string; category: string; xpReward: number;
  collectible: string; status: string; steps: Step[];
};

const KIND_LABEL: Record<string, string> = { todo: "To-do", lektion: "Lektion", finanzen: "Finanzen", chat: "Chat" };

export default function Missionen() {
  const { api, refresh } = useApp();
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setMissions(await api<Mission[]>("GET", "/api/missions")); setError(""); }
    catch (e: any) { setError(e.message); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  async function toggle(stepId: number) {
    const res = await api<{ missions: Mission[] }>("POST", `/api/missions/step/${stepId}`, {});
    setMissions(res.missions);
    await refresh();
  }

  async function generate() {
    setBusy(true);
    try {
      setMissions(await api<Mission[]>("POST", "/api/missions/generate", { wish }));
      setOpen(false); setWish("");
      toast({ title: "Mission erstellt", description: "Deine neue Mission steht bereit." });
    } catch (e: any) {
      toast({ title: "Mission konnte nicht erzeugt werden", description: e.message });
    } finally { setBusy(false); }
  }

  return (
    <Page>
      <PageHeader
        title="Missionen"
        subtitle="Mehrstufige Pakete aus Alltagsaufgaben und Genius-Lektionen."
        action={<Button onClick={() => setOpen(true)} data-testid="button-create-mission"><Plus className="mr-1 h-4 w-4" /> Mission erstellen</Button>}
      />

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {!missions && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        {missions?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Noch keine Missionen. Erstelle deine erste.</p>
          </div>
        )}
        {missions?.map((m) => {
          const done = m.steps.filter((s) => s.done).length;
          const pct = m.steps.length ? Math.round((done / m.steps.length) * 100) : 0;
          return (
            <motion.div key={m.id} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="rounded-lg border border-card-border bg-card p-4" data-testid={`card-mission-${m.id}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                </div>
                <Badge variant={m.status === "geschafft" ? "default" : "secondary"} className="shrink-0 text-[11px]">
                  {m.status === "geschafft" ? "Geschafft" : m.status === "laufend" ? "Läuft" : "Offen"}
                </Badge>
                <button onClick={() => void api("DELETE", `/api/missions/${m.id}`).then(load)} aria-label="Mission löschen" data-testid={`button-delete-mission-${m.id}`}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{done}/{m.steps.length}</span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {m.steps.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover-elevate" data-testid={`row-step-${s.id}`}>
                      <Checkbox checked={Boolean(s.done)} onCheckedChange={() => void toggle(s.id)} data-testid={`checkbox-step-${s.id}`} />
                      <span className={`min-w-0 flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{KIND_LABEL[s.kind] || s.kind}</Badge>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-card-border pt-3">
                <Badge variant="secondary" className="gap-1 text-[11px]"><Sparkles className="h-3 w-3" /> {m.xpReward} XP</Badge>
                {m.collectible && <Badge variant="outline" className="gap-1 text-[11px]"><Award className="h-3 w-3" /> Sammelkarte: {m.collectible}</Badge>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-create-mission">
          <DialogHeader>
            <DialogTitle className="text-base">Eigene Mission erstellen</DialogTitle>
            <DialogDescription>Beschreibe dein Ziel — SPARK baut daraus eine mehrstufige Mission.</DialogDescription>
          </DialogHeader>
          <Input value={wish} onChange={(e) => setWish(e.target.value)} placeholder="z. B. In 8 Wochen 5 km am Stück laufen" data-testid="input-mission-wish" />
          <Button onClick={() => void generate()} disabled={!wish.trim() || busy} data-testid="button-generate-mission">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mission generieren
          </Button>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
