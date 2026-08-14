import { CalendarDays, Flame, Sparkles } from "lucide-react";
import { Page, PageHeader } from "../components/Layout";
import { SparkAvatar } from "../components/Avatar";
import JarvisSphere from "../components/JarvisSphere";
import { BankVerbinden } from "../components/BankVerbinden";
import { useApp } from "../state";

function Heatmap({ days }: { days: { day: string; xp: number }[] }) {
  const activity = new Map(days.map((day) => [day.day, day.xp]));
  const start = new Date();
  start.setDate(start.getDate() - 111);
  const cells = Array.from({ length: 112 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { key, xp: activity.get(key) || 0 };
  });
  const opacity = (xp: number) => (xp === 0 ? 0 : xp < 20 ? 0.35 : xp < 60 ? 0.55 : xp < 140 ? 0.75 : 1);
  return <div className="grid grid-flow-col grid-rows-7 gap-1" data-testid="heatmap-streak">
    {cells.map((cell) => <div key={cell.key} title={`${new Date(cell.key).toLocaleDateString("de-DE")}: ${cell.xp} XP`} className="h-3 w-3 rounded-[3px]" style={{ background: cell.xp ? `hsl(var(--primary) / ${opacity(cell.xp)})` : "hsl(var(--muted))" }} />)}
  </div>;
}

export default function Profil() {
  const { user, companion, stats } = useApp();
  const avatar = companion && { preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit };
  const activeDays = new Set((stats?.days || []).filter((day) => day.xp > 0 || day.minutes > 0).map((day) => day.day)).size;

  return <Page>
    <PageHeader title="Profil" subtitle="Dein Fortschritt und deine Verbindungen an einem Ort." />
    <div className="spark-hero flex flex-wrap items-center gap-4 rounded-2xl p-6">
      {avatar && <JarvisSphere size={90} />}
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold">{user?.name || user?.email}</p>
        <p className="mt-1 text-sm text-muted-foreground">{stats?.totalXp ?? 0} XP aus deinen abgeschlossenen Aktivitäten</p>
      </div>
    </div>
    <div className="mt-4"><BankVerbinden /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {[{ label: "Streak-Tage", value: stats?.streak ?? 0, icon: Flame }, { label: "Gesamt-XP", value: stats?.totalXp ?? 0, icon: Sparkles }, { label: "Aktive Tage", value: activeDays, icon: CalendarDays }].map((item) => <div key={item.label} className="spark-panel rounded-2xl p-5"><item.icon className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">{item.label}</p><p className="font-display text-2xl font-semibold">{item.value}</p></div>)}
    </div>
    <div className="spark-panel mt-5 overflow-x-auto rounded-2xl p-5 spark-scroll">
      <p className="mb-3 text-sm font-medium">Aktivitätskalender (16 Wochen)</p>
      <Heatmap days={stats?.days || []} />
    </div>
  </Page>;
}
