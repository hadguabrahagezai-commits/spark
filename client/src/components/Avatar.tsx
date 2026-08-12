import { useEffect, useRef, useState, useCallback } from "react";

/* ===========================================================================
   SPARK-Avatar — vollständig eigene SVG-Grafik, parametrisch.
   Keine Fremdbilder, keine echten Personen, keine externe Avatar-API nötig.
   =========================================================================== */

export type AvatarConfig = {
  preset: string;
  style: string; // anime | realistisch | abstrakt
  skin: string;
  hair: string;
  hairstyle: string; // kurz | lang | bob | zopf | locken | kahl
  eyes: string; // rund | mandel | schmal
  outfit: string;
};

export type Mood = "freudig" | "neutral" | "nachdenklich" | "besorgt";

export const AVATAR_PRESETS: { id: string; label: string; config: Omit<AvatarConfig, "preset"> }[] = [
  { id: "anime-junge", label: "Anime Junge", config: { style: "anime", skin: "#F3C9A4", hair: "#2F3350", hairstyle: "kurz", eyes: "rund", outfit: "#3B82F6" } },
  { id: "anime-maedchen", label: "Anime Mädchen", config: { style: "anime", skin: "#F8D6BC", hair: "#8B3A62", hairstyle: "lang", eyes: "rund", outfit: "#EC4899" } },
  { id: "anime-androgyn", label: "Anime Androgyn", config: { style: "anime", skin: "#E8B996", hair: "#22D3EE", hairstyle: "bob", eyes: "mandel", outfit: "#8B5CF6" } },
  { id: "real-mann", label: "Realistisch Mann", config: { style: "realistisch", skin: "#C68642", hair: "#221A15", hairstyle: "kurz", eyes: "schmal", outfit: "#334155" } },
  { id: "real-frau", label: "Realistisch Frau", config: { style: "realistisch", skin: "#E0AC69", hair: "#3B2314", hairstyle: "zopf", eyes: "mandel", outfit: "#0F766E" } },
  { id: "real-nonbinaer", label: "Realistisch Nonbinär", config: { style: "realistisch", skin: "#8D5524", hair: "#141414", hairstyle: "locken", eyes: "rund", outfit: "#B45309" } },
  { id: "abstrakt-funke", label: "Abstrakt Funke", config: { style: "abstrakt", skin: "#22D3EE", hair: "#A78BFA", hairstyle: "kahl", eyes: "rund", outfit: "#1E293B" } },
  { id: "abstrakt-prisma", label: "Abstrakt Prisma", config: { style: "abstrakt", skin: "#F472B6", hair: "#FDE68A", hairstyle: "kahl", eyes: "mandel", outfit: "#312E81" } },
  { id: "abstrakt-orbit", label: "Abstrakt Orbit", config: { style: "abstrakt", skin: "#34D399", hair: "#0EA5E9", hairstyle: "kahl", eyes: "schmal", outfit: "#064E3B" } },
  { id: "abstrakt-kristall", label: "Abstrakt Kristall", config: { style: "abstrakt", skin: "#93C5FD", hair: "#E0E7FF", hairstyle: "kahl", eyes: "rund", outfit: "#1E3A8A" } },
  { id: "abstrakt-lava", label: "Abstrakt Lava", config: { style: "abstrakt", skin: "#FB923C", hair: "#EF4444", hairstyle: "kahl", eyes: "mandel", outfit: "#7C2D12" } },
  { id: "abstrakt-moos", label: "Abstrakt Moos", config: { style: "abstrakt", skin: "#A3E635", hair: "#166534", hairstyle: "kahl", eyes: "schmal", outfit: "#14532D" } },
  { id: "anime-sanft", label: "Anime Sanft", config: { style: "anime", skin: "#FFE0C7", hair: "#6D28D9", hairstyle: "locken", eyes: "mandel", outfit: "#14B8A6" } },
  { id: "real-klar", label: "Realistisch Klar", config: { style: "realistisch", skin: "#F1C27D", hair: "#6B7280", hairstyle: "kahl", eyes: "schmal", outfit: "#475569" } },
];

