import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.js";
import { authRoutes } from "./routes/auth.js";
import { syncRoutes } from "./routes/sync.js";
import { rankRoutes } from "./routes/rankings.js";
import { usageRoute } from "./routes/usage.js";
import { dashboardRoute } from "./dashboard.js";
import { landingRoute } from "./landing.js";
import { sampleRoute } from "./sample.js";
import { inviteRoute } from "./invite.js";
import { guideRoute } from "./guide.js";
import { guidePage } from "./guide_page.js";
import { feedbackPages } from "./routes/feedback_pages.js";
import { sendMpEvents, gaClientIdFromRequest, isLikelyBot } from "./ga-mp.js";


const app = new Hono<{ Bindings: Env }>();

// E6: Add global security headers middleware
app.use("*", async (c, next) => {
  await next();
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  c.header("Content-Security-Policy", "default-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()");
});

// Server-side GA4 Measurement Protocol page_view — anti-tracking-prevention fallback.
// Fires from the edge (non-blocking) for real HTML navigations only. Dormant until
// GA4_MP_API_SECRET is set. Reuses the browser's _ga client_id so it dedupes with the
// client-side gtag hit; skips when no _ga cookie exists yet (avoids phantom users).
app.use("*", async (c, next) => {
  const path = c.req.path;
  const isPage =
    c.req.method === "GET" &&
    !path.startsWith("/api/") &&
    (c.req.header("Accept") || "").includes("text/html") &&
    !/\.(png|svg|ico|xml|txt|json|webmanifest|css|js|map|ttf|woff2?|jpe?g|gif|webp)$/.test(path);
  if (isPage) {
    const ua = c.req.header("User-Agent") || "";
    const clientId = gaClientIdFromRequest(c.req.raw);
    if (clientId && !isLikelyBot(ua)) {
      try {
        c.executionCtx.waitUntil(
          sendMpEvents(c.env, clientId, [
            { name: "page_view", params: { page_location: c.req.url, ssrc: "worker" } },
          ]),
        );
      } catch {
        // executionCtx unavailable (non-Worker context) — skip silently
      }
    }
  }
  await next();
});

// E5: Validate API routes before CORS matching
const allowedPrefixes = [
  "/api/health",
  "/api/version",
  "/api/init",
  "/api/join",
  "/api/leave",
  "/api/sync",
  "/api/usage",
  "/api/profile",
  "/api/group",
  "/api/rank",
  "/api/activity",
  "/api/messages",
  "/api/admin/messages"
];

app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  const isAllowed = allowedPrefixes.some(prefix => path === prefix || path.startsWith(prefix + "/"));
  if (!isAllowed) {
    return c.json({ error: "Not Found" }, 404);
  }
  await next();
});

// E9: Tighten CORS settings
app.use("/api/*", cors({
  origin: (origin) => {
    if (!origin) return "https://atologs.com";
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        hostname === "atologs.com" ||
        hostname === "atologs.com" ||
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".atologs.com")
      ) {
        return origin;
      }
    } catch {
      // ignore invalid URLs
    }
    return "https://atologs.com";
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
}));

app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  await next();
});


// E7: Static SEO and Favicon endpoints
app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  c.header("Content-Type", "text/plain");
  return c.text(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml`);
});

app.get("/sitemap.xml", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.text(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${origin}/guide</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${origin}/sample</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${origin}/g/global</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`, 200, { "Content-Type": "application/xml; charset=utf-8" });
});

const FAVICON_BASE64 = "AAABAAEAEBAAAAEAIABoQgAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//";

app.get("/favicon.ico", (c) => {
  const binary = Uint8Array.from(atob(FAVICON_BASE64), char => char.charCodeAt(0));
  c.header("Content-Type", "image/x-icon");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(binary);
});

// E11: Version API endpoint
app.get("/api/version", (c) => {
  return c.json({ version: "0.5.5", cli: "0.3.15" });
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api", authRoutes);
app.route("/api", syncRoutes);
app.route("/api", rankRoutes);
app.post("/api/usage", usageRoute);
app.route("/", landingRoute);
app.route("/", sampleRoute);
app.route("/", guideRoute);
app.route("/", guidePage);
app.route("/", inviteRoute);
app.route("/", feedbackPages);
app.route("/", dashboardRoute);

export default app;
