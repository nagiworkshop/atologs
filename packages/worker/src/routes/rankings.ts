import { Hono } from "hono";
import type { Env } from "../types.js";
import type {
  AgentSource,
  GroupRecord,
  UsageData,
  RankingEntry,
  RankingPeriod,
  RankResponse,
  UserRecord,
} from "@ccclub/shared";

const app = new Hono<{ Bindings: Env }>();

const VALID_PERIODS: RankingPeriod[] = ["daily", "yesterday", "weekly", "monthly", "all-time"];
const RANK_CACHE_VERSION = "v4";

type AgentTotals = { costUSD: number; totalTokens: number; nonCacheTokens: number; chatCount: number; entryCount: number };

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hasUsage(block: UsageData["blocks"][number]): boolean {
  return block.entryCount > 0 || block.totalTokens > 0 || block.costUSD > 0;
}

function getBlockActivityTime(block: UsageData["blocks"][number]): number {
  const lastActivity = new Date(block.lastActivityAt || "").getTime();
  if (Number.isFinite(lastActivity)) return lastActivity;
  const blockEnd = new Date(block.blockEnd || block.blockStart).getTime();
  if (Number.isFinite(blockEnd)) return blockEnd;
  const blockStart = new Date(block.blockStart).getTime();
  return Number.isFinite(blockStart) ? blockStart : 0;
}

