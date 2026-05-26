import { Hono } from "hono";
import { dashboardHTML } from "./dashboard.js";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/sample", async (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const origin = new URL(c.req.url).origin;
  return c.html(dashboardHTML("SAMPLE", "実績紹介", 3, origin, "/sample"));
});

export { app as sampleRoute };
