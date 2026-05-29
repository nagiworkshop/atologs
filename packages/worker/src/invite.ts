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
import type { GroupRecord } from "@atologs/shared";
import { cachedPngResponse, getColor, hashCode, htmlEsc, latinOnly, ogCacheUrl, renderToPng, sanitizeCode, svgEsc, truncate } from "./og-utils.js";
import { renderLayout, renderFeedbackCta } from "./components/layout.js";
import { colors, fontSize, spacing, radius } from "./design-tokens.js";

const app = new Hono<{ Bindings: Env }>();

const esc = htmlEsc;

function getCreator(group: GroupRecord): string {
  const creator = group.members.find((m) => m.userId === group.createdBy);
  return creator?.displayName || group.members[0]?.displayName || "Someone";
}

// Invite page
app.get("/invite/:code", async (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const code = sanitizeCode(c.req.param("code"));
  if (!code) return c.text("Invalid code", 400);

  const group = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
  const origin = new URL(c.req.url).origin;
  if (!group) return c.html(notFoundHTML(code, origin), 404);

  return c.html(inviteHTML(group, origin));
});

function inviteHTML(group: GroupRecord, origin: string) {
  const creator = getCreator(group);
  const n = group.members.length;
  const code = group.code;
  const ogTitle = `${esc(creator)} さんがグループ「${esc(truncate(group.name, 40))}」にあなたを招待しています`;
  const ogDesc = `${n} 人のメンバーがコーディングエージェントの利用状況を記録しています。コマンド1つで参加できます。`;

  const MAX_SHOW = 10;
  const shown = group.members.slice(0, MAX_SHOW);
  const overflow = n - MAX_SHOW;

  const memberAvatars = shown
    .map((m, i) => {
      const color = getColor(m.userId);
      const initial = esc((m.displayName || "?").charAt(0).toUpperCase());
      const ml = i === 0 ? "" : "margin-left: -8px;";
      return `<div class="avatar" style="background:${color};${ml}" title="${esc(m.displayName)}">${initial}</div>`;
    })
    .join("");

  const overflowBadge =
    overflow > 0
      ? `<div class="avatar overflow" style="margin-left:-8px;">+${overflow}</div>`
      : "";

  const memberNames = shown.map((m) => esc(m.displayName)).join(", ") + (overflow > 0 ? ` 他 ${overflow} 人` : "");

  const extraStyles = `
    .wrap {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 ${spacing[4]};
    }
    @media (min-width: 768px) {
      .wrap {
        padding: 0 ${spacing[6]};
      }
    }

    /* Back link */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: ${spacing[1.5]};
      color: ${colors.textMuted};
      font-size: ${fontSize.md};
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s;
    }
    @media (min-width: 768px) {
      .back-link {
        font-size: ${fontSize.lg};
      }
    }
    .back-link:hover {
      color: ${colors.accent};
    }

    .invite-hero {
      text-align: center; padding: ${spacing[6]} 0 ${spacing[5]};
    }
    .invite-label {
      font-size: ${fontSize.base}; color: ${colors.textMuted}; text-transform: uppercase;
      letter-spacing: 0.1em; font-weight: 500; margin-bottom: ${spacing[2]};
    }
    .group-name {
      font-size: ${fontSize['5xl']}; font-weight: 700; line-height: 1.25; color: ${colors.textPrimary}; margin-bottom: 10px;
      word-break: break-word;
      letter-spacing: -0.02em;
    }
    @media (min-width: 768px) {
      .group-name {
        font-size: ${fontSize['6xl']};
      }
    }
    .created-by {
      font-size: ${fontSize.lg}; color: ${colors.textMuted};
    }
    .created-by strong { color: ${colors.textPrimary}; font-weight: 500; }

    .members-section {
      text-align: center; padding: ${spacing[8]} ${spacing[6]};
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: ${radius.xl};
      margin-bottom: ${spacing[6]};
      box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
    }
    .avatars {
      display: flex; justify-content: center; align-items: center;
      margin-bottom: 18px;
    }
    .avatar {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: ${fontSize['2xl']}; color: ${colors.bgWhite};
      border: 3px solid ${colors.bgWhite}; flex-shrink: 0;
      position: relative; z-index: 1;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .avatar.overflow {
      background: ${colors.border}; color: ${colors.textMuted}; font-size: ${fontSize.md}; font-weight: 600;
    }
    .member-count {
      font-size: ${fontSize['4xl']}; font-weight: 700; color: ${colors.textPrimary};
      margin-bottom: ${spacing[2]};
    }
    .member-names {
      font-size: ${fontSize.lg}; color: ${colors.textMuted}; max-width: 440px;
      margin: 0 auto; line-height: 1.5;
    }

    .join-section {
      padding: ${spacing[3]} 0 ${spacing[12]}; text-align: center;
    }
    .join-card {
      background: ${colors.bgWhite}; border: 1px solid ${colors.border};
      border-radius: ${radius.xl}; padding: ${spacing[9]} ${spacing[6]};
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
    }
    .join-label {
      font-size: ${fontSize.base}; color: ${colors.textMuted}; margin-bottom: 18px;
      text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;
    }
    .join-cmd {
      display: inline-flex; align-items: center; gap: 0;
      background: ${colors.bg}; border: 1px solid ${colors.border};
      border-radius: 10px; padding: 14px 24px; font-size: ${fontSize['2xl']};
      cursor: pointer; transition: all 0.2s ease;
      position: relative;
      width: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }
    .join-cmd:hover { border-color: ${colors.accent}; background: ${colors.bg}; }
    .join-cmd .dollar { color: ${colors.success}; margin-right: 10px; font-weight: 700; }
    .join-cmd .cmd-text { color: ${colors.textPrimary}; }
    .join-cmd .copy-hint {
      margin-left: 18px; color: ${colors.textFaint}; font-size: ${fontSize.base};
      transition: color 0.15s;
    }
    .join-cmd:hover .copy-hint { color: ${colors.textMuted}; }
    .join-cmd .copied-msg {
      position: absolute; right: -8px; top: -30px;
      font-size: ${fontSize.base}; color: ${colors.success}; opacity: 0;
      transition: opacity 0.2s; pointer-events: none;
      font-weight: 700;
    }

    .join-note {
      margin-top: 22px; font-size: ${fontSize.md}; color: ${colors.textFaint}; line-height: 1.6;
    }
    .join-note a { color: ${colors.textMuted}; }

    .leaderboard-link {
      display: inline-flex; align-items: center; gap: ${spacing[2]};
      margin-top: ${spacing[7]}; padding: ${spacing[3]} ${spacing[6]};
      border: 1px solid ${colors.border}; border-radius: ${radius.md};
      color: ${colors.textMuted}; font-size: ${fontSize.lg}; font-weight: 600;
      transition: all 0.2s ease;
      background: ${colors.bgWhite};
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .leaderboard-link:hover {
      border-color: ${colors.accent}; color: ${colors.textPrimary}; text-decoration: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    details summary {
      font-size: ${fontSize.base}; font-weight: 600; color: ${colors.textMuted};
      cursor: pointer; outline: none; user-select: none;
      margin-top: ${spacing[3]}; margin-bottom: ${spacing[1.5]}; display: inline-flex; align-items: center; gap: ${spacing[1.5]};
    }
    details summary::-webkit-details-marker {
      display: none;
    }
    details summary::before {
      content: "▶"; font-size: 8px; transition: transform 0.15s ease; color: ${colors.textFaint}; display: inline-block;
    }
    details[open] summary::before {
      transform: rotate(90deg);
    }

    @media (max-width: 600px) {
      .invite-hero { padding: ${spacing[8]} 0 ${spacing[6]}; }
      .avatar { width: 38px; height: 38px; font-size: ${fontSize.lg}; }
      .join-cmd { font-size: ${fontSize.lg}; padding: 12px 18px; }
    }
  `;

  const bodyContent = html`
  <div class="wrap">
    <div style="text-align: left; margin-bottom: 8px;">
      <a href="/" class="back-link">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        <span>ホーム</span>
      </a>
    </div>

    <div class="invite-hero">
      <div class="invite-label">グループへの招待</div>
      <div class="group-name">${esc(group.name)}</div>
      <div class="created-by">作成者: <strong>${esc(creator)}</strong></div>
    </div>

    <div class="members-section">
      <div class="avatars">
        ${raw(memberAvatars + overflowBadge)}
      </div>
      <div class="member-count">${n} 人のメンバー</div>
      <div class="member-names">${memberNames}</div>
    </div>

    <div class="join-section">
      <div class="join-card">
        <div class="join-label">コマンド1つで参加できます</div>
        
        <div style="font-size:11px; color:${colors.textMuted}; margin-bottom:6px; font-weight:600; text-align:left;">macOS / Linux</div>
        <div class="join-cmd mono" id="join-cmd">
          <div style="display:flex; align-items:center;">
            <span class="dollar">$</span>
            <span class="cmd-text">CCCLUB_API_URL=${origin} npx atologs join ${code}</span>
          </div>
          <span class="copy-hint" style="white-space:nowrap;">クリックしてコピー</span>
          <span class="copied-msg" id="copied-msg">コピーしました！</span>
        </div>
        
        <details style="width:100%; box-sizing:border-box; text-align:left;">
          <summary>Windows の場合</summary>
          <div class="join-cmd mono" id="join-cmd-win" style="margin-top:4px;">
            <div style="display:flex; align-items:center;">
              <span class="dollar">$</span>
              <span class="cmd-text">npx cross-env CCCLUB_API_URL=${origin} npx atologs join ${code}</span>
            </div>
            <span class="copy-hint" style="white-space:nowrap;">クリックしてコピー</span>
            <span class="copied-msg" id="copied-msg-win">コピーしました！</span>
          </div>
        </details>

        <div class="join-note">
          <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">Node.js</a> が必要です。アカウント登録は不要です。
        </div>
      </div>

      ${raw(renderFeedbackCta())}

      <a href="/g/${code}" class="leaderboard-link">
        リーダーボードを表示する →
      </a>
    </div>
  </div>`;

  const extraScripts = `
    document.getElementById("join-cmd").addEventListener("click", function() {
      navigator.clipboard.writeText("CCCLUB_API_URL=${origin} npx atologs join ${code}");
      const msg = document.getElementById("copied-msg");
      msg.style.opacity = "1";
      setTimeout(function() { msg.style.opacity = "0"; }, 2000);
    });

    document.getElementById("join-cmd-win").addEventListener("click", function() {
      navigator.clipboard.writeText("npx cross-env CCCLUB_API_URL=${origin} npx atologs join ${code}");
      const msg = document.getElementById("copied-msg-win");
      msg.style.opacity = "1";
      setTimeout(function() { msg.style.opacity = "0"; }, 2000);
    });
  `;

  return renderLayout({
    title: `${ogTitle} — AtoLogs`,
    description: ogDesc,
    ogImage: `${origin}/invite/${code}/og.png`,
    canonical: `${origin}/invite/${code}`,
    active: "home",
    bodyContent: bodyContent.toString(),
    extraStyles,
    extraScripts,
  });
}