/* --- Viseme-System: Mundpfad wird numerisch gemorpht ---------------------- */
type Viseme = { w: number; open: number; curve: number };
const VISEMES: Record<string, Viseme> = {
  geschlossen: { w: 16, open: 1.5, curve: 2 },
  A: { w: 18, open: 16, curve: 4 },
  E: { w: 22, open: 8, curve: 3 },
  I: { w: 24, open: 4, curve: 2 },
  O: { w: 13, open: 14, curve: 8 },
  U: { w: 10, open: 10, curve: 9 },
};
const VISEME_ORDER = ["A", "E", "I", "O", "U"] as const;

function mouthPath(v: Viseme, cx = 100, cy = 152) {
  const { w, open, curve } = v;
  return `M ${cx - w} ${cy} Q ${cx} ${cy - curve} ${cx + w} ${cy} Q ${cx} ${cy + open} ${cx - w} ${cy} Z`;
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpViseme(a: Viseme, b: Viseme, t: number): Viseme {
  return { w: lerp(a.w, b.w, t), open: lerp(a.open, b.open, t), curve: lerp(a.curve, b.curve, t) };
}

const BROWS: Record<Mood, { y: number; angle: number }> = {
  freudig: { y: -4, angle: -8 },
  neutral: { y: 0, angle: 0 },
  nachdenklich: { y: 2, angle: 10 },
  besorgt: { y: -2, angle: 18 },
};

export function SparkAvatar({
  config,
  size = 160,
  mood = "neutral",
  amplitude = 0,
  speaking = false,
  animate = true,
  className = "",
}: {
  config: AvatarConfig;
  size?: number;
  mood?: Mood;
  amplitude?: number;
  speaking?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const [blink, setBlink] = useState(false);
  const [breath, setBreath] = useState(0);
  const [viseme, setViseme] = useState<Viseme>(VISEMES.geschlossen);
  const visemeIndex = useRef(0);
  const rafRef = useRef<number>();

  /* Blinzeln alle 3–6 s */
  useEffect(() => {
    if (!animate) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [animate]);

  /* Atmung + Lip-Sync-Morphing */
  useEffect(() => {
    if (!animate) {
      setViseme(VISEMES.geschlossen);
      return;
    }
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      setBreath(Math.sin(t / 1400) * 0.012);
      if (speaking) {
        acc += dt;
        if (acc > 110) {
          acc = 0;
          visemeIndex.current = (visemeIndex.current + 1 + Math.floor(Math.random() * 2)) % VISEME_ORDER.length;
        }
        const target = VISEMES[VISEME_ORDER[visemeIndex.current]];
        const amp = Math.min(1, Math.max(0.18, amplitude));
        setViseme((cur) => lerpViseme(cur, lerpViseme(VISEMES.geschlossen, target, amp), 0.35));
      } else {
        setViseme((cur) => lerpViseme(cur, VISEMES.geschlossen, 0.2));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [speaking, amplitude, animate]);

  const brow = BROWS[mood] || BROWS.neutral;
  const eyeH = blink ? 1.5 : config.eyes === "schmal" ? 6 : config.eyes === "mandel" ? 8 : 11;
  const eyeW = config.eyes === "schmal" ? 13 : config.eyes === "mandel" ? 12 : 11;
  const scale = 1 + breath;

  if (config.style === "abstrakt") {
    return (
      <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img"
        aria-label="Abstrakter SPARK-Companion" data-testid="img-avatar">
        <defs>
          <linearGradient id={`ag-${config.preset}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={config.skin} />
            <stop offset="100%" stopColor={config.hair} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="82" fill={config.outfit} opacity="0.35" />
        <g transform={`translate(100 100) scale(${scale}) translate(-100 -100)`}>
          <polygon points="100,26 168,100 100,174 32,100" fill={`url(#ag-${config.preset})`} />
          <circle cx="100" cy="100" r="46" fill={config.outfit} opacity="0.9" />
          <ellipse cx="82" cy={94 + brow.y} rx={eyeW - 2} ry={eyeH} fill="#0B0E14" />
          <ellipse cx="118" cy={94 + brow.y} rx={eyeW - 2} ry={eyeH} fill="#0B0E14" />
          <path d={mouthPath(viseme, 100, 124)} fill="#0B0E14" />
          <path d={`M 70 ${78 + brow.y} l 22 ${brow.angle / 2 - 4}`} stroke={config.skin} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d={`M 130 ${78 + brow.y} l -22 ${brow.angle / 2 - 4}`} stroke={config.skin} strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    );
  }

  const anime = config.style === "anime";
  return (
    <svg viewBox="0 0 200 220" width={size} height={(size * 220) / 200} className={className} role="img"
      aria-label="SPARK-Companion" data-testid="img-avatar">
      <g transform={`translate(100 120) scale(${scale}) translate(-100 -120)`}>
        {/* Schultern / Kleidung */}
        <path d="M42 220 C42 178 68 164 100 164 C132 164 158 178 158 220 Z" fill={config.outfit} />
        <path d="M100 164 l -10 20 l 10 12 l 10 -12 Z" fill="#ffffff" opacity="0.18" />

        {/* Haar hinten */}
        {config.hairstyle !== "kahl" && (
          <path
            d={
              config.hairstyle === "lang"
                ? "M44 96 C44 44 156 44 156 96 L160 186 L138 168 C138 120 62 120 62 168 L40 186 Z"
                : config.hairstyle === "zopf"
                  ? "M46 96 C46 46 154 46 154 96 L156 150 L142 140 C142 108 58 108 58 140 L44 150 Z"
                  : "M46 96 C46 48 154 48 154 96 L152 132 L48 132 Z"
            }
            fill={config.hair}
          />
        )}

        {/* Hals */}
        <rect x="88" y="140" width="24" height="30" rx="10" fill={config.skin} />
        <ellipse cx="100" cy="152" rx="16" ry="8" fill="#000" opacity="0.08" />

        {/* Kopf */}
        <ellipse cx="100" cy="104" rx={anime ? 48 : 45} ry={anime ? 52 : 56} fill={config.skin} />
        <ellipse cx="53" cy="110" rx="6" ry="10" fill={config.skin} />
        <ellipse cx="147" cy="110" rx="6" ry="10" fill={config.skin} />

        {/* Wangen */}
        {anime && (
          <>
            <ellipse cx="70" cy="126" rx="10" ry="6" fill="#F97316" opacity="0.18" />
            <ellipse cx="130" cy="126" rx="10" ry="6" fill="#F97316" opacity="0.18" />
          </>
        )}

        {/* Augen */}
        <ellipse cx="80" cy={110 + brow.y * 0.4} rx={eyeW} ry={eyeH} fill="#FFFFFF" />
        <ellipse cx="120" cy={110 + brow.y * 0.4} rx={eyeW} ry={eyeH} fill="#FFFFFF" />
        {!blink && (
          <>
            <circle cx="80" cy={110 + brow.y * 0.4} r={anime ? 6 : 5} fill="#1F2937" />
            <circle cx="120" cy={110 + brow.y * 0.4} r={anime ? 6 : 5} fill="#1F2937" />
            <circle cx="82" cy={107 + brow.y * 0.4} r="2" fill="#FFFFFF" opacity="0.9" />
            <circle cx="122" cy={107 + brow.y * 0.4} r="2" fill="#FFFFFF" opacity="0.9" />
          </>
        )}

        {/* Augenbrauen — reagieren auf Stimmung */}
        <path d={`M 66 ${92 + brow.y} q 14 ${-6 + brow.angle / 3} 28 ${brow.angle / 6}`} stroke={config.hair}
          strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d={`M 134 ${92 + brow.y} q -14 ${-6 + brow.angle / 3} -28 ${brow.angle / 6}`} stroke={config.hair}
          strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* Nase */}
        <path d="M100 122 q4 8 -4 9" stroke="#00000033" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Mund mit Viseme-Morphing */}
        <path d={mouthPath(viseme)} fill="#7F1D1D" />
        <path d={mouthPath({ ...viseme, open: viseme.open * 0.3 })} fill="#EF7A7A" opacity="0.55" />

        {/* Haar vorne */}
        {config.hairstyle !== "kahl" && (
          <path
            d={
              config.hairstyle === "locken"
                ? "M52 96 a16 16 0 0 1 22 -14 a18 18 0 0 1 26 -6 a18 18 0 0 1 26 6 a16 16 0 0 1 22 14 c-16 -30 -80 -30 -96 0 Z"
                : config.hairstyle === "bob"
                  ? "M50 98 C50 52 150 52 150 98 L142 82 C126 96 74 96 58 82 Z"
                  : "M52 96 C52 52 148 52 148 96 L140 78 C118 92 82 92 60 80 Z"
            }
            fill={config.hair}
          />
        )}
        {config.hairstyle === "zopf" && (
          <>
            <circle cx="46" cy="120" r="12" fill={config.hair} />
            <circle cx="154" cy="120" r="12" fill={config.hair} />
          </>
        )}
      </g>
    </svg>
  );
}

/* ===========================================================================
   Sprachausgabe + Lip-Sync-Amplitude
   =========================================================================== */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const rafRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setSpeaking(false);
    setAmplitude(0);
  }, []);

  /** Browser-Sprachausgabe mit amplitudensimuliertem Lip-Sync. */
  const speak = useCallback(
    (text: string, opts?: { voice?: string; rate?: number; pitch?: number; volume?: number; onEnd?: () => void }) => {
      if (!("speechSynthesis" in window)) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 3000));
      u.lang = "de-DE";
      u.rate = opts?.rate ?? 1;
      u.pitch = opts?.pitch ?? 1;
      u.volume = opts?.volume ?? 1;
      const voices = window.speechSynthesis.getVoices();
      const chosen = opts?.voice ? voices.find((v) => v.name === opts.voice) : voices.find((v) => v.lang?.startsWith("de"));
      if (chosen) u.voice = chosen;

      let energy = 0.5;
      u.onboundary = () => { energy = 0.55 + Math.random() * 0.45; };
      u.onstart = () => {
        setSpeaking(true);
        const loop = () => {
          energy = Math.max(0.2, energy - 0.02);
          setAmplitude(energy * (0.75 + Math.random() * 0.25));
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      };
      const finish = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setSpeaking(false);
        setAmplitude(0);
        opts?.onEnd?.();
      };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      return true;
    },
    [],
  );

  /** Echtes Audio (z. B. ElevenLabs) — Lip-Sync über AnalyserNode. */
  const playAudio = useCallback(async (src: string) => {
    const audio = new Audio(src);
    audioRef.current = audio;
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    setSpeaking(true);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
      setAmplitude(Math.min(1, sum / data.length / 24));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    audio.onended = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setSpeaking(false);
      setAmplitude(0);
      void ctx.close();
    };
    await audio.play();
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { speaking, amplitude, speak, playAudio, stop };
}

/** Dominante Farben aus einem Foto ableiten — erzeugt einen Avatar im SPARK-Stil, kein Abbild. */
export async function deriveFromPhoto(file: File): Promise<Partial<AvatarConfig>> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const center: number[] = [];
  const top: number[] = [];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const px = [data[i], data[i + 1], data[i + 2]];
      if (y > 26 && y < 46 && x > 20 && x < 44) center.push(...px);
      if (y < 16) top.push(...px);
    }
  }
  const avg = (arr: number[]) => {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < arr.length; i += 3) { r += arr[i]; g += arr[i + 1]; b += arr[i + 2]; }
    const n = arr.length / 3 || 1;
    return `#${[r / n, g / n, b / n].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
  };
  bitmap.close?.();
  return { skin: avg(center), hair: avg(top) };
}
