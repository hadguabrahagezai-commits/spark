import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic, MicOff, Square, Video } from "lucide-react";
import { SparkAvatar, useSpeech } from "@/components/Avatar";
import type { Mood } from "@/components/Avatar";
import { useApp } from "@/state";
import { API_BASE } from "@/lib/queryClient";

type AvatarModus = "heygen" | "svg";

export function VoiceModal({
  open, onOpenChange, chatId, onExchange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chatId: number | null;
  onExchange?: () => void;
}) {
  const { companion, token, api } = useApp();
  const speech = useSpeech();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [mood, setMood] = useState<Mood>("neutral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modus, setModus] = useState<AvatarModus>("svg");
  const [avatarStatus, setAvatarStatus] = useState("SPARK-Avatar (lokal)");
  const [sttQuelle, setSttQuelle] = useState("Browser (Web Speech API)");
  const [verbindeAvatar, setVerbindeAvatar] = useState(false);
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<any>(null);

  const avatar = companion && {
    preset: companion.preset, style: companion.style, skin: companion.skin, hair: companion.hair,
    hairstyle: companion.hairstyle, eyes: companion.eyes, outfit: companion.outfit,
  };

  useEffect(() => {
    if (!open) {
      stopAll();
      void stopAvatar();
      setTranscript(""); setAnswer(""); setError("");
      return;
    }
    if (companion?.avatarMode === "heygen") void startAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ------------------------------------------------------ HeyGen Live-Avatar */

  async function startAvatar() {
    setVerbindeAvatar(true);
    setAvatarStatus("HeyGen wird verbunden …");
    try {
      const res = await api<any>("POST", "/api/avatar/token", {});
      const mod = await import("@heygen/liveavatar-web-sdk");
      const session = new mod.LiveAvatarSession(res.token, { voiceChat: false });
      sessionRef.current = session;
      await session.start();
      if (videoRef.current) session.attach(videoRef.current);
      setModus("heygen");
      setAvatarStatus("HeyGen Live");
    } catch (e: any) {
      sessionRef.current = null;
      setModus("svg");
      setAvatarStatus("SPARK-Avatar (lokal)");
      setError(`Live-Avatar nicht verfügbar: ${e.message} — SPARK nutzt den eigenen Avatar.`);
    } finally {
      setVerbindeAvatar(false);
    }
  }

  async function stopAvatar() {
    try {
      await sessionRef.current?.stop();
    } catch {
      /* Sitzung war bereits beendet */
    }
    sessionRef.current = null;
    setModus("svg");
  }

  /* ------------------------------------------------------------- Zuhören */

  function stopAll() {
    try { recRef.current?.stop(); } catch { /* ignorieren */ }
    try { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); } catch { /* ignorieren */ }
    recRef.current = null;
    setListening(false);
    speech.stop();
  }

  /** Bevorzugt serverseitiges Whisper, sonst Web Speech API im Browser. */
  async function listen() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        setBusy(true);
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const r = await api<any>("POST", "/api/voice/stt", { audioBase64: btoa(binary), mimeType: "audio/webm" });
          setSttQuelle("OpenAI Whisper (Server)");
          setTranscript(r.text);
          setBusy(false);
          if (r.text?.trim()) await send(r.text.trim());
        } catch {
          setBusy(false);
          setSttQuelle("Browser (Web Speech API)");
          browserListen();
        }
      };
      mediaRef.current = rec;
      rec.start();
      setListening(true);
      window.setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 12000);
    } catch {
      browserListen();
    }
  }

  function browserListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Keine Spracherkennung verfügbar. Ohne OPENAI_API_KEY und ohne Web-Speech-API geht es leider nicht."); return; }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void send(finalText.trim());
    };
    rec.onerror = () => { setListening(false); setError("Spracherkennung abgebrochen."); };
    rec.start();
    recRef.current = rec;
    setListening(true);
    setSttQuelle("Browser (Web Speech API)");
  }

  /* -------------------------------------------------------------- Sprechen */

  async function sprich(text: string) {
    if (sessionRef.current) {
      try {
        sessionRef.current.repeat(text);
        return;
      } catch {
        /* weiter zu TTS */
      }
    }
    try {
      const res = await fetch(`${API_BASE}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const typ = res.headers.get("content-type") || "";
      if (res.ok && !typ.includes("application/json")) {
        const blob = await res.blob();
        await speech.playAudio(URL.createObjectURL(blob));
        return;
      }
    } catch {
      /* weiter zur Browser-Ausgabe */
    }
    speech.speak(text, {
      voice: companion?.voiceName, rate: companion?.voiceRate, pitch: companion?.voicePitch, volume: companion?.voiceVolume,
    });
  }

  async function send(text: string) {
    if (!chatId) return;
    setBusy(true); setAnswer(""); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).message || "Antwort fehlgeschlagen.");
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
          if (payload.delta) { full += payload.delta; setAnswer(full); }
          if (payload.error) setError(payload.error);
          if (payload.done) setMood((payload.mood as Mood) || "neutral");
        }
      }
      if (full) await sprich(full);
      onExchange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopAll(); void stopAvatar(); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-voice">
        <DialogHeader>
          <DialogTitle className="text-base">Sprachchat mit {companion?.name || "Spark"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {modus === "heygen" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-[200px] w-[200px] rounded-full border border-card-border bg-black object-cover"
              data-testid="video-heygen"
            />
          ) : (
            avatar && <SparkAvatar config={avatar} size={200} mood={mood} speaking={speech.speaking} amplitude={speech.amplitude} />
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant={listening ? "default" : "secondary"}>
              {listening ? "Hört zu …" : busy ? "Denkt nach …" : speech.speaking ? "Spricht …" : "Bereit"}
            </Badge>
            <Badge variant="outline" data-testid="badge-avatar-status">
              {verbindeAvatar ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Video className="mr-1 h-3 w-3" />}
              {avatarStatus}
            </Badge>
            <Badge variant="outline">Stimmung: {mood}</Badge>
          </div>

          <div className="max-h-56 w-full space-y-2 overflow-y-auto spark-scroll">
            {transcript && (
              <p className="rounded-md bg-muted/60 p-2 text-sm break-words" data-testid="text-transcript">
                <span className="text-xs text-muted-foreground">Du: </span>{transcript}
              </p>
            )}
            {answer && (
              <p className="rounded-md border border-card-border bg-card p-2 text-sm break-words" data-testid="text-voice-answer">{answer}</p>
            )}
            {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive break-words">{error}</p>}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => (listening ? stopAll() : void listen())} variant={listening ? "destructive" : "default"} data-testid="button-voice-listen">
              {listening ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
              {listening ? "Stopp" : "Sprechen"}
            </Button>
            <Button variant="outline" onClick={() => speech.stop()} disabled={!speech.speaking} data-testid="button-voice-stop-speech">
              <Square className="mr-1 h-4 w-4" /> Ausgabe stoppen
            </Button>
            {companion?.avatarMode === "heygen" && modus !== "heygen" && (
              <Button variant="secondary" onClick={() => void startAvatar()} disabled={verbindeAvatar} data-testid="button-avatar-retry">
                Live-Avatar erneut verbinden
              </Button>
            )}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Spracherkennung: {sttQuelle}. Avatar: {avatarStatus}. SPARK zeigt immer an, welcher Dienst gerade wirklich läuft.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
