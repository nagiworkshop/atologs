// ga-mp.ts — GA4 Measurement Protocol (server-side event sender) for the Cloudflare Worker.
// Why: the worker is already SSR, so it can fire GA4 events from the edge — surviving the
// browser Tracking-Prevention / ad-block that blocks the client-side `g/collect` beacon
// (Chromium 137+), and capturing server-only conversions (e.g. first CLI sync) the browser
// never sees. Safe by default: silently no-ops when GA4_MP_API_SECRET is unset (fork/preview-safe).
import type { Env } from "./types.js";

export const GA4_MEASUREMENT_ID = "G-EVZ3ZQNZD5";
const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";

export interface MpEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/** Fire GA4 events server-side. Returns a promise to hand to ctx.waitUntil(). Never throws. */
export async function sendMpEvents(env: Env, clientId: string, events: MpEvent[], userId?: string): Promise<void> {
  const secret = env.GA4_MP_API_SECRET;
  if (!secret || !clientId || events.length === 0) return; // silent no-op (no secret = dormant)
  const url = `${MP_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`;
  const payload: Record<string, unknown> = {
    client_id: clientId,
    events: events.map((e) => ({ name: e.name, params: { ...(e.params || {}) } })),
  };
  if (userId) payload.user_id = userId;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // never propagate analytics failures into the request path
  }
}

/** GA client_id from the first-party `_ga` cookie (matches the browser session), else "". */
export function gaClientIdFromRequest(req: Request): string {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(/_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  return m ? m[1] : "";
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic synthetic GA client_id for server-only events (no browser cookie exists). */
export function gaClientIdForUser(userId: string): string {
  return `${djb2(userId)}.${djb2(userId.split("").reverse().join(""))}`;
}

/** Crude bot/crawler filter so server-side hits don't pollute human stats. */
export function isLikelyBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests|axios|node-fetch/i.test(ua);
}
