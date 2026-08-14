const LOCAL_AVATARS = [
  { id: "photoreal-1", name: "Photoreal Studio", preview: "/assets/avatars/photoreal-1.svg" },
  { id: "photoreal-2", name: "Warm Portrait", preview: "/assets/avatars/photoreal-2.svg" },
  { id: "cyberpunk-1", name: "Cyberpunk Neon", preview: "/assets/avatars/cyberpunk-1.svg" },
  { id: "glass-1", name: "Glass Portrait", preview: "/assets/avatars/glass-1.svg" },
  { id: "studio-bw", name: "Studio B/W", preview: "/assets/avatars/studio-bw.svg" },
];

export type AvatarStatus = { konfiguriert: boolean; anbieter: "lokal"; hinweis: string };

export function avatarStatus(): AvatarStatus {
  return { konfiguriert: true, anbieter: "lokal", hinweis: "Premium-Avatare lokal verfügbar (clientseitig ausgeliefert)." };
}

export type AvatarListResult = { ok: boolean; avatare: { id: string; name: string; vorschauUrl?: string }[]; nachricht: string };

export async function listAvatars(): Promise<AvatarListResult> {
  return { ok: true, avatare: LOCAL_AVATARS.map((a) => ({ id: a.id, name: a.name, vorschauUrl: a.preview })), nachricht: "Lokale Premium-Avatare" };
}

export type TokenResult = { ok: false; status?: number; nachricht: string };

export async function createSessionToken(): Promise<TokenResult> {
  return { ok: false, status: 503, nachricht: "Live-Avatare wurden deaktiviert. Verwende die lokalen Premium-Avatare." };
}

export const streaming = {
  neu: async () => ({ ok: false, status: 503, data: { message: "Live-Streaming deaktiviert." } }),
  start: async () => ({ ok: false, status: 503, data: { message: "Live-Streaming deaktiviert." } }),
  task: async () => ({ ok: false, status: 503, data: { message: "Live-Streaming deaktiviert." } }),
  stop: async () => ({ ok: false, status: 503, data: { message: "Live-Streaming deaktiviert." } }),
};

export async function testAvatar(): Promise<{ ok: boolean; nachricht: string }> {
  return { ok: true, nachricht: "Lokale Premium-Avatare verfügbar." };
}
