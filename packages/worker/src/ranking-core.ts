// ranking-core.ts — pure ranking logic, extracted from routes/rankings.ts (work-log 042).
// No KV, no HTTP, no Hono. Everything here is a pure function so it can be unit-tested
// and so the global and group rank handlers share ONE implementation instead of two copies.
import type { AgentSource, UsageData, RankingEntry, RankingPeriod } from "@ccclub/shared";

export const VALID_PERIODS: RankingPeriod[] = ["daily", "yesterday", "weekly", "monthly", "all-time"];

export type AgentTotals = {
  costUSD: number;
  totalTokens: number;
  nonCacheTokens: number;
  chatCount: number;
  entryCount: number;
};

type UsageBlock = UsageData["blocks"][number];

export function hasUsage(block: UsageBlock): boolean {
  return block.entryCount > 0 || block.totalTokens > 0 || block.costUSD > 0;
}

export function getBlockActivityTime(block: UsageBlock): number {
  const lastActivity = new Date(block.lastActivityAt || "").getTime();
  if (Number.isFinite(lastActivity)) return lastActivity;
  const blockEnd = new Date(block.blockEnd || block.blockStart).getTime();
  if (Number.isFinite(blockEnd)) return blockEnd;
  const blockStart = new Date(block.blockStart).getTime();
  return Number.isFinite(blockStart) ? blockStart : 0;
}

export function addAgentTotals(totals: Map<AgentSource, AgentTotals>, block: UsageBlock): void {
  const source = block.source ?? "claude";
  const current = totals.get(source) ?? { costUSD: 0, totalTokens: 0, nonCacheTokens: 0, chatCount: 0, entryCount: 0 };
  current.costUSD += block.costUSD;
  current.totalTokens += block.totalTokens;
  current.nonCacheTokens += (block.inputTokens != null && block.outputTokens != null)
    ? (block.inputTokens + block.outputTokens + (block.reasoningTokens || 0))
    : block.totalTokens;
  current.chatCount += block.chatCount || 0;
  current.entryCount += block.entryCount;
  totals.set(source, current);
}

export function buildAgentBreakdown(
  totals: Map<AgentSource, AgentTotals>,
  totalCostUSD: number,
  totalTokens: number,
): RankingEntry["agentBreakdown"] {
  const denominator = totalCostUSD > 0 ? totalCostUSD : totalTokens;
  return Array.from(totals.entries())
    .map(([source, value]) => {
      const numerator = totalCostUSD > 0 ? value.costUSD : value.totalTokens;
      return {
        source,
        costUSD: Math.round(value.costUSD * 10000) / 10000,
        totalTokens: value.totalTokens,
        nonCacheTokens: value.nonCacheTokens,
        chatCount: value.chatCount,
        entryCount: value.entryCount,
        percent: denominator > 0 ? Math.round((numerator / denominator) * 100) : 0,
      };
    })
    .sort((a, b) => b.percent - a.percent || b.costUSD - a.costUSD);
}

export function parsePeriod(rawPeriod: string | undefined, rawWindow: string | undefined): RankingPeriod {
  const raw = rawPeriod || rawWindow;
  if (!raw) return "daily";
  const normalized = raw.toLowerCase().trim();
  if (normalized === "today" || normalized === "daily" || normalized === "1d" || normalized === "day") {
    return "daily";
  }
  if (normalized === "yesterday") {
    return "yesterday";
  }
  if (normalized === "7d" || normalized === "weekly" || normalized === "7" || normalized === "week") {
    return "weekly";
  }
  if (normalized === "30d" || normalized === "monthly" || normalized === "30" || normalized === "month") {
    return "monthly";
  }
  if (normalized === "all" || normalized === "all-time" || normalized === "all_time") {
    return "all-time";
  }
  if (VALID_PERIODS.includes(normalized as RankingPeriod)) {
    return normalized as RankingPeriod;
  }
  return "daily";
}

