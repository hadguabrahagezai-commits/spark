import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Building2, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";

type BankStatus = {
  configured: boolean;
  anbieter: string;
  umgebung: string;
  verbundeneBanken: number;
  message: string;
};

/** „Bank verbinden“ über Plaid Link — echte Verbindung, echte Abo-Erkennung. */
export function BankVerbinden({ onAbosAktualisiert, onSkip }: { onAbosAktualisiert?: () => void; onSkip?: () => void }) {
  const { api } = useApp();
  const { toast } = useToast();
  const [status, setStatus] = useState<BankStatus | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState("");
  const [abrufe, setAbrufe] = useState(false);
  const [übersprungen, setÜbersprungen] = useState(false);

  const statusLaden = useCallback(async () => {
    try {
      setStatus(await api<BankStatus>("GET", "/api/bank/status"));
    } catch (e: any) {
      setFehler(e.message);
    }
  }, [api]);

  useEffect(() => {
    void statusLaden();
  }, [statusLaden]);

  async function linkStarten() {
    setLaedt(true);
    setFehler("");
    try {
      const r = await api<{ linkToken: string }>("POST", "/api/bank/link-token");
      setLinkToken(r.linkToken);
    } catch (e: any) {
      setFehler(e.message);
    } finally {
      setLaedt(false);
    }
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        await api("POST", "/api/bank/exchange", {
          publicToken,
          institution: metadata?.institution?.name || "Bank",
        });
        toast({ title: "Bank verbunden", description: metadata?.institution?.name || "Verbindung hergestellt." });
        setLinkToken(null);
        await statusLaden();
        await abosHolen();
      } catch (e: any) {
        setFehler(e.message);
      }
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function abosHolen() {
    setAbrufe(true);
    setFehler("");
    try {
      const r = await api<any>("GET", "/api/bank/recurring");
      toast({
        title: "Abos aus der Bank übernommen",
        description: `${r.streams.length} wiederkehrende Buchungen erkannt, ${r.uebernommen} neu übernommen.`,
      });
      onAbosAktualisiert?.();
    } catch (e: any) {
      setFehler(e.message);
    } finally {
      setAbrufe(false);
    }
  }

  function überspringen() {
    setÜbersprungen(true);
    onSkip?.();
  }

  if (übersprungen) {
    return <div className="mb-4 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground" data-testid="status-bank-skipped">
      Bankverbindung übersprungen. Du kannst sie jederzeit hier im Profil nachholen.
    </div>;
  }

  return (
    <div className="mb-4 rounded-md border border-card-border bg-card p-3" data-testid="section-bank-verbinden">
      <div className="flex flex-wrap items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-medium">Bankverbindung</p>
        <Badge variant={status?.verbundeneBanken ? "default" : "secondary"} className="text-[10px]" data-testid="badge-bank-status">
          {status?.verbundeneBanken ? `${status.verbundeneBanken} Bank(en) verbunden` : "Bank nicht verbunden"}
        </Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!status?.configured || laedt}
            onClick={() => void linkStarten()}
            data-testid="button-connect-bank"
          >
            {laedt ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Bank verbinden
          </Button>
          {onSkip && <Button size="sm" variant="ghost" onClick={überspringen} data-testid="button-skip-bank">Jetzt überspringen</Button>}
          {(status?.verbundeneBanken ?? 0) > 0 && (
            <Button size="sm" variant="outline" disabled={abrufe} onClick={() => void abosHolen()} data-testid="button-sync-recurring">
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${abrufe ? "animate-spin" : ""}`} /> Abos neu erkennen
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="break-words" data-testid="text-bank-message">{status?.message || "Bank-Status wird geladen …"}</p>
      </div>
      {fehler && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive break-words" data-testid="text-bank-error">
          {fehler}
        </p>
      )}
    </div>
  );
}