function notFoundHTML(code: string, origin: string) {
  const ogTitle = "招待が見つかりません — AtoLogs";
  const ogDesc = "グループへの招待リンクが見つかりません。";

  const extraStyles = `
    .wrap { text-align: center; padding: ${spacing[6]}; max-width: 480px; margin: auto; }
    h1 { font-size: ${fontSize['5xl']}; font-weight: 700; margin-bottom: ${spacing[3]}; color: ${colors.textPrimary}; letter-spacing: -0.5px; }
    p { font-size: ${fontSize.lg}; color: ${colors.textMuted}; margin-bottom: ${spacing[6]}; }
    .cta {
      display: inline-block; border: 1px solid ${colors.border}; background: ${colors.bgWhite};
      border-radius: ${radius.md}; padding: ${spacing[3]} ${spacing[6]}; font-size: ${fontSize.xl}; color: ${colors.textPrimary};
      font-weight: 600; transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .cta:hover { border-color: ${colors.accent}; color: ${colors.accent}; }
  `;

  const bodyContent = html`
  <div class="wrap">
    <h1>招待が見つかりません</h1>
    <p>グループコード <code>${esc(code)}</code> は存在しません。削除されたか、リンクが間違っている可能性があります。</p>
    <a href="/" class="cta">自分でグループを作成する &rarr;</a>
  </div>`;

  return renderLayout({
    title: ogTitle,
    description: ogDesc,
    canonical: `${origin}/invite/${code}`,
    active: "home",
    bodyContent: bodyContent.toString(),
    extraStyles,
  });
}

