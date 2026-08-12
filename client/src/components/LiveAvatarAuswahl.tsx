import { useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";

type Avatar = { id: string; name: string; vorschauUrl?: string; quelle: string };

/** Reiter „Live-Avatar“: echte HeyGen-Avatare, ehrlicher Rückfall auf den SVG-Avatar. */
export function LiveAvatarAuswahl() {
  const { api, companion, patchCompanion } = useApp();
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [liste, setListe] = useState<{ ok: boolean; avatare: Avatar[]; nachricht: string } | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function laden() {
    setLaedt(true);
    try {
      setStatus(await api<any>("GET", "/api/avatar/status"));
      setListe(await api<any>("GET", "/api/avatar/list"));
    } catch (e: any) {
      setListe({ ok: false, avatare: [], nachricht: e.message });
    } finally {
      setLaedt(false);
    }
  }

  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modus = companion?.avatarMode || "svg";

  return (
    <div className="space-y-4" data-testid="section-live-avatar">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status?.konfiguriert ? "default" : "secondary"} data-testid="badge-avatar-mode">
          {status?.konfiguriert ? "HeyGen konfiguriert" : "SPARK-Avatar (lokal)"}
        </Badge>
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground break-words">
          {status?.hinweis || "Status wird geladen …"}
        </p>
        <Button size="sm" variant="ghost" onClick={() => void laden()} data-testid="button-avatar-refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${laedt ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={modus === "svg" ? "default" : "outline"}
          onClick={() => void patchCompanion({ avatarMode: "svg" } as any)}
          data-testid="button-avatar-mode-svg"
        >
          SPARK-Avatar (SVG, lokal)
        </Button>
        <Button
          size="sm"
          variant={modus === "heygen" ? "default" : "outline"}
          disabled={!status?.konfiguriert}
          onClick={() => void patchCompanion({ avatarMode: "heygen" } as any)}
          data-testid="button-avatar-mode-heygen"
        >
          <Video className="mr-1 h-3.5 w-3.5" /> HeyGen Live
        </Button>
        {!status?.konfiguriert && (
          <a
            href="https://app.heygen.com/settings?nav=API"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 self-center text-[11px] text-primary underline-offset-2 hover:underline"
          >
            HEYGEN_API_KEY holen <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {!liste && <Skeleton className="h-40 w-full" />}

      {liste && !liste.ok && (
        <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground break-words" data-testid="text-avatar-hint">
          {liste.nachricht} SPARK nutzt bis dahin den eigenen SVG-Avatar mit Viseme-Lip-Sync — dieser funktioniert
          vollständig ohne externe Dienste.
        </p>
      )}

      {liste?.ok && (
        <>
          <p className="text-[11px] text-muted-foreground">{liste.nachricht}</p>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto spark-scroll sm:grid-cols-3">
            {liste.avatare.map((a) => {
              const aktiv = companion?.liveAvatarId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={async () => {
                    await patchCompanion({ liveAvatarId: a.id, liveAvatarName: a.name, avatarMode: "heygen" } as any);
                    toast({ title: "Live-Avatar gewählt", description: a.name });
                  }}
                  className={`overflow-hidden rounded-md border text-left hover-elevate ${aktiv ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
                  data-testid={`button-live-avatar-${a.id}`}
                >
                  <div className="aspect-[3/4] w-full bg-muted">
                    {a.vorschauUrl ? (
                      <img src={a.vorschauUrl} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Video className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-1 p-1.5">
                    <span className="min-w-0 flex-1 break-words text-[11px] leading-tight">{a.name}</span>
                    {aktiv && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
