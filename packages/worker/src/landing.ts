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
import { renderLayout, renderFeedbackCta } from "./components/layout.js";
import { colors, fontSize, spacing, radius } from "./design-tokens.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const origin = new URL(c.req.url).origin;
  return c.html(landingHTML(origin));
});

function landingHTML(origin: string) {
  const extraStyles = `
    .section-container {
      max-width: 1024px;
      margin: 0 auto;
      padding-left: 24px;
      padding-right: 24px;
    }
    .hero-title {
      font-size: 3rem;
    }
    .hero-sub {
      font-size: 1rem;
    }
    .setup-title-text {
      font-size: 1.25rem;
    }
    .setup-subtitle-text {
      font-size: 1rem;
    }
    .overlapping-circles > * + * {
      margin-left: -0.5rem;
    }
    .cta-row {
      display: flex;
      flex-direction: row;
      align-items: center;
    }
    .btn-copy {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
      display: flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background-color: ${colors.textPrimary};
      color: #ffffff;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.15s ease-in-out;
      border: 1px solid ${colors.textPrimary};
      white-space: nowrap;
      flex-shrink: 0;
      cursor: pointer;
    }
    .btn-copy:hover {
      background-color: #262626;
      border-color: #262626;
    }
    .preview-title {
      font-size: 1.25rem;
    }
    .window-title {
      font-size: 0.875rem;
    }
    .window-body {
      padding: 1.5rem;
    }
    .window-body > * + * {
      margin-top: 1.5rem;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .stat-value {
      font-size: 1.25rem;
    }
    .features-box {
      padding: 2rem;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .feature-card-title {
      font-size: 1rem;
    }
    .privacy-box {
      padding: 1.5rem;
    }
    .privacy-link {
      color: #4f46e5;
      text-decoration: none;
    }
    .privacy-link:hover {
      text-decoration: underline;
    }
    .divide-y-list > * + * {
      border-top: 1px solid ${colors.border};
    }
    .tab-btn {
      flex: 1;
      padding-top: 0.875rem;
      padding-bottom: 0.875rem;
      padding-left: 1rem;
      padding-right: 1rem;
      font-size: 0.875rem;
      transition: all 0.15s ease-in-out;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .tab-active {
      font-weight: 600;
      color: ${colors.textPrimary};
      border-bottom: 2px solid ${colors.textPrimary};
    }
    .tab-inactive {
      font-weight: 500;
      color: ${colors.textMuted};
      border-bottom: 2px solid transparent;
    }
    .tab-inactive:hover {
      color: ${colors.textPrimary};
    }
    .tab-active svg {
      color: ${colors.textMuted} !important;
    }
    .tab-inactive svg {
      color: ${colors.textFaint} !important;
    }

    @media (max-width: 767px) {
      .section-container {
        padding-left: 16px;
        padding-right: 16px;
      }
      .hero-padding {
        padding-top: 32px !important;
        padding-bottom: 24px !important;
      }
      .hero-title {
        font-size: 1.875rem !important;
      }
      .hero-sub {
        font-size: 0.875rem !important;
      }
      .setup-padding {
        padding-top: 24px !important;
        padding-bottom: 24px !important;
      }
      .setup-box {
        padding: 1rem !important;
      }
      .setup-title-text {
        font-size: 1.125rem !important;
      }
      .setup-subtitle-text {
        font-size: 0.875rem !important;
      }
      .cta-row {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      .btn-copy {
        width: 100% !important;
      }
      .preview-padding {
        padding-top: 40px !important;
        padding-bottom: 40px !important;
      }
      .preview-header {
        margin-bottom: 1.5rem !important;
      }
      .preview-title {
        font-size: 1.125rem !important;
      }
      .window-title {
        font-size: 0.75rem !important;
      }
      .window-body {
        padding: 1rem !important;
      }
      .stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
      .stat-value {
        font-size: 1.125rem !important;
      }
      .features-box {
        padding: 1.5rem !important;
      }
      .features-grid {
        grid-template-columns: 1fr !important;
      }
      .feature-card-title {
        font-size: 0.875rem !important;
      }
      .privacy-padding {
        padding-top: 24px !important;
        padding-bottom: 24px !important;
      }
      .privacy-box {
        padding: 1.25rem !important;
      }
      .cmd-padding {
        padding-bottom: 48px !important;
      }
    }
  `;

  const bodyContent = html`
  <!-- HERO -->
  <section style="background-color: ${colors.bg};">
    <div class="section-container hero-padding" style="padding-top: 56px; padding-bottom: 32px;">
      <p style="font-size: 0.875rem; color: ${colors.textMuted}; margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
        AtoLogs
      </p>
      <h1 class="hero-title" style="font-weight: 700; letter-spacing: -0.025em; color: ${colors.textPrimary}; line-height: 1.25;">
        AIと開発した跡を、<br>消える前に残そう。
      </h1>
      <p class="hero-sub" style="margin-top: 0.625rem; color: ${colors.textSecondary};">
        トークン数は、実力ではありません。それは、AIと一緒に試行錯誤した跡です。
      </p>
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <a href="/sample" style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; background-color: ${colors.textPrimary}; color: #ffffff; border-radius: ${radius.md}; font-size: 15px; font-weight: 500; text-decoration: none; transition: background-color 0.15s ease-in-out;" onmouseover="this.style.backgroundColor='#262626'" onmouseout="this.style.backgroundColor='${colors.textPrimary}'">
          実績紹介
        </a>
      </div>
    </div>
  </section>

  <!-- SETUP GUIDE -->
  <section style="background-color: ${colors.bgWhite};">
    <div class="section-container setup-padding" style="padding-top: 40px; padding-bottom: 40px;">
      <div class="setup-box" style="background-color: ${colors.bg}; border-radius: ${radius.xl}; border: 1px solid ${colors.border}; padding: 1.5rem;">
        <!-- Setup Mode Tabs — Underline indicator style -->
        <div style="display: flex; border-bottom: 1px solid ${colors.border};" role="tablist" aria-label="Setup mode">
          <button id="tab-agent" class="tab-btn tab-active" type="button" role="tab" aria-selected="true">
            <svg style="width: 1rem; height: 1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="8" width="12" height="9" rx="2"/><path d="M12 5v3M9 17v2m6-2v2M8.5 12h.01M15.5 12h.01M4 11v3m16-3v3"/></svg>
            エージェント経由
          </button>
          <button id="tab-human" class="tab-btn tab-inactive" type="button" role="tab" aria-selected="false">
            <svg style="width: 1rem; height: 1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>
            手動コマンド経由
          </button>
        </div>

        <!-- Tab Body -->
        <div style="margin-top: 1.5rem; text-align: center;">
          <h2 id="setup-title" class="setup-title-text" style="font-weight: 700; color: ${colors.textPrimary};">このプロンプトをコーディングエージェントに送信してください。</h2>
          <p id="setup-subtitle" class="setup-subtitle-text" style="margin-top: 0.5rem; color: ${colors.textSecondary}; max-width: 32rem; margin-left: auto; margin-right: auto; line-height: 1.625;">
            エージェントが自動的に AtoLogs をインストールし、グループを初期化し、利用状況を同期します。設定はほぼゼロです。
          </p>

          <!-- Supported Agents -->
          <div id="agent-logo-wrapper" style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
            <div class="overlapping-circles" style="display: flex; overflow: hidden;">
              <span style="width: 2rem; height: 2rem; border-radius: ${radius.full}; border: 2px solid ${colors.bgWhite}; background-color: ${colors.bgMuted}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;" title="Claude Code">🤖</span>
              <span style="width: 2rem; height: 2rem; border-radius: ${radius.full}; border: 2px solid ${colors.bgWhite}; background-color: ${colors.bgMuted}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;" title="Codex">💻</span>
              <span style="width: 2rem; height: 2rem; border-radius: ${radius.full}; border: 2px solid ${colors.bgWhite}; background-color: ${colors.bgMuted}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;" title="OpenCode">📂</span>
              <span style="width: 2rem; height: 2rem; border-radius: ${radius.full}; border: 2px solid ${colors.bgWhite}; background-color: ${colors.textPrimary}; color: ${colors.bg}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;" title="pi-agent">π</span>
            </div>
            <div style="text-align: left; font-size: 0.875rem; color: ${colors.textSecondary};">
              <strong style="display: block; color: ${colors.textPrimary}; font-weight: 600; line-height: 1.25; font-size: 0.875rem;">対応エージェント</strong>
              <span>Claude Code · Codex · OpenCode · Amp · pi-agent</span>
            </div>
          </div>

          <!-- Prompt/Command Code Box & CTA Button Row — Responsive layout -->
          <div class="cta-row" style="margin-top: 1.5rem; gap: 0.75rem;">
            <div style="flex: 1 1 0%; text-align: left; background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 0.375rem; padding: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.875rem; word-break: break-all; color: #262626; user-select: all; -webkit-user-select: all; display: flex; align-items: center; min-height: 48px;">
              <code id="setup-code" style="width: 100%;">Read ${origin}/llms-full.txt</code>
            </div>
            <button id="copy-setup" class="btn-copy" type="button">
              <svg style="width: 1rem; height: 1rem; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span id="copy-btn-text">プロンプトをコピー</span>
            </button>
          </div>
          <p id="copy-feedback" style="margin-top: 0.5rem; font-size: 0.875rem; color: ${colors.success}; font-weight: 500; opacity: 0; transition: opacity 0.15s ease-in-out;">コピーしました！</p>
        </div>
      </div>
    </div>
  </section>

  ${raw(renderFeedbackCta())}

  <!-- INLINE MINI-PREVIEW (HomeDemo style) -->
  <section style="background-color: ${colors.bg};">
    <div class="section-container preview-padding" style="padding-top: 56px; padding-bottom: 56px;">
      <div class="preview-header" style="text-align: center; max-width: 42rem; margin-left: auto; margin-right: auto;">
        <p style="font-size: 0.875rem; color: ${colors.textMuted}; margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">プレビュー</p>
        <h2 class="preview-title" style="font-weight: 700; color: ${colors.textPrimary};">こんな感じで記録できます</h2>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: ${colors.textSecondary};">
          実際の画面イメージです。送信されるのは集計データのみで、ソースコードは一切送信されません。
        </p>
      </div>

      <!-- Faux Window Frame -->
      <div style="border-radius: ${radius.xl}; border: 1px solid ${colors.border}; background-color: ${colors.bgWhite}; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 0.375rem; padding: 0.625rem 0.875rem; border-bottom: 1px solid ${colors.border}; background-color: ${colors.bg};">
          <span style="width: 0.625rem; height: 0.625rem; border-radius: 9999px; background-color: #d4d4d4;"></span>
          <span style="width: 0.625rem; height: 0.625rem; border-radius: 9999px; background-color: #d4d4d4;"></span>
          <span style="width: 0.625rem; height: 0.625rem; border-radius: 9999px; background-color: #d4d4d4;"></span>
          <span class="window-title" style="margin-left: 0.75rem; color: ${colors.textFaint}; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important;">atologs.com / dashboard</span>
        </div>

        <div class="window-body">
          <!-- Stat Grid -->
          <div class="stat-grid" style="gap: 0.75rem;">
            <div style="border-radius: 0.375rem; border: 1px solid #c7d2fe; background-color: rgba(238, 242, 255, 0.4); padding: 0.75rem;">
              <p style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.textMuted}; line-height: 1.25; white-space: nowrap;">今月のトークン</p>
              <p class="stat-value" style="margin-top: 0.25rem; font-weight: 700; color: ${colors.textPrimary};">2,108,540</p>
            </div>
            <div style="border-radius: 0.375rem; border: 1px solid ${colors.border}; background-color: ${colors.bgWhite}; padding: 0.75rem;">
              <p style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.textMuted}; line-height: 1.25; white-space: nowrap;">推定コスト</p>
              <p class="stat-value" style="margin-top: 0.25rem; font-weight: 700; color: ${colors.textPrimary};">¥1,340</p>
              <p style="font-size: 0.875rem; color: ${colors.textFaint};">≈ $8.94</p>
            </div>
            <div style="border-radius: 0.375rem; border: 1px solid ${colors.border}; background-color: ${colors.bgWhite}; padding: 0.75rem;">
              <p style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.textMuted}; line-height: 1.25; white-space: nowrap;">セッション</p>
              <p class="stat-value" style="margin-top: 0.25rem; font-weight: 700; color: ${colors.textPrimary};">42</p>
            </div>
            <div style="border-radius: 0.375rem; border: 1px solid #a7f3d0; background-color: rgba(209, 250, 229, 0.4); padding: 0.75rem;">
              <p style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.textMuted}; line-height: 1.25; white-space: nowrap;">活用日数</p>
              <p class="stat-value" style="margin-top: 0.25rem; font-weight: 700; color: ${colors.textPrimary};">18 日</p>
            </div>
          </div>

          <!-- Calendar Heatmap Preview -->
          <div>
            <p style="font-size: 0.875rem; color: ${colors.textFaint}; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">活用カレンダー</p>
            <div style="overflow-x: auto; padding-top: 0.25rem; padding-bottom: 0.25rem;">
              <svg width="220" height="40" aria-hidden="true" style="opacity: 0.8;">
                <rect x="0" y="0" width="10" height="10" rx="1.5" fill="#e2e8f0" />
                <rect x="13" y="0" width="10" height="10" rx="1.5" fill="#c7d2fe" />
                <rect x="26" y="0" width="10" height="10" rx="1.5" fill="#818cf8" />
                <rect x="39" y="0" width="10" height="10" rx="1.5" fill="#4f46e5" />
                <rect x="52" y="0" width="10" height="10" rx="1.5" fill="#e2e8f0" />
                <rect x="65" y="0" width="10" height="10" rx="1.5" fill="#c7d2fe" />
                <rect x="78" y="0" width="10" height="10" rx="1.5" fill="#4f46e5" />
                <rect x="0" y="13" width="10" height="10" rx="1.5" fill="#818cf8" />
                <rect x="13" y="13" width="10" height="10" rx="1.5" fill="#4f46e5" />
                <rect x="26" y="13" width="10" height="10" rx="1.5" fill="#e2e8f0" />
                <rect x="39" y="13" width="10" height="10" rx="1.5" fill="#e2e8f0" />
                <rect x="52" y="13" width="10" height="10" rx="1.5" fill="#c7d2fe" />
                <rect x="65" y="13" width="10" height="10" rx="1.5" fill="#818cf8" />
                <rect x="78" y="13" width="10" height="10" rx="1.5" fill="#4f46e5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="section-container setup-padding" style="padding-top: 40px; padding-bottom: 40px;">
    <div class="features-box" style="border-radius: ${radius.xl}; border: 1px solid ${colors.border}; background-color: ${colors.bgWhite};">
      <h2 class="setup-title-text" style="font-weight: 700; color: ${colors.textPrimary};">できること</h2>
      <div class="features-grid" style="margin-top: 1.5rem; gap: 1.5rem;">
        <div style="border-radius: 0.375rem; border: 1px solid ${colors.border}; background-color: rgba(250, 250, 249, 0.4); padding: 1.25rem;">
          <div style="font-size: 1.5rem;" aria-hidden="true">📊</div>
          <h3 class="feature-card-title" style="margin-top: 0.75rem; font-weight: 600; color: ${colors.textPrimary};">利用量を見える化</h3>
          <p style="margin-top: 0.375rem; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625;">
            トークン数・推定コスト・セッション数を、日ごとにわかりやすく表示します。
          </p>
        </div>
        <div style="border-radius: 0.375rem; border: 1px solid ${colors.border}; background-color: rgba(250, 250, 249, 0.4); padding: 1.25rem;">
          <div style="font-size: 1.5rem;" aria-hidden="true">🗓️</div>
          <h3 class="feature-card-title" style="margin-top: 0.75rem; font-weight: 600; color: ${colors.textPrimary};">活用カレンダー</h3>
          <p style="margin-top: 0.375rem; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625;">
            GitHub の Contributions Graph のように、AIと向き合った日々をひと目で振り返れます。
          </p>
        </div>
        <div style="border-radius: 0.375rem; border: 1px solid ${colors.border}; background-color: rgba(250, 250, 249, 0.4); padding: 1.25rem;">
          <div style="font-size: 1.5rem;" aria-hidden="true">🌿</div>
          <h3 class="feature-card-title" style="margin-top: 0.75rem; font-weight: 600; color: ${colors.textPrimary};">やさしいランキング</h3>
          <p style="margin-top: 0.375rem; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625;">
            誰が一番燃やしたか、ではありません。続けている人を、そっと讃えるためのものです。
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- PRIVACY DESIGN -->
  <section class="section-container privacy-padding" style="padding-top: 32px; padding-bottom: 32px;">
    <div class="privacy-box" style="border-radius: ${radius.xl}; border: 1px solid ${colors.border}; background-color: rgba(250, 250, 249, 0.5);">
      <h2 class="setup-title-text" style="font-weight: 700; color: ${colors.textPrimary};">🔒 プライバシー設計</h2>
      <p style="margin-top: 0.625rem; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625;">
        AtoLogs は、プロンプト本文・コード・ファイル内容を収集しません。送信されるのは、トークン数・推定コスト・セッション数などの集計データのみです。
      </p>
      <div style="margin-top: 1rem; font-size: 0.875rem; color: ${colors.textSecondary}; background-color: ${colors.bgWhite}; padding: 1rem; border-radius: 0.5rem; border: 1px solid rgba(229, 229, 224, 0.8);">
        AtoLogs のソースコードは GitHub で公开されています。<br>
        私たちの言葉ではなく、コードそのものを読んでご判断ください。<br>
        <a href="https://github.com/nagiworkshop/atolog_cc" target="_blank" rel="noopener noreferrer" class="privacy-link" style="font-weight: 500; margin-top: 0.25rem; display: inline-block;">→  https://github.com/nagiworkshop/atolog_cc</a>
      </div>
    </div>
  </section>

  <!-- COMMAND LIST -->
  <section class="section-container cmd-padding" style="padding-bottom: 64px;">
    <h2 class="setup-title-text" style="font-weight: 700; color: ${colors.textPrimary}; margin-bottom: 1rem;">主要コマンド一覧</h2>
    <div class="divide-y-list" style="border-top: 1px solid ${colors.border}; border-bottom: 1px solid ${colors.border};">
      <div style="padding: 0.875rem 0; display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center;">
          <code style="font-size: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; color: #262626; background-color: ${colors.bgMuted}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; user-select: all; -webkit-user-select: all;">npx cross-env CCCLUB_API_URL=\${origin} npx ccclub init</code>
        </div>
        <span style="font-size: 0.875rem; color: ${colors.textSecondary};">グループを作成して開始（初回セットアップ）</span>
      </div>
      <div style="padding: 0.875rem 0; display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center;">
          <code style="font-size: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; color: #262626; background-color: ${colors.bgMuted}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; user-select: all; -webkit-user-select: all;">npx cross-env CCCLUB_API_URL=\${origin} npx ccclub join 代码</code>
        </div>
        <span style="font-size: 0.875rem; color: ${colors.textSecondary};">招待コードを使ってグループに参加</span>
      </div>
      <div style="padding: 0.875rem 0; display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center;">
          <code style="font-size: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; color: #262626; background-color: ${colors.bgMuted}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; user-select: all; -webkit-user-select: all;">npx cross-env CCCLUB_API_URL=\${origin} npx ccclub</code>
        </div>
        <span style="font-size: 0.875rem; color: ${colors.textSecondary};">本日のリーダーボードを表示（アクティブメンバーのみ）</span>
      </div>
      <div style="padding: 0.875rem 0; display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center;">
          <code style="font-size: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; color: #262626; background-color: ${colors.bgMuted}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; user-select: all; -webkit-user-select: all;">npx cross-env CCCLUB_API_URL=\${origin} npx ccclub sync</code>
        </div>
        <span style="font-size: 0.875rem; color: ${colors.textSecondary};">手動同期を実行</span>
      </div>
      <div style="padding: 0.875rem 0; display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center;">
          <code style="font-size: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; color: #262626; background-color: ${colors.bgMuted}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; user-select: all; -webkit-user-select: all;">npx cross-env CCCLUB_API_URL=\${origin} npx ccclub show-data</code>
        </div>
        <span style="font-size: 0.875rem; color: ${colors.textSecondary};">プライバシー監査（送信されるデータを確認）</span>
      </div>
    </div>
  </section>
  `;

  const extraScripts = `
    const origin = window.location.origin;
    const setupModes = {
      agent: {
        title: "このプロンプトをコーディングエージェントに送信してください。",
        subtitle: "エージェントが自動的に AtoLogs をインストールし、グループを初期化し、利用状況を同期します。設定はほぼゼロです。",
        copy: "Read " + origin + "/llms-full.txt",
        btnText: "プロンプトをコピー"
      },
      human: {
        title: "コマンドを1つ実行するだけで開始できます。",
        subtitle: "AtoLogs がローカルのエージェントのログを自動検出し、生成された招待コードを仲間と共有して参加させることができます。",
        copy: "npx cross-env CCCLUB_API_URL=" + origin + " npx ccclub init",
        btnText: "コマンドをコピー"
      }
    };

    const tabAgent = document.getElementById('tab-agent');
    const tabHuman = document.getElementById('tab-human');
    const setupTitle = document.getElementById('setup-title');
    const setupSubtitle = document.getElementById('setup-subtitle');
    const setupCode = document.getElementById('setup-code');
    const copyBtn = document.getElementById('copy-setup');
    const copyBtnText = document.getElementById('copy-btn-text');
    const copyFeedback = document.getElementById('copy-feedback');
    const agentLogoWrapper = document.getElementById('agent-logo-wrapper');

    let currentMode = 'agent';

    function updateTabs() {
      const data = setupModes[currentMode];
      setupTitle.textContent = data.title;
      setupSubtitle.textContent = data.subtitle;
      setupCode.textContent = data.copy;
      copyBtnText.textContent = data.btnText;

      if (currentMode === 'agent') {
        tabAgent.className = 'tab-btn tab-active';
        tabHuman.className = 'tab-btn tab-inactive';
        tabAgent.setAttribute('aria-selected', 'true');
        tabHuman.setAttribute('aria-selected', 'false');
        agentLogoWrapper.style.display = 'flex';
      } else {
        tabHuman.className = 'tab-btn tab-active';
        tabAgent.className = 'tab-btn tab-inactive';
        tabAgent.setAttribute('aria-selected', 'false');
        tabHuman.setAttribute('aria-selected', 'true');
        agentLogoWrapper.style.display = 'none';
      }
    }

    tabAgent.addEventListener('click', function() {
      currentMode = 'agent';
      updateTabs();
    });

    tabHuman.addEventListener('click', function() {
      currentMode = 'human';
      updateTabs();
    });

    copyBtn.addEventListener('click', function() {
      const copyText = setupModes[currentMode].copy;
      navigator.clipboard.writeText(copyText).then(function() {
        copyFeedback.style.opacity = '1';
        setTimeout(function() {
          copyFeedback.style.opacity = '0';
        }, 1800);
      });
    });

    // Initialize with dynamic origin
    updateTabs();
  `;

  return renderLayout({
    title: 'AtoLogs — AIと開発した跡を、消える前に残そう。',
    canonical: origin,
    active: 'home',
    bodyContent: bodyContent.toString(),
    extraStyles,
    extraScripts,
  });
}

export { app as landingRoute };
