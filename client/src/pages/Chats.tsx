import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, Copy, Mic, Paperclip, Pin, PinOff, Plus, RefreshCw, Search, Send,
  Square, ThumbsDown, ThumbsUp, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/Markdown";
import { SparkAvatar } from "@/components/Avatar";
import { VoiceModal } from "@/components/VoiceModal";
import { useApp } from "@/state";
import { API_BASE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ChatRow = { id: number; title: string; pinned: number; updatedAt: number; preview: string; count: number };
type Msg = { id: number; role: string; content: string; mood: string; rating: number; attachment: string };

const STARTERS = [
  "Hilf mir, meinen Tag zu sortieren.",
  "Erkläre mir Zinseszins in 3 Sätzen.",
  "Ich habe zu viel um die Ohren — wo fange ich an?",
  "Mach mir einen Lernplan für diese Woche.",
];

export default function Chats() {
  const { api, token, companion, refresh } = useApp();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [attachment, setAttachment] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceReply, setVoiceReply] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [mobileList, setMobileList] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const avatar = companion && { preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair, hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit };

  async function loadChats(select?: number) {
    const list = await api<ChatRow[]>("GET", "/api/chats");
    setChats(list);
    if (select) setActiveId(select);
    else if (!activeId && list.length) setActiveId(list[0].id);
  }

  async function loadMessages(id: number) {
    setMessages(await api<Msg[]>("GET", `/api/chats/${id}/messages`));
  }

  useEffect(() => { void loadChats(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (activeId) void loadMessages(activeId); }, [activeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  async function newChat() {
    const chat = await api<ChatRow>("POST", "/api/chats", { title: "Neuer Chat" });
    await loadChats(chat.id);
    setMessages([]);
    setMobileList(false);
  }

  async function send(text: string, regenerate = false) {
    let chatId = activeId;
    if (!chatId) {
      const chat = await api<ChatRow>("POST", "/api/chats", {});
      chatId = chat.id;
      setActiveId(chat.id);
    }
    setBusy(true); setError(""); setStreaming("");
    if (!regenerate) {
      setMessages((m) => [...m, { id: Date.now(), role: "user", content: text, mood: "neutral", rating: 0, attachment }]);
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, message: text, attachment, regenerate }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Fehler ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const payload = JSON.parse(part.slice(6));
          if (payload.delta) { full += payload.delta; setStreaming(full); }
          if (payload.error) setError(payload.error);
        }
      }
      setAttachment("");
      if (full.trim() && !regenerate) {
        setVoiceReply(full);
        setVoiceOpen(true);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setBusy(false);
      setStreaming("");
      abortRef.current = null;
      if (chatId) await loadMessages(chatId);
      await loadChats();
      await refresh();
      window.setTimeout(() => { void loadChats(); }, 4000);
    }
  }

  async function regenerate() {
    if (!activeId) return;
    await api("POST", "/api/chat/regenerate", { chatId: activeId });
    await loadMessages(activeId);
    await send("", true);
  }

  async function rate(id: number, value: number) {
    await api("PATCH", `/api/messages/${id}/rating`, { rating: value });
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, rating: value } : x)));
  }

  const filtered = (chats || []).filter((c) => c.title.toLowerCase().includes(query.toLowerCase()) || c.preview.toLowerCase().includes(query.toLowerCase()));
  const activeChat = chats?.find((c) => c.id === activeId);

  return (
    <div className="spark-chat flex h-full flex-col md:flex-row">
      {/* Chatliste */}
      <aside className={`w-full shrink-0 border-r border-border bg-card/30 md:flex md:w-80 md:flex-col ${mobileList ? "flex flex-col" : "hidden"}`} data-testid="list-chats">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chats durchsuchen" className="h-10 rounded-xl bg-background/70 pl-8" data-testid="input-search-chats" />
          </div>
          <Button size="icon" onClick={() => void newChat()} data-testid="button-new-chat" aria-label="Neuer Chat"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto spark-scroll p-3">
          {!chats && <><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></>}
          {chats && filtered.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Noch keine Chats. Starte mit „+".
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.id}
              className={`group flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-all hover-elevate ${activeId === c.id ? "border-primary/40 bg-primary/10 shadow-sm" : "border-transparent hover:border-border"}`}
              onClick={() => { setActiveId(c.id); setMobileList(false); }}
              data-testid={`row-chat-${c.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">{c.preview || "Leerer Chat"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(c.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <div className="flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); void api("PATCH", `/api/chats/${c.id}`, { pinned: c.pinned ? 0 : 1 }).then(() => loadChats()); }}
                  aria-label="Anpinnen" data-testid={`button-pin-${c.id}`}>
                  {c.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); void api("DELETE", `/api/chats/${c.id}`).then(() => { setActiveId(null); return loadChats(); }); }}
                  aria-label="Löschen" data-testid={`button-delete-chat-${c.id}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
              {Boolean(c.pinned) && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </div>
          ))}
        </div>
      </aside>

      {/* Chatfenster */}
      <section className={`flex min-w-0 flex-1 flex-col ${mobileList ? "hidden md:flex" : "flex"}`}>
        <header className="flex min-h-16 items-center gap-2 border-b border-border bg-background/45 px-4 py-3 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileList(true)} aria-label="Zur Chatliste" data-testid="button-back-list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {avatar && <SparkAvatar config={avatar} size={34} animate={false} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{activeChat?.title || "Neuer Chat"}</p>
            <p className="text-[11px] text-muted-foreground">{busy ? "Antwort wird live erstellt …" : `${companion?.name || "Spark"} · KI-Assistenz`}</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setVoiceOpen(true)} aria-label="Sprachchat" data-testid="button-voice-open">
            <Mic className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto spark-scroll p-4 md:p-7">
          {messages.length === 0 && !streaming && (
            <div className="mx-auto max-w-md py-10 text-center">
              {avatar && <SparkAvatar config={avatar} size={110} mood="freudig" className="mx-auto" />}
              <p className="mt-3 text-sm text-muted-foreground">Womit soll ich anfangen?</p>
              <div className="mt-4 grid gap-2">
                {STARTERS.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto whitespace-normal py-2 text-left"
                    onClick={() => void send(s)} data-testid={`button-starter-${s.slice(0, 10)}`}>{s}</Button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`} data-testid={`message-${m.id}`}>
                {m.role !== "user" && avatar && <SparkAvatar config={avatar} size={30} animate={false} className="mt-1 shrink-0" />}
                <div className={`max-w-[85%] min-w-0 rounded-lg border px-3 py-2 ${m.role === "user" ? "border-primary/40 bg-primary/10" : "border-card-border bg-card"}`}>
                  {m.attachment && <Badge variant="secondary" className="mb-1.5 text-[10px]">Anhang: {m.attachment}</Badge>}
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown>{m.content}</Markdown>}
                  {m.role === "assistant" && (
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Kopieren" data-testid={`button-copy-${m.id}`}
                        onClick={() => { void navigator.clipboard.writeText(m.content); setCopiedId(m.id); window.setTimeout(() => setCopiedId(null), 1500); }}>
                        {copiedId === m.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${m.rating === 1 ? "text-primary" : ""}`} aria-label="Hilfreich"
                        onClick={() => void rate(m.id, 1)} data-testid={`button-up-${m.id}`}><ThumbsUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${m.rating === -1 ? "text-destructive" : ""}`} aria-label="Nicht hilfreich"
                        onClick={() => void rate(m.id, -1)} data-testid={`button-down-${m.id}`}><ThumbsDown className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void regenerate()} data-testid={`button-regenerate-${m.id}`}>
                        <RefreshCw className="h-3.5 w-3.5" /> Neu
                      </Button>
                      <Badge variant="outline" className="ml-auto text-[10px]">{m.mood}</Badge>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {streaming && (
            <div className="flex gap-3">
              {avatar && <SparkAvatar config={avatar} size={30} speaking amplitude={0.6} className="mt-1 shrink-0" />}
              <div className="max-w-[85%] min-w-0 rounded-2xl border border-card-border bg-card/90 px-4 py-3 shadow-sm">
                <Markdown>{streaming}</Markdown>
              </div>
            </div>
          )}
          {busy && !streaming && (
            <div className="flex gap-3"><Skeleton className="h-16 w-2/3" /></div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm" data-testid="status-chat-error">
              <p className="text-destructive">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void regenerate()}>Erneut versuchen</Button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border bg-background/80 p-3 pb-20 backdrop-blur-xl md:p-5 md:pb-5">
          {attachment && (
            <Badge variant="secondary" className="mb-2 gap-1">
              Anhang: {attachment}
              <button onClick={() => setAttachment("")} aria-label="Anhang entfernen"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-border bg-card/85 p-2 shadow-lg shadow-black/5">
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border hover-elevate" title="Datei anhängen">
              <Paperclip className="h-4 w-4" />
              <input type="file" className="hidden" data-testid="input-attachment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setAttachment(`${f.name} (${Math.round(f.size / 1024)} kB)`);
                  toast({ title: "Anhang vorgemerkt", description: "SPARK erhält Dateiname und Größe als Kontext. Bildinhalte werden nicht hochgeladen." });
                }} />
            </label>
            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)} rows={1}
              placeholder="Frage etwas, plane etwas oder denke laut …" className="max-h-40 min-h-[42px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              data-testid="input-message"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !busy) { const t = input; setInput(""); void send(t); }
                }
              }}
            />
            {busy ? (
              <Button variant="destructive" size="icon" onClick={() => abortRef.current?.abort()} data-testid="button-stop" aria-label="Stopp">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" disabled={!input.trim()} onClick={() => { const t = input; setInput(""); void send(t); }} data-testid="button-send" aria-label="Senden">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <VoiceModal open={voiceOpen} onOpenChange={(value) => { setVoiceOpen(value); if (!value) setVoiceReply(""); }} chatId={activeId} initialText={voiceReply} onExchange={() => activeId && loadMessages(activeId)} />
    </div>
  );
}
