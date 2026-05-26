/**
 * ⚠️ 维护本文件前必读：/REDESIGN_SPEC.md
 *
 * 本文件遵循 AtoLogs 重做规范：
 * - 不许写 <!DOCTYPE> <html> <body> 骨架（用 renderLayout 包裹）
 * - 不许写 <header> <footer> <nav class="bottom-nav">（layout 提供）
 * - 不许在本文件内加额外 <style> 块（用 renderLayout 的 extraStyles 参数）
 * - 不许硬编码 hex 颜色（从 design-tokens.ts 导入）
 * - 改完后必须跑 `bash scripts/audit-consistency.sh atologs.com` 验证
 *
 * 长期维护规则见 CLAUDE.md「网站维护铁律」段落
 */

import { Hono } from "hono";
import { html, raw } from "hono/html";
import type { Env } from "./types.js";
import type { AgentSource, GroupRecord, UsageData } from "@ccclub/shared";
import { cachedPngResponse, getColor, hashCode, htmlEsc, latinOnly, ogCacheUrl, renderToPng, sanitizeCode, svgEsc, truncate } from "./og-utils.js";
import { renderLayout, renderFeedbackCta } from "./components/layout.js";
import { colors, fontSize, spacing, radius, shadow } from "./design-tokens.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/g/:code", async (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const code = sanitizeCode(c.req.param("code"));
  if (!code) return c.text("Invalid code", 400);
  const isGlobal = code.toLowerCase() === "global";
  let groupName = "";
  let memberCount = 0;
  if (code === "88888" || code === "888888" || code === "SAMPLE") {
    groupName = code === "SAMPLE" ? "実績紹介" : "ゲストグループ";
    memberCount = code === "SAMPLE" ? 3 : 0;
  } else if (!isGlobal) {
    const group = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
    if (group) {
      groupName = group.name;
      memberCount = group.members.length;
    }
  }
  const origin = new URL(c.req.url).origin;
  return c.html(dashboardHTML(code, groupName, memberCount, origin));
});

// ── Dashboard OG image with ranking table ────────────────────

app.get("/g/:code/og.png", async (c) => {
  const code = sanitizeCode(c.req.param("code"));
  if (!code) return c.text("Invalid code", 400);
  const isGlobal = code.toLowerCase() === "global";

  let groupName: string;
  let members: Array<{ userId: string; displayName: string }>;
  let totalMembers: number;
  let cacheVersion: string;

  if (isGlobal) {
    groupName = "Global Rankings";
    const publicUsers = (await c.env.KV.get<string[]>("public_users", "json")) || [];
    totalMembers = publicUsers.length;
    members = publicUsers.slice(0, 30).map((id) => ({ userId: id, displayName: id.slice(0, 8) }));
    cacheVersion = `global:${totalMembers}:${Math.floor(Date.now() / 300_000)}`;
  } else if (code === "88888" || code === "888888" || code === "SAMPLE") {
    groupName = code === "SAMPLE" ? "実績紹介" : "ゲストグループ";
    members = [];
    totalMembers = code === "SAMPLE" ? 3 : 0;
    cacheVersion = code === "SAMPLE" ? "sample" : "guest";
  } else {
    const [group, lastSync] = await Promise.all([
      c.env.KV.get<GroupRecord>(`group:${code}`, "json"),
      c.env.KV.get(`last_sync:${code}`, "text"),
    ]);
    if (!group) return c.text("Not found", 404);
    groupName = group.name;
    members = group.members.map((m) => ({ userId: m.userId, displayName: m.displayName }));
    totalMembers = members.length;
    cacheVersion = `${lastSync || "0"}:${hashCode(`${group.name}:${group.members.map((m) => `${m.userId}:${m.displayName}:${m.avatar || ""}:${m.joinedAt}`).join("|")}`)}`;
  }

  const origin = new URL(c.req.url).origin;
  const domain = origin.replace("https://", "");
  const cacheUrl = ogCacheUrl(c.req.url, `g/v2/${code}/${cacheVersion}.png`);
  return cachedPngResponse(cacheUrl, async () => {
    const usageResults = await Promise.all(
      members.map((m) => c.env.KV.get<UsageData>(`usage:${m.userId}`, "json")),
    );

    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const startMs = todayStart.getTime();
    const endMs = startMs + 86_400_000;
    const agentSet = new Set<AgentSource>();
    let activeCount = 0;

    const ranked: DashboardOgEntry[] = [];
    for (let i = 0; i < members.length; i++) {
      const usage = usageResults[i];
      let cost = 0;
      let tokens = 0;
      let turns = 0;
      let lastActiveMs = 0;
      const agents = new Set<AgentSource>();

      if (usage) {
        for (const block of usage.blocks) {
          const t = new Date(block.blockStart).getTime();
          if (t < startMs || t >= endMs) continue;
          const activityTime = new Date(block.lastActivityAt || block.blockEnd || block.blockStart).getTime();
          if (Number.isFinite(activityTime) && activityTime > lastActiveMs) lastActiveMs = activityTime;
          const source = block.source ?? "claude";
          cost += block.costUSD;
          tokens += (block.inputTokens != null && block.outputTokens != null)
            ? (block.inputTokens + block.outputTokens + (block.reasoningTokens || 0))
            : block.totalTokens;
          turns += block.chatCount || 0;
          agents.add(source);
          agentSet.add(source);
        }
      }
      if (lastActiveMs > 0 && now - lastActiveMs < 15 * 60 * 1000) {
        activeCount++;
      }
      ranked.push({
        ...members[i],
        agents: Array.from(agents),
        costUSD: Math.round(cost * 100) / 100,
        tokens,
        turns,
      });
    }
    ranked.sort((a, b) => b.costUSD - a.costUSD);

    const svg = buildDashboardOgSvg(
      groupName,
      ranked.slice(0, 5),
      totalMembers,
      activeCount,
      formatAgentSummary(Array.from(agentSet)),
      code,
      domain,
    );
    return renderToPng(svg);
  }, {
    maxAge: 300,
    staleWhileRevalidate: 86_400,
    executionCtx: c.executionCtx,
  });
});

type DashboardOgEntry = {
  displayName: string;
  userId: string;
  costUSD: number;
  tokens: number;
  turns: number;
  agents: AgentSource[];
};

const AGENT_LABELS_OG: Record<AgentSource, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  amp: "Amp",
  pi: "pi-agent",
};

const AGENT_ORDER_OG: AgentSource[] = ["claude", "codex", "opencode", "amp", "pi"];

function formatAgentSummary(agents: AgentSource[]): string {
  const ordered = AGENT_ORDER_OG.filter((a) => agents.includes(a));
  return ordered.length > 0 ? ordered.map((a) => AGENT_LABELS_OG[a]).join(" · ") : "Claude Code · Codex · OpenCode · Amp · pi-agent";
}

