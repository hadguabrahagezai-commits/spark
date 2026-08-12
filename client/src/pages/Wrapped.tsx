import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/Layout";
import { useApp } from "@/state";

type Wrapped = {
  lernminuten: number; xp: number; aktiveTage: number; geloesteAufgaben: number;
  gespartesGeld: number; besterTag: string; besterTagGrund: string; rang: string; streak: number;
};

export default function WrappedPage() {
  const { api, user } = useApp();
  const [data, setData] = useState<Wrapped | null>(null);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { api<Wrapped>("GET", "/api/wrapped").then(setData).catch((e) => setError(e.message)); }, [api]);

  const slides = data
    ? [
        { title: "Deine Woche", value: `${data.aktiveTage} aktive Tage`, sub: `Streak: ${data.streak} Tage in Folge` },
        { title: "Gelernt", value: `${data.lernminuten} Minuten`, sub: `${data.xp} XP gesammelt` },
        { title: "Erledigt", value: `${data.geloesteAufgaben} Aufgaben`, sub: "Kleine Schritte, echte Wirkung." },
        { title: "Gespart", value: `${data.gespartesGeld.toFixed(2)} €`, sub: "aus deaktivierten Abos, monatlich" },
        { title: "Bester Tag", value: new Date(data.besterTag).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }), sub: data.besterTagGrund },
        { title: "Dein Rang", value: data.rang, sub: "Ein Funke reicht — weiter so." },
      ]
    : [];

  function share() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = 1080; canvas.height = 1350;
    const style = getComputedStyle(document.documentElement);
    const bg = `hsl(${style.getPropertyValue("--background").trim()})`;
    const fg = `hsl(${style.getPropertyValue("--foreground").trim()})`;
    const primary = `hsl(${style.getPropertyValue("--primary").trim()})`;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(540, 140); ctx.lineTo(620, 260); ctx.lineTo(540, 380); ctx.lineTo(460, 260); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "bold 78px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("SPARK Wrapped", 540, 500);
    ctx.font = "36px sans-serif";
    ctx.fillText(user?.name || "Meine Woche", 540, 560);
    if (data) {
      const lines = [
        `${data.aktiveTage} aktive Tage`,
        `${data.lernminuten} Lernminuten`,
        `${data.xp} XP`,
        `${data.geloesteAufgaben} Aufgaben erledigt`,
        `${data.gespartesGeld.toFixed(2)} € gespart`,
        `Rang: ${data.rang}`,
      ];
      ctx.font = "bold 52px sans-serif";
      lines.forEach((l, i) => {
        ctx.fillStyle = i % 2 ? primary : fg;
        ctx.fillText(l, 540, 700 + i * 90);
      });
    }
    ctx.fillStyle = fg; ctx.font = "32px sans-serif";
    ctx.fillText("Ein Funke reicht.", 540, 1280);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "spark-wrapped.png";
    a.click();
  }

  return (
    <Page>
      <PageHeader title="Wochen-Rückblick" subtitle="Deine letzten 7 Tage als kurze Geschichte." />
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!data && !error && <Skeleton className="h-72 w-full" />}

      {data && (
        <>
          <div className="relative overflow-hidden rounded-lg border border-card-border spark-surface p-8 text-center" data-testid="card-wrapped">
            <div className="mb-4 flex justify-center gap-1">
              {slides.map((_, i) => (
                <span key={i} className={`h-1 w-8 rounded-full transition-colors ${i <= slide ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={slide} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.35 }}>
                <p className="text-sm text-muted-foreground">{slides[slide].title}</p>
                <p className="mt-3 font-display text-3xl font-semibold spark-gradient-text" data-testid="text-wrapped-value">{slides[slide].value}</p>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{slides[slide].sub}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" disabled={slide === 0} onClick={() => setSlide((s) => s - 1)} aria-label="Zurück" data-testid="button-wrapped-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={slide >= slides.length - 1} onClick={() => setSlide((s) => s + 1)} aria-label="Weiter" data-testid="button-wrapped-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button className="mt-4" onClick={share} data-testid="button-share-wrapped">
            <Download className="mr-1 h-4 w-4" /> Mit Freunden teilen (Bild herunterladen)
          </Button>
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </Page>
  );
}
