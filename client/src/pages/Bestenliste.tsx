import { useEffect, useState } from "react";
import { Crown, Send, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page, PageHeader } from "@/components/Layout";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";

type Entry = { id: number; userId: number | null; name: string; xp: number; isSeed: number };

export default function Bestenliste() {
  const { api, user } = useApp();
  const { toast } = useToast();
  const [scope, setScope] = useState("global");
  const [data, setData] = useState<{ entries: Entry[]; resetAt: number; ownUserId: number } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [friend, setFriend] = useState("");

  useEffect(() => {
    setData(null);
    api<any>("GET", `/api/leaderboard?scope=${scope}`).then(setData).catch((e) => setError(e.message));
  }, [scope, api]);

  const rest = data ? Math.max(0, data.resetAt - Date.now()) : 0;
  const tage = Math.floor(rest / 86400000);
  const stunden = Math.floor((rest % 86400000) / 3600000);

  return (
    <Page>
      <PageHeader
        title="Bestenliste"
        subtitle="XP-Rangliste. Mitspieler sind Beispieldaten dieser Instanz — klar gekennzeichnet."
        action={<Button variant="outline" onClick={() => setOpen(true)} data-testid="button-challenge"><Send className="mr-1 h-4 w-4" /> Freund herausfordern</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList>
            <TabsTrigger value="freunde" data-testid="tab-freunde">Freunde</TabsTrigger>
            <TabsTrigger value="klasse" data-testid="tab-klasse">Klasse</TabsTrigger>
            <TabsTrigger value="global" data-testid="tab-global">Global</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge variant="secondary" className="gap-1" data-testid="status-reset">
          <Timer className="h-3.5 w-3.5" /> Reset in {tage} T {stunden} Std
        </Badge>
      </div>

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!data && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}

      <div className="space-y-1.5">
        {data?.entries.map((e, i) => {
          const own = e.userId === data.ownUserId;
          return (
            <div key={e.id}
              className={`flex items-center gap-3 rounded-md border p-3 ${own ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
              data-testid={`row-leader-${i}`}>
              <span className="w-6 text-sm font-semibold text-muted-foreground">{i + 1}</span>
              {i === 0 ? <Crown className="h-4 w-4 text-primary" /> : <Trophy className="h-4 w-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate text-sm">{own ? `${user?.name || "Du"} (du)` : e.name}</span>
              {Boolean(e.isSeed) && <Badge variant="outline" className="shrink-0 text-[10px]">Beispiel</Badge>}
              <span className="shrink-0 text-sm font-medium">{e.xp} XP</span>
            </div>
          );
        })}
        {data?.entries.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            In dieser Liste ist noch niemand.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-challenge">
          <DialogHeader>
            <DialogTitle className="text-base">Freund herausfordern</DialogTitle>
            <DialogDescription>
              Diese Instanz versendet keine E-Mails. SPARK erzeugt einen Einladungstext, den du selbst teilen kannst.
            </DialogDescription>
          </DialogHeader>
          <Input value={friend} onChange={(e) => setFriend(e.target.value)} placeholder="Name deines Freundes" data-testid="input-friend" />
          <Button
            onClick={() => {
              const text = `Hey ${friend || "du"}, ich fordere dich bei SPARK heraus — wer hat diese Woche mehr XP? Ein Funke reicht.`;
              void navigator.clipboard.writeText(text);
              toast({ title: "Einladung kopiert", description: text });
              setOpen(false);
            }}
            data-testid="button-copy-challenge"
          >
            Einladungstext kopieren
          </Button>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