// OG image
app.get("/invite/:code/og.png", async (c) => {
  const code = sanitizeCode(c.req.param("code"));
  if (!code) return c.text("Invalid code", 400);

  const group = await c.env.KV.get<GroupRecord>(`group:${code}`, "json");
  if (!group) {
    return c.text("Not found", 404);
  }

  const version = hashCode(`${group.name}:${group.members.map((m) => `${m.userId}:${m.displayName}:${m.avatar || ""}:${m.joinedAt}`).join("|")}`);
  const origin = new URL(c.req.url).origin;
  const cacheUrl = ogCacheUrl(c.req.url, `invite/v3/${code}/${version}.png`);
  return cachedPngResponse(cacheUrl, async () => {
    const svg = buildOgSvg(group, origin);
    return renderToPng(svg);
  }, {
    maxAge: 86_400,
    staleWhileRevalidate: 604_800,
    executionCtx: c.executionCtx,
  });
});

function buildOgSvg(group: GroupRecord, origin: string): string {
  const W = 1200;
  const H = 630;
  const creator = getCreator(group);
  const n = group.members.length;
  const groupName = svgEsc(truncate(latinOnly(group.name) || group.code, 36));
  const creatorName = svgEsc(truncate(latinOnly(creator) || "A friend", 30));
  const code = group.code;

  const MAX_AVATARS = 8;
  const shown = group.members.slice(0, MAX_AVATARS);
  const overflow = n - MAX_AVATARS;

  const avatarR = 30;
  const avatarSpacing = 46;
  const avatarStartX = 86;
  const avatarY = 382;

  let avatarsSvg = "";
  shown.forEach((m, i) => {
    const cx = avatarStartX + i * avatarSpacing;
    const color = getColor(m.userId);
    const latin = latinOnly(m.displayName);
    const initial = svgEsc((latin || "?").charAt(0).toUpperCase());
    avatarsSvg += `<circle cx="${cx}" cy="${avatarY}" r="${avatarR}" fill="${color}" stroke="#181512" stroke-width="4"/>`;
    avatarsSvg += `<text x="${cx}" y="${avatarY + 7}" text-anchor="middle" fill="#161412" font-size="21" font-weight="700" font-family="Inter, sans-serif">${initial}</text>`;
  });

  if (overflow > 0) {
    const cx = avatarStartX + shown.length * avatarSpacing;
    avatarsSvg += `<circle cx="${cx}" cy="${avatarY}" r="${avatarR}" fill="#27231f" stroke="#181512" stroke-width="4"/>`;
    avatarsSvg += `<text x="${cx}" y="${avatarY + 5}" text-anchor="middle" fill="#a8a19a" font-size="14" font-weight="700" font-family="Inter, sans-serif">+${overflow}</text>`;
  }

  const memberLabel = `${n} 人のメンバー`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#201d19"/>
      <stop offset="100%" stop-color="#13110f"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)" rx="0"/>
  <rect x="42" y="34" width="${W - 84}" height="${H - 68}" rx="24" fill="#181512" stroke="#2b2723"/>

  <!-- Brand -->
  <text x="86" y="78" fill="#746f69" font-size="20" font-weight="700" font-family="Inter, sans-serif">AtoLogs</text>
  <rect x="86" y="106" width="144" height="34" rx="17" fill="#201d19" stroke="#2c2824"/>
  <circle cx="106" cy="123" r="5" fill="#5fdc8f"/>
  <text x="122" y="128" fill="#a8a19a" font-size="14" font-weight="700" font-family="Inter, sans-serif">招待リンク</text>

  <!-- "invites you to join" -->
  <text x="86" y="186" fill="#8a8480" font-size="22" font-family="Inter, sans-serif">${creatorName} さんがあなたを招待しています</text>

  <!-- Group name -->
  <text x="86" y="250" fill="#f3eee7" font-size="54" font-weight="700" font-family="Inter, sans-serif" letter-spacing="-1">${groupName}</text>

  <!-- Member count -->
  <text x="86" y="292" fill="#8a8480" font-size="20" font-family="Inter, sans-serif">${memberLabel} がコーディング状況を共有中</text>

  <!-- Avatars -->
  ${avatarsSvg}

  <!-- Join command -->
  <rect x="86" y="454" width="512" height="62" rx="14" fill="#080807" stroke="#26221e" stroke-width="1"/>
  <text x="112" y="493" fill="#5fdc8f" font-size="18" font-weight="700" font-family="Inter, monospace">$</text>
  <text x="136" y="491" fill="#f1ede7" font-size="13" font-family="Inter, monospace" xml:space="preserve">npx cross-env CCCLUB_API_URL=${svgEsc(origin)} npx atologs join ${code}</text>

  <!-- Preview panel -->
  <rect x="684" y="110" width="430" height="406" rx="20" fill="#201d19" stroke="#2c2824"/>
  <text x="716" y="158" fill="#d6b56d" font-size="15" font-weight="700" font-family="Inter, sans-serif">Claude Code &amp; Codex リーダーボード</text>
  <rect x="716" y="190" width="334" height="46" rx="8" fill="#d6b56d" fill-opacity="0.075"/>
  <rect x="716" y="252" width="278" height="46" rx="8" fill="#aeb7bf" fill-opacity="0.045"/>
  <rect x="716" y="314" width="364" height="46" rx="8" fill="#c58a61" fill-opacity="0.05"/>
  <text x="742" y="219" fill="#d6b56d" font-size="18" font-weight="700" font-family="Inter, sans-serif">1</text>
  <text x="782" y="219" fill="#f1ede7" font-size="17" font-weight="600" font-family="Inter, sans-serif">ライブリーダーボード</text>
  <text x="742" y="281" fill="#aeb7bf" font-size="18" font-weight="700" font-family="Inter, sans-serif">2</text>
  <text x="782" y="281" fill="#f1ede7" font-size="17" font-weight="600" font-family="Inter, sans-serif">エージェント割合と料金</text>
  <text x="742" y="343" fill="#c58a61" font-size="18" font-weight="700" font-family="Inter, sans-serif">3</text>
  <text x="782" y="343" fill="#f1ede7" font-size="17" font-weight="600" font-family="Inter, sans-serif">ローカルログのみ集計</text>
  <text x="716" y="430" fill="#8a8480" font-size="17" font-family="Inter, sans-serif">No signup. Local logs only.</text>

  <!-- Footer -->
  <text x="86" y="560" fill="#4f4942" font-size="16" font-family="Inter, sans-serif">Claude Code · Codex · OpenCode · Amp · pi-agent</text>
  <text x="${W - 86}" y="560" text-anchor="end" fill="#4f4942" font-size="16" font-family="Inter, sans-serif">${svgEsc(origin.replace("https://", ""))}/invite/${svgEsc(code)}</text>
</svg>`;
}

export { app as inviteRoute };
