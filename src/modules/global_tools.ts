import fs from 'fs/promises';
import path from 'path';

const LOG = path.resolve(process.cwd(), 'global_tools.log');
async function log(msg: string) { await fs.appendFile(LOG, `[${new Date().toISOString()}] ${msg}\n`).catch(()=>{}); }

const rateMap = new Map<string, number>();
const MIN_INTERVAL = 500; // ms per host

async function rateLimit(key: string) {
  const now = Date.now();
  const last = rateMap.get(key) ?? 0;
  const delta = now - last;
  if (delta < MIN_INTERVAL) throw new Error('Rate limit');
  rateMap.set(key, now);
}

export async function getWeather(city: string, opts?: { apiKey?: string; dryRun?: boolean }) {
  const dryRun = opts?.dryRun ?? process.env.JARVIS_TOOLS_DRY === '1';
  await log(`getWeather ${city} dryRun=${dryRun}`);
  if (dryRun) return { ok: true, source: 'dry', weather: { temp: 20, cond: 'clear' } };
  await rateLimit('weather');
  // If API key provided, call a provider (user must set env var)
  const key = opts?.apiKey ?? process.env.OPENWEATHER_API_KEY;
  if (!key) return { ok: false, reason: 'no-key' };
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric`;
  const res = await fetch(url);
  const json = await res.json();
  return { ok: res.ok, source: 'openweather', weather: json };
}

export async function getNews(query: string, opts?: { apiKey?: string; dryRun?: boolean }) {
  const dryRun = opts?.dryRun ?? process.env.JARVIS_TOOLS_DRY === '1';
  await log(`getNews ${query} dryRun=${dryRun}`);
  if (dryRun) return { ok: true, source: 'dry', items: [{ title: 'Dry news sample', url: '' }] };
  await rateLimit('news');
  const key = opts?.apiKey ?? process.env.NEWSAPI_API_KEY;
  if (!key) return { ok: false, reason: 'no-key' };
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${key}`;
  const res = await fetch(url);
  const json = await res.json();
  return { ok: res.ok, source: 'newsapi', items: json.articles || [] };
}

export async function getMarkets(symbol: string, opts?: { apiKey?: string; dryRun?: boolean }) {
  const dryRun = opts?.dryRun ?? process.env.JARVIS_TOOLS_DRY === '1';
  await log(`getMarkets ${symbol} dryRun=${dryRun}`);
  if (dryRun) return { ok: true, source: 'dry', price: 123.45 };
  await rateLimit('markets');
  // Use a free public endpoint if available (e.g., Yahoo Finance unofficial). Keep expectation: user supplies API.
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  const json = await res.json();
  return { ok: res.ok, source: 'yahoo', data: json };
}

export default { getWeather, getNews, getMarkets };
