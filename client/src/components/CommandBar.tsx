import { useState } from "react";
import { Search } from "lucide-react";

export default function CommandBar({ onAction }: { onAction: (text: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <div className="flex items-center gap-2 w-full max-w-lg">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Web suchen oder Befehl eingeben (z. B. 'Öffne YouTube')"
          className="h-9 w-full rounded-xl bg-background/60 pl-8 pr-3 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { onAction(q.trim()); setQ(""); } }} />
      </div>
      <button className="rounded-xl border border-border px-3 py-1 text-sm" onClick={() => { if (q.trim()) { onAction(q.trim()); setQ(""); } }}>
        Los
      </button>
    </div>
  );
}
