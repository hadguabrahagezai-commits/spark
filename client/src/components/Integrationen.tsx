import { useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plug, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/state";
import { API_BASE } from "@/lib/queryClient";

type Status = "verbunden" | "teilweise" | "nicht_konfiguriert";
type Integration = {
  id: string;
  name: string;
  status: Status;
  detail: string;
  hinweis: string;
  variablen: string[];
  konsole: string;
};

const BADGE: Record<Status, { text: string; className: string; Icon: any }> = {
  verbunden: { text: "Verbunden", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40", Icon: Check },
  teilweise: {
    text: "Schlüssel gesetzt, aber unvollständig",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/40",
    Icon: AlertTriangle,
  },
  nicht_konfiguriert: { text: "Nicht konfiguriert", className: "bg-muted text-muted-foreground border-border", Icon: X },
};

export function Integrationen() {
  const { api, token } = useApp();
  const [daten, setDaten] = useState<{ integrationen: Integration[]; google: any } | null>(null);
  const [pruefe, setPruefe] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Record<string, { ok: boolean; nachricht: string }>>({});
  const [laden, setLaden] = useState(false);

  async function neuLaden() {
    setLaden(true);
    try {
      setDaten(await api<any>("GET", "/api/integrations/status"));
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    void neuLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function testen(id: string) {
    setPruefe(id);
    try {
      const r = await api<{ ok: boolean; nachricht: string }>("POST", `/api/integrations/test/${id}`);
      setErgebnis((e) => ({ ...e, [id]: r }));
    } catch (e: any) {
      setErgebnis((x) => ({ ...x, [id]: { ok: false, nachricht: e.message } }));
    } finally {
      setPruefe(null);
      void neuLaden();
    }
  }

  return (
    <section className="rounded-lg border border-card-border bg-card p-4" data-testid="section-integrationen">
      <div className="mb-3 flex items-center gap-2">
        <Plug className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Integrationen</h2>
        <Badge variant="secondary" className="text-[10px]">Live-Status</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void neuLaden()} data-testid="button-integrations-refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${laden ? "animate-spin" : ""}`} />
          <span className="ml-1 hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground">
        Alle Schlüssel werden ausschließlich serverseitig aus der Datei <code>.env</code> gelesen. SPARK zeigt hier
        ungeschönt, was wirklich verbunden ist.
      </p>

      {!daten && <Skeleton className="h-64 w-full" />}

      <div className="grid gap-2 md:grid-cols-2">
        {daten?.integrationen.map((i) => {
          const b = BADGE[i.status];
          const r = ergebnis[i.id];
          return (
            <div
              key={i.id}
              className="flex flex-col gap-2 rounded-md border border-card-border bg-background p-3"
              data-testid={`card-integration-${i.id}`}
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-[8rem] flex-1">
                  <p className="text-sm font-medium leading-snug break-words">{i.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground break-words">{i.detail}</p>
                </div>
                <Badge variant="outline" className={`max-w-full shrink gap-1 whitespace-normal break-words text-left text-[10px] ${b.className}`}>
                  <b.Icon className="h-3 w-3 shrink-0" />
                  {b.text}
                </Badge>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground break-words">{i.hinweis}</p>

              <p className="text-[10px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                Variablen: {i.variablen.map((v) => <code key={v} className="mr-1 [overflow-wrap:anywhere]">{v}</code>)}
              </p>

              {r && (
                <p
                  className={`rounded border px-2 py-1 text-[11px] leading-relaxed break-words ${
                    r.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                  data-testid={`text-test-result-${i.id}`}
                >
                  {r.nachricht}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pruefe === i.id}
                  onClick={() => void testen(i.id)}
                  data-testid={`button-test-${i.id}`}
                >
                  {pruefe === i.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Verbindung testen
                </Button>
                <a
                  href={i.konsole}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                  data-testid={`link-console-${i.id}`}
                >
                  Konsole öffnen <ExternalLink className="h-3 w-3" />
                </a>
                {i.id === "google" && (
                  <>
                    {daten?.google?.konfiguriert && !daten?.google?.verbunden && (
                      <Button
                        size="sm"
                        onClick={() => {
                          window.location.href = `${API_BASE}/api/google/auth?token=${encodeURIComponent(token || "")}`;
                        }}
                        data-testid="button-google-connect"
                      >
                        Mit Google verbinden
                      </Button>
                    )}
                    {daten?.google?.verbunden && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await api("POST", "/api/google/disconnect");
                          void neuLaden();
                        }}
                        data-testid="button-google-disconnect"
                      >
                        Trennen
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
