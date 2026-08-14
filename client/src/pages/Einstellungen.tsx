import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle, Brain, Check, CreditCard, Download, Globe, KeyRound, LogOut, Palette,
  ShieldAlert, Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Skeleton } from "../components/ui/skeleton";
import { Page, PageHeader } from "../components/Layout";
import { SparkMark } from "../components/Logo";
import { Integrationen } from "../components/Integrationen";
import { useApp } from "../state";
import { useToast } from "../hooks/use-toast";
import { API_BASE } from "../lib/queryClient";

const THEMES = [
  { id: "nachtlabor", name: "Nachtlabor" },
  { id: "aurora", name: "Aurora Light" },
  { id: "terminal", name: "Retro-Terminal" },
  { id: "bio", name: "Bio-Grün" },
];

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-card-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Einstellungen() {
  const { api, user, settings, patchUser, patchSettings, setTheme, previewTheme, logout, token, refresh } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [memories, setMemories] = useState<any[] | null>(null);
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [worry, setWorry] = useState(0);

  useEffect(() => {
    void api<any[]>("GET", "/api/memories").then(setMemories).catch(() => setMemories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportData() {
    const res = await fetch(`${API_BASE}/api/export`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spark-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Page>
      <PageHeader title="Einstellungen" subtitle="Alles, was SPARK über dich weiß und wie es sich verhält." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Abo */}
        <Section title="Abo" icon={CreditCard}>
          <div className="flex items-center gap-3">
            <span className="text-primary"><SparkMark size={26} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">SPARK {settings?.plan === "plus" ? "Plus" : "Frei"}</p>
              <p className="text-xs text-muted-foreground">
                {settings?.plan === "plus" ? "Alle Funktionen freigeschaltet." : "Alle Kernfunktionen sind frei nutzbar."}
              </p>
            </div>
            <Button size="sm" variant={settings?.plan === "plus" ? "outline" : "default"} data-testid="button-upgrade"
              onClick={() => void patchSettings({ plan: settings?.plan === "plus" ? "frei" : "plus" })}>
              {settings?.plan === "plus" ? "Auf Frei wechseln" : "Auf Plus upgraden"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Hinweis: Diese Instanz enthält keine Zahlungsabwicklung — der Plan ist rein lokal.</p>
        </Section>

        {/* Personalisierung */}
        <Section title="Personalisierung" icon={Palette}>
          <Label className="text-xs">App-Design</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <Button key={t.id} size="sm" variant={user?.theme === t.id ? "default" : "outline"}
                onMouseEnter={() => previewTheme(t.id)} onMouseLeave={() => previewTheme(null)}
                onClick={() => void setTheme(t.id)} data-testid={`button-settings-theme-${t.id}`}>
                {t.name}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void patchUser({ onboarded: 0 } as any)} data-testid="button-open-companion-setup">
              Gesicht, Charakter & Stimme einrichten
            </Button>
          </div>
        </Section>

        {/* Konto */}
        <Section title="Konto" icon={KeyRound}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-account-name" />
                <Button size="sm" onClick={() => void patchUser({ name })} data-testid="button-save-name">Speichern</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={user?.email || ""} readOnly data-testid="input-account-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Passwort ändern</Label>
              <Input type="password" placeholder="Aktuelles Passwort" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} data-testid="input-pw-current" />
              <Input type="password" placeholder="Neues Passwort (min. 8 Zeichen)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} data-testid="input-pw-next" />
              <Button size="sm" data-testid="button-change-password"
                onClick={async () => {
                  try {
                    await api("PATCH", "/api/auth/password", pw);
                    toast({ title: "Passwort geändert" });
                    setPw({ current: "", next: "" });
                  } catch (e: any) { toast({ title: "Fehler", description: e.message }); }
                }}>Passwort ändern</Button>
            </div>
          </div>
        </Section>

        {/* Barrierefreiheit */}
        <Section title="Barrierefreiheit" icon={Globe}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="motion">Reduzierte Bewegung</Label>
              <Switch id="motion" checked={Boolean(settings?.reducedMotion)} onCheckedChange={(v) => void patchSettings({ reducedMotion: v ? 1 : 0 })} data-testid="switch-motion" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="contrast">Kontrastmodus</Label>
              <Switch id="contrast" checked={Boolean(settings?.highContrast)} onCheckedChange={(v) => void patchSettings({ highContrast: v ? 1 : 0 })} data-testid="switch-contrast" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Textgröße</Label>
                <span className="text-xs text-muted-foreground">{settings?.textScale ?? 100}%</span>
              </div>
              <Slider value={[settings?.textScale ?? 100]} min={85} max={130} step={5}
                onValueChange={(v) => void patchSettings({ textScale: v[0] })} data-testid="slider-textscale" />
            </div>
          </div>
        </Section>

        {/* Benachrichtigungen */}
        <Section title="Benachrichtigungen" icon={Check}>
          <div className="space-y-3">
            {[
              ["notifyDaily", "Täglicher Tagesvorschlag"],
              ["notifyStreak", "Streak-Erinnerung"],
              ["notifyReview", "Fällige Wiederholungen"],
              ["notifyMissions", "Missions-Fortschritt"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key}>{label}</Label>
                <Switch id={key} checked={Boolean((settings as any)?.[key])}
                  onCheckedChange={(v) => void patchSettings({ [key]: v ? 1 : 0 } as any)} data-testid={`switch-${key}`} />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Ehrlich gesagt: Diese Instanz versendet keine Push-Nachrichten. Die Schalter steuern, was SPARK dir in der App anzeigt.
            </p>
          </div>
        </Section>

        {/* Sprache */}
        <Section title="Sprache & Region" icon={Globe}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Sprache</Label><Input value={settings?.language || "de-DE"} onChange={(e) => void patchSettings({ language: e.target.value })} data-testid="input-language" /></div>
            <div className="space-y-1.5"><Label>Region</Label><Input value={settings?.region || "DE"} onChange={(e) => void patchSettings({ region: e.target.value })} data-testid="input-region" /></div>
          </div>
        </Section>

        <div className="lg:col-span-2"><Integrationen /></div>

        {/* Gedächtnis */}
        <Section title="Datenschutz & Gedächtnis" icon={Brain}>
          <p className="text-xs text-muted-foreground">Was SPARK über dich weiß ({memories?.length ?? 0} Einträge)</p>
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto spark-scroll">
            {!memories && <Skeleton className="h-20 w-full" />}
            {memories?.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Noch nichts gespeichert.</p>}
            {memories?.map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-md border border-card-border bg-background p-2 text-xs" data-testid={`row-memory-${m.id}`}>
                <div className="min-w-0 flex-1">
                  <p>{m.text}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{m.kind} · Wichtigkeit {m.importance}</p>
                </div>
                <button aria-label="Eintrag löschen" data-testid={`button-delete-memory-${m.id}`}
                  onClick={() => void api("DELETE", `/api/memories/${m.id}`).then(() => setMemories((x) => (x || []).filter((y) => y.id !== m.id)))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void exportData()} data-testid="button-export">
            <Download className="mr-1 h-4 w-4" /> Alle Daten exportieren (JSON)
          </Button>
        </Section>

        {/* Sorgen-Modus */}
        <section className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 lg:col-span-2" data-testid="section-worry">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Sorgen-Modus</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Löscht das gesamte Langzeitgedächtnis unwiderruflich. Chats und Fortschritt bleiben erhalten.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {worry === 0 && <Button variant="destructive" size="sm" onClick={() => setWorry(1)} data-testid="button-worry-1">Gedächtnis löschen</Button>}
            {worry === 1 && (
              <>
                <span className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Wirklich alles löschen?</span>
                <Button variant="destructive" size="sm" onClick={() => setWorry(2)} data-testid="button-worry-2">Ja, weiter</Button>
                <Button variant="ghost" size="sm" onClick={() => setWorry(0)}>Abbrechen</Button>
              </>
            )}
            {worry === 2 && (
              <>
                <span className="text-sm text-destructive">Letzte Bestätigung — das lässt sich nicht rückgängig machen.</span>
                <Button variant="destructive" size="sm" data-testid="button-worry-confirm"
                  onClick={async () => {
                    await api("DELETE", "/api/memories");
                    setMemories([]); setWorry(0);
                    toast({ title: "Gedächtnis gelöscht", description: "SPARK weiß jetzt nichts mehr über dich." });
                  }}>Endgültig löschen</Button>
                <Button variant="ghost" size="sm" onClick={() => setWorry(0)}>Abbrechen</Button>
              </>
            )}
          </div>
        </section>

        <div className="lg:col-span-2">
          <Button variant="outline" onClick={() => void logout()} data-testid="button-logout">
            <LogOut className="mr-1 h-4 w-4" /> Abmelden
          </Button>
          <Button variant="ghost" className="ml-2" onClick={() => navigate("/profil")} data-testid="button-goto-profile">Zum Profil</Button>
        </div>
      </div>
    </Page>
  );
}
