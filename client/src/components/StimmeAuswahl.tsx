import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/state";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/queryClient";

export type VoiceEntry = {
  id: string;
  name: string;
  provider?: "elevenlabs" | "heygen" | "openai";
  vorschauUrl?: string;
  kategorie?: string;
  labels?: Record<string, string>;
  beschreibung?: string;
};
export type VoiceListe = {
  source: "elevenlabs" | "openai";
  voices: VoiceEntry[];
  hinweis: string;
  standardStimme: string;
  regler: { stability: number; similarity: number; style: number };
  fehler?: string;
};

const QUELLE_TEXT: Record<VoiceListe["source"], string> = {
  elevenlabs: "ElevenLabs (echte Stimmen)",
  openai: "OpenAI-TTS",
};

const PROBE_SATZ = "Hallo, ich bin dein SPARK-Companion. Schön, dass du da bist.";
const CONSENT_SENTENCE =
  "Ich stimme zu, dass SPARK meine Stimme für ein persönliches Stimmprofil verwenden darf.";

/** Echte Stimmenauswahl mit echtem Vorschau-Audio und echtem Stimmklonen. */
export function StimmeAuswahl({ companionName }: { companionName: string }) {
  const { api, token, companion, patchCompanion } = useApp();
  const { toast } = useToast();
  const [liste, setListe] = useState<VoiceListe | null>(null);
  const [gewaehlt, setGewaehlt] = useState(companion?.voiceId || "");
  const [stability, setStability] = useState(companion?.voiceStability ?? 0.5);
  const [similarity, setSimilarity] = useState(companion?.voiceSimilarity ?? 0.75);
  const [style, setStyle] = useState(companion?.voiceStyle ?? 0);
  const [spielt, setSpielt] = useState<string | null>(null);
  const [klont, setKlont] = useState(false);
  const [aufnahme, setAufnahme] = useState(false);
  const [heygenVoiceId, setHeygenVoiceId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    void api<VoiceListe>("GET", "/api/voice/voices")
      .then((l) => {
        setListe(l);
        setStability((s: number) => (companion?.voiceId ? s : l.regler.stability));
        setSimilarity((s: number) => (companion?.voiceId ? s : l.regler.similarity));
        setStyle((s: number) => (companion?.voiceId ? s : l.regler.style));
        if (!gewaehlt && l.standardStimme) setGewaehlt(l.standardStimme);
      })
      .catch(() => setListe({ source: "openai", voices: [], hinweis: "Stimmliste konnte nicht geladen werden.", standardStimme: "", regler: { stability: 0.5, similarity: 0.75, style: 0 } }));
    void api<any>("GET", "/api/avatar/status").then((status) => setHeygenVoiceId(status?.voiceId || "")).catch(() => {});
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function vorschau(v: VoiceEntry) {
    audioRef.current?.pause();
    setSpielt(v.id);
    try {
      if (v.vorschauUrl) {
        const a = new Audio(v.vorschauUrl);
        audioRef.current = a;
        a.onended = () => setSpielt(null);
        await a.play();
        return;
      }
      const res = await fetch(`${API_BASE}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: PROBE_SATZ, voiceId: v.id, voiceProvider: v.provider || liste?.source, stability, similarity, style }),
      });
      const typ = res.headers.get("content-type") || "";
      if (!res.ok || typ.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Vorschau nicht möglich", description: data.message || data.reason || `Fehler ${res.status}` });
        setSpielt(null);
        return;
      }
      const blob = await res.blob();
      const a = new Audio(URL.createObjectURL(blob));
      audioRef.current = a;
      a.onended = () => setSpielt(null);
      await a.play();
    } catch (e: any) {
      toast({ title: "Vorschau fehlgeschlagen", description: e.message });
      setSpielt(null);
    }
  }

  async function speichern(voiceId: string, provider: "elevenlabs" | "openai" | "heygen" = liste?.source || "elevenlabs") {
    setGewaehlt(voiceId);
    await patchCompanion({
      voiceId,
      voiceProvider: provider,
      voiceStability: stability,
      voiceSimilarity: similarity,
      voiceStyle: style,
    } as any);
  }

  async function reglerSpeichern() {
    await patchCompanion({ voiceStability: stability, voiceSimilarity: similarity, voiceStyle: style } as any);
    toast({ title: "Feinregler gespeichert" });
  }

  async function klonen() {
    if (aufnahme) {
      recRef.current?.stop();
      setAufnahme(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setKlont(true);
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const buf = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          const res = await api<any>("POST", "/api/voice/clone", {
            name: `${companionName || "SPARK"}-Stimme`,
            audioBase64: btoa(binary),
            mimeType: "audio/webm",
            consent: true,
          });
          setGewaehlt(res.voiceId);
          toast({ title: "Stimme geklont", description: res.nachricht });
          void api<VoiceListe>("GET", "/api/voice/voices").then(setListe);
        } catch (e: any) {
          toast({ title: "Stimmklonen nicht möglich", description: e.message });
        } finally {
          setKlont(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setAufnahme(true);
      window.setTimeout(() => {
        if (rec.state === "recording") {
          rec.stop();
          setAufnahme(false);
        }
      }, 12000);
    } catch {
      toast({ title: "Mikrofon nicht verfügbar", description: "Bitte den Zugriff erlauben." });
    }
  }

  if (!liste) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4" data-testid="section-stimme-live">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" data-testid="badge-voice-source">
          {QUELLE_TEXT[liste.source]}
        </Badge>
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground break-words">{liste.hinweis}</p>
      </div>
      {liste.fehler && (
        <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive break-words">
          {liste.fehler}
        </p>
      )}

      {liste.voices.length > 0 ? (
        <div className="grid max-h-64 gap-2 overflow-y-auto spark-scroll sm:grid-cols-2">
          {liste.voices.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-2 rounded-md border p-2 ${gewaehlt === v.id ? "border-primary bg-primary/10" : "border-card-border bg-card"}`}
              data-testid={`row-voice-${v.id}`}
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => void speichern(v.id, v.provider || liste.source)} data-testid={`button-select-voice-${v.id}`}>
                <p className="truncate text-xs font-medium">{v.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {v.beschreibung ||
                    [v.labels?.gender, v.labels?.accent, v.labels?.age, v.labels?.use_case].filter(Boolean).join(" · ") ||
                    v.kategorie ||
                    "Stimme"}
                </p>
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label={`${v.name} anhören`}
                onClick={() => void vorschau(v)}
                data-testid={`button-preview-voice-${v.id}`}
              >
                {spielt === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          Keine Anbieter-Stimmen verfügbar. Prüfe die ElevenLabs- oder OpenAI-Konfiguration.
        </p>
      )}

      {heygenVoiceId && (
        <div className="rounded-md border border-card-border bg-card p-3">
          <p className="text-sm font-medium">HeyGen Live-Stimme</p>
          <p className="mt-1 text-xs text-muted-foreground">Diese Stimme wird ausschließlich vom HeyGen-Videoavatar mit Lippenbewegung genutzt.</p>
          <Button className="mt-3" size="sm" variant={companion?.voiceProvider === "heygen" ? "default" : "outline"} onClick={() => void speichern(heygenVoiceId, "heygen")} data-testid="button-select-heygen-voice">
            HeyGen-Stimme für Videoavatar nutzen
          </Button>
        </div>
      )}

      {liste.source === "elevenlabs" && (
        <div className="space-y-3 rounded-md border border-card-border bg-card p-3">
          <p className="text-sm font-medium">Feinregler (wirken echt auf ElevenLabs)</p>
          {[
            { label: "Stabilität (stability)", value: stability, set: setStability, id: "stability" },
            { label: "Ähnlichkeit (similarity_boost)", value: similarity, set: setSimilarity, id: "similarity" },
            { label: "Stil (style)", value: style, set: setStyle, id: "style" },
          ].map((s) => (
            <div key={s.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label>{s.label}</Label>
                <span className="text-xs text-muted-foreground">{s.value.toFixed(2)}</span>
              </div>
              <Slider value={[s.value]} onValueChange={(v) => s.set(v[0])} min={0} max={1} step={0.05} data-testid={`slider-${s.id}`} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void reglerSpeichern()} data-testid="button-save-voice-settings">
              Regler speichern
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!gewaehlt}
              onClick={() => void vorschau({ id: gewaehlt, name: "Auswahl" })}
              data-testid="button-test-voice-settings"
            >
              <Volume2 className="mr-1 h-3.5 w-3.5" /> Mit Reglern anhören
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-card-border bg-card p-4">
        <p className="text-sm font-medium">Eigene Stimme nutzen (Instant Voice Cloning)</p>
        <p className="mt-1 text-xs text-muted-foreground">Bitte diesen Satz vorlesen:</p>
        <p className="mt-1 rounded bg-muted/60 p-2 text-xs italic break-words">„{CONSENT_SENTENCE}“</p>
        <Button
          size="sm"
          variant={aufnahme ? "destructive" : "secondary"}
          className="mt-3"
          disabled={klont}
          onClick={() => void klonen()}
          data-testid="button-clone-voice"
        >
          {klont ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : aufnahme ? <Square className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
          {klont ? "Wird geklont …" : aufnahme ? "Aufnahme stoppen" : "Aufnahme starten"}
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground break-words">
          {liste.source === "elevenlabs"
            ? "Die Aufnahme geht an ElevenLabs (/v1/voices/add) und erzeugt eine echte geklonte Stimme, die danach für alle Antworten genutzt wird."
            : "Ohne ELEVENLABS_API_KEY wird nichts geklont — SPARK sagt das ehrlich und nutzt weiterhin die gewählte Standardstimme."}
        </p>
      </div>
    </div>
  );
}