function addAgentTotals(totals: Map<AgentSource, AgentTotals>, block: UsageData["blocks"][number]): void {
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

function buildAgentBreakdown(totals: Map<AgentSource, AgentTotals>, totalCostUSD: number, totalTokens: number): RankingEntry["agentBreakdown"] {
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

function parsePeriod(rawPeriod: string | undefined, rawWindow: string | undefined): RankingPeriod {
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

function getDateRange(period: RankingPeriod, tzOffsetMin = 0): { start: Date; end: Date } {
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

// GET /api/rank/global - Global public ranking (must be before :code route)
app.get("/rank/global", async (c) => {
  const period = parsePeriod(c.req.query("period"), c.req.query("window"));
  const tz = parseInt(c.req.query("tz") || "0", 10) || 0;
  const publicUsers = (await c.env.KV.get<string[]>("public_users", "json")) || [];

  if (publicUsers.length === 0) {
    return c.json<RankResponse>({
      group: { name: "Global Rankings", code: "global", memberCount: 0 },
      period,
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      rankings: [],
    });
  }

  const { start, end } = getDateRange(period, tz);
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Monthly range for ROI calculation
  const { start: monthStart, end: monthEnd } = getDateRange("monthly", tz);
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();
  const isMonthly = period === "monthly";

  // Fetch all usage data and user groups in parallel
  const [usageResults, groupsResults] = await Promise.all([
    Promise.all(publicUsers.map((id) => c.env.KV.get<UsageData>(`usage:${id}`, "json"))),
    Promise.all(publicUsers.map((id) => c.env.KV.get<string[]>(`user_groups:${id}`, "json"))),
  ]);

  // Fetch first group for each user (for display name + plan) in parallel
  const firstGroupCodes = groupsResults.map((g) => g?.[0]);
  const uniqueCodes = [...new Set(firstGroupCodes.filter(Boolean))] as string[];
  const groupMap = new Map<string, GroupRecord>();
  await Promise.all(
    uniqueCodes.map(async (code) => {
      const g = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
      if (g) groupMap.set(code, g);
    }),
  );

  // Resolve display info and check if any user has a plan
  const userInfos: Array<{ displayName: string; avatar: string; plan?: string; url?: string }> = [];
  for (let idx = 0; idx < publicUsers.length; idx++) {
    const userId = publicUsers[idx];
    let displayName = userId.slice(0, 8);
    let avatar = "";
    let plan: string | undefined;
    let url: string | undefined;
    const firstCode = firstGroupCodes[idx];
    if (firstCode) {
      const group = groupMap.get(firstCode);
      const member = group?.members.find((m) => m.userId === userId);
      if (member) {
        displayName = member.displayName;
        avatar = member.avatar || "";
        plan = member.plan;
        url = member.url;
      }
    }
    userInfos.push({ displayName, avatar, plan, url });
  }
  const hasPlan = userInfos.some((u) => u.plan);

  const entries: RankingEntry[] = [];

  for (let idx = 0; idx < publicUsers.length; idx++) {
    const userId = publicUsers[idx];
    const usage = usageResults[idx];
    const info = userInfos[idx];

    if (!usage) continue;

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

    for (const block of usage.blocks) {
      if (hasUsage(block)) {
        const activityTime = getBlockActivityTime(block);
        if (activityTime > lastActiveTime) {
          lastActiveTime = activityTime;
          lastActiveSource = block.source ?? "claude";
        }
      }
      const blockTime = new Date(block.blockStart).getTime();
      if (blockTime >= startMs && blockTime < endMs) {
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
      if (hasPlan && !isMonthly && blockTime >= monthStartMs && blockTime < monthEndMs) {
        monthlyCost += block.costUSD;
      }
    }

    if (totalTokens > 0 || entryCount > 0) {
      const entry: RankingEntry = {
        rank: 0,
        userId,
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
      if (hasPlan) {
        entry.monthlyCostUSD = Math.round((isMonthly ? costUSD : monthlyCost) * 10000) / 10000;
      }
      if (usage?.usageSnapshot) entry.usageSnapshot = usage.usageSnapshot;
      if (usage?.lastSync) entry.lastSync = usage.lastSync;
      if (lastActiveTime > 0) entry.lastActiveAt = new Date(lastActiveTime).toISOString();
      if (lastActiveSource) entry.lastActiveSource = lastActiveSource;
      entries.push(entry);
    }
  }

  entries.sort((a, b) => b.costUSD - a.costUSD);
  entries.forEach((e, i) => (e.rank = i + 1));

  return c.json<RankResponse>({
    group: { name: "Global Rankings", code: "global", memberCount: publicUsers.length },
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    rankings: entries,
  });
});

// GET /api/rank/:code
app.get("/rank/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const period = parsePeriod(c.req.query("period"), c.req.query("window"));
  const tz = parseInt(c.req.query("tz") || "0", 10) || 0;

  if (code === "88888" || code === "888888" || code === "SAMPLE") {
    const { start, end } = getDateRange(period, tz);
    let scale = 1;
    if (period === "yesterday") scale = 0.9;
    else if (period === "weekly") scale = 6.2;
    else if (period === "monthly") scale = 25.4;
    else if (period === "all-time") scale = 48.7;

    const rankings: RankingEntry[] = [
      {
        rank: 1,
        userId: "demo-alice",
        displayName: "Alice",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        totalTokens: Math.round(612400 * scale),
        inputTokens: Math.round(450000 * scale),
        outputTokens: Math.round(162400 * scale),
        reasoningTokens: Math.round(35000 * scale),
        costUSD: Math.round(1.84 * scale * 10000) / 10000,
        models: ["claude-3-5-sonnet", "gpt-4o"],
        agents: ["claude", "codex"],
        agentBreakdown: [
          {
            source: "claude",
            costUSD: Math.round(1.42 * scale * 10000) / 10000,
            totalTokens: Math.round(412400 * scale),
            nonCacheTokens: Math.round(390000 * scale),
            chatCount: Math.round(8 * scale),
            entryCount: Math.round(32 * scale),
            percent: 77
          },
          {
            source: "codex",
            costUSD: Math.round(0.42 * scale * 10000) / 10000,
            totalTokens: Math.round(200000 * scale),
            nonCacheTokens: Math.round(180000 * scale),
            chatCount: Math.round(2 * scale),
            entryCount: Math.round(10 * scale),
            percent: 23
          }
        ],
        entryCount: Math.round(42 * scale),
        chatCount: Math.round(10 * scale),
        lastActiveAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        lastActiveSource: "claude"
      },
      {
        rank: 2,
        userId: "demo-bob",
        displayName: "Bob",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        totalTokens: Math.round(241500 * scale),
        inputTokens: Math.round(180000 * scale),
        outputTokens: Math.round(61500 * scale),
        reasoningTokens: 0,
        costUSD: Math.round(0.72 * scale * 10000) / 10000,
        models: ["claude-3-5-sonnet"],
        agents: ["claude"],
        agentBreakdown: [
          {
            source: "claude",
            costUSD: Math.round(0.72 * scale * 10000) / 10000,
            totalTokens: Math.round(241500 * scale),
            nonCacheTokens: Math.round(230000 * scale),
            chatCount: Math.round(4 * scale),
            entryCount: Math.round(18 * scale),
            percent: 100
          }
        ],
        entryCount: Math.round(18 * scale),
        chatCount: Math.round(4 * scale),
        lastActiveAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        lastActiveSource: "claude"
      },
      {
        rank: 3,
        userId: "demo-charlie",
        displayName: "Charlie",
        avatar: "",
        totalTokens: Math.round(50200 * scale),
        inputTokens: Math.round(40000 * scale),
        outputTokens: Math.round(10200 * scale),
        reasoningTokens: 0,
        costUSD: Math.round(0.15 * scale * 10000) / 10000,
        models: ["deepseek-coder"],
        agents: ["opencode"],
        agentBreakdown: [
          {
            source: "opencode",
            costUSD: Math.round(0.15 * scale * 10000) / 10000,
            totalTokens: Math.round(50200 * scale),
            nonCacheTokens: Math.round(45000 * scale),
            chatCount: Math.round(2 * scale),
            entryCount: Math.round(6 * scale),
            percent: 100
          }
        ],
        entryCount: Math.round(6 * scale),
        chatCount: Math.round(2 * scale),
        lastActiveAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        lastActiveSource: "opencode"
      }
    ];

    const result: RankResponse = {
      group: { name: code === "SAMPLE" ? "実績紹介" : "ゲストグループ", code, memberCount: 3 },
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      rankings,
    };
    return c.json<RankResponse>(result);
  }

  const group = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
  if (!group) {
    return c.json({ error: "group not found" }, 404);
  }

  const { start, end } = getDateRange(period, tz);



  // Check KV-backed cache before doing O(N) reads
  const tzBucket = Math.round(tz / 60);
  const cacheKey = `rank_cache:${RANK_CACHE_VERSION}:${code}:${period}:${tzBucket}`;
  const [cacheEntry, lastSyncStr] = await Promise.all([
    c.env.KV.get<{ data: RankResponse; computedAt: number }>(cacheKey, "json"),
    c.env.KV.get(`last_sync:${code}`, "text"),
  ]);
  const lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0;
  if (cacheEntry && cacheEntry.computedAt >= lastSync) {
    return c.json(cacheEntry.data);
  }

  const startMs = start.getTime();
  const endMs = end.getTime();

  // Monthly range for ROI calculation
  const { start: monthStart, end: monthEnd } = getDateRange("monthly", tz);
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();
  const isMonthly = period === "monthly";

  // Fetch usage for all members in parallel
  const usageResults = await Promise.all(
    group.members.map((m) => c.env.KV.get<UsageData>(`usage:${m.userId}`, "json")),
  );

  const hasPlan = group.members.some((m) => m.plan);
  const entries: RankingEntry[] = [];

  for (let idx = 0; idx < group.members.length; idx++) {
    const member = group.members[idx];
    const usage = usageResults[idx];

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
        if (blockTime >= startMs && blockTime < endMs) {
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
        if (hasPlan && !isMonthly && blockTime >= monthStartMs && blockTime < monthEndMs) {
          monthlyCost += block.costUSD;
        }
      }
    }

    const entry: RankingEntry = {
      rank: 0,
      userId: member.userId,
      displayName: member.displayName,
      avatar: member.avatar || "",
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
    if (member.plan) entry.plan = member.plan;
    if (member.url) entry.url = member.url;
    if (hasPlan) {
      entry.monthlyCostUSD = Math.round((isMonthly ? costUSD : monthlyCost) * 10000) / 10000;
    }
    if (usage?.usageSnapshot) entry.usageSnapshot = usage.usageSnapshot;
    if (usage?.lastSync) entry.lastSync = usage.lastSync;
    if (lastActiveTime > 0) entry.lastActiveAt = new Date(lastActiveTime).toISOString();
    if (lastActiveSource) entry.lastActiveSource = lastActiveSource;
    entries.push(entry);
  }

  entries.sort((a, b) => b.costUSD - a.costUSD);
  entries.forEach((e, i) => (e.rank = i + 1));

  const result: RankResponse = {
    group: { name: group.name, code: group.code, memberCount: group.members.length },
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    rankings: entries,
  };

  // Store in cache (10 min TTL as safety net); non-blocking
  c.executionCtx.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify({ data: result, computedAt: Date.now() }), {
      expirationTtl: 600,
    })
  );

  return c.json<RankResponse>(result);
});

// GET /api/activity/:code?range=24h|yesterday|7d|30d&tz=N
app.get("/activity/:code", async (c) => {
  const rawCode = c.req.param("code");
  const isGlobal = rawCode.toLowerCase() === "global";
  const code = rawCode.toUpperCase();
  const rawRange = c.req.query("range") || c.req.query("window") || "24h";
  let range: "yesterday" | "7d" | "30d" | "24h" = "24h";
  const norm = rawRange.toLowerCase().trim();
  if (norm === "yesterday") {
    range = "yesterday";
  } else if (norm === "7d" || norm === "weekly" || norm === "7" || norm === "week") {
    range = "7d";
  } else if (norm === "30d" || norm === "monthly" || norm === "30" || norm === "month") {
    range = "30d";
  } else if (norm === "today" || norm === "daily" || norm === "24h" || norm === "1d" || norm === "day") {
    range = "24h";
  }
  const tz = parseInt(c.req.query("tz") || "0", 10) || 0;

  if (code === "88888" || code === "888888" || code === "SAMPLE") {
    const nowUtc = Date.now();
    const nowLocal = new Date(nowUtc + tz * 60_000);
    const todayLocal = new Date(nowLocal);
    todayLocal.setUTCHours(0, 0, 0, 0);
    const todayUtc = todayLocal.getTime() - tz * 60_000;
    let startMs: number;
    let endMs: number;
    let intervalMs: number;
    let steps: number;

    if (range === "30d") {
      startMs = todayUtc - 29 * 86_400_000;
      endMs = todayUtc + 86_400_000;
      intervalMs = 86_400_000;
      steps = 30;
    } else if (range === "7d") {
      startMs = todayUtc - 6 * 86_400_000;
      endMs = todayUtc + 86_400_000;
      intervalMs = 86_400_000;
      steps = 7;
    } else if (range === "yesterday") {
      startMs = todayUtc - 86_400_000;
      endMs = todayUtc;
      intervalMs = 3600_000 * 2; // every 2 hours
      steps = 12;
    } else {
      startMs = todayUtc;
      endMs = todayUtc + 86_400_000;
      intervalMs = 3600_000 * 2; // every 2 hours
      steps = 12;
    }

    const mockUsers = [
      {
        displayName: "Alice",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        baseCost: 0.15,
        baseTokens: 50000,
        activeProb: 0.7,
      },
      {
        displayName: "Bob",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        baseCost: 0.06,
        baseTokens: 20000,
        activeProb: 0.5,
      },
      {
        displayName: "Charlie",
        avatar: "",
        baseCost: 0.02,
        baseTokens: 8000,
        activeProb: 0.3,
      }
    ];

    const series = mockUsers.map(user => {
      const blocks: Array<{ t: string; cost: number; tokens: number; totalTokens: number; chats: number }> = [];
      let totalCost = 0;

      for (let i = 0; i < steps; i++) {
        const timeMs = startMs + i * intervalMs;
        if (timeMs > nowUtc) continue;

        const hash = Math.abs(hashCode(user.displayName + i));
        const active = (hash % 100) / 100 < user.activeProb;

        if (active) {
          const costFactor = 0.5 + (hash % 10) / 10;
          const cost = Math.round(user.baseCost * costFactor * 10000) / 10000;
          const tokens = Math.round(user.baseTokens * costFactor);
          const chats = 1 + (hash % 3);
          blocks.push({
            t: new Date(timeMs).toISOString(),
            cost,
            tokens,
            totalTokens: tokens,
            chats,
          });
          totalCost += cost;
        }
      }

      return {
        displayName: user.displayName,
        avatar: user.avatar,
        totalCost: Math.round(totalCost * 10000) / 10000,
        blocks,
      };
    });

    series.sort((a, b) => b.totalCost - a.totalCost);

    return c.json({
      range,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      series,
    });
  }



  // Check KV-backed cache before doing O(N) reads
  const tzBucket = Math.round(tz / 60);
  const activityCacheKey = `activity_cache:${code}:${range}:${tzBucket}`;
  const [activityCacheEntry, activityLastSyncStr] = await Promise.all([
    c.env.KV.get<{ data: unknown; computedAt: number }>(activityCacheKey, "json"),
    c.env.KV.get(`last_sync:${code}`, "text"),
  ]);
  const activityLastSync = activityLastSyncStr ? parseInt(activityLastSyncStr) : 0;
  if (activityCacheEntry && activityCacheEntry.computedAt >= activityLastSync) {
    return c.json(activityCacheEntry.data);
  }

  // Align time window to user's local day boundary (same logic as getDateRange)
  const nowUtc = Date.now();
  const nowLocal = new Date(nowUtc + tz * 60_000);
  const todayLocal = new Date(nowLocal);
  todayLocal.setUTCHours(0, 0, 0, 0);
  const todayUtc = todayLocal.getTime() - tz * 60_000;

  let startMs: number;
  let endMs: number;
  if (range === "30d") {
    startMs = todayUtc - 29 * 86_400_000;
    endMs = todayUtc + 86_400_000;
  } else if (range === "7d") {
    startMs = todayUtc - 6 * 86_400_000;
    endMs = todayUtc + 86_400_000;
  } else if (range === "yesterday") {
    startMs = todayUtc - 86_400_000;
    endMs = todayUtc;
  } else {
    startMs = todayUtc;
    endMs = todayUtc + 86_400_000;
  }

  // Get members + resolve display names
  const MAX_USERS = 10;
  let memberIds: string[] = [];
  const memberMap = new Map<string, { displayName: string; avatar: string; url?: string }>();

  if (isGlobal) {
    const publicUsers = (await c.env.KV.get<string[]>("public_users", "json")) || [];
    memberIds = publicUsers;

    // Resolve display names from each user's first group (same as /rank/global)
    const groupsResults = await Promise.all(
      memberIds.map((id) => c.env.KV.get<string[]>(`user_groups:${id}`, "json")),
    );
    const firstGroupCodes = groupsResults.map((g) => g?.[0]);
    const uniqueCodes = [...new Set(firstGroupCodes.filter(Boolean))] as string[];
    const groupMap = new Map<string, GroupRecord>();
    await Promise.all(
      uniqueCodes.map(async (gc) => {
        const g = await c.env.KV.get<GroupRecord>(`group:${gc}`, "json");
        if (g) groupMap.set(gc, g);
      }),
    );
    for (let idx = 0; idx < memberIds.length; idx++) {
      const uid = memberIds[idx];
      const fc = firstGroupCodes[idx];
      if (fc) {
        const grp = groupMap.get(fc);
        const mem = grp?.members.find((m) => m.userId === uid);
        if (mem) {
          memberMap.set(uid, { displayName: mem.displayName, avatar: mem.avatar || "", url: mem.url });
          continue;
        }
      }
      memberMap.set(uid, { displayName: uid.slice(0, 8), avatar: "" });
    }
  } else {
    const group = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
    if (!group) return c.json({ error: "group not found" }, 404);
    for (const m of group.members) {
      memberIds.push(m.userId);
      memberMap.set(m.userId, { displayName: m.displayName, avatar: m.avatar || "", url: m.url });
    }
  }

  // Fetch usage for all members
  const usageResults = await Promise.all(
    memberIds.map((id) => c.env.KV.get<UsageData>(`usage:${id}`, "json")),
  );

  // Build per-user time series
  type BlockEntry = { t: number; cost: number; tokens: number; totalTokens: number; chats: number };
  const series: Array<{
    displayName: string;
    avatar: string;
    url?: string;
    totalCost: number;
    blocks: Array<{ t: string; cost: number; tokens: number; totalTokens: number; chats: number }>;
  }> = [];

  for (let i = 0; i < memberIds.length; i++) {
    const userId = memberIds[i];
    const usage = usageResults[i];
    const info = memberMap.get(userId) || { displayName: userId.slice(0, 8), avatar: "" };

    const parsed: BlockEntry[] = [];
    if (usage) {
      for (const block of usage.blocks) {
        const blockTime = new Date(block.blockStart).getTime();
        if (blockTime >= startMs && blockTime < endMs) {
          parsed.push({
            t: blockTime,
            cost: Math.round(block.costUSD * 10000) / 10000,
            tokens: (block.inputTokens != null && block.outputTokens != null)
              ? (block.inputTokens + block.outputTokens + (block.reasoningTokens || 0))
              : block.totalTokens,
            totalTokens: block.totalTokens,
            chats: block.chatCount || 0,
          });
        }
      }
    }
    parsed.sort((a, b) => a.t - b.t);

    const totalCost = parsed.reduce((s, bl) => s + bl.cost, 0);
    const blocks = parsed.map((bl) => ({
      t: new Date(bl.t).toISOString(),
      cost: bl.cost,
      tokens: bl.tokens,
      totalTokens: bl.totalTokens,
      chats: bl.chats,
    }));

    series.push({ displayName: info.displayName, avatar: info.avatar, url: info.url, totalCost, blocks });
  }

  // Sort by total cost descending, limit to top N
  series.sort((a, b) => b.totalCost - a.totalCost);
  const limited = series.filter((s) => s.blocks.length > 0).slice(0, MAX_USERS);

  const activityResult = { range, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), series: limited };

  c.executionCtx.waitUntil(
    c.env.KV.put(activityCacheKey, JSON.stringify({ data: activityResult, computedAt: Date.now() }), {
      expirationTtl: 600,
    })
  );

  return c.json(activityResult);
});

export { app as rankRoutes };
