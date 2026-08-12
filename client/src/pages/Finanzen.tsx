import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Ban, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page, PageHeader } from "@/components/Layout";
import { useApp } from "@/state";
import { BankVerbinden } from "@/components/BankVerbinden";
import { useToast } from "@/hooks/use-toast";

type Sub = { id: number; name: string; category: string; amount: number; cycle: string; lastUsed: string; source: string; active: number };
type Data = { subs: Sub[]; monatlich: number; jaehrlich: number; doppelteKategorien: string[]; banking: { configured: boolean; message: string } };

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Finanzen() {
  const { api } = useApp();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monatlich", category: "sonstiges", lastUsed: "" });

  const load = async () => {
    try { setData(await api<Data>("GET", "/api/subscriptions")); setError(""); }
    catch (e: any) { setError(e.message); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const monthly = (s: Sub) => (s.cycle === "jährlich" ? s.amount / 12 : s.amount);
  const unused = (data?.subs || []).filter((s) => /Monat/i.test(s.lastUsed));
  const savings = unused.reduce((a, b) => a + monthly(b), 0);

  const byCategory = Object.entries(
    (data?.subs || []).reduce<Record<string, number>>((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + monthly(s);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const chartData = (data?.subs || []).slice(0, 8).map((s) => ({ name: s.name, Kosten: Number(monthly(s).toFixed(2)) }));

  return (
    <Page>
      <PageHeader
        title="Finanzen & Abo-Checker"
        subtitle="Alle Kosten im Blick — doppelte und ungenutzte Abos erkennen."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)} data-testid="button-import-csv"><Upload className="mr-1 h-4 w-4" /> CSV</Button>
            <Button onClick={() => setOpen(true)} data-testid="button-add-sub"><Plus className="mr-1 h-4 w-4" /> Abo</Button>
          </div>
        }
      />

      {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <BankVerbinden onAbosAktualisiert={() => void load()} />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Monatlich", value: `${data?.monatlich?.toFixed(2) ?? "—"} €`, icon: Wallet },
          { label: "Jährlich", value: `${data?.jaehrlich?.toFixed(2) ?? "—"} €`, icon: Wallet },
          { label: "Sparpotenzial / Monat", value: `${savings.toFixed(2)} €`, icon: Ban },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-card-border bg-card p-4" data-testid={`kpi-${k.label}`}>
            <k.icon className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="font-display text-xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      {(data?.doppelteKategorien.length ?? 0) > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-chart-4/40 bg-chart-4/10 p-3 text-sm" data-testid="status-duplicates">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-4" />
          <p>Mehrfach belegte Kategorien: {data!.doppelteKategorien.join(", ")}. Prüfe, ob du wirklich alle brauchst.</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-card-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Monatskosten je Abo</p>
          {!data ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: -18, right: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }} />
                <Bar dataKey="Kosten" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-lg border border-card-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Verteilung nach Kategorie</p>
          {!data ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={78} label={{ fontSize: 10 }}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {data?.subs.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-card-border bg-card p-3" data-testid={`row-sub-${s.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.category} · zuletzt genutzt: {s.lastUsed || "unbekannt"}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{s.source}</Badge>
            {/Monat/i.test(s.lastUsed) && <Badge variant="secondary" className="text-[10px]">ungenutzt?</Badge>}
            <span className="text-sm font-medium">{s.amount.toFixed(2)} € / {s.cycle === "jährlich" ? "Jahr" : "Monat"}</span>
            <Button size="icon" variant="ghost" aria-label="Abo löschen" data-testid={`button-delete-sub-${s.id}`}
              onClick={() => void api("DELETE", `/api/subscriptions/${s.id}`).then(load)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {data?.subs.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Noch keine Abos erfasst. Lege eines an oder importiere eine CSV.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-add-sub">
          <DialogHeader><DialogTitle className="text-base">Abo hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-sub-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Betrag (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-sub-amount" /></div>
              <div className="space-y-1.5">
                <Label>Zyklus</Label>
                <div className="flex gap-1.5">
                  {["monatlich", "jährlich"].map((c) => (
                    <Button key={c} size="sm" variant={form.cycle === c ? "default" : "outline"} onClick={() => setForm({ ...form, cycle: c })} data-testid={`button-cycle-${c}`}>{c}</Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Kategorie</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="input-sub-category" /></div>
            <div className="space-y-1.5"><Label>Zuletzt genutzt</Label><Input value={form.lastUsed} onChange={(e) => setForm({ ...form, lastUsed: e.target.value })} placeholder="z. B. vor 2 Wochen" data-testid="input-sub-lastused" /></div>
            <Button className="w-full" disabled={!form.name || !form.amount} data-testid="button-save-sub"
              onClick={async () => {
                await api("POST", "/api/subscriptions", { ...form, amount: parseFloat(form.amount) });
                setForm({ name: "", amount: "", cycle: "monatlich", category: "sonstiges", lastUsed: "" });
                setOpen(false); await load();
              }}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent data-testid="dialog-csv">
          <DialogHeader><DialogTitle className="text-base">CSV importieren</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Format je Zeile: <code>Name;Betrag;Zyklus;Kategorie</code></p>
          <Textarea rows={7} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Musikdienst;10,99;monatlich;unterhaltung"} data-testid="input-csv" />
          <Button disabled={!csv.trim()} data-testid="button-run-import"
            onClick={async () => {
              const res = await api<{ importiert: number }>("POST", "/api/subscriptions/import", { csv });
              toast({ title: "Import abgeschlossen", description: `${res.importiert} Einträge übernommen.` });
              setCsv(""); setCsvOpen(false); await load();
            }}>Importieren</Button>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