export function getDateRange(period: RankingPeriod, tzOffsetMin = 0): { start: Date; end: Date } {
  // Shift "now" into the user's local day by applying their tz offset
  const nowUtc = Date.now();
  const nowLocal = new Date(nowUtc + tzOffsetMin * 60_000);

  switch (period) {
    case "daily": {
      const s = new Date(nowLocal);
      s.setUTCHours(0, 0, 0, 0);
      // Shift back to real UTC
      return { start: new Date(s.getTime() - tzOffsetMin * 60_000), end: new Date(s.getTime() - tzOffsetMin * 60_000 + 86_400_000) };
    }
    case "yesterday": {
      const s = new Date(nowLocal);
      s.setUTCHours(0, 0, 0, 0);
      const todayUtc = s.getTime() - tzOffsetMin * 60_000;
      return { start: new Date(todayUtc - 86_400_000), end: new Date(todayUtc) };
    }
    case "weekly": {
      // Rolling 7-day window (today minus 6 days through end of today)
      const s = new Date(nowLocal);
      s.setUTCHours(0, 0, 0, 0);
      const todayUtc = s.getTime() - tzOffsetMin * 60_000;
      return { start: new Date(todayUtc - 6 * 86_400_000), end: new Date(todayUtc + 86_400_000) };
    }
    case "monthly": {
      // Rolling 30-day window (today minus 29 days through end of today)
      const s = new Date(nowLocal);
      s.setUTCHours(0, 0, 0, 0);
      const todayUtc = s.getTime() - tzOffsetMin * 60_000;
      return { start: new Date(todayUtc - 29 * 86_400_000), end: new Date(todayUtc + 86_400_000) };
    }
    case "all-time":
      return { start: new Date("2020-01-01"), end: new Date("2099-12-31") };
  }
}

/** The time/flag window a ranking is computed against. Precomputed once per request. */
export interface RankWindow {
  startMs: number;
  endMs: number;
  monthStartMs: number;
  monthEndMs: number;
  isMonthly: boolean;
  hasPlan: boolean;
}

/** Display identity for a ranked user (resolved by the handler from group members / public users). */
export interface EntryInfo {
  userId: string;
  displayName: string;
  avatar: string;
  plan?: string;
  url?: string;
}

/**
 * Aggregate one user's usage blocks into a RankingEntry (rank left at 0; assigned later by
 * sortAndRankByCost). Extracted VERBATIM from the duplicated loops in routes/rankings.ts
 * (global L200-276 / group L448-521) — same arithmetic, same field-by-field construction.
 * `usage` may be null (group members with no usage yet) — yields an all-zero entry.
 */
export function buildRankingEntry(usage: UsageData | null | undefined, info: EntryInfo, win: RankWindow): RankingEntry {
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let costUSD = 0;
  let entryCount = 0;
  let chatCount = 0;
  let monthlyCost = 0;
  let lastActiveTime = 0;
  let lastActiveSource: AgentSource | undefined;
  const models = new Set<string>();
  const agents = new Set<AgentSource>();
  const agentTotals = new Map<AgentSource, AgentTotals>();

  if (usage) {
    for (const block of usage.blocks) {
      if (hasUsage(block)) {
        const activityTime = getBlockActivityTime(block);
        if (activityTime > lastActiveTime) {
          lastActiveTime = activityTime;
          lastActiveSource = block.source ?? "claude";
        }
      }
      const blockTime = new Date(block.blockStart).getTime();
      if (blockTime >= win.startMs && blockTime < win.endMs) {
        const source = block.source ?? "claude";
        totalTokens += block.totalTokens;
        inputTokens += block.inputTokens || 0;
        outputTokens += block.outputTokens || 0;
        reasoningTokens += block.reasoningTokens || 0;
        costUSD += block.costUSD;
        entryCount += block.entryCount;
        chatCount += block.chatCount || 0;
        for (const m of block.models) models.add(m);
        agents.add(source);
        addAgentTotals(agentTotals, block);
      }
      if (win.hasPlan && !win.isMonthly && blockTime >= win.monthStartMs && blockTime < win.monthEndMs) {
        monthlyCost += block.costUSD;
      }
    }
  }

  const entry: RankingEntry = {
    rank: 0,
    userId: info.userId,
    displayName: info.displayName,
    avatar: info.avatar,
    totalTokens,
    inputTokens,
    outputTokens,
    reasoningTokens,
    costUSD: Math.round(costUSD * 10000) / 10000,
    models: Array.from(models),
    agents: Array.from(agents),
    agentBreakdown: buildAgentBreakdown(agentTotals, costUSD, totalTokens),
    entryCount,
    chatCount,
  };
  if (info.plan) entry.plan = info.plan;
  if (info.url) entry.url = info.url;
  if (win.hasPlan) {
    entry.monthlyCostUSD = Math.round((win.isMonthly ? costUSD : monthlyCost) * 10000) / 10000;
  }
  if (usage?.usageSnapshot) entry.usageSnapshot = usage.usageSnapshot;
  if (usage?.lastSync) entry.lastSync = usage.lastSync;
  if (lastActiveTime > 0) entry.lastActiveAt = new Date(lastActiveTime).toISOString();
  if (lastActiveSource) entry.lastActiveSource = lastActiveSource;
  return entry;
}

/** Sort entries by cost descending and assign 1-based ranks in place (verbatim from both handlers). */
export function sortAndRankByCost(entries: RankingEntry[]): void {
  entries.sort((a, b) => b.costUSD - a.costUSD);
  entries.forEach((e, i) => (e.rank = i + 1));
}
