import { describe, it, expect } from "vitest";
import type { UsageData } from "@ccclub/shared";
import {
  buildRankingEntry,
  sortAndRankByCost,
  parsePeriod,
  getDateRange,
  buildAgentBreakdown,
  type RankWindow,
  type AgentTotals,
} from "./ranking-core.js";

// ── synthetic helpers ──────────────────────────────────────────────
type Block = UsageData["blocks"][number];
function block(overrides: Partial<Block> = {}): Block {
  return {
    blockStart: "2026-06-01T00:00:00.000Z",
    totalTokens: 0,
    costUSD: 0,
    entryCount: 0,
    models: [],
    ...overrides,
  } as Block;
}
function usage(blocks: Block[]): UsageData {
  return { blocks } as UsageData;
}

const DAY = 86_400_000;
const T0 = Date.parse("2026-06-01T00:00:00.000Z"); // window start
const baseWin: RankWindow = {
  startMs: T0,
  endMs: T0 + DAY,
  monthStartMs: T0 - 29 * DAY,
  monthEndMs: T0 + DAY,
  isMonthly: false,
  hasPlan: false,
};
const info = { userId: "u1", displayName: "Alice", avatar: "" };

// ── buildRankingEntry: the extracted core ──────────────────────────
describe("buildRankingEntry", () => {
  it("counts only in-window blocks, rounds cost to 4dp, builds agentBreakdown", () => {
    const u = usage([
      block({ source: "claude", blockStart: "2026-06-01T01:00:00.000Z", totalTokens: 1000, inputTokens: 600, outputTokens: 400, costUSD: 1.23456, entryCount: 5, chatCount: 2, models: ["claude-x"] }),
      block({ source: "codex", blockStart: "2026-06-01T02:00:00.000Z", totalTokens: 500, costUSD: 0.5, entryCount: 3, chatCount: 1, models: ["gpt-x"] }),
      block({ source: "claude", blockStart: "2026-05-01T00:00:00.000Z", totalTokens: 9999, costUSD: 99, entryCount: 99, models: ["old"] }), // OUT of window
    ]);
    const e = buildRankingEntry(u, info, baseWin);
    expect(e.totalTokens).toBe(1500); // 1000 + 500 (the 9999 block is out of window)
    expect(e.entryCount).toBe(8); // 5 + 3
    expect(e.chatCount).toBe(3);
    expect(e.costUSD).toBe(1.7346); // round((1.23456 + 0.5) * 10000) / 10000
    expect([...e.agents].sort()).toEqual(["claude", "codex"]);
    expect([...e.models].sort()).toEqual(["claude-x", "gpt-x"]);
    expect(e.rank).toBe(0); // ranks assigned later by sortAndRankByCost
    expect(e.agentBreakdown[0].source).toBe("claude"); // higher cost share first
  });

  it("null usage yields an all-zero entry (the group-member-with-no-data case)", () => {
    const e = buildRankingEntry(null, info, baseWin);
    expect(e.totalTokens).toBe(0);
    expect(e.costUSD).toBe(0);
    expect(e.entryCount).toBe(0);
    expect(e.agentBreakdown).toEqual([]);
    expect(e.models).toEqual([]);
    expect(e.userId).toBe("u1");
  });

  it("with a plan, computes monthlyCostUSD over the month window", () => {
    const u = usage([
      block({ source: "claude", blockStart: "2026-06-01T01:00:00.000Z", costUSD: 2, totalTokens: 100, entryCount: 1, models: [] }), // in daily + month
      block({ source: "claude", blockStart: "2026-05-20T00:00:00.000Z", costUSD: 5, totalTokens: 50, entryCount: 1, models: [] }), // in month only
    ]);
    const e = buildRankingEntry(u, { ...info, plan: "pro" }, { ...baseWin, hasPlan: true });
    expect(e.plan).toBe("pro");
    expect(e.costUSD).toBe(2); // only the in-daily-window block
    expect(e.monthlyCostUSD).toBe(7); // 2 + 5 across the month window
  });

  it("tracks last active time/source across ALL blocks (even out of window)", () => {
    const u = usage([
      block({ source: "claude", blockStart: "2026-06-01T01:00:00.000Z", lastActivityAt: "2026-06-01T01:30:00.000Z", costUSD: 0.1, totalTokens: 10, entryCount: 1, models: [] }),
      block({ source: "codex", blockStart: "2026-05-01T00:00:00.000Z", lastActivityAt: "2026-05-01T05:00:00.000Z", costUSD: 0.1, totalTokens: 10, entryCount: 1, models: [] }),
    ]);
    const e = buildRankingEntry(u, info, baseWin);
    expect(e.lastActiveAt).toBe("2026-06-01T01:30:00.000Z");
    expect(e.lastActiveSource).toBe("claude");
  });
});

describe("sortAndRankByCost", () => {
  it("sorts by cost desc and assigns 1-based ranks in place", () => {
    const entries = [{ rank: 0, costUSD: 1 }, { rank: 0, costUSD: 5 }, { rank: 0, costUSD: 3 }] as any;
    sortAndRankByCost(entries);
    expect(entries.map((e: any) => e.costUSD)).toEqual([5, 3, 1]);
    expect(entries.map((e: any) => e.rank)).toEqual([1, 2, 3]);
  });
});

describe("parsePeriod", () => {
  it("maps every documented alias", () => {
    expect(parsePeriod("today", undefined)).toBe("daily");
    expect(parsePeriod("1d", undefined)).toBe("daily");
    expect(parsePeriod("yesterday", undefined)).toBe("yesterday");
    expect(parsePeriod(undefined, "7d")).toBe("weekly");
    expect(parsePeriod("week", undefined)).toBe("weekly");
    expect(parsePeriod("30", undefined)).toBe("monthly");
    expect(parsePeriod("all", undefined)).toBe("all-time");
    expect(parsePeriod("garbage", undefined)).toBe("daily"); // fallback
    expect(parsePeriod(undefined, undefined)).toBe("daily"); // default
  });
});

describe("getDateRange", () => {
  it("produces the right window durations", () => {
    expect(getDateRange("daily", 0).end.getTime() - getDateRange("daily", 0).start.getTime()).toBe(DAY);
    expect(getDateRange("yesterday", 0).end.getTime() - getDateRange("yesterday", 0).start.getTime()).toBe(DAY);
    expect(getDateRange("weekly", 0).end.getTime() - getDateRange("weekly", 0).start.getTime()).toBe(7 * DAY);
    expect(getDateRange("monthly", 0).end.getTime() - getDateRange("monthly", 0).start.getTime()).toBe(30 * DAY);
  });
  it("daily start aligns to a UTC-day boundary at tz=0", () => {
    expect(getDateRange("daily", 0).start.getTime() % DAY).toBe(0);
  });
});

describe("buildAgentBreakdown", () => {
  it("computes percent by cost share and sorts descending", () => {
    const totals = new Map<any, AgentTotals>([
      ["claude", { costUSD: 3, totalTokens: 300, nonCacheTokens: 300, chatCount: 3, entryCount: 3 }],
      ["codex", { costUSD: 1, totalTokens: 100, nonCacheTokens: 100, chatCount: 1, entryCount: 1 }],
    ]);
    const b = buildAgentBreakdown(totals, 4, 400);
    expect(b[0].source).toBe("claude");
    expect(b[0].percent).toBe(75);
    expect(b[1].percent).toBe(25);
  });
});
