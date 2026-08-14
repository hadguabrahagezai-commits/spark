import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useApp } from "../state";
import { useToast } from "../hooks/use-toast";

const LOCAL_AVATARS = [
  { id: "photoreal-1", name: "Photoreal Studio" , preview: "/assets/avatars/photoreal-1.svg" },
  { id: "photoreal-2", name: "Warm Portrait" , preview: "/assets/avatars/photoreal-2.svg" },
  { id: "cyberpunk-1", name: "Cyberpunk Neon" , preview: "/assets/avatars/cyberpunk-1.svg" },
  { id: "glass-1", name: "Glass Portrait" , preview: "/assets/avatars/glass-1.svg" },
  { id: "studio-bw", name: "Studio B/W" , preview: "/assets/avatars/studio-bw.svg" },
];

/** Reiter „Live-Avatar“: ersetzt externe Live-Avatar-Auswahl durch lokale Premium-Avatare. */
export function LiveAvatarAuswahl() {
  const { companion, patchCompanion } = useApp();
  const { toast } = useToast();
  const [modus, setModus] = useState(companion?.avatarMode || "svg");

  return (
    <div className="space-y-4" data-testid="section-live-avatar">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={modus === "svg" ? "secondary" : "default"} data-testid="badge-avatar-mode">SPARK Premium Avatare</Badge>
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground break-words">Wähle ein hochaufgelöstes Avatar-Design, lokal ausgeliefert.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={modus === "svg" ? "default" : "outline"} onClick={() => { setModus("svg"); void patchCompanion({ avatarMode: "svg" } as any); }} data-testid="button-avatar-mode-svg">SPARK-Avatar (SVG, lokal)</Button>
        <Button size="sm" variant={modus === "image" ? "default" : "outline"} onClick={() => { setModus("image"); void patchCompanion({ avatarMode: "image" } as any); }} data-testid="button-avatar-mode-image">Premium Bilder</Button>
      </div>

      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto spark-scroll sm:grid-cols-3">
        {LOCAL_AVATARS.map((a) => {
          const aktiv = companion?.liveAvatarId === a.id || companion?.preset === a.id;
          return (
            <button key={a.id} onClick={async () => {
              await patchCompanion({ liveAvatarId: a.id, liveAvatarName: a.name, avatarMode: "image", preset: a.id } as any);
              toast({ title: "Avatar gewählt", description: a.name });
            }} className={`overflow-hidden rounded-md border text-left hover-elevate ${aktiv ? "border-primary bg-primary/10" : "border-card-border bg-card"}`} data-testid={`button-live-avatar-${a.id}`}>
              <div className="aspect-[3/4] w-full bg-muted">
                <img src={a.preview} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="flex items-start gap-1 p-1.5">
                <span className="min-w-0 flex-1 break-words text-[11px] leading-tight">{a.name}</span>
                {aktiv && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
