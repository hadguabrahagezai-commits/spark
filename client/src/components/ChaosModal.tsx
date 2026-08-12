import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Mic, MicOff, Sparkles, Wand2 } from "lucide-react";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";

type SortedItem = { title: string; target: string; priority: number; begruendung?: string };

const TARGET_LABEL: Record<string, string> = {
  kalender: "Kalender",
  erinnerung: "Erinnerung",
  lektion: "Genius-Lektion",
  todo: "To-do",
};

export function ChaosModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { api } = useApp();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [items, setItems] = useState<SortedItem[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<any>(null);
  const timerRef = useRef<number>();

  useEffect(() => {
    if (!open) {
      stopListening();
      setItems(null);
      setError("");
      setSeconds(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopListening() {
    try { recRef.current?.stop(); } catch { /* ignorieren */ }
    recRef.current = null;
    window.clearInterval(timerRef.current);
    setListening(false);
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Spracheingabe nicht verfügbar", description: "Dein Browser unterstützt die Web Speech API nicht. Bitte tippen." });
      return;
    }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = text ? text + " " : "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setText((finalText + interim).trimStart());
    };
    rec.onerror = () => stopListening();
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s >= 29) { stopListening(); return 30; }
        return s + 1;
      });
    }, 1000);
  }

  async function sort() {
    setLoading(true);
    setError("");
    try {
      const data = await api<SortedItem[]>("POST", "/api/chaos/sort", { text });
      setItems(data);
      setSelected(Object.fromEntries(data.map((_, i) => [i, true])));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    const chosen = (items || []).filter((_, i) => selected[i]);
    await api("POST", "/api/chaos/apply", { items: chosen });
    toast({ title: "Übernommen", description: `${chosen.length} Einträge landen in deinem Tag.` });
    setText("");
    setItems(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-chaos">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Kopf leeren
          </DialogTitle>
          <DialogDescription>
            Sprich bis zu 30 Sekunden frei oder tippe alles heraus. SPARK sortiert es anschließend.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Alles raus: Termine, Sorgen, Ideen, offene Punkte …"
          data-testid="input-chaos-text"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={listening ? "destructive" : "secondary"}
            size="sm"
            onClick={() => (listening ? stopListening() : startListening())}
            data-testid="button-chaos-mic"
          >
            {listening ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
            {listening ? `Aufnahme läuft · ${30 - seconds}s` : "Sprechen"}
          </Button>
          <Button size="sm" onClick={sort} disabled={!text.trim() || loading} data-testid="button-chaos-sort">
            <Wand2 className="mr-1 h-4 w-4" /> Sortieren
          </Button>
          <span className="text-xs text-muted-foreground">{text.trim().split(/\s+/).filter(Boolean).length} Wörter</span>
        </div>

        {loading && (
          <div className="space-y-2" data-testid="status-chaos-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm" data-testid="status-chaos-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="flex-1">
              <p>{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={sort}>Erneut versuchen</Button>
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-card-border bg-card p-3 hover-elevate"
                data-testid={`row-chaos-item-${i}`}
              >
                <Checkbox
                  checked={Boolean(selected[i])}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [i]: Boolean(v) }))}
                  data-testid={`checkbox-chaos-${i}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  {item.begruendung && <p className="mt-0.5 text-xs text-muted-foreground">{item.begruendung}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">{TARGET_LABEL[item.target] || item.target}</Badge>
                    <Badge variant="outline" className="text-[11px]">Priorität {item.priority}</Badge>
                  </div>
                </div>
              </label>
            ))}
            <Button className="w-full" onClick={apply} data-testid="button-chaos-apply">
              Übernehmen
            </Button>
          </div>
        )}

        {items && items.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            SPARK konnte daraus keine Aufgaben ableiten. Versuch es mit etwas mehr Kontext.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
