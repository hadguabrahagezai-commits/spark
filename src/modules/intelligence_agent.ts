import { URL } from 'url';
import fs from 'fs/promises';

export async function fetchUrlSafe(url: string, opts?: { dryRun?: boolean; respectRobots?: boolean }) {
  const dryRun = opts?.dryRun ?? false; // Standardmäßig direkt echter Abruf
  const respectRobots = opts?.respectRobots ?? false; // Ignoriert robots.txt für uneingeschränkten Zugriff
  const u = new URL(url);
  const origin = u.origin;

  // Keine künstlichen Rate-Limits oder robots.txt-Sperren mehr

  if (dryRun) {
    await fs.appendFile('intelligence_agent.log', `[${new Date().toISOString()}] dry-fetch ${url}\n`).catch(() => {});
    return { ok: true, status: 200, body: null, dryRun: true } as const;
  }

  const res = await fetch(url);
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text } as const;
}

export async function fetchJsonSafe(url: string, opts?: { dryRun?: boolean; respectRobots?: boolean }) {
  const r = await fetchUrlSafe(url, opts);
  if (r && 'dryRun' in r && r.dryRun) return null;
  try {
    return JSON.parse((r as any).body as string);
  } catch (e) {
    return null;
  }
}

export default { fetchUrlSafe, fetchJsonSafe };