import { useLocation } from "wouter";
import { CalendarDays, Flame, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Page, PageHeader } from "@/components/Layout";
import { SparkAvatar } from "@/components/Avatar";
import { useApp } from "@/state";

function Heatmap({ days }: { days: { day: string; xp: number }[] }) {
  const map = new Map(days.map((d) => [d.day, d.xp]));
  const cells: { key: string; xp: number }[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 111);
  for (let i = 0; i < 112; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ key, xp: map.get(key) || 0 });
  }
  const level = (xp: number) => (xp === 0 ? 0 : xp < 20 ? 1 : xp < 60 ? 2 : xp < 140 ? 3 : 4);
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" data-testid="heatmap-streak">
      {cells.map((c) => (
        <div key={c.key} title={`${new Date(c.key).toLocaleDateString("de-DE")}: ${c.xp} XP`}
          className="h-3 w-3 rounded-[3px]"
          style={{ background: c.xp ? `hsl(var(--primary) / ${0.2 + level(c.xp) * 0.2})` : "hsl(var(--muted))" }} />
      ))}
    </div>
  );
}

export default function Profil() {
  const { user, companion, stats } = useApp();
  const [, navigate] = useLocation();
  const avatar = companion && { preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit };
  const activeSubjects = new Set((stats?.days || []).filter((d) => d.xp > 0).map((d) => d.day)).size;

  return (
    <Page>
      <PageHeader title="Profil" subtitle="Dein Fortschritt auf einen Blick." />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-card-border bg-card p-5">
        {avatar && <SparkAvatar config={avatar} size={90} mood="freudig" />}
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{user?.name || user?.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className="gap-1"><Trophy className="h-3 w-3" /> Rang {stats?.rank}</Badge>
            <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> {stats?.totalXp} XP</Badge>
          </div>
          <div className="mt-3 w-56">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${stats?.rankProgress || 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Noch {Math.max(0, (stats?.nextRankXp || 0) - (stats?.totalXp || 0))} XP bis zum nächsten Rang
            </p>
          </div>
        </div>
        <Button className="ml-auto" onClick={() => navigate("/wrapped")} data-testid="button-wrapped">Wochen-Rückblick öffnen</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Streak-Tage", value: stats?.streak ?? 0, icon: Flame },
          { label: "Gesamt-XP", value: stats?.totalXp ?? 0, icon: Sparkles },
          { label: "Aktive Tage", value: activeSubjects, icon: CalendarDays },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-card-border bg-card p-4" data-testid={`stat-${k.label}`}>
            <k.icon className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="font-display text-xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-card-border bg-card p-4 spark-scroll">
        <p className="mb-3 text-sm font-medium">Streak-Kalender (16 Wochen)</p>
        <Heatmap days={stats?.days || []} />
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>weniger</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: l ? `hsl(var(--primary) / ${0.2 + l * 0.2})` : "hsl(var(--muted))" }} />
          ))}
          <span>mehr</span>
        </div>
      </div>
    </Page>
  );
}
