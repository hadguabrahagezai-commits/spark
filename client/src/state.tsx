import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/queryClient";

export type Companion = {
  name: string; preset: string; style: string; skin: string; hair: string; hairstyle: string;
  eyes: string; outfit: string; personality: string; directness: number; verbosity: number; humor: number;
  voiceName: string; voiceRate: number; voicePitch: number; voiceVolume: number; voiceConsent: number; voiceProfile: string;
  voiceProvider: string; voiceId: string; voiceStability: number; voiceSimilarity: number; voiceStyle: number;
  avatarMode: string; liveAvatarId: string; liveAvatarName: string;
};
export type Settings = {
  reducedMotion: number; textScale: number; highContrast: number; notifyDaily: number; notifyStreak: number;
  notifyReview: number; notifyMissions: number; language: string; region: string; plan: string; energy: string;
};
export type User = { id: number; email: string; name: string; goal: string; theme: string; onboarded: number };
export type Stats = {
  totalXp: number; streak: number; minutes: number; rank: string; rankIndex: number;
  nextRankXp: number; rankProgress: number; days: { day: string; xp: number; minutes: number }[];
};

type Ctx = {
  token: string | null;
  user: User | null;
  companion: Companion | null;
  settings: Settings | null;
  stats: Stats | null;
  loading: boolean;
  theme: string;
  previewTheme: (t: string | null) => void;
  setTheme: (t: string) => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  patchUser: (p: Partial<User>) => Promise<void>;
  patchCompanion: (p: Partial<Companion>) => Promise<void>;
  patchSettings: (p: Partial<Settings>) => Promise<void>;
  api: <T = any>(method: string, url: string, body?: unknown) => Promise<T>;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp muss innerhalb von AppProvider genutzt werden");
  return ctx;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function rawApi<T>(method: string, url: string, body?: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw new ApiError(res.status, data?.message || `Fehler ${res.status}`);
  return data as T;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const api = useCallback(
    <T,>(method: string, url: string, body?: unknown) => rawApi<T>(method, url, body, token),
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const data = await rawApi<any>("GET", "/api/auth/me", undefined, token);
    setUser(data.user);
    setCompanion(data.companion);
    setSettings(data.settings);
    setStats(data.stats);
  }, [token]);

  const login = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const data = await rawApi<any>("GET", "/api/auth/me", undefined, t);
      setToken(t);
      setUser(data.user);
      setCompanion(data.companion);
      setSettings(data.settings);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { if (token) await rawApi("POST", "/api/auth/logout", {}, token); } catch { /* egal */ }
    setToken(null); setUser(null); setCompanion(null); setSettings(null); setStats(null);
  }, [token]);

  const patchUser = useCallback(async (p: Partial<User>) => {
    const u = await rawApi<User>("PATCH", "/api/user", p, token);
    setUser(u);
  }, [token]);

  const patchCompanion = useCallback(async (p: Partial<Companion>) => {
    setCompanion((c) => (c ? { ...c, ...p } : c));
    const c = await rawApi<Companion>("PATCH", "/api/companion", p, token);
    setCompanion(c);
  }, [token]);

  const patchSettings = useCallback(async (p: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...p } : s));
    const s = await rawApi<Settings>("PATCH", "/api/settings", p, token);
    setSettings(s);
  }, [token]);

  const setTheme = useCallback(async (t: string) => {
    setUser((u) => (u ? { ...u, theme: t } : u));
    setPreview(null);
    if (token) await rawApi("PATCH", "/api/user", { theme: t }, token);
  }, [token]);

  const theme = preview || user?.theme || "nachtlabor";

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.classList.toggle("dark", theme !== "aurora");
    html.setAttribute("data-motion", settings?.reducedMotion ? "reduziert" : "normal");
    html.setAttribute("data-contrast", settings?.highContrast ? "hoch" : "normal");
    html.style.setProperty("--text-scale", String((settings?.textScale ?? 100) / 100));
  }, [theme, settings?.reducedMotion, settings?.highContrast, settings?.textScale]);

  const value = useMemo<Ctx>(
    () => ({ token, user, companion, settings, stats, loading, theme, previewTheme: setPreview, setTheme, login, logout, refresh, patchUser, patchCompanion, patchSettings, api }),
    [token, user, companion, settings, stats, loading, theme, setTheme, login, logout, refresh, patchUser, patchCompanion, patchSettings, api],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useReducedMotion() {
  const { settings } = useApp();
  const [system, setSystem] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystem(mq.matches);
    const handler = () => setSystem(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return system || Boolean(settings?.reducedMotion);
}