function formatAgentCell(agents: AgentSource[]): string {
  const ordered = AGENT_ORDER_OG.filter((a) => agents.includes(a));
  if (ordered.length === 0) return "—";
  return ordered.slice(0, 2).map((a) => AGENT_LABELS_OG[a].replace(" Code", "")).join(", ");
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${parseFloat((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(Math.round(n));
}

function buildDashboardOgSvg(
  groupName: string,
  top5: DashboardOgEntry[],
  totalMembers: number,
  activeCount: number,
  agentSummary: string,
  code: string,
  domain: string,
): string {
  const W = 1200;
  const H = 630;
  const name = svgEsc(truncate(latinOnly(groupName) || code, 32));

  const ROW_H = 56;
  const TABLE_X = 86;
  const TABLE_W = 1028;
  const TABLE_Y = 238;
  const memberLabel = `${totalMembers} 人のメンバー`;
  const activeLabel = `${activeCount} 人がアクティブ`;

  let tableRows = "";
  top5.forEach((entry, i) => {
    const y = TABLE_Y + i * ROW_H;
    const color = getColor(entry.userId);
    const latin = latinOnly(entry.displayName);
    const initial = svgEsc((latin || "?").charAt(0).toUpperCase());
    const displayName = svgEsc(truncate(latin || entry.userId.slice(0, 8), 22));
    const rankColor = i === 0 ? "#d6b56d" : i === 1 ? "#aeb7bf" : i === 2 ? "#c58a61" : "#746f69";
    const tint = i === 0 ? "#d6b56d" : i === 1 ? "#aeb7bf" : i === 2 ? "#c58a61" : "#ffffff";
    const tintOpacity = i === 0 ? "0.075" : i === 1 ? "0.045" : i === 2 ? "0.05" : i % 2 === 0 ? "0.026" : "0.018";
    const costStr = entry.costUSD > 0 ? `$${entry.costUSD.toFixed(2)}` : "$0.00";
    const agentStr = svgEsc(formatAgentCell(entry.agents));

    tableRows += `
      <rect x="${TABLE_X}" y="${y}" width="${TABLE_W}" height="${ROW_H - 4}" rx="8" fill="${tint}" fill-opacity="${tintOpacity}" stroke="#2a2723" stroke-width="1"/>
      <text x="${TABLE_X + 24}" y="${y + 34}" fill="${rankColor}" font-size="18" font-weight="700" font-family="Inter, sans-serif">${i + 1}</text>
      <circle cx="${TABLE_X + 72}" cy="${y + 27}" r="17" fill="${color}"/>
      <text x="${TABLE_X + 72}" y="${y + 33}" text-anchor="middle" fill="#161412" font-size="14" font-weight="700" font-family="Inter, sans-serif">${initial}</text>
      <text x="${TABLE_X + 104}" y="${y + 34}" fill="#f1ede7" font-size="18" font-weight="600" font-family="Inter, sans-serif">${displayName}</text>
      <text x="${TABLE_X + 460}" y="${y + 34}" fill="#a8a19a" font-size="15" font-weight="500" font-family="Inter, sans-serif">${agentStr}</text>
      <text x="${TABLE_X + 700}" y="${y + 34}" text-anchor="end" fill="#d4935e" font-size="17" font-weight="700" font-family="Inter, sans-serif">${costStr}</text>
      <text x="${TABLE_X + 850}" y="${y + 34}" text-anchor="end" fill="#cfc8c0" font-size="16" font-weight="600" font-family="Inter, sans-serif">${formatCompactNumber(entry.tokens)}</text>
      <text x="${TABLE_X + TABLE_W - 28}" y="${y + 34}" text-anchor="end" fill="#cfc8c0" font-size="16" font-weight="600" font-family="Inter, sans-serif">${formatCompactNumber(entry.turns)}</text>`;
  });

  if (top5.length === 0) {
    tableRows = `<rect x="${TABLE_X}" y="${TABLE_Y}" width="${TABLE_W}" height="170" rx="12" fill="#1f1c18" stroke="#2a2723"/><text x="${W / 2}" y="${TABLE_Y + 94}" text-anchor="middle" fill="#6b6560" font-size="20" font-family="Inter, sans-serif">本日のアクティビティはまだありません</text>`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#201d19"/>
      <stop offset="100%" stop-color="#13110f"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="42" y="34" width="${W - 84}" height="${H - 68}" rx="24" fill="#181512" stroke="#2b2723"/>

  <!-- Brand -->
  <text x="86" y="78" fill="#746f69" font-size="20" font-weight="700" font-family="Inter, sans-serif">AtoLogs</text>
  <circle cx="86" cy="118" r="5" fill="#5fdc8f"/>
  <text x="102" y="124" fill="#8a8480" font-size="15" font-weight="600" font-family="Inter, sans-serif">ライブリーダーボード・プレビュー</text>

  <!-- Group name -->
  <text x="86" y="166" fill="#f3eee7" font-size="44" font-weight="700" font-family="Inter, sans-serif" letter-spacing="-1">${name}</text>

  <!-- Subtitle -->
  <text x="86" y="194" fill="#8a8480" font-size="17" font-family="Inter, sans-serif">今日 · ${memberLabel} · ${activeLabel}</text>
  <rect x="748" y="72" width="366" height="52" rx="14" fill="#201d19" stroke="#2c2824"/>
  <text x="770" y="105" fill="#a8a19a" font-size="15" font-weight="600" font-family="Inter, sans-serif">${svgEsc(truncate(agentSummary, 44))}</text>

  <!-- Header row -->
  <text x="${TABLE_X + 24}" y="${TABLE_Y - 14}" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">#</text>
  <text x="${TABLE_X + 104}" y="${TABLE_Y - 14}" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">メンバー</text>
  <text x="${TABLE_X + 460}" y="${TABLE_Y - 14}" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">エージェント</text>
  <text x="${TABLE_X + 700}" y="${TABLE_Y - 14}" text-anchor="end" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">料金</text>
  <text x="${TABLE_X + 850}" y="${TABLE_Y - 14}" text-anchor="end" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">トークン</text>
  <text x="${TABLE_X + TABLE_W - 28}" y="${TABLE_Y - 14}" text-anchor="end" fill="#6d6760" font-size="12" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.8">会話回数</text>

  <!-- Ranking rows -->
  ${tableRows}

  <!-- Footer -->
  <text x="86" y="${H - 70}" fill="#4f4942" font-size="15" font-family="Inter, sans-serif">${svgEsc(domain)}/g/${svgEsc(code)}</text>
  <text x="${W - 86}" y="${H - 70}" text-anchor="end" fill="#4f4942" font-size="15" font-family="Inter, sans-serif">クロードコード &amp; コーディングエージェント リーダーボード</text>
</svg>`;
}

export function dashboardHTML(code: string, groupName: string, memberCount: number, origin: string, canonicalPath?: string) {
  const isGlobal = code.toLowerCase() === "global";
  const ogTitle = isGlobal
    ? "グローバル活用ログ — AtoLogs"
    : groupName
      ? `${htmlEsc(truncate(groupName, 40))} \u2014 AtoLogs`
      : `${htmlEsc(code)} \u2014 AtoLogs`;
  const ogDesc = isGlobal
    ? "世界の開発者によるコーディングエージェントの利用状況と活用ログ一覧です。"
    : groupName
      ? `${memberCount} 人のメンバーがコーディングエージェントの利用状況を記録しています。`
      : `${htmlEsc(code)}のコーディングエージェント利用状況リーダーボード。`;

  const extraStyles = `
    body.unauthenticated #raw-data-btn-container,
    body.unauthenticated #sharing-banner {
      display: none !important;
    }

    /* Hide local top-nav on desktop when header is active */
    @media (min-width: 768px) {
      .top-nav {
        display: none !important;
      }
    }

    :root {
      --bg: ${colors.bg};
      --surface: ${colors.bgWhite};
      --surface-soft: ${colors.bgMuted};
      --surface-deep: ${colors.bg};
      --line: ${colors.border};
      --line-soft: ${colors.borderLight};
      --text: ${colors.textPrimary};
      --title: ${colors.textPrimary};
      --muted: ${colors.textMuted};
      --faint: ${colors.textFaint};
      --brand: ${colors.accent};
      --link: ${colors.accent};
      --success: ${colors.success};
      --gold: ${colors.gold};
      --silver: ${colors.silver};
      --bronze: ${colors.bronze};
    }
    
    code { font-family: "SF Mono", "Fira Code", Menlo, Consolas, monospace !important; }

    .wrap {
      max-width: 1024px;
      margin: 0 auto;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    @media (min-width: 768px) {
      .wrap {
        padding: 40px 24px;
        gap: 40px;
      }
    }

    /* Top nav */
    .top-nav {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }

    /* Back link */
    .back-link, .global-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: ${colors.textMuted};
      font-size: 13px;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s;
    }
    @media (min-width: 768px) {
      .back-link, .global-link {
        font-size: 14px;
      }
    }
    .back-link:hover, .global-link:hover {
      color: ${colors.accent};
    }

    /* Header */
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: ${colors.textPrimary};
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
    @media (min-width: 768px) {
      h1 {
        font-size: 24px;
      }
    }
    .subtitle {
      color: ${colors.textSecondary};
      font-size: 14px;
      margin-top: 4px;
      line-height: 1.5;
    }
    @media (min-width: 768px) {
      .subtitle {
        font-size: 16px;
      }
    }
    .agent-summary {
      color: ${colors.textMuted};
      font-size: 12px;
      margin-top: 6px;
      line-height: 1.5;
      min-height: 18px;
    }

    /* Period selector matching atologs.com tabs */
    .periods {
      display: flex;
      gap: 6px;
      margin: 16px 0 8px;
      flex-wrap: wrap;
      align-items: center;
      background: transparent;
      border: none;
      padding: 0;
      border-radius: 0;
    }
    @media (min-width: 768px) {
      .periods {
        gap: 8px;
      }
    }
    .periods button {
      flex: 1;
      text-align: center;
      white-space: nowrap;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid ${colors.border};
      background: ${colors.bgWhite};
      color: ${colors.textSecondary};
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
      font-weight: 500;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    @media (min-width: 768px) {
      .periods button {
        flex: none;
        padding: 8px 16px;
      }
    }
    .periods button:hover:not(.toggle):not(.active) {
      border-color: ${colors.accent};
      color: ${colors.accentDark};
    }
    .periods button:active:not(.toggle) {
      background: ${colors.bgMuted};
    }
    .periods button.active {
      background: ${colors.textPrimary};
      color: ${colors.bgWhite};
      border-color: ${colors.textPrimary};
    }

    /* Cache toggle */
    .toggle-wrap {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px;
    }
    @media (max-width: 600px) {
      .toggle-wrap {
        width: 100%;
        margin-left: 0;
        justify-content: flex-end;
        padding-top: 8px;
      }
    }
    .toggle-label { font-size: 12px; color: ${colors.textMuted}; user-select: none; cursor: pointer; font-weight: 500; }
    .toggle {
      position: relative; width: 32px; height: 18px; cursor: pointer;
      background: var(--line); border-radius: 9px; border: none; outline: none;
      padding: 0; transition: background 0.2s;
    }
    .toggle::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: ${colors.textMuted}; transition: all 0.2s;
    }
    .toggle.on { background: var(--success); }
    .toggle.on::after { left: 16px; background: var(--surface); }

    /* Table */
    .table-shell {
      overflow-x: auto; border-radius: 12px; border: 1px solid ${colors.border};
      background: var(--surface);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    table { width: 100%; border-collapse: collapse; margin-top: 0; min-width: 680px; }

    /* Responsive blocks */
    @media (max-width: 767px) {
      .desktop-only { display: none !important; }
      .mobile-only { display: block !important; }
    }
    @media (min-width: 768px) {
      .desktop-only { display: block !important; }
      .mobile-only { display: none !important; }
    }

    /* Mobile Cards */
    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mobile-card {
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      transition: background 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .mobile-card:active {
      background: #f5f5f0;
    }
    .mobile-card.top-one { border-left: 3px solid var(--gold); }
    .mobile-card.top-two { border-left: 3px solid var(--silver); }
    .mobile-card.top-three { border-left: 3px solid var(--bronze); }
    .mobile-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mobile-card-header .rank {
      width: 24px;
      text-align: center;
      flex-shrink: 0;
      margin: 0;
    }
    .mobile-card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 16px;
      margin-top: 12px;
      padding-left: 36px;
    }
    @media (min-width: 480px) {
      .mobile-card-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .mobile-stat-item {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 10px;
      color: ${colors.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
      font-weight: 500;
      white-space: nowrap;
    }
    .stat-val {
      font-size: 13px;
      font-weight: 500;
      color: ${colors.textPrimary};
      font-variant-numeric: tabular-nums;
    }
    .stat-val.cost { font-weight: 600; }
    th {
      color: ${colors.textMuted}; font-size: 13px; font-weight: 500;
      text-align: left; padding: 12px 16px;
      border-bottom: 1px solid ${colors.border};
      background: ${colors.bg};
    }
    td { padding: 12px 16px; border-bottom: 1px solid ${colors.borderLight}; vertical-align: middle; }
    tbody tr { transition: background 0.15s ease; }
    tbody tr:hover { background: ${colors.bg}; }
    tbody tr:last-child td { border-bottom: none; }
    tr.top-one { background: rgba(217,119,6,0.01); }
    tr.top-two { background: rgba(75,85,99,0.005); }
    tr.top-three { background: rgba(180,83,9,0.005); }
    
    /* Column alignments */
    th:nth-child(3), td:nth-child(3),
    th:nth-child(4), td:nth-child(4),
    th:nth-child(5), td:nth-child(5),
    th:nth-child(6), td:nth-child(6),
    th:nth-child(7), td:nth-child(7) {
      text-align: right;
    }

    .rank { font-weight: 700; width: 40px; color: var(--faint); }
    .rank.gold { color: var(--gold); }
    .rank.silver { color: var(--silver); }
    .rank.bronze { color: var(--bronze); }
    .name-cell { display: flex; align-items: center; gap: 12px; text-align: left; }
    .name-cell > div:last-child { flex: 1; min-width: 0; }
    .avatar-wrap { position: relative; flex-shrink: 0; width: 32px; height: 32px; }
    .avatar {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 500; font-size: 13px; color: #ffffff;
    }
    .typing-bubble {
      position: absolute; top: -6px; right: -4px;
      background: #ffffff; border-radius: 8px;
      padding: 3px 5px; display: flex; gap: 2px; align-items: center;
      box-shadow: 0 0 0 2px var(--bg), 0 1px 3px rgba(0,0,0,0.1);
    }
    .typing-bubble span {
      width: 3.5px; height: 3.5px; border-radius: 50%; background: var(--text);
      opacity: 0.15; animation: typing-fade 1.2s infinite ease-in-out;
    }
    .typing-bubble span:nth-child(1) { animation-delay: 0s; }
    .typing-bubble span:nth-child(2) { animation-delay: 0.3s; }
    .typing-bubble span:nth-child(3) { animation-delay: 0.6s; }
    @keyframes typing-fade {
      0%, 100% { opacity: 0.15; }
      30%, 50% { opacity: 1; }
    }
    .avatar img {
      width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
    }
    .avatar img.errored { display: none; }
    .avatar .fallback { display: none; }
    .avatar img.errored + .fallback { display: flex; }
    .name-text { font-weight: 500; font-size: 14px; color: ${colors.textPrimary}; }
    .agent-line {
      color: var(--faint); font-size: 11px; margin-top: 4px; min-height: 18px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .agent-source { color: var(--muted); }
    .agent-percent { color: var(--faint); font-variant-numeric: tabular-nums; }
    .active-badge {
      display: inline-flex; align-items: center; gap: 4px; vertical-align: -1px;
      color: var(--success); font-size: 12px; font-weight: 400; margin-left: 6px; line-height: 1;
    }
    .active-agent-icon {
      width: 12px; height: 12px; display: block; object-fit: contain; flex: 0 0 auto;
    }
    .active-agent-fallback {
      width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 3px; background: rgba(5,150,105,0.08); color: var(--success); font-size: 10px; font-weight: 600;
    }
    .active-count {
      color: var(--success); font-size: 13px; margin-top: 4px;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .active-split {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--muted); font-size: 12px;
    }
    .active-source-score {
      display: inline-flex; align-items: center; gap: 4px;
      white-space: nowrap;
    }
    .active-source-score img {
      width: 13px; height: 13px; display: block; object-fit: contain;
    }
    .active-source-score .fallback {
      width: 13px; height: 13px; border-radius: 3px;
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(5,150,105,0.08); color: var(--success);
      font-size: 10px; font-weight: 650; line-height: 1;
    }
    .active-source-score .score-count {
      color: var(--success); font-weight: 650; font-variant-numeric: tabular-nums;
    }
    .active-score-sep { color: var(--line); }
    .name-link {
      color: ${colors.textPrimary};
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s;
    }
    .name-link:hover {
      color: ${colors.accent};
      text-decoration: none;
    }
    .bar {
      height: 3px; background: var(--brand); border-radius: 2px; margin-top: 6px;
      opacity: 0.25; transition: width 0.3s;
    }
    .tokens { color: ${colors.textPrimary}; font-variant-numeric: tabular-nums; font-size: 14px; }
    .cost { font-variant-numeric: tabular-nums; font-size: 14px; color: ${colors.textPrimary}; font-weight: 500; }
    .roi { font-variant-numeric: tabular-nums; font-size: 13px; white-space: nowrap; }
    .roi .price { color: var(--faint); }
    .roi .pct { font-weight: 600; }
    .roi .pct.high { color: var(--success); }
    .roi .pct.mid { color: var(--gold); }
    .roi .pct.low { color: var(--faint); }
    .calls { color: var(--muted); font-size: 14px; }
    .avg-turn { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .avg-turn-main { color: var(--text); font-size: 14px; font-weight: 500; }
    .avg-turn-sub { color: var(--faint); font-size: 11px; margin-top: 2px; }

    /* Activity chart */
    .chart-section { margin-top: 32px; }
    .chart-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px;
    }
    .chart-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .chart-canvas {
      background: var(--surface); border-radius: 12px; padding: 20px;
      border: 1px solid var(--line);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .chart-canvas svg { width: 100%; display: block; }
    .chart-legend {
      display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px;
      padding: 0 4px;
    }
    .chart-legend-item {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--muted); cursor: pointer; user-select: none;
      font-weight: 500;
    }
    .chart-legend-item.hidden { opacity: 0.4; }
    .chart-legend-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .chart-canvas { position: relative; }
    .chart-tooltip {
      position: absolute; pointer-events: none; opacity: 0;
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 8px; padding: 8px 12px; font-size: 12px;
      color: var(--text); white-space: nowrap; z-index: 10;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
      transition: opacity 0.15s;
    }
    .chart-tooltip.visible { opacity: 1; }

    /* Empty */
    .empty { text-align: center; color: var(--faint); padding: 64px 0; font-size: 14px; line-height: 1.8; }

    /* Invite */
    .invite {
      margin-top: 32px; padding: 20px; background: var(--surface); border-radius: 12px;
      display: flex; align-items: center; justify-content: space-between;
      border: 1px solid var(--line);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .invite-label { color: var(--muted); font-size: 12px; margin-bottom: 4px; font-weight: 500; }
    .invite-code {
      font-family: "SF Mono", Menlo, monospace;
      font-size: 14px; letter-spacing: 0.5px; font-weight: 600; color: var(--text);
    }
    .copy-btn {
      padding: 8px 16px; border-radius: 8px; border: 1px solid var(--line);
      background: var(--surface); color: var(--muted); cursor: pointer;
      font-size: 13px; font-family: inherit; font-weight: 550;
      transition: all 0.15s ease;
    }
    .copy-btn:hover { border-color: var(--brand); color: var(--text); }

    /* Stat Grid */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 10px 0 10px;
    }
    @media (min-width: 768px) {
      .stat-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .stat-card.brand-card {
      border-color: #c7d2fe;
      background: rgba(99, 102, 241, 0.04);
    }
    .stat-card.success-card {
      border-color: #a7f3d0;
      background: rgba(16, 185, 129, 0.04);
    }
    .stat-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 550;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .stat-sub {
      font-size: 11px;
      color: var(--faint);
      margin-top: 2px;
    }

    /* View Modes & Segmented Control */
    .view-modes {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-top: -12px;
      margin-bottom: -12px;
    }
    .segmented-control {
      display: inline-flex;
      background: var(--surface-soft);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid var(--line);
    }
    .segmented-control button {
      background: transparent;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      font-weight: 550;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .segmented-control button:hover {
      color: var(--text);
    }
    .segmented-control button.active {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      border: 1px solid var(--line);
    }

    @media (max-width: 600px) {
      .wrap { padding: 32px 16px; }
      .periods { align-items: stretch; }
      .toggle-wrap { width: 100%; margin-left: 0; justify-content: flex-end; padding: 2px 6px 4px; }
      th:nth-last-child(1), td:nth-last-child(1) { display: none; }
      .hide-mobile { display: none; }
    }

    /* Toggle switch styles */
    .ios-switch {
      position: relative;
      width: 46px;
      height: 26px;
      background-color: var(--line, #e5e5e0);
      border-radius: 13px;
      border: none;
      cursor: pointer;
      outline: none;
      transition: background-color 0.2s;
      padding: 0;
      flex-shrink: 0;
    }
    .ios-switch.active {
      background-color: ${colors.accent};
    }
    .ios-switch-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 22px;
      height: 22px;
      background-color: #ffffff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s;
    }
    .ios-switch.active .ios-switch-thumb {
      transform: translateX(20px);
    }
  `;

  const bodyContent = html`
    <div id="toast-container" style="position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;"></div>
    <div class="wrap">
      <div class="top-nav">
        <a href="/" class="back-link" id="back-link">← ${isGlobal ? "マイグループ" : "ホーム"}</a>
        ${isGlobal ? html`` : html`<a href="/g/global" class="global-link">グローバル →</a>`}
      </div>
      ${code === "888888" ? html`
        <div class="demo-banner" style="
          background: ${colors.warningBg};
          border: 1px solid ${colors.border};
          border-left: 4px solid ${colors.gold};
          border-radius: ${radius.lg};
          padding: ${spacing[3]} ${spacing[4]};
          margin-bottom: ${spacing[4]};
          font-size: ${fontSize.md};
          color: ${colors.warning};
          box-shadow: ${shadow.sm};
          display: flex;
          flex-direction: column;
          gap: ${spacing[1.5]};
          text-align: left;
        ">
          <div style="font-weight: 700; display: flex; align-items: center; gap: ${spacing[1.5]}; font-size: ${fontSize.lg}; color: ${colors.warning};">
            <span>🔍</span>
            <span>デモダッシュボードの移行について</span>
          </div>
          <div style="color: ${colors.textSecondary}; font-size: ${fontSize.base}; line-height: 1.6;">
            AtoLogs の機能を紹介する新しいダッシュボードページ（実績紹介）が公开されました。<br>
            新しいデモ画面は以下のリンクからご覧いただけます：
          </div>
          <div style="margin-top: 8px;">
            <a href="/sample" style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; background-color: ${colors.textPrimary}; color: #ffffff; border-radius: ${radius.md}; font-size: 14px; font-weight: 600; text-decoration: none; transition: background-color 0.15s ease-in-out;" onmouseover="this.style.backgroundColor='#262626'" onmouseout="this.style.backgroundColor='${colors.textPrimary}'">
              新しいデモページ（/sample）を見る &rarr;
            </a>
          </div>
        </div>
      ` : (code === "SAMPLE" ? html`
        <div class="demo-banner" style="
          background: ${colors.warningBg};
          border: 1px solid ${colors.border};
          border-left: 4px solid ${colors.gold};
          border-radius: ${radius.lg};
          padding: ${spacing[3]} ${spacing[4]};
          margin-bottom: ${spacing[4]};
          font-size: ${fontSize.md};
          color: ${colors.warning};
          box-shadow: ${shadow.sm};
          display: flex;
          flex-direction: column;
          gap: ${spacing[1.5]};
          text-align: left;
        ">
          <div style="font-weight: 700; display: flex; align-items: center; gap: ${spacing[1.5]}; font-size: ${fontSize.lg}; color: ${colors.warning};">
            <span>🔍</span>
            <span>これはデモデータです（演示数据）</span>
          </div>
          <div style="color: ${colors.textSecondary}; font-size: ${fontSize.base}; line-height: 1.6;">
            実際の記録は <code style="background: ${colors.bgMuted}; padding: 2px 4px; border-radius: ${radius.sm}; border: 1px solid ${colors.border}; font-size: ${fontSize.xs}; color: ${colors.textPrimary}; font-weight: 500;">ccclub init</code> で開始できます。<br>
            詳細は <a href="/guide" style="color: ${colors.accent}; font-weight: 600; text-decoration: underline; transition: color 0.15s;" onmouseover="this.style.color='${colors.accentDark}'" onmouseout="this.style.color='${colors.accent}'">使い方（使用指南）</a> をご覧ください。
          </div>
        </div>
      ` : html``)}
      <h1 id="title">${isGlobal ? "グローバル活用ログ" : (groupName ? htmlEsc(groupName) : htmlEsc(code))}</h1>
      <div class="subtitle" id="date-range"></div>
      <div class="agent-summary" id="agent-summary"></div>
      <div class="active-count" id="active-count"></div>

      <div id="sharing-banner" style="display: none; align-items: center; justify-content: space-between; background: var(--card-bg, #fff); border: 1px solid var(--line, #e5e5e0); border-radius: 12px; padding: 12px 16px; margin: 16px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="sharing-icon" style="font-size: 18px;">🔒</span>
          <div>
            <div id="sharing-title" style="font-weight: 600; font-size: 13px; color: var(--text);">活用ログへの共有</div>
            <div id="sharing-desc" style="font-size: 11px; color: var(--muted); margin-top: 1px;">あなたのデータはグループ内のみ（非公開）です。</div>
          </div>
        </div>
        <button id="toggle-sharing-btn" class="ios-switch" aria-label="活用ログ共有切り替え">
          <span class="ios-switch-thumb"></span>
        </button>
      </div>

      <div class="stat-grid" id="stat-grid"></div>

      <div id="raw-data-btn-container" style="margin-top: 16px; text-align: center;">
        <button id="show-raw-data-btn" style="background: none; border: none; color: #737373; font-size: 13px; text-decoration: underline; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='none'">
          🔍 私のデータの中身を確認する
        </button>
      </div>

      <!-- Modal for showing raw data -->
      <div id="raw-data-modal" style="display: none; position: fixed; inset: 0; z-index: 999; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #ffffff; border: 1px solid #e5e5e0; border-radius: 12px; max-width: 600px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.08); display: flex; flex-direction: column; overflow: hidden; max-height: 85vh; text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e5e0;">
            <h3 style="font-size: 15px; font-weight: bold; margin: 0; display: flex; align-items: center; gap: 6px; color: #171717;">
              <span>🔍</span> 送信されたデータの中身
            </h3>
            <button style="background: none; border: none; font-size: 20px; cursor: pointer; color: #a3a3a3; line-height: 1; padding: 4px;" onclick="document.getElementById('raw-data-modal').style.display='none'">&times;</button>
          </div>
          <div style="padding: 16px; overflow-y: auto; flex: 1;">
            <div style="font-size: 12.5px; color: #171717; font-weight: 500; margin-bottom: 16px; line-height: 1.5; padding: 12px; background: #fafaf9; border-left: 4px solid #171717; border-radius: 4px;">
              💡 <strong>送信データの詳細：</strong><br>
              これがサーバーに送信されたデータの全てです。コード、ファイル名、会話内容は一切含まれていません。
            </div>
            <div style="background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12.5px; overflow: auto; color: #f5f5f5; max-height: 400px; white-space: pre-wrap; word-break: break-all; text-align: left;">
              <code id="raw-data-code-block" style="color: #f5f5f5; background: none; padding: 0;">読み込み中...</code>
            </div>
          </div>
          <div style="padding: 12px 16px; border-top: 1px solid #e5e5e0; display: flex; justify-content: flex-end; background: #fafaf9;">
            <button style="padding: 8px 16px; background: #171717; border: 1px solid #171717; color: #ffffff; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;" onclick="document.getElementById('raw-data-modal').style.display='none'">閉じる</button>
          </div>
        </div>
      </div>

      <div class="periods">
        <button class="active" data-period="daily">今日</button>
        <button data-period="yesterday">昨日</button>
        <button data-period="weekly">7日間</button>
        <button data-period="monthly">30日間</button>
        <button data-period="all-time">全期間</button>
      </div>

      ${isGlobal ? html`` : html`
      <div class="view-modes" id="view-modes-container">
        <div class="segmented-control">
          <button class="active" id="btn-mode-rank">リーダーボード</button>
          <button id="btn-mode-matrix">エージェント別集計</button>
        </div>
      </div>`}

      <div id="content"></div>

      ${raw(renderFeedbackCta())}

      ${isGlobal ? html`` : html`
      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">アクティビティ</span>
        </div>
        <div class="chart-canvas" id="chart"></div>
      </div>`}

      ${isGlobal ? html`` : html`
      <div class="invite">
        <div>
          <div class="invite-label">メンバーを招待する</div>
          <div class="invite-code" id="invite-code-display"></div>
        </div>
        <button class="copy-btn" id="copy-btn">コマンドをコピー</button>
      </div>`}
    </div>
  `;

  const extraScripts = html`
    const CODE = "${code}";
    const IS_GLOBAL = ${isGlobal ? "true" : "false"};
    const GROUP_NAME = ${raw(JSON.stringify(groupName || ""))};
    const MEMBER_COUNT = ${memberCount || 0};
    let period = "daily";
    let showCache = false;
    let viewMode = "rank";
    const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000;

    // Toast Notification System
    function showToast(message, type = "success") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.style.pointerEvents = "auto";
      toast.style.minWidth = "260px";
      toast.style.background = type === "error" ? "#fee2e2" : "#ecfdf5";
      toast.style.color = type === "error" ? "#991b1b" : "#065f46";
      toast.style.border = "1px solid " + (type === "error" ? "#fca5a5" : "#a7f3d0");
      toast.style.padding = "12px 16px";
      toast.style.borderRadius = "8px";
      toast.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
      toast.style.fontSize = "14px";
      toast.style.fontWeight = "500";
      toast.style.display = "flex";
      toast.style.alignItems = "center";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      toast.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
      
      const text = document.createElement("span");
      text.textContent = message;
      toast.appendChild(text);
      
      container.appendChild(toast);
      
      // Trigger reflow
      toast.offsetHeight;
      
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
      
      setTimeout(function() {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(function() {
          toast.remove();
        }, 300);
      }, 3000);
    }

    // Token extraction and management
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
      localStorage.setItem("atologs_user_token", tokenParam);
      urlParams.delete("token");
      const newQuery = urlParams.toString();
      const newUrl = window.location.pathname + (newQuery ? "?" + newQuery : "") + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
    function goUnauthenticated() {
      document.body.classList.add("unauthenticated");
    }

    const userToken = localStorage.getItem("atologs_user_token");
    if (!IS_GLOBAL && CODE !== "888888" && CODE !== "88888" && CODE !== "SAMPLE" && !userToken) {
      goUnauthenticated();
    }

    if (!IS_GLOBAL && CODE && CODE !== "888888" && CODE !== "88888" && CODE !== "SAMPLE") {
      localStorage.setItem("last_group_code", CODE);
    }
    // Local dynamic navigation override removed since it is handled globally in layout.ts

    function formatCost(usd) {
      var jpy = Math.round(usd * 150);
      return '<span class="tabular-nums">¥' + jpy.toLocaleString("ja-JP") + '</span>' +
             '<span class="text-[11px] text-neutral-500 tabular-nums" style="display:block;font-size:11px;color:var(--muted)">($' + usd.toFixed(2) + ')</span>';
    }
    function formatCostPlainText(usd) {
      var jpy = Math.round(usd * 150);
      return "¥" + jpy.toLocaleString("ja-JP") + " ($" + usd.toFixed(2) + ")";
    }

    // Global page: back link goes to referrer group or fallback to home
    if (IS_GLOBAL) {
      var backLink = document.getElementById("back-link");
      if (backLink) {
        var ref = document.referrer;
        var groupMatch = ref && ref.match(/\\/g\\/([a-zA-Z0-9]+)/);
        if (groupMatch && groupMatch[1].toLowerCase() !== "global") {
          backLink.href = "/g/" + groupMatch[1];
        }
      }
    }


    var btnModeRank = document.getElementById("btn-mode-rank");
    var btnModeMatrix = document.getElementById("btn-mode-matrix");
    if (btnModeRank && btnModeMatrix) {
      btnModeRank.addEventListener("click", function() {
        if (viewMode === "rank") return;
        viewMode = "rank";
        btnModeRank.classList.add("active");
        btnModeMatrix.classList.remove("active");
        load();
      });
      btnModeMatrix.addEventListener("click", function() {
        if (viewMode === "matrix") return;
        viewMode = "matrix";
        btnModeMatrix.classList.add("active");
        btnModeRank.classList.remove("active");
        load();
      });
    }

    var inviteEl = document.getElementById("invite-code-display");
    if (inviteEl) inviteEl.textContent = "npx cross-env CCCLUB_API_URL=" + window.location.origin + " npx ccclub join " + CODE;
    var copyBtn = document.getElementById("copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function() {
        navigator.clipboard.writeText("npx cross-env CCCLUB_API_URL=" + window.location.origin + " npx ccclub join " + CODE);
        this.textContent = "コピーしました！";
        var btn = this;
        setTimeout(function() { btn.textContent = "コピー"; }, 2000);
      });
    }

    var AVATAR_COLORS = [
      "#c45c5c","#d4845a","#d4a03e","#8aaa5a","#5aad7d",
      "#4a9b8a","#4a8aaa","#5a7aaa","#7a6aaa","#9a5aaa",
      "#aa5a8a","#c46a7a"
    ];
    function hashCode(str) {
      var h = 0;
      for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    function getAvatarColor(userId) {
      return AVATAR_COLORS[hashCode(userId) % AVATAR_COLORS.length];
    }
    function avatarHTML(userId, displayName, avatarUrl, isActive) {
      var initial = esc((displayName || "?").charAt(0).toUpperCase());
      var color = getAvatarColor(userId);
      var bubble = isActive ? '<div class="typing-bubble"><span></span><span></span><span></span></div>' : '';
      if (avatarUrl) {
        return '<div class="avatar-wrap">' +
          '<div class="avatar">' +
          '<img src="' + esc(avatarUrl) + '" alt="" onerror="this.classList.add(&#39;errored&#39;)">' +
          '<span class="fallback avatar" style="background:' + color + ';width:32px;height:32px;display:none;align-items:center;justify-content:center">' + initial + '</span>' +
          '</div>' + bubble + '</div>';
      }
      return '<div class="avatar-wrap"><div class="avatar" style="background:' + color + '">' + initial + '</div>' + bubble + '</div>';
    }

    var AGENT_ORDER = ["claude", "codex", "opencode", "amp", "pi"];
    var AGENT_LABELS = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", amp: "Amp", pi: "pi-agent" };
    var AGENT_ICONS = { claude: "/agent-icons/claude.svg", codex: "/agent-icons/codex.svg", opencode: "/agent-icons/opencode.svg", amp: "/agent-icons/amp.svg" };
    function activeTime(row) {
      var value = row.lastActiveAt || row.lastSync;
      if (!value) return 0;
      var ms = new Date(value).getTime();
      return isNaN(ms) ? 0 : ms;
    }
    function isRecentlyActive(row, now) {
      var ms = activeTime(row);
      return ms > 0 && (now - ms) < ACTIVE_THRESHOLD_MS;
    }
    function activeSourceForRow(row) {
      return row.lastActiveSource || (row.agents && row.agents[0]);
    }
    function orderedAgents(agents) {
      agents = agents || [];
      return AGENT_ORDER.filter(function(a) { return agents.indexOf(a) !== -1; })
        .concat(agents.filter(function(a) { return AGENT_ORDER.indexOf(a) === -1; }));
    }
    function getAgentBreakdown(row) {
      if (row.agentBreakdown && row.agentBreakdown.length > 0) return row.agentBreakdown;
      return orderedAgents(row.agents).map(function(source) {
        return { source: source, costUSD: 0, totalTokens: 0, nonCacheTokens: 0, chatCount: 0, entryCount: 0, percent: 0 };
      });
    }
    function agentTooltip(row) {
      if (!row.agentBreakdown || row.agentBreakdown.length === 0) {
        return orderedAgents(row.agents).map(function(source) {
          return AGENT_LABELS[source] || source;
        }).join("\\n");
      }
      return getAgentBreakdown(row).map(function(agent) {
        var label = AGENT_LABELS[agent.source] || agent.source;
        var pct = agent.percent ? agent.percent + "% · " : "";
        var cost = agent.costUSD ? formatCostPlainText(agent.costUSD) + " · " : "";
        var tokenCount = showCache ? agent.totalTokens : (agent.nonCacheTokens != null ? agent.nonCacheTokens : agent.totalTokens);
        var tokens = tokenCount ? formatTokens(tokenCount) + " tokens · " : "";
        var turns = (agent.chatCount || 0) + " turn" + ((agent.chatCount || 0) === 1 ? "" : "s");
        return label + ": " + pct + cost + tokens + turns;
      }).join("\\n");
    }
    function agentMixHTML(row) {
      var breakdown = getAgentBreakdown(row);
      if (breakdown.length === 0) return "";
      var hasBreakdown = row.agentBreakdown && row.agentBreakdown.length > 0;
      var text = breakdown.map(function(agent) {
        var label = esc(AGENT_LABELS[agent.source] || agent.source);
        if (hasBreakdown && breakdown.length > 1) {
          return '<span class="agent-source">' + label + '</span> <span class="agent-percent">(' + agent.percent + '%)</span>';
        }
        return '<span class="agent-source">' + label + '</span>';
      }).join('<span class="agent-percent">, </span>');
      return '<div class="agent-line" title="' + esc(agentTooltip(row)) + '">' +
        text + '</div>';
    }
    function activeBadgeHTML(row, isActive) {
      if (!isActive) return "";
      var source = row.lastActiveSource || (row.agents && row.agents[0]);
      var label = (source && AGENT_LABELS[source]) || source || "active";
      var icon = "";
      if (source && AGENT_ICONS[source]) {
        icon = '<img class="active-agent-icon" src="' + AGENT_ICONS[source] + '" alt="">';
      } else if (source === "pi") {
        icon = '<span class="active-agent-fallback">π</span>';
      }
      return '<span class="active-badge" title="' + esc(label + " がアクティブ") + '">' + icon + '<span>アクティブ</span></span>';
    }
    function activeSourceScoreHTML(source, count, countFirst) {
      var label = AGENT_LABELS[source] || source;
      var icon = "";
      if (AGENT_ICONS[source]) {
        icon = '<img src="' + AGENT_ICONS[source] + '" alt="">';
      } else if (source === "pi") {
        icon = '<span class="fallback">π</span>';
      } else {
        icon = '<span class="fallback">' + esc((label || "?").charAt(0).toUpperCase()) + '</span>';
      }
      var countHTML = '<span class="score-count">' + count + '</span>';
      var labelHTML = '<span>' + esc(source === "claude" ? "Claude" : label) + '</span>';
      return '<span class="active-source-score" title="' + esc(label + " active") + '">' +
        (countFirst ? countHTML + icon + labelHTML : icon + labelHTML + countHTML) +
        '</span>';
    }
    function claudeCodexActiveSplitHTML(claudeCount, codexCount) {
      return '<span class="active-split">' +
        '<span class="active-source-score" title="Claude Code active">' +
          '<img src="' + AGENT_ICONS.claude + '" alt="">' +
          '<span>Claude</span>' +
          '<span class="score-count">' + claudeCount + '</span>' +
        '</span>' +
        '<span class="active-score-sep">:</span>' +
        '<span class="active-source-score" title="Codex active">' +
          '<span class="score-count">' + codexCount + '</span>' +
          '<span>Codex</span>' +
          '<img src="' + AGENT_ICONS.codex + '" alt="">' +
        '</span>' +
      '</span>';
    }
    function activeSplitHTML(rows, now) {
      var counts = {};
      rows.forEach(function(row) {
        if (!isRecentlyActive(row, now)) return;
        var source = activeSourceForRow(row);
        if (!source) return;
        counts[source] = (counts[source] || 0) + 1;
      });
      var sources = AGENT_ORDER.filter(function(source) { return counts[source] > 0; })
        .concat(Object.keys(counts).filter(function(source) { return AGENT_ORDER.indexOf(source) === -1; }));
      if (sources.length === 0) return "";
      if (sources.length === 2 && counts.claude && counts.codex) {
        return claudeCodexActiveSplitHTML(counts.claude, counts.codex);
      }
      return '<span class="active-split">' + sources.map(function(source) {
        return activeSourceScoreHTML(source, counts[source], false);
      }).join('<span class="active-score-sep">·</span>') + '</span>';
    }

    document.querySelectorAll(".periods button[data-period]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        document.querySelectorAll(".periods button").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        period = btn.dataset.period;
        load();
        loadChart();
      });
    });

    function renderEmptyDashboard() {
      document.getElementById("title").textContent = GROUP_NAME || "ダッシュボード";
      document.getElementById("date-range").textContent =
        "本日" + " \u00b7 " + MEMBER_COUNT + " 人のメンバー";

      var agentSummaryEl = document.getElementById("agent-summary");
      if (agentSummaryEl) {
        agentSummaryEl.style.display = "block";
        agentSummaryEl.textContent = "対応エージェント: Claude Code \u00b7 Codex \u00b7 OpenCode \u00b7 Amp \u00b7 pi-agent";
      }

      var activeEl = document.getElementById("active-count");
      if (activeEl) {
        activeEl.style.display = "block";
        activeEl.innerHTML = '<span>0 人がアクティブ</span>';
      }

      var statHTML = 
        '<div class="stat-card brand-card">' +
          '<div class="stat-title">' + (period === 'daily' ? '今日のトークン' : period === 'yesterday' ? '昨日のトークン' : period === 'weekly' ? '7日間のトークン' : period === 'monthly' ? '30日間のトークン' : '累計トークン') + '</div>' +
          '<div class="stat-value">0</div>' +
          '<div class="stat-sub">0 tokens</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-title">' + (period === 'daily' ? '今日の料金' : period === 'yesterday' ? '昨日の料金' : period === 'weekly' ? '7日間の料金' : period === 'monthly' ? '30日間の料金' : '累計料金') + '</div>' +
          '<div class="stat-value">¥0 <span style="font-size:11px;color:var(--muted)">($0.00)</span></div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-title">セッション</div>' +
          '<div class="stat-value">0</div>' +
          '<div class="stat-sub">会話回数</div>' +
        '</div>' +
        '<div class="stat-card success-card">' +
          '<div class="stat-title">アクティブメンバー</div>' +
          '<div class="stat-value">0 / ' + MEMBER_COUNT + '</div>' +
          '<div class="stat-sub">稼働なし</div>' +
        '</div>';
      document.getElementById("stat-grid").innerHTML = statHTML;

      var contentHTML = '<div class="empty">未ログインのため、メンバーのデータは表示されません。<br>データを見るにはログインしてください。</div>';
      document.getElementById("content").innerHTML = contentHTML;

      var chartEl = document.getElementById("chart");
      if (chartEl) {
        chartEl.innerHTML = '<div style="color:var(--faint);text-align:center;padding:48px 24px;font-size:13px">データなし（未ログイン）</div>';
      }

      var rawBtn = document.getElementById("raw-data-btn-container");
      if (rawBtn) rawBtn.style.display = "none";
      
      var sharingBanner = document.getElementById("sharing-banner");
      if (sharingBanner) sharingBanner.style.display = "none";
      
      var inviteCodeDisplay = document.getElementById("invite-code-display");
      if (inviteCodeDisplay) {
        inviteCodeDisplay.textContent = 'npx cross-env CCCLUB_API_URL=' + window.location.origin + ' npx ccclub join ' + CODE;
      }
    }

    function load() {
      var apiPath = IS_GLOBAL ? "/api/rank/global" : "/api/rank/" + encodeURIComponent(CODE);
      var tz = -new Date().getTimezoneOffset();
      var headers = {};
      if (userToken) {
        headers["Authorization"] = "Bearer " + userToken;
      }
      fetch(apiPath + "?period=" + period + "&tz=" + tz, { headers: headers })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          document.getElementById("title").textContent = IS_GLOBAL ? "グローバル活用ログ" : data.group.name;
          document.getElementById("date-range").textContent =
            data.start.slice(0,10) + " 〜 " + data.end.slice(0,10) +
            (IS_GLOBAL ? "" : " \u00b7 " + data.group.memberCount + " 人のメンバー");

          var now = Date.now();
          var agentSet = {};
          data.rankings.forEach(function(r) {
            (r.agents || []).forEach(function(a) { agentSet[a] = true; });
          });
          var agentKeys = AGENT_ORDER.filter(function(a) { return agentSet[a]; })
            .concat(Object.keys(agentSet).filter(function(a) { return AGENT_ORDER.indexOf(a) === -1; }));
          var agentNames = agentKeys.map(function(a) { return AGENT_LABELS[a] || a; });
          var agentSummaryEl = document.getElementById("agent-summary");
          if (agentSummaryEl) {
            if (IS_GLOBAL) {
              agentSummaryEl.style.display = "none";
            } else {
              agentSummaryEl.style.display = "block";
              agentSummaryEl.textContent = agentNames.length > 0
                ? "この期間の利用元: " + agentNames.join(" \u00b7 ")
                : "対応エージェント: Claude Code \u00b7 Codex \u00b7 OpenCode \u00b7 Amp \u00b7 pi-agent";
            }
          }

          if (data.rankings.length === 0) {
            if (IS_GLOBAL) {
              document.getElementById("stat-grid").innerHTML = "";
              document.getElementById("content").innerHTML =
                '<div class="empty">公開ユーザーはまだいません。<br>次のコマンドでプロフィールを公開できます: <code class="mono">npx cross-env CCCLUB_API_URL=' + window.location.origin + ' npx ccclub profile --public</code></div>';
            } else {
              var hasToken = !!userToken;
              if (!hasToken && CODE !== "888888" && CODE !== "88888" && CODE !== "SAMPLE") {
                goUnauthenticated();
                // Standard layout metrics cards showing 0 values
                var statHTML = 
                  '<div class="stat-card brand-card">' +
                    '<div class="stat-title">' + (period === 'daily' ? '今日のトークン' : period === 'yesterday' ? '昨日のトークン' : period === 'weekly' ? '7日間のトークン' : period === 'monthly' ? '30日間のトークン' : '累計トークン') + '</div>' +
                    '<div class="stat-value">0</div>' +
                    '<div class="stat-sub">0 tokens</div>' +
                  '</div>' +
                  '<div class="stat-card">' +
                    '<div class="stat-title">' + (period === 'daily' ? '今日の料金' : period === 'yesterday' ? '昨日の料金' : period === 'weekly' ? '7日間の料金' : period === 'monthly' ? '30日間の料金' : '累計料金') + '</div>' +
                    '<div class="stat-value">¥0 <span style="font-size:11px;color:var(--muted)">($0.00)</span></div>' +
                    '<div class="stat-sub">¥0</div>' +
                  '</div>' +
                  '<div class="stat-card">' +
                    '<div class="stat-title">セッション</div>' +
                    '<div class="stat-value">0</div>' +
                    '<div class="stat-sub">会話回数</div>' +
                  '</div>' +
                  '<div class="stat-card success-card">' +
                    '<div class="stat-title">アクティブメンバー</div>' +
                    '<div class="stat-value">0 / ' + data.group.memberCount + '</div>' +
                    '<div class="stat-sub">稼働なし</div>' +
                  '</div>';
                document.getElementById("stat-grid").innerHTML = statHTML;

                var loginCmd = 'npx cross-env CCCLUB_API_URL=' + window.location.origin + ' npx ccclub';
                document.getElementById("content").innerHTML =
                  '<div class="empty-state-card" style="padding: 48px 24px; text-align: center; background: var(--bg); border: 1px dashed var(--line); border-radius: 12px; margin-top: 16px;">' +
                    '<div style="font-size: 36px; margin-bottom: 16px;">🔒</div>' +
                    '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text);">アクセス制限あり</h3>' +
                    '<p style="font-size: 13px; color: var(--muted); margin-bottom: 24px;">このグループのデータは保護されています。ターミナルで以下のコマンドを実行し、表示されたダッシュボードURLからアクセスしてください。</p>' +
                    '<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 16px;">' +
                      '<span style="font-size: 12px; font-weight: 600; color: var(--text);">ターミナルでコマンドを実行：</span>' +
                      '<div style="display: flex; width: 100%; max-width: 500px; background: var(--card-bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; align-items: center; justify-content: space-between; font-family: monospace; font-size: 12px; box-sizing: border-box;">' +
                        '<span id="empty-cmd-text" style="word-break: break-all; text-align: left; color: var(--text);">' + loginCmd + '</span>' +
                        '<button class="copy-btn" id="empty-copy-btn" style="margin-left: 8px; padding: 4px 8px; font-size: 11px; white-space: nowrap;">コピー</button>' +
                      '</div>' +
                    '</div>' +
                  '</div>';

                var emptyCopyBtn = document.getElementById("empty-copy-btn");
                if (emptyCopyBtn) {
                  emptyCopyBtn.addEventListener("click", function() {
                    navigator.clipboard.writeText(loginCmd);
                    emptyCopyBtn.textContent = "コピーしました！";
                    setTimeout(function() { emptyCopyBtn.textContent = "コピー"; }, 2000);
                  });
                }
              } else {
                // Standard layout metrics cards showing 0 values
                var statHTML = 
                  '<div class="stat-card brand-card">' +
                    '<div class="stat-title">' + (period === 'daily' ? '今日のトークン' : period === 'yesterday' ? '昨日のトークン' : period === 'weekly' ? '7日間のトークン' : period === 'monthly' ? '30日間のトークン' : '累計トークン') + '</div>' +
                    '<div class="stat-value">0</div>' +
                    '<div class="stat-sub">0 tokens</div>' +
                  '</div>' +
                  '<div class="stat-card">' +
                    '<div class="stat-title">' + (period === 'daily' ? '今日の料金' : period === 'yesterday' ? '昨日の料金' : period === 'weekly' ? '7日間の料金' : period === 'monthly' ? '30日間の料金' : '累計料金') + '</div>' +
                    '<div class="stat-value">¥0 <span style="font-size:11px;color:var(--muted)">($0.00)</span></div>' +
                    '<div class="stat-sub">¥0</div>' +
                  '</div>' +
                  '<div class="stat-card">' +
                    '<div class="stat-title">セッション</div>' +
                    '<div class="stat-value">0</div>' +
                    '<div class="stat-sub">会話回数</div>' +
                  '</div>' +
                  '<div class="stat-card success-card">' +
                    '<div class="stat-title">アクティブメンバー</div>' +
                    '<div class="stat-value">0 / ' + data.group.memberCount + '</div>' +
                    '<div class="stat-sub">稼働なし</div>' +
                  '</div>';
                document.getElementById("stat-grid").innerHTML = statHTML;

                var syncCmd = 'npx cross-env CCCLUB_API_URL=' + window.location.origin + ' npx ccclub sync';
                document.getElementById("content").innerHTML =
                  '<div class="empty-state-card" style="padding: 48px 24px; text-align: center; background: var(--bg); border: 1px dashed var(--line); border-radius: 12px; margin-top: 16px;">' +
                    '<div style="font-size: 36px; margin-bottom: 16px;">📊</div>' +
                    '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text);">この期間のデータがありません</h3>' +
                    '<p style="font-size: 13px; color: var(--muted); margin-bottom: 24px;">ローカルでアクティビティを同期して、ランキングを更新しましょう！</p>' +
                    '<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 16px;">' +
                      '<span style="font-size: 12px; font-weight: 600; color: var(--text);">ターミナルで同期コマンドを実行：</span>' +
                      '<div style="display: flex; width: 100%; max-width: 500px; background: var(--card-bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; align-items: center; justify-content: space-between; font-family: monospace; font-size: 12px; box-sizing: border-box;">' +
                        '<span id="empty-cmd-text" style="word-break: break-all; text-align: left; color: var(--text);">' + syncCmd + '</span>' +
                        '<button class="copy-btn" id="empty-copy-btn" style="margin-left: 8px; padding: 4px 8px; font-size: 11px; white-space: nowrap;">コピー</button>' +
                      '</div>' +
                    '</div>' +
                  '</div>';

                var emptyCopyBtn = document.getElementById("empty-copy-btn");
                if (emptyCopyBtn) {
                  emptyCopyBtn.addEventListener("click", function() {
                    navigator.clipboard.writeText(syncCmd);
                    emptyCopyBtn.textContent = "コピーしました！";
                    setTimeout(function() { emptyCopyBtn.textContent = "コピー"; }, 2000);
                  });
                }
              }
            }
            return;
          }

          var activeCount = data.rankings.filter(function(r) {
            return isRecentlyActive(r, now);
          }).length;
           var activeEl = document.getElementById("active-count");
           if (activeEl) {
             if (IS_GLOBAL) {
               activeEl.style.display = "none";
             } else {
               activeEl.style.display = "block";
               activeEl.innerHTML = activeCount > 0
                 ? '<span>' + activeCount + ' 人がアクティブ</span>' + activeSplitHTML(data.rankings, now)
                 : "";
             }
           }

          var totalCost = 0;
          var totalTokensSum = 0;
          var totalChats = 0;
          data.rankings.forEach(function(r) {
            totalCost += r.costUSD;
            var disp = showCache ? r.totalTokens : ((r.inputTokens != null && r.outputTokens != null) ? (r.inputTokens + r.outputTokens + (r.reasoningTokens || 0)) : r.totalTokens);
            totalTokensSum += disp;
            totalChats += (r.chatCount || 0);
          });

          var statHTML = 
            '<div class="stat-card brand-card">' +
              '<div class="stat-title">' + (period === 'daily' ? '今日のトークン' : period === 'yesterday' ? '昨日のトークン' : period === 'weekly' ? '7日間のトークン' : period === 'monthly' ? '30日間のトークン' : '累計トークン') + '</div>' +
              '<div class="stat-value">' + formatTokens(totalTokensSum) + '</div>' +
              '<div class="stat-sub">' + totalTokensSum.toLocaleString("ja-JP") + ' tokens</div>' +
            '</div>' +
            '<div class="stat-card">' +
              '<div class="stat-title">' + (period === 'daily' ? '今日の料金' : period === 'yesterday' ? '昨日の料金' : period === 'weekly' ? '7日間の料金' : period === 'monthly' ? '30日間の料金' : '累計料金') + '</div>' +
              '<div class="stat-value">' + formatCostPlainText(totalCost) + '</div>' +
            '</div>' +
            '<div class="stat-card">' +
              '<div class="stat-title">セッション</div>' +
              '<div class="stat-value">' + totalChats + '</div>' +
              '<div class="stat-sub">会話回数</div>' +
            '</div>' +
            '<div class="stat-card success-card">' +
              '<div class="stat-title">アクティブメンバー</div>' +
              '<div class="stat-value">' + activeCount + ' / ' + data.group.memberCount + '</div>' +
              '<div class="stat-sub">' + (activeCount > 0 ? activeCount + ' 人が本日稼働中' : '稼働なし') + '</div>' +
            '</div>';
          document.getElementById("stat-grid").innerHTML = statHTML;



          var maxCost = 0;
          data.rankings.forEach(function(r) { if (r.costUSD > maxCost) maxCost = r.costUSD; });
          var hasPlan = data.rankings.some(function(r) { return r.plan; });
          var hasAgents = data.rankings.some(function(r) {
            return r.agents && r.agents.length > 0 && !(r.agents.length === 1 && r.agents[0] === "claude");
          });
          var PLAN_PRICES = { pro: 20, max100: 100, max200: 200, api: 0 };

          var h = "";
          var m = "";

          if (viewMode === "matrix") {
            // Comprehensive Matrix View (総合表)
            h = '<div class="table-shell desktop-only"><table><thead><tr>' +
              '<th>#</th>' +
              '<th>メンバー</th>';
            agentKeys.forEach(function(a) {
              h += '<th>' + esc(AGENT_LABELS[a] || a) + '</th>';
            });
            h += '<th>合計料金</th>' +
                 '<th>合計トークン</th>' +
                 '</tr></thead><tbody>';

            m = '<div class="mobile-only"><div class="mobile-cards">';

            data.rankings.forEach(function(r) {
              var pct = maxCost > 0 ? (r.costUSD / maxCost * 100) : 0;
              var rowClass = r.rank === 1 ? "top-one" : r.rank === 2 ? "top-two" : r.rank === 3 ? "top-three" : "";
              var rankClass = r.rank === 1 ? "rank gold" : r.rank === 2 ? "rank silver" : r.rank === 3 ? "rank bronze" : "rank";
              var isActive = isRecentlyActive(r, now);
              var displayedTokens = showCache ? r.totalTokens : ((r.inputTokens != null && r.outputTokens != null) ? (r.inputTokens + r.outputTokens + (r.reasoningTokens || 0)) : r.totalTokens);

              // Desktop Row
              h += '<tr class="' + rowClass + '">' +
                '<td class="' + rankClass + '">' + r.rank + '</td>' +
                '<td><div class="name-cell">' + avatarHTML(r.userId, r.displayName, r.avatar, isActive) +
                  '<div><div class="name-text">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="name-link">' + esc(r.displayName) + '</a>' : esc(r.displayName)) + activeBadgeHTML(r, isActive) + '</div>' +
                  '<div class="bar" style="width:' + pct + '%"></div></div></div></td>';

              var breakdown = getAgentBreakdown(r);
              agentKeys.forEach(function(a) {
                var agentData = null;
                for (var k = 0; k < breakdown.length; k++) {
                  if (breakdown[k].source === a) {
                    agentData = breakdown[k];
                    break;
                  }
                }
                if (agentData && (agentData.costUSD > 0 || agentData.totalTokens > 0)) {
                  var tCount = showCache ? agentData.totalTokens : (agentData.nonCacheTokens != null ? agentData.nonCacheTokens : agentData.totalTokens);
                  h += '<td class="avg-turn">' +
                    '<div class="avg-turn-main">' + formatCost(agentData.costUSD) + '</div>' +
                    '<div class="avg-turn-sub">' + formatTokens(tCount) + ' tok</div>' +
                    '</td>';
                } else {
                  h += '<td style="color:var(--faint);text-align:center">\u2014</td>';
                }
              });

              h += '<td class="cost">' + formatCost(r.costUSD) + '</td>' +
                   '<td class="tokens">' + formatTokens(displayedTokens) + '</td>' +
                   '</tr>';

              // Mobile Card
              m += '<div class="mobile-card ' + rowClass + '">' +
                '<div class="mobile-card-header">' +
                  '<span class="' + rankClass + '">' + r.rank + '</span>' +
                  '<div class="name-cell">' + avatarHTML(r.userId, r.displayName, r.avatar, isActive) +
                    '<div><div class="name-text">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="name-link">' + esc(r.displayName) + '</a>' : esc(r.displayName)) + activeBadgeHTML(r, isActive) + '</div></div>' +
                  '</div>' +
                '</div>' +
                '<div class="mobile-card-grid">';

              var activeAgentBreakdown = breakdown.filter(function(agent) {
                return agent.costUSD > 0 || agent.totalTokens > 0;
              });
              if (activeAgentBreakdown.length === 0) {
                m += '<div style="grid-column: span 2; text-align: center; color: var(--faint); font-size: 13px; padding: 8px 0;">使用データなし</div>';
              } else {
                activeAgentBreakdown.forEach(function(agent) {
                  var label = AGENT_LABELS[agent.source] || agent.source;
                  var tCount = showCache ? agent.totalTokens : (agent.nonCacheTokens != null ? agent.nonCacheTokens : agent.totalTokens);
                  m += '<div class="mobile-stat-item" style="grid-column: span 2; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding: 6px 0;">' +
                    '<span class="stat-label" style="font-weight: 550; color: var(--text);">' + esc(label) + '</span>' +
                    '<span class="stat-val" style="text-align: right; font-size: 13px;">' +
                      '¥' + Math.round(agent.costUSD * 150).toLocaleString("ja-JP") + ' <span style="font-size: 10px; color: var(--muted);">(' + formatTokens(tCount) + ' tok)</span>' +
                    '</span>' +
                  '</div>';
                });
              }

              m += '<div class="mobile-stat-item" style="margin-top: 4px;"><span class="stat-label">合計料金</span><span class="stat-val cost">' + formatCost(r.costUSD) + '</span></div>' +
                   '<div class="mobile-stat-item" style="margin-top: 4px;"><span class="stat-label">合計トークン</span><span class="stat-val tokens">' + formatTokens(displayedTokens) + '</span></div>';

              m += '</div>' +
                '<div style="padding-left:36px;"><div class="bar" style="width:' + pct + '%"></div></div>' +
              '</div>';
            });

            h += '</tbody></table></div>';
            m += '</div></div>';

          } else {
            // Leaderboard View
            h = '<div class="table-shell desktop-only"><table><thead><tr><th>#</th><th>メンバー</th><th>料金</th><th>トークン</th><th>会話回数</th><th title="会話あたりの料金とトークン数">会話単価</th>';
            if (hasPlan) h += '<th>ROI</th>';
            h += '</tr></thead><tbody>';

            m = '<div class="mobile-only"><div class="mobile-cards">';

            data.rankings.forEach(function(r) {
              var pct = maxCost > 0 ? (r.costUSD / maxCost * 100) : 0;
              var rowClass = r.rank === 1 ? "top-one" : r.rank === 2 ? "top-two" : r.rank === 3 ? "top-three" : "";
              var rankClass = r.rank === 1 ? "rank gold" : r.rank === 2 ? "rank silver" : r.rank === 3 ? "rank bronze" : "rank";
              var isActive = isRecentlyActive(r, now);
              var agentLine = "";
              if (hasAgents && r.agents && r.agents.length > 0) {
                agentLine = agentMixHTML(r);
              }
              var displayedTokens = showCache ? r.totalTokens : ((r.inputTokens != null && r.outputTokens != null) ? (r.inputTokens + r.outputTokens + (r.reasoningTokens || 0)) : r.totalTokens);

              // Desktop Row
              h += '<tr class="' + rowClass + '">' +
                '<td class="' + rankClass + '">' + r.rank + '</td>' +
                '<td><div class="name-cell">' + avatarHTML(r.userId, r.displayName, r.avatar, isActive) +
                  '<div><div class="name-text">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="name-link">' + esc(r.displayName) + '</a>' : esc(r.displayName)) + activeBadgeHTML(r, isActive) + '</div>' +
                  agentLine + '<div class="bar" style="width:' + pct + '%"></div></div></div></td>' +
                '<td class="cost">' + formatCost(r.costUSD) + '</td>' +
                '<td class="tokens">' + formatTokens(displayedTokens) + '</td>';
              var chats = r.chatCount || 0;
              var perChat = chats > 0 ? formatCost(r.costUSD / chats) : '\u2014';
              var tokensPerChat = chats > 0 ? formatTokens(Math.round(displayedTokens / chats)) + ' tok' : '';
              h += '<td class="calls">' + chats + '</td>' +
                '<td class="avg-turn"><div class="avg-turn-main">' + perChat + '</div>' +
                (tokensPerChat ? '<div class="avg-turn-sub">' + tokensPerChat + '</div>' : '') + '</td>';
              if (hasPlan) {
                if (r.plan && r.plan !== "api") {
                  var price = PLAN_PRICES[r.plan] || 0;
                  var monthly = r.monthlyCostUSD || 0;
                  var roi = price > 0 ? Math.round(monthly / price * 100) : 0;
                  var pctClass = roi >= 100 ? "pct high" : roi >= 50 ? "pct mid" : "pct low";
                  h += '<td class="roi"><span class="price">' + formatCost(price) + '/</span><span class="' + pctClass + '">' + roi + '%</span></td>';
                } else if (r.plan === "api") {
                  h += '<td class="roi"><span class="pct low">API</span></td>';
                } else {
                  h += '<td class="roi"><span class="pct low">\u2014</span></td>';
                }
              }
              h += '</tr>';

              // Mobile Card
              var roiHTML = '\u2014';
              if (hasPlan) {
                if (r.plan && r.plan !== "api") {
                  var price = PLAN_PRICES[r.plan] || 0;
                  var monthly = r.monthlyCostUSD || 0;
                  var roi = price > 0 ? Math.round(monthly / price * 100) : 0;
                  var pctClass = roi >= 100 ? "pct high" : roi >= 50 ? "pct mid" : "pct low";
                  roiHTML = '<span class="price">' + formatCost(price) + '/</span><span class="' + pctClass + '">' + roi + '%</span>';
                } else if (r.plan === "api") {
                  roiHTML = '<span class="pct low">API</span>';
                }
              }

              m += '<div class="mobile-card ' + rowClass + '">' +
                '<div class="mobile-card-header">' +
                  '<span class="' + rankClass + '">' + r.rank + '</span>' +
                  '<div class="name-cell">' + avatarHTML(r.userId, r.displayName, r.avatar, isActive) +
                    '<div><div class="name-text">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" class="name-link">' + esc(r.displayName) + '</a>' : esc(r.displayName)) + activeBadgeHTML(r, isActive) + '</div>' +
                    agentLine + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="mobile-card-grid">' +
                  '<div class="mobile-stat-item"><span class="stat-label">料金</span><span class="stat-val cost">' + formatCost(r.costUSD) + '</span></div>' +
                  '<div class="mobile-stat-item"><span class="stat-label">トークン</span><span class="stat-val tokens">' + formatTokens(displayedTokens) + '</span></div>' +
                  '<div class="mobile-stat-item"><span class="stat-label">会話回数</span><span class="stat-val">' + chats + '</span></div>' +
                  '<div class="mobile-stat-item"><span class="stat-label">会話単価</span><span class="stat-val avg-turn">' + perChat + (tokensPerChat ? ' <span class="avg-turn-sub" style="font-size:10px; font-weight:normal;">' + tokensPerChat + '</span>' : '') + '</span></div>';
              if (hasPlan) {
                m += '<div class="mobile-stat-item"><span class="stat-label">ROI</span><span class="stat-val">' + roiHTML + '</span></div>';
              }
              m += '</div>' +
                '<div style="padding-left:36px;"><div class="bar" style="width:' + pct + '%"></div></div>' +
              '</div>';
            });

            h += '</tbody></table></div>';
            m += '</div></div>';
          }
          document.getElementById("content").innerHTML = h + m;
          var refreshEl = document.getElementById("refresh-info");
          if (refreshEl) {
            refreshEl.textContent = "最終更新: " + new Date().toLocaleTimeString();
          }
        })
        .catch(function() {
          document.getElementById("content").innerHTML =
            '<div class="empty">リーダーボードの読み込みに失敗しました。再読み込みしてください。</div>';
        });
    }

    function formatTokens(n) {
      if (n >= 1000000000) { var b = n / 1000000000; return (b % 1 === 0 ? b : parseFloat(b.toFixed(1))) + "B"; }
      if (n >= 1000000) { var m = n / 1000000; return (m % 1 === 0 ? m : parseFloat(m.toFixed(1))) + "M"; }
      if (n >= 1000) { var k = n / 1000; return (k % 1 === 0 ? k : parseFloat(k.toFixed(1))) + "K"; }
      return String(n);
    }
    function esc(s) {
      var d = document.createElement("div"); d.textContent = s; return d.innerHTML;
    }

    // Activity chart
    var CHART_COLORS = ["#4f46e5", "#059669", "#d97706", "#2563eb", "#db2777", "#7c3aed", "#0891b2", "#ea580c"];
    var hiddenUsers = {};

    function periodToRange(p) {
      if (p === "yesterday") return "yesterday";
      if (p === "weekly") return "7d";
      if (p === "monthly" || p === "all-time") return "30d";
      return "24h";
    }

    function loadChart() {
      if (IS_GLOBAL) return;
      var apiPath = IS_GLOBAL ? "/api/activity/global" : "/api/activity/" + encodeURIComponent(CODE);
      var tz = -new Date().getTimezoneOffset();
      var range = periodToRange(period);
      var headers = {};
      if (userToken) {
        headers["Authorization"] = "Bearer " + userToken;
      }
      fetch(apiPath + "?range=" + range + "&tz=" + tz, { headers: headers })
        .then(function(res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function(data) { renderChart(data); })
        .catch(function() {
          document.getElementById("chart").innerHTML = '<div style="color:var(--faint);text-align:center;padding:24px;font-size:13px">アクティビティチャートを読み込めませんでした</div>';
        });
    }

    function renderChart(data) {
      var el = document.getElementById("chart");
      var startMs = new Date(data.start).getTime();
      var endMs = new Date(data.end).getTime();
      var durationMs = endMs - startMs;
      var range = data.range;

      if (!data.series || data.series.length === 0) {
        el.innerHTML = '<div style="color:var(--faint);text-align:center;padding:24px;font-size:13px">この期間のアクティビティはありません</div>';
        return;
      }

      // Bucket blocks into time intervals to show activity intensity
      var W = 560, H = 200, PAD_L = 0, PAD_R = 0, PAD_T = 8, PAD_B = 20;
      var plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
      var bucketCount = range === "24h" || range === "yesterday" ? 48 : range === "7d" ? 28 : 30;
      var bucketMs = durationMs / bucketCount;

      var globalMax = 0;
      var userSeries = data.series.map(function(user) {
        var buckets = new Array(bucketCount).fill(0);
        var tokenBuckets = new Array(bucketCount).fill(0);
        user.blocks.forEach(function(bl) {
          var idx = Math.min(Math.floor((new Date(bl.t).getTime() - startMs) / bucketMs), bucketCount - 1);
          if (idx >= 0) {
            buckets[idx] += bl.cost;
            var tVal = showCache ? (bl.totalTokens || 0) : (bl.tokens || bl.totalTokens || 0);
            tokenBuckets[idx] += tVal;
          }
        });
        for (var b = 0; b < buckets.length; b++) {
          if (buckets[b] > globalMax) globalMax = buckets[b];
        }
        var total = user.blocks.reduce(function(s, bl) { return s + bl.cost; }, 0);
        var totalTokens = user.blocks.reduce(function(s, bl) {
          return s + (showCache ? (bl.totalTokens || 0) : (bl.tokens || bl.totalTokens || 0));
        }, 0);
        // Convert buckets to points
        var points = buckets.map(function(v, i) {
          return { t: startMs + (i + 0.5) * bucketMs, v: v };
        });
        var tokenPoints = tokenBuckets.map(function(v, i) {
          return { t: startMs + (i + 0.5) * bucketMs, v: v };
        });
        return { name: user.displayName, url: user.url || "", total: total, totalTokens: totalTokens, points: points, tokenPoints: tokenPoints };
      });

      if (globalMax === 0) globalMax = 1;

      // Build SVG paths with smooth cubic bezier curves
      var paths = "";
      userSeries.forEach(function(us, idx) {
        var color = CHART_COLORS[idx % CHART_COLORS.length];
        var pts = us.points.map(function(pt) {
          return {
            x: PAD_L + ((pt.t - startMs) / durationMs) * plotW,
            y: PAD_T + plotH - (pt.v / globalMax) * plotH
          };
        });
        if (pts.length < 2) return;
        var d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
        for (var j = 1; j < pts.length; j++) {
          var prev = pts[j - 1], cur = pts[j];
          var cpx = (prev.x + cur.x) / 2;
          d += " C" + cpx.toFixed(1) + "," + prev.y.toFixed(1) +
               " " + cpx.toFixed(1) + "," + cur.y.toFixed(1) +
               " " + cur.x.toFixed(1) + "," + cur.y.toFixed(1);
        }
        paths += '<path id="chart-path-' + idx + '" d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>';
      });

      // Time axis labels
      var labels = "";
      var labelCount = range === "24h" || range === "yesterday" ? 6 : range === "7d" ? 7 : 6;
      for (var i = 0; i <= labelCount; i++) {
        var t = startMs + (durationMs * i / labelCount);
        var dt = new Date(t);
        var label;
        if (range === "24h" || range === "yesterday") {
          label = dt.getHours().toString().padStart(2, "0") + ":" + dt.getMinutes().toString().padStart(2, "0");
        } else {
          label = (dt.getMonth() + 1) + "/" + dt.getDate();
        }
        var lx = PAD_L + (i / labelCount) * plotW;
        labels += '<text x="' + lx.toFixed(1) + '" y="' + (H - 2) + '" fill="#737373" font-size="10" text-anchor="middle">' + label + '</text>';
        labels += '<line x1="' + lx.toFixed(1) + '" y1="' + PAD_T + '" x2="' + lx.toFixed(1) + '" y2="' + (PAD_T + plotH) + '" stroke="#e5e5e0" stroke-width="1" opacity="0.5"/>';
      }

      // Cost axis label (peak per bucket)
      var costLabel = globalMax >= 1 ? "$" + globalMax.toFixed(0) : "$" + globalMax.toFixed(2);
      labels += '<text x="' + (W - 2) + '" y="' + (PAD_T + 10) + '" fill="#a3a3a3" font-size="10" text-anchor="end">' + costLabel + '</text>';

      // Crosshair line + dot markers (hidden by default) + hover overlay
      var overlay = '<line id="chart-crosshair" x1="0" y1="' + PAD_T + '" x2="0" y2="' + (PAD_T + plotH) + '" stroke="#4f46e5" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>';
      userSeries.forEach(function(us, idx) {
        var color = CHART_COLORS[idx % CHART_COLORS.length];
        overlay += '<circle id="chart-dot-' + idx + '" cx="0" cy="0" r="3.5" fill="' + color + '" stroke="#ffffff" stroke-width="1.5" opacity="0"/>';
      });
      overlay += '<rect x="' + PAD_L + '" y="' + PAD_T + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" id="chart-overlay" style="cursor:crosshair"/>';


      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
        labels + paths + overlay + '</svg>';

      // Legend
      var legend = '<div class="chart-legend">';
      userSeries.forEach(function(us, idx) {
        var color = CHART_COLORS[idx % CHART_COLORS.length];
        var legendName = us.url ? '<a href="' + esc(us.url) + '" target="_blank" rel="noopener noreferrer" class="name-link">' + esc(us.name) + '</a>' : esc(us.name);
        legend += '<div class="chart-legend-item" data-idx="' + idx + '"><span class="chart-legend-dot" style="background:' + color + '"></span>' +
          legendName + ' $' + us.total.toFixed(2) + ' <span style="font-size:11px;color:var(--muted)">(' + formatTokens(us.totalTokens) + ')</span></div>';
      });
      legend += '</div>';

      el.innerHTML = svg + '<div class="chart-tooltip" id="chart-tooltip"></div>' + legend;

      // Re-apply hidden state after re-render (keyed by user name)
      userSeries.forEach(function(us, idx) {
        if (hiddenUsers[us.name]) {
          var item = el.querySelector('.chart-legend-item[data-idx="' + idx + '"]');
          if (item) item.classList.add("hidden");
          var path = document.getElementById("chart-path-" + idx);
          if (path) path.setAttribute("opacity", "0");
        }
      });

      // Crosshair hover logic
      var tooltip = document.getElementById("chart-tooltip");
      var crosshair = document.getElementById("chart-crosshair");
      var overlayRect = document.getElementById("chart-overlay");
      var svgEl = el.querySelector("svg");

      overlayRect.addEventListener("mousemove", function(e) {
        var svgRect = svgEl.getBoundingClientRect();
        var mouseX = (e.clientX - svgRect.left) / svgRect.width * W;
        // Find nearest bucket index
        var bucketIdx = Math.round((mouseX - PAD_L) / plotW * (bucketCount - 1));
        bucketIdx = Math.max(0, Math.min(bucketCount - 1, bucketIdx));
        // X position of this bucket
        var bx = PAD_L + ((bucketIdx + 0.5) * bucketMs / durationMs) * plotW;
        // Show crosshair
        crosshair.setAttribute("x1", bx.toFixed(1));
        crosshair.setAttribute("x2", bx.toFixed(1));
        crosshair.setAttribute("opacity", "1");
        // Time label
        var bt = new Date(startMs + bucketIdx * bucketMs);
        var timeLabel = range === "24h" || range === "yesterday"
          ? bt.getHours().toString().padStart(2, "0") + ":" + bt.getMinutes().toString().padStart(2, "0")
          : (bt.getMonth() + 1) + "/" + bt.getDate();
        // Position dots and build tooltip content
        var tipLines = '<div style="color:#8a8480;margin-bottom:2px">' + timeLabel + '</div>';
        var hasData = false;
        userSeries.forEach(function(us, idx) {
          var pt = us.points[bucketIdx];
          var color = CHART_COLORS[idx % CHART_COLORS.length];
          var dot = document.getElementById("chart-dot-" + idx);
          if (hiddenUsers[us.name]) {
            dot.setAttribute("opacity", "0");
            return;
          }
          var py = PAD_T + plotH - (pt.v / globalMax) * plotH;
          dot.setAttribute("cx", bx.toFixed(1));
          dot.setAttribute("cy", py.toFixed(1));
          dot.setAttribute("opacity", pt.v > 0 ? "1" : "0");
          if (pt.v > 0) {
            hasData = true;
            var tPts = us.tokenPoints && us.tokenPoints[bucketIdx] ? us.tokenPoints[bucketIdx].v : 0;
            tipLines += '<div><span style="color:' + color + '">' + esc(us.name) + '</span> <b>$' + pt.v.toFixed(2) + '</b> <span style="color:var(--muted);font-size:11px">(' + formatTokens(tPts) + ' tok)</span></div>';
          }
        });
        if (!hasData) {
          tipLines += '<div style="color:#5a5550">アクティビティなし</div>';
        }
        tooltip.innerHTML = tipLines;
        // Position tooltip
        var elRect = el.getBoundingClientRect();
        var scaleX = svgRect.width / W;
        var left = (svgRect.left - elRect.left) + bx * scaleX;
        tooltip.style.left = left + "px";
        tooltip.style.top = "0px";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.classList.add("visible");
      });

      overlayRect.addEventListener("mouseleave", function() {
        crosshair.setAttribute("opacity", "0");
        userSeries.forEach(function(us, idx) {
          document.getElementById("chart-dot-" + idx).setAttribute("opacity", "0");
        });
        tooltip.classList.remove("visible");
      });

      // Legend toggle: click to show/hide individual lines
      el.querySelectorAll(".chart-legend-item").forEach(function(item) {
        item.addEventListener("click", function() {
          var idx = parseInt(item.getAttribute("data-idx"), 10);
          var userName = userSeries[idx].name;
          var pathEl = document.getElementById("chart-path-" + idx);
          if (hiddenUsers[userName]) {
            delete hiddenUsers[userName];
            item.classList.remove("hidden");
            if (pathEl) pathEl.setAttribute("opacity", "0.85");
          } else {
            hiddenUsers[userName] = true;
            item.classList.add("hidden");
            if (pathEl) pathEl.setAttribute("opacity", "0");
          }
        });
      });
    }

    // Toggle Sharing Logic
    var toggleBtn = document.getElementById("toggle-sharing-btn");
    var sharingTitle = document.getElementById("sharing-title");
    var sharingDesc = document.getElementById("sharing-desc");
    var sharingIcon = document.getElementById("sharing-icon");
    var isSharingPublic = false;

    function updateSharingUI(visibility) {
      isSharingPublic = (visibility === "public");
      if (!toggleBtn) return;
      if (isSharingPublic) {
        toggleBtn.classList.add("active");
        if (sharingIcon) sharingIcon.textContent = "🌐";
        if (sharingTitle) {
          sharingTitle.textContent = "活用ログに共有中";
          sharingTitle.style.color = "#4f46e5";
        }
        if (sharingDesc) sharingDesc.textContent = "あなたのアクティビティデータはグローバルランキングに公開されています。";
      } else {
        toggleBtn.classList.remove("active");
        if (sharingIcon) sharingIcon.textContent = "🔒";
        if (sharingTitle) {
          sharingTitle.textContent = "グループ内のみ公開";
          sharingTitle.style.color = "var(--text)";
        }
        if (sharingDesc) sharingDesc.textContent = "データはグループ内のみ表示され、グローバルランキングには共有されていません。";
      }
    }

    function initSharing() {
      if (!userToken || IS_GLOBAL) return;
      fetch("/api/profile", {
        headers: { "Authorization": "Bearer " + userToken }
      })
      .then(function(res) {
        if (res.status === 401) {
          localStorage.removeItem("atologs_user_token");
          goUnauthenticated();
          return;
        }
        return res.json();
      })
      .then(function(profile) {
        if (!profile) return;
        var banner = document.getElementById("sharing-banner");
        if (banner) {
          banner.style.display = "flex";
        }
        updateSharingUI(profile.visibility);
      })
      .catch(function(err) {
        console.error("Failed to load profile:", err);
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function() {
        if (!userToken) return;
        toggleBtn.disabled = true;
        var nextVisibility = isSharingPublic ? "private" : "public";
        fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken
          },
          body: JSON.stringify({ visibility: nextVisibility })
        })
        .then(function(res) {
          toggleBtn.disabled = false;
          if (res.ok) {
            return res.json();
          }
          throw new Error("Failed to update profile");
        })
        .then(function(profile) {
          updateSharingUI(profile.visibility);
          load();
        })
        .catch(function(err) {
          toggleBtn.disabled = false;
          showToast("設定の更新に失敗しました。", "error");
        });
      });
    }

    load();
    initSharing();
    loadChart();
    setInterval(function() { load(); loadChart(); }, 5 * 60 * 1000);

    var rawDataBtn = document.getElementById("show-raw-data-btn");
    if (rawDataBtn) {
      rawDataBtn.addEventListener("click", function() {
        var uToken = localStorage.getItem("atologs_user_token");
        var modal = document.getElementById("raw-data-modal");
        var codeBlock = document.getElementById("raw-data-code-block");
        
        modal.style.display = "flex";
        codeBlock.textContent = "データを読み込み中...";
        
        if (!uToken) {
          codeBlock.textContent = "ログインしていません。";
          return;
        }
        
        fetch("/api/profile/raw-data", {
          headers: {
            "Authorization": "Bearer " + uToken
          }
        })
        .then(function(res) {
          if (!res.ok) {
            throw new Error("HTTP error " + res.status);
          }
          return res.json();
        })
        .then(function(data) {
          codeBlock.textContent = JSON.stringify(data, null, 2);
        })
        .catch(function(err) {
          codeBlock.textContent = "データの取得に失敗しました。同期履歴がまだ無いか、セッションが切れている可能性があります。\\n\\n詳細: " + err.message + "\\n\\nローカルで以下のコマンドを実行してデータを確認することもできます：\\nCCCLUB_API_URL=" + window.location.origin + " npx ccclub show-data";
        });
      });
    }
    // Local dynamic navigation override removed since it is handled globally in layout.ts
  `;

  return renderLayout({
    title: ogTitle,
    description: ogDesc,
    canonical: `${origin}${canonicalPath || `/g/${code}`}`,
    active: code === "SAMPLE" ? ("none" as any) : (isGlobal ? "dashboard-global" : "dashboard-group"),
    bodyContent: bodyContent.toString(),
    extraStyles,
    extraScripts: extraScripts.toString(),
  });
}

export { app as dashboardRoute };
