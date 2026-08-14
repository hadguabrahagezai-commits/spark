import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

type Props = { size?: number; speaking?: boolean; listening?: boolean; amplitude?: number; className?: string };

export default function JarvisSphere({ size = 64, speaking = false, listening = false, amplitude = 0, className = "" }: Props) {
  const anim = useAnimation();
  useEffect(() => {
    if (speaking) anim.start({ scale: [1, 1.06 + Math.min(0.06, amplitude * 0.12), 1], rotate: [0, 6, 0], transition: { duration: 0.9, repeat: Infinity } });
    else if (listening) anim.start({ scale: [1, 1.03, 1], rotate: [0, 2, 0], transition: { duration: 1.2, repeat: Infinity } });
    else anim.start({ scale: 1, rotate: 0 });
  }, [speaking, listening, amplitude, anim]);

  const glow = speaking ? `0 0 ${12 + amplitude * 40}px rgba(124,77,242,${0.18 + amplitude * 0.25}), 0 0 ${6 + amplitude * 20}px rgba(0,200,255,${0.08 + amplitude * 0.18})` : "0 6px 18px rgba(0,0,0,0.6)";

  return (
    <motion.div animate={anim} className={className} style={{ width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: "999px", position: "relative", overflow: "hidden", filter: speaking ? "saturate(1.1)" : undefined }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 999, background: "radial-gradient(circle at 30% 30%, rgba(120,80,240,0.95), transparent 25%), radial-gradient(circle at 70% 70%, rgba(0,200,255,0.9), transparent 30%), linear-gradient(135deg, rgba(255,80,120,0.04), rgba(10,10,20,0.22))",
          boxShadow: glow,
          transform: "translateZ(0)",
          transition: "box-shadow 300ms ease, transform 300ms ease",
        }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "screen", pointerEvents: "none" }}>
          <defs>
            <radialGradient id="g1" cx="30%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#7A50F0" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#002b5b" stopOpacity="0.06" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="42" fill="url(#g1)" opacity="0.95" />
        </svg>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.02), rgba(255,255,255,0))", mixBlendMode: "overlay", pointerEvents: "none" }} />
      </div>
    </motion.div>
  );
}
