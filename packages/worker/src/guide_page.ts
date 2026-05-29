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
import { colors, fontSize, spacing } from "./design-tokens.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/guide", (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const origin = new URL(c.req.url).origin;
  return c.html(guideHTML(origin));
});

function guideHTML(origin: string) {
  const extraStyles = `
    .hidden {
      display: none !important;
    }
    .main-container {
      flex: 1;
      max-width: 1024px;
      width: 100%;
      margin: 0 auto;
      padding: ${spacing[8]} ${spacing[4]};
    }
    @media (min-width: 768px) {
      .main-container {
        padding: ${spacing[12]} ${spacing[6]};
      }
    }
    .guide-layout {
      display: flex;
      flex-direction: column;
      gap: ${spacing[8]};
    }
    @media (min-width: 768px) {
      .guide-layout {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: ${spacing[8]};
      }
    }
    .sidebar-toc {
      display: none;
    }
    @media (min-width: 768px) {
      .sidebar-toc {
        display: block;
        grid-column: span 1 / span 1;
      }
    }
    .toc-link {
      display: block;
      padding: ${spacing[1]} 0 ${spacing[1]} ${spacing[3]};
      margin-left: -17px;
      border-left: 2px solid transparent;
      color: ${colors.textMuted};
      text-decoration: none;
      transition: color 0.15s;
    }
    .toc-link:hover {
      color: ${colors.textSecondary};
    }
    .toc-link.active {
      color: ${colors.textPrimary};
      font-weight: 600;
      border-left-color: ${colors.textPrimary};
    }
    .article-area {
      max-width: 42rem;
      width: 100%;
      margin: 0 auto;
    }
    .article-area > * + * {
      margin-top: ${spacing[12]};
    }
    @media (min-width: 768px) {
      .article-area {
        grid-column: span 3 / span 3;
        margin: 0;
      }
      .article-area > * + * {
        margin-top: ${spacing[16]};
      }
    }
    .page-title {
      font-size: 2.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: ${colors.textPrimary};
      line-height: 1.25;
      margin: 0;
    }
    @media (max-width: 767px) {
      .page-title {
        font-size: 1.875rem;
      }
    }
    .subtext-responsive {
      font-size: 1rem;
    }
    @media (max-width: 767px) {
      .subtext-responsive {
        font-size: 0.875rem;
      }
    }
    .guide-section {
      scroll-margin-top: 5rem;
    }
    .guide-section > * + * {
      margin-top: ${spacing[4]};
    }
    .guide-section-large {
      scroll-margin-top: 5rem;
    }
    .guide-section-large > * + * {
      margin-top: ${spacing[6]};
    }
    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: ${colors.textPrimary};
      padding-bottom: ${spacing[2]};
      border-bottom: 1px solid ${colors.border};
      margin: 0;
    }
    @media (max-width: 767px) {
      .section-title {
        font-size: 1.25rem;
      }
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
      color: white;
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
    .code-inline {
      background-color: ${colors.border};
      padding: 2px 4px;
      border-radius: 4px;
      font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important;
      font-size: 0.75rem;
    }
    .guide-list {
      list-style-type: decimal;
      padding-left: 1.25rem;
      margin: 0;
    }
    .guide-list > li + li {
      margin-top: 4px;
    }
    .guide-tab-btn {
      padding: 8px 16px;
      font-size: 0.875rem;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
    }
    .guide-tab-btn.active {
      font-weight: 600;
      color: ${colors.textPrimary};
      border-bottom: 2px solid ${colors.textPrimary};
    }
    .guide-tab-btn.inactive {
      font-weight: 500;
      color: ${colors.textMuted};
      border-bottom: 2px solid transparent;
    }
    .guide-tab-btn.inactive:hover {
      color: ${colors.textSecondary};
    }
    .mockup-terminal > * + * {
      margin-top: 0.5rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-top: 16px;
    }
    @media (min-width: 768px) {
      .info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .info-card {
      border: 1px solid ${colors.border};
      border-radius: 0.5rem;
      padding: 16px;
      background-color: ${colors.bgWhite};
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .info-card > * + * {
      margin-top: 4px;
    }
    .guide-ol-list {
      list-style-type: decimal;
      padding-left: 1.25rem;
      margin: 0;
      color: ${colors.textSecondary};
      font-size: 0.9375rem;
      line-height: 1.625;
    }
    .guide-ol-list > li + li {
      margin-top: 8px;
    }
    .privacy-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      margin-top: 16px;
    }
    @media (min-width: 768px) {
      .privacy-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .privacy-list-red {
      list-style-type: disc;
      padding-left: 1.25rem;
      margin: 0;
      font-size: 0.75rem;
      color: ${colors.danger};
      line-height: 1.625;
    }
    .privacy-list-red > li + li {
      margin-top: 4px;
    }
    .privacy-list-emerald {
      list-style-type: disc;
      padding-left: 1.25rem;
      margin: 0;
      font-size: 0.75rem;
      color: ${colors.success};
      line-height: 1.625;
    }
    .privacy-list-emerald > li + li {
      margin-top: 4px;
    }
    .guide-table {
      width: 100%;
      text-align: left;
      font-size: 0.875rem;
      border-collapse: collapse;
    }
    .guide-table th {
      padding: 12px;
      font-weight: 600;
      color: ${colors.textMuted};
      background-color: ${colors.bg};
      border-bottom: 1px solid ${colors.border};
    }
    .guide-table td {
      padding: 12px;
    }
    .guide-table tbody tr {
      border-bottom: 1px solid ${colors.border};
    }
    .guide-table tbody tr:last-child {
      border-bottom: none;
    }
    details.guide-details {
      margin-top: 16px;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      background-color: ${colors.bg};
      overflow: hidden;
    }
    details.guide-details summary {
      padding: 14px;
      font-size: 0.875rem;
      font-weight: 500;
      color: ${colors.textSecondary};
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      -webkit-user-select: none;
    }
    details.guide-details summary::-webkit-details-marker {
      display: none;
    }
    details.guide-details summary:hover {
      background-color: ${colors.bgMuted};
    }
    details.guide-details[open] summary svg {
      transform: rotate(180deg);
    }
    details.guide-details summary svg {
      transition: transform 0.15s ease-in-out;
    }
    details.trouble-details {
      border: 1px solid ${colors.border};
      border-radius: 8px;
      background-color: ${colors.bgWhite};
      overflow: hidden;
    }
    details.trouble-details summary {
      padding: 16px;
      font-weight: 700;
      font-size: 0.9375rem;
      color: ${colors.textSecondary};
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      -webkit-user-select: none;
    }
    details.trouble-details summary::-webkit-details-marker {
      display: none;
    }
    details.trouble-details summary:hover {
      color: ${colors.textPrimary};
      background-color: ${colors.bg};
    }
    details.trouble-details[open] summary svg {
      transform: rotate(180deg);
    }
    details.trouble-details summary svg {
      transition: transform 0.15s ease-in-out;
    }
  `;

  const bodyContent = html`
  <div class="main-container">
    <div class="guide-layout">
      
      <!-- Sticky Sidebar TOC (Desktop Only) -->
      <aside class="sidebar-toc">
        <div style="position: sticky; top: 5rem; display: flex; flex-direction: column; gap: 0.375rem; font-size: 0.875rem; color: ${colors.textMuted}; border-left: 1px solid ${colors.border}; padding-left: 1rem; padding-top: 0.25rem; padding-bottom: 0.25rem;">
          <span style="font-size: 0.75rem; font-weight: 600; color: ${colors.textFaint}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">目次</span>
          <a href="#quickstart" class="toc-link active">1. 30秒で始める</a>
          <a href="#two-ways" class="toc-link">2. 2つの始め方</a>
          <a href="#dashboard" class="toc-link">3. データを見る</a>
          <a href="#invite" class="toc-link">4. 仲間を招待する</a>
          <a href="#privacy" class="toc-link">5. プライバシー</a>
          <a href="#commands" class="toc-link">6. コマンド一覧</a>
          <a href="#troubleshooting" class="toc-link">7. 困ったときは</a>
          <a href="#about" class="toc-link">8. このサイトについて</a>
        </div>
      </aside>

      <!-- Main Text Reading Area -->
      <article class="article-area">
        
        <!-- PAGE TITLE -->
        <div>
          <h1 class="page-title">使い方ガイド</h1>
          <p class="subtext-responsive" style="margin-top: 0.75rem; color: ${colors.textMuted}; line-height: 1.625;">
            AtoLogs (アトログズ) は、コーディングエージェント（Claude Code 等）の使用量をお手軽に可視化し、仲間と共有できるツールです。
          </p>
        </div>

        <section style="background-color: ${colors.bgMuted}; border-radius: 0.5rem; padding: 20px 24px; margin: 24px 0;">
          <h2 style="font-size: 18px; font-weight: 700; color: ${colors.textPrimary}; margin-bottom: 16px;">📋 目次</h2>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">

            <!-- 新ユーザー向け -->
            <div>
              <h3 style="font-size: 15px; font-weight: 600; color: ${colors.textPrimary}; margin-bottom: 8px;">🆕 新規ユーザー</h3>
              <ul style="list-style: none; padding-left: 0; font-size: 14px; line-height: 1.8;">
                <li><a href="#section-1" style="color: ${colors.textSecondary}; text-decoration: none;">1. 30秒で始める</a></li>
                <li><a href="#section-2" style="color: ${colors.textSecondary}; text-decoration: none;">2. 2つの始め方</a></li>
                <li><a href="#section-7" style="color: ${colors.textSecondary}; text-decoration: none;">7. 困ったときは</a></li>
              </ul>
            </div>

            <!-- 老ユーザー向け -->
            <div>
              <h3 style="font-size: 15px; font-weight: 600; color: ${colors.textPrimary}; margin-bottom: 8px;">👤 既存ユーザー</h3>
              <ul style="list-style: none; padding-left: 0; font-size: 14px; line-height: 1.8;">
                <li><a href="#section-3" style="color: ${colors.textSecondary}; text-decoration: none;">3. データを見る</a></li>
                <li><a href="#section-5" style="color: ${colors.textSecondary}; text-decoration: none;">5. プライバシー</a></li>
                <li><a href="#section-6" style="color: ${colors.textSecondary}; text-decoration: none;">6. コマンド一覧</a></li>
              </ul>
            </div>

            <!-- 分享向け -->
            <div>
              <h3 style="font-size: 15px; font-weight: 600; color: ${colors.textPrimary}; margin-bottom: 8px;">🔗 シェア</h3>
              <ul style="list-style: none; padding-left: 0; font-size: 14px; line-height: 1.8;">
                <li><a href="#section-4" style="color: ${colors.textSecondary}; text-decoration: none;">4. 仲間を招待する</a></li>
                <li><a href="#section-3" style="color: ${colors.textSecondary}; text-decoration: none;">3. ブラウザシェア</a></li>
              </ul>
            </div>

          </div>
        </section>

        <!-- 1. 30秒で始める -->
        <section id="quickstart" class="guide-section">
          <h2 id="section-1" class="section-title">1. 30秒で始める</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            初期化コマンドを実行するだけで、すぐに開始できます。お使いのターミナルで以下のコマンドを実行してください：
          </p>

          <div style="margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="flex: 1; text-align: left; background-color: ${colors.codeBg}; border: 1px solid #262626; border-radius: 0.375rem; padding: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.875rem; word-break: break-all; color: ${colors.codeFg}; user-select: all; -webkit-user-select: all; display: flex; align-items: center; min-height: 48px;">
                <code id="code-quickinit" style="width: 100%;">CCCLUB_API_URL=${origin} npx atologs init</code>
              </div>
              <button onclick="copyText('code-quickinit', 'toast-quickinit')" class="btn-copy" type="button">
                <svg style="width: 1rem; height: 1rem; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>コピー</span>
              </button>
            </div>
            <p id="toast-quickinit" style="margin-top: 0.5rem; font-size: 0.875rem; color: ${colors.success}; font-weight: 500; opacity: 0; transition: opacity 0.15s ease-in-out;">コピーしました！</p>
          </div>

          <div style="margin-top: 1rem; background-color: ${colors.bg}; border-radius: 0.5rem; padding: 1rem; border: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary};">
            <p style="font-weight: 500; color: ${colors.textSecondary}; margin: 0 0 0.5rem 0;">このコマンドだけで以下が自動で行われます：</p>
            <ul class="guide-list">
              <li>表示名（ユーザー名）を <code class="code-inline">git config</code> から自動検出（変更可能）</li>
              <li>6文字のグループ招待コードを新規発行</li>
              <li>Claude Code / Codex などのログを自動検出してバックグラウンド同期を設定</li>
            </ul>
          </div>
        </section>

        <!-- 2. 2つの始め方 -->
        <section id="two-ways" class="guide-section-large">
          <h2 id="section-2" class="section-title">2. 2つの始め方</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            ご利用環境に合わせて、以下の2つのいずれかの方法でセットアップを開始できます。
          </p>

          <!-- TABS SELECTOR -->
          <div style="display: flex; border-bottom: 1px solid ${colors.border};">
            <button id="tab-btn-agent" class="guide-tab-btn active">A · AI エージェントに任せる</button>
            <button id="tab-btn-manual" class="guide-tab-btn inactive">B · ターミナルで手動</button>
          </div>

          <!-- TAB CONTENT A (AGENT) -->
          <div id="tab-content-agent" class="guide-section">
            <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
              すでに起動している Claude Code やコーディングAIチャットに、以下のプロンプトをそのまま貼り付けてください。AIが自動的にガイドを読み取り、セットアップコマンドを実行します。
            </p>
            <div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="flex: 1; text-align: left; background-color: ${colors.codeBg}; border: 1px solid #262626; border-radius: 0.375rem; padding: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.875rem; word-break: break-all; color: ${colors.codeFg}; user-select: all; -webkit-user-select: all; display: flex; align-items: center; min-height: 48px;">
                  <code id="code-agentprompt" style="width: 100%;">Read ${origin}/llms-full.txt and run init command</code>
                </div>
                <button onclick="copyText('code-agentprompt', 'toast-agentprompt')" class="btn-copy" type="button">
                  <svg style="width: 1rem; height: 1rem; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>プロンプトをコピー</span>
                </button>
              </div>
              <p id="toast-agentprompt" style="margin-top: 0.5rem; font-size: 0.875rem; color: ${colors.success}; font-weight: 500; opacity: 0; transition: opacity 0.15s ease-in-out;">コピーしました！</p>
            </div>
            
            <!-- visual mockup -->
            <div class="mockup-terminal" style="border: 1px solid ${colors.border}; border-radius: 0.5rem; padding: 1rem; background-color: #0a0a0a; color: white; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem;">
              <div style="color: ${colors.textMuted};">&gt; Claude Code terminal</div>
              <div style="color: #d4d4d4;">User: Read ${origin}/llms-full.txt and run init command</div>
              <div style="color: ${colors.textFaint};">Claude: I'll read the docs and run the initialization for you. ...</div>
              <div style="color: #34d399;">✔ Group created! Code: YHAW6P. Dashboard: ${origin}/g/YHAW6P</div>
            </div>
          </div>

          <!-- TAB CONTENT B (MANUAL) -->
          <div id="tab-content-manual" class="hidden guide-section">
            <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
              手動で一つずつ確認しながら導入したい場合は、お使いのターミナルで以下のコマンドを実行してください。
            </p>
            <div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="flex: 1; text-align: left; background-color: ${colors.codeBg}; border: 1px solid #262626; border-radius: 0.375rem; padding: 0.875rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.875rem; word-break: break-all; color: ${colors.codeFg}; user-select: all; -webkit-user-select: all; display: flex; align-items: center; min-height: 48px;">
                  <code id="code-manualcmd" style="width: 100%;">CCCLUB_API_URL=${origin} npx atologs init</code>
                </div>
                <button onclick="copyText('code-manualcmd', 'toast-manualcmd')" class="btn-copy" type="button">
                  <svg style="width: 1rem; height: 1rem; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>コマンドをコピー</span>
                </button>
              </div>
              <p id="toast-manualcmd" style="margin-top: 0.5rem; font-size: 0.875rem; color: ${colors.success}; font-weight: 500; opacity: 0; transition: opacity 0.15s ease-in-out;">コピーしました！</p>
            </div>
          </div>
        </section>

        <!-- 3. 数据を見る -->
        <section id="dashboard" class="guide-section">
          <h2 id="section-3" class="section-title">3. データを見る</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            セットアップが完了すると、自動的にWebダッシュボードが生成され、以下のデータ項目をいつでもブラウザから確認できます。
          </p>

          <!-- Annotated layout list -->
          <div class="info-grid">
            <div class="info-card">
              <span style="font-size: 0.75rem; font-weight: 600; color: ${colors.textFaint};">01 / STAT GRID</span>
              <h4 style="font-weight: 700; color: ${colors.textSecondary}; margin: 0; font-size: 1rem;">主要指標カード</h4>
              <p style="font-size: 0.75rem; color: ${colors.textSecondary}; line-height: 1.625; margin: 0;">
                「今日のトークン量」「推定コスト」「会話セッション数」「稼働しているメンバー数」をトップに要約表示します。
              </p>
            </div>

            <div class="info-card">
              <span style="font-size: 0.75rem; font-weight: 600; color: ${colors.textFaint};">02 / TIMELINE HEATMAP</span>
              <h4 style="font-weight: 700; color: ${colors.textSecondary}; margin: 0; font-size: 1rem;">活動タイムライン（ヒートマップ）</h4>
              <p style="font-size: 0.75rem; color: ${colors.textSecondary}; line-height: 1.625; margin: 0;">
                いつ誰がアクティブにコードを書いたかを時間帯別に可視化します。<strong>※このグラフはプライベートなグループ内のみで共有され、グローバルランキング（/g/global）には非表示になります。</strong>
              </p>
            </div>

            <div class="info-card">
              <span style="font-size: 0.75rem; font-weight: 600; color: ${colors.textFaint};">03 / LEADERBOARD</span>
              <h4 style="font-weight: 700; color: ${colors.textSecondary}; margin: 0; font-size: 1rem;">リーダーボード テーブル</h4>
              <p style="font-size: 0.75rem; color: ${colors.textSecondary}; line-height: 1.625; margin: 0;">
                メンバーのアバターや名前と合わせて、使用エージェント比率（Claude Code / Codex 等）や会話量別の順位表を表示します。
              </p>
            </div>

            <div class="info-card">
              <span style="font-size: 0.75rem; font-weight: 600; color: ${colors.textFaint};">04 / SHARING BANNER</span>
              <h4 style="font-weight: 700; color: ${colors.textSecondary}; margin: 0; font-size: 1rem;">活用ログ共有切り替え</h4>
              <p style="font-size: 0.75rem; color: ${colors.textSecondary}; line-height: 1.625; margin: 0;">
                ダッシュボードからワンクリックで、自分がグループ内のランキングに参加するか、一時的に非表示にするかを切り替えることができます。
              </p>
            </div>
          </div>

          <div style="background-color: ${colors.bgMuted}; border-left: 3px solid ${colors.border}; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
            ※ ブラウザからも閲覧可能：<br>
            <code style="background: ${colors.bgWhite}; padding: 2px 6px; border-radius: 4px; font-family: SF Mono, Menlo, monospace; font-size: 13px;">https://atologs.com/g/&lt;6 桁コード&gt;</code> をブラウザで開くだけ。ログインは不要で、コードを知っている人なら誰でもアクセスできます（22 億通りの組み合わせによる "Security by Obscurity"）。
          </div>
        </section>

        <!-- 4. 仲間を招待する -->
        <section id="invite" class="guide-section">
          <h2 id="section-4" class="section-title">4. 仲間を招待する</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            AtoLogs の真価はチーム全体で使うことで発揮されます。招待手順は以下の通りです：
          </p>

          <ol class="guide-ol-list">
            <li>ダッシュボード上部にある「招待リンク」をコピーします。</li>
            <li>招待リンク（例：<code class="code-inline">${origin}/invite/YHAW6P</code>）を Slack や Discord、LINE 等に貼り付けます。（自動的にリッチなプレビュー画像が生成されます）</li>
            <li>招待された側は、リンク内にある「参加コマンド」をコピーしてお使いのターミナルで実行するだけで完了です。</li>
          </ol>

          <div style="margin-top: 1rem; background-color: ${colors.bgMuted}; border-left: 4px solid ${colors.textSecondary}; padding: 1rem; border-radius: 0 0.25rem 0.25rem 0; font-size: 0.875rem; color: ${colors.textSecondary};">
            <span style="font-weight: 700; color: ${colors.textSecondary}; display: block; margin-bottom: 0.25rem;">💡 招待されてもデータは強制的に公開されません</span>
            グループに参加しても、あなたのデータはそのグループ内のメンバー同士でのみ共有されます。グローバルランキング（<a href="/g/global" style="text-decoration: underline; color: ${colors.textSecondary}; font-weight: 500;">/g/global</a>）にデータを掲載するには、自身で明示的に公開コマンドを実行するまで一切掲載されません。
          </div>

          <div style="background-color: ${colors.bgMuted}; border-left: 3px solid ${colors.border}; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
            ※ 招待リンクをそのままブラウザでシェアすることもできます。<br>
            受け取った相手は CLI をインストールしなくても、リンクをクリックするだけでグループのリーダーボードを閲覧できます。CLI でデータを送信したい場合のみ <code style="background: ${colors.bgWhite}; padding: 2px 6px; border-radius: 4px; font-family: SF Mono, Menlo, monospace; font-size: 13px;">atologs join &lt;コード&gt;</code> を実行してください。
          </div>
        </section>

        ${raw(renderFeedbackCta())}

        <!-- 5. プライバシー -->
        <section id="privacy" class="guide-section">
          <h2 id="section-5" class="section-title">5. プライバシー</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            AtoLogs はセキュリティとプライバシーを第一に設計されており、開発データや会話内容は一切収集しません。
          </p>

          <div style="margin-top: 1rem; margin-bottom: 1rem; font-size: 0.875rem; color: ${colors.textSecondary}; background-color: rgba(245, 245, 245, 0.5); padding: 1rem; border-radius: 0.5rem; border: 1px solid ${colors.border};">
            AtoLogs のソースコードは GitHub で公開されています。<br>
            私たちの言葉ではなく、コードそのものを読んでご判断ください。<br>
            <a href="https://github.com/nagiworkshop/atologs" target="_blank" rel="noopener noreferrer" class="privacy-link" style="font-weight: 500; margin-top: 0.25rem; display: inline-block;">→  https://github.com/nagiworkshop/atologs</a>
          </div>

          <div class="privacy-grid">
            <div style="background-color: ${colors.dangerBg}; border: 1px solid #fee2e2; border-radius: 0.5rem; padding: 1rem;">
              <h4 style="font-weight: 700; color: ${colors.danger}; display: flex; align-items: center; gap: 0.5rem; margin-top: 0; margin-bottom: 0.5rem; font-size: 0.9375rem;">
                <span>❌</span> 送信されないもの（非収集）
              </h4>
              <ul class="privacy-list-red">
                <li>ユーザープロンプトや入力されたテキスト</li>
                <li>AIエージェントからの回答テキスト</li>
                <li>開発中のソースコードやファイルの中身</li>
                <li>ファイルの絶対パスやプロジェクトフォルダー名</li>
                <li>会話された詳細履歴そのもの</li>
              </ul>
            </div>

            <div style="background-color: rgba(236, 253, 245, 0.5); border: 1px solid #d1fae5; border-radius: 0.5rem; padding: 1rem;">
              <h4 style="font-weight: 700; color: ${colors.success}; display: flex; align-items: center; gap: 0.5rem; margin-top: 0; margin-bottom: 0.5rem; font-size: 0.9375rem;">
                <span>✅</span> 送信されるもの
              </h4>
              <ul class="privacy-list-emerald">
                <li>トークン数（入力、出力、推論）</li>
                <li>使用されたAIモデル名</li>
                <li>会話セッション数（エージェント起動回数）</li>
                <li>集計タイムスタンプ（30分単位にまとめて送信）</li>
              </ul>
            </div>
          </div>

          <div style="margin-top: 1rem; font-size: 0.875rem; color: ${colors.textSecondary};">
            <p>
              どのようなデータが送信されるかご自身の目で直接監査できます。ターミナルで以下のコマンドを実行してください：
            </p>
            <code style="display: block; background-color: ${colors.codeBg}; color: ${colors.codeFg}; border-radius: 0.25rem; padding: 0.625rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; margin-top: 0.5rem;">CCCLUB_API_URL=${origin} npx atologs show-data</code>
          </div>
        </section>

        <!-- 6. コマンド一覧 -->
        <section id="commands" class="guide-section">
          <h2 id="section-6" class="section-title">6. コマンド一覧</h2>
          <p style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; margin: 0;">
            よく使用する基本的な CLI コマンドです：
          </p>

          <p style="background-color: ${colors.bgMuted}; border-left: 3px solid ${colors.border}; padding: 12px 16px; margin: 16px 0; font-size: 14px; color: ${colors.textSecondary}; line-height: 1.6;">
            ※ AtoLogs は upstream の <strong>atologs</strong> CLI（npm パッケージ名）を使用しています。互換性のため、コマンド名は <code style="background: ${colors.bgWhite}; padding: 2px 6px; border-radius: 4px; font-family: SF Mono, Menlo, monospace; font-size: 13px;">atologs</code> のままお使いください。
          </p>

          <div style="overflow-x: auto; border: 1px solid ${colors.border}; border-radius: 0.5rem; background-color: ${colors.bgWhite}; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-top: 0.75rem;">
            <table class="guide-table">
              <thead>
                <tr>
                  <th>コマンド</th>
                  <th>説明</th>
                </tr>
              </thead>
              <tbody style="color: ${colors.textSecondary};">
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs init</td>
                  <td>グループを作成して開始（初回セットアップ）</td>
                </tr>
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs join &lt;コード&gt;</td>
                  <td>招待コードを使用してグループに参加</td>
                </tr>
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs</td>
                  <td>本日のリーダーボードを表示</td>
                </tr>
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs profile --name "..."</td>
                  <td>表示名を変更</td>
                </tr>
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs show-data</td>
                  <td>アップロードされる生データをプレビュー</td>
                </tr>
                <tr>
                  <td style="font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">atologs leave &lt;コード&gt;</td>
                  <td>グループから脱退</td>
                </tr>
              </tbody>
            </table>
          </div>

          <details class="guide-details">
            <summary>
              <span>すべてのコマンド一覧を表示</span>
              <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <div style="padding: 1rem; border-top: 1px solid ${colors.border}; background-color: ${colors.bgWhite}; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; color: ${colors.textSecondary}; display: flex; flex-direction: column; gap: 0.5rem;">
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs create</span> — 新たなグループを作成する</p>
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs sync</span> — 手動同期（通常は自動でバックグラウンド実行）</p>
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs sync --force</span> — ローカルログを再スキャンしてすべて再アップロード</p>
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs profile --avatar &lt;URL&gt;</span> — カスタムアバター画像を設定</p>
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs profile --public</span> — グローバルランキングに公開する（公開）</p>
              <p style="margin: 0;"><span style="font-weight: 700; color: ${colors.textSecondary};">atologs profile --private</span> — グローバルランキングから非公開にする（非公開・デフォルト）</p>
              <p style="padding-top: 0.5rem; color: ${colors.textFaint}; font-family: 'Noto Sans JP', sans-serif !important; margin: 0;">※ 全ての CLI オプションは <a href="/llms-full.txt" style="text-decoration: underline; color: ${colors.textSecondary};">llms-full.txt</a> より確認いただけます。</p>
            </div>
          </details>
        </section>

        <!-- 7. 困ったときは -->
        <section id="troubleshooting" class="guide-section">
          <h2 id="section-7" class="section-title">7. 困ったときは</h2>
          
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            
            <details class="trouble-details">
              <summary>
                <span>Q. ダッシュボードにデータが表示されません</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                通常はバックグラウンドで自動的に同期されますが、強制的にローカルログをスキャンして再アップロードするには、ターミナルで以下のコマンドを実行してください：
                <code style="display: block; background-color: ${colors.codeBg}; color: ${colors.codeFg}; border-radius: 0.25rem; padding: 0.5rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; margin-top: 0.5rem;">CCCLUB_API_URL=${origin} npx atologs sync --force</code>
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. Codex などのエージェントを使っているのに反映されません</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                デフォルト以外のディレクトリにログが保存されている可能性があります。環境変数 <code class="code-inline">CODEX_HOME</code> にログフォルダーの絶対パスを設定してから同期をお試しください。
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. 複数のPC / マシンで同じ自分を集計したいです</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                <code class="code-inline">~/.ccclub/config.json</code> に記録されている <code class="code-inline">userToken</code> の値をもう一方のマシンの設定ファイルに上書きコピーすることで、データを同一ユーザーのアクティビティとして統合できます。
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. グループの名前を変更したいです</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                恐れ入りますが、現在グループ名の後からの変更はサポートされておりません。新しいグループを作成（<code class="code-inline">atologs create</code>）いただき、改めてメンバーを招待してください。
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. データを全部サーバーから削除したいです</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                参加しているすべてのグループから脱退（<code class="code-inline">atologs leave</code>）を実行し、マシンのローカルに存在する設定フォルダー <code class="code-inline">~/.ccclub/</code> を削除してください。サーバー上の古いデータは一定期間後に自動消滅します。
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. Windows 環境でうまく起動しません</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                Windows PowerShell やコマンドプロンプトでは、環境変数の設定方法が異なります。<code class="code-inline">cross-env</code> パッケージを使用してコマンドを実行してください：
                <code style="display: block; background-color: ${colors.codeBg}; color: ${colors.codeFg}; border-radius: 0.25rem; padding: 0.5rem; font-family: SF Mono, Fira Code, Menlo, Consolas, monospace !important; font-size: 0.75rem; margin-top: 0.5rem;">npx cross-env CCCLUB_API_URL=${origin} npx atologs init</code>
              </div>
            </details>

            <details class="trouble-details">
              <summary>
                <span>Q. 表示される料金（コスト）が請求金額と合いません</span>
                <svg style="width: 1rem; height: 1rem; color: ${colors.textFaint};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div style="padding: 1rem; border-top: 1px solid ${colors.border}; font-size: 0.875rem; color: ${colors.textSecondary}; line-height: 1.625; background-color: rgba(250, 250, 249, 0.5);">
                本サービスで算出されるコストは、モデルごとの公開単価を基準に入力・出力・推论トークン数を掛け合わせて算出されたおおよその参考指標です。キャッシュ割引や各プロバイダーのご契約状況による割引等は反映されないため、あくまで概算としてご活用ください。
              </div>
            </details>

          </div>
        </section>

        <!-- 8. このサイトについて -->
        <section id="about" class="guide-section">
          <h2 id="section-8" class="section-title">8. このサイトについて</h2>
          
          <div style="color: ${colors.textSecondary}; line-height: 1.625; font-size: 0.9375rem; display: flex; flex-direction: column; gap: 0.75rem;">
            <p style="margin: 0;">
              <span style="font-weight: 700; color: ${colors.textPrimary};">AtoLogs について</span> ── 
              AtoLogs は、AIエージェントを活用した開発プロセスの跡を記録し、チーム内での学びの共有とモチベーション向上をサポートするツールです。開発者の Nagi が個人で開発・運用を行っています。
            </p>
            <p style="margin: 0;">
              <span style="font-weight: 700; color: ${colors.textPrimary};">オープンソースへの感謝</span> ── 
              本サイトは、オープンソースプロジェクトである <a href="https://github.com/mazzzystar/ccclub" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: ${colors.textPrimary}; font-weight: 600;">mazzzystar/ccclub</a> をベースにした、日本向けローカライズフォーク（Fork）版です。多大なるオリジナルの開発者に敬意と感謝を表します。MIT Licenseの下で配布されています。
            </p>
            <p style="margin: 0;">
              <span style="font-weight: 700; color: ${colors.textPrimary};">フィードバック・お問い合わせ</span> ── 
              バグ報告、ご提案、質問などがございましたら、お気軽に <a href="https://github.com/nagiworkshop/atologs/issues" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: ${colors.textPrimary}; font-weight: 600;">GitHub Issues</a> までお寄せください。
            </p>
          </div>
        </section>

      </article>
    </div>
  </div>
  `;

  const extraScripts = `
    // Copying text functionality
    function copyText(elementId, feedbackId) {
      const text = document.getElementById(elementId).textContent.trim();
      navigator.clipboard.writeText(text).then(function() {
        const feedback = document.getElementById(feedbackId);
        feedback.style.opacity = '1';
        setTimeout(function() {
          feedback.style.opacity = '0';
        }, 1500);
      }).catch(function(err) {
        console.error("Copy failed: ", err);
      });
    }

    // Tabs logic
    const tabBtnAgent = document.getElementById('tab-btn-agent');
    const tabBtnManual = document.getElementById('tab-btn-manual');
    const tabContentAgent = document.getElementById('tab-content-agent');
    const tabContentManual = document.getElementById('tab-content-manual');

    if (tabBtnAgent && tabBtnManual && tabContentAgent && tabContentManual) {
      tabBtnAgent.addEventListener('click', function() {
        tabBtnAgent.className = "guide-tab-btn active";
        tabBtnManual.className = "guide-tab-btn inactive";
        tabContentAgent.classList.remove('hidden');
        tabContentManual.classList.add('hidden');
      });

      tabBtnManual.addEventListener('click', function() {
        tabBtnManual.className = "guide-tab-btn active";
        tabBtnAgent.className = "guide-tab-btn inactive";
        tabContentManual.classList.remove('hidden');
        tabContentAgent.classList.add('hidden');
      });
    }

    // Active TOC scroll detection
    const sections = document.querySelectorAll('section');
    const tocLinks = document.querySelectorAll('.toc-link');

    window.addEventListener('scroll', function() {
      let current = '';
      sections.forEach(function(section) {
        const sectionTop = section.offsetTop;
        if (pageYOffset >= sectionTop - 120) {
          current = section.getAttribute('id');
        }
      });

      tocLinks.forEach(function(link) {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
    });
  `;

  return renderLayout({
    title: '使い方 — AtoLogs',
    description: 'AtoLogs の使い方ガイド。CLI のインストール、グループの作成・参加、対応エージェント (Claude Code · Codex · OpenCode · Amp · pi-agent) の自動検出、リーダーボード共有まで、3 分で始められる手順を網羅。',
    canonical: `${origin}/guide`,
    jsonLd: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "AtoLogs 使い方ガイド",
      "description": "AtoLogs CLI と Web ダッシュボードの使い方。CLI インストール、グループ作成、リーダーボード閲覧までの完全ガイド。",
      "inLanguage": "ja-JP",
      "url": `${origin}/guide`,
      "mainEntityOfPage": `${origin}/guide`,
      "publisher": {
        "@type": "Organization",
        "name": "AtoLogs",
        "logo": { "@type": "ImageObject", "url": `${origin}/favicon.svg` }
      },
      "proficiencyLevel": "Beginner",
      "about": ["Claude Code", "Codex", "OpenCode", "Amp", "Coding Agent Analytics"]
    }),
    active: 'guide',
    bodyContent: bodyContent.toString(),
    extraStyles,
    extraScripts,
  });
}

export { app as guidePage };
