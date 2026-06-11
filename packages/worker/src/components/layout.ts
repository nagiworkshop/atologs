import { colors, fontStack, fontSize, spacing, radius } from '../design-tokens';
import { renderNav, navStyles, type ActivePage } from './nav';
import { renderFooter, footerStyles } from './footer';
import { renderBottomNav, bottomNavStyles } from './bottom-nav';

export interface LayoutOptions {
  /** 页面 title 标签内容 */
  title: string;
  /** meta description */
  description?: string;
  /** og:image URL */
  ogImage?: string;
  /** canonical URL */
  canonical?: string;
  /** 当前页面（决定 nav active 高亮）*/
  active: ActivePage;
  /** 页面主体 HTML 内容 */
  bodyContent: string;
  /** 该页特定的 <style> 块附加内容（仅业务样式，禁止重写 nav/footer/bottom-nav） */
  extraStyles?: string;
  /** 该页特定的 <script> 块附加内容 */
  extraScripts?: string;
  /** 该页 JSON-LD 结构化数据（Schema.org），会作为 <script type="application/ld+json"> 插入 head */
  jsonLd?: string;
}

/**
 * 单一页面骨架渲染函数。
 * 所有页面必须通过这个函数渲染，不许自己写 <html><body> 骨架。
 */
/**
 * X (Twitter) Ads pixel ID. Create in X Ads Manager → Tools → Conversion tracking →
 * "Website tag" (Universal Website Tag) → copy the short pixel ID (e.g. "rC3xs").
 * Empty string = pixel not rendered (safe default until the tag exists).
 */
const X_PIXEL_ID = "rclwf";

/**
 * Microsoft Clarity project ID (heatmaps + session recordings).
 * From the Clarity dashboard URL clarity.microsoft.com/projects/view/<ID>/...
 * → here <ID> = "x5e5utneeu". Empty string = not rendered (safe default).
 */
const CLARITY_ID = "x5e5utneeu";

export function renderLayout(opts: LayoutOptions): string {
  const description = opts.description ||
    'Claude Code などのコーディングエージェント利用量・推定コスト・セッション数を記録する個人・チーム向けツール。';
  const ogImage = opts.ogImage || 'https://atologs.com/g/global/og.png';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
  <title>${opts.title}</title>
  <meta name="description" content="${description}" />
  <meta name="application-name" content="AtoLogs" />
  <meta name="theme-color" content="${colors.bg}" />
  ${opts.canonical ? `<link rel="canonical" href="${opts.canonical}" />` : ''}

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AtoLogs" />
  <meta property="og:title" content="${opts.title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="ja_JP" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@atologs_jp" />
  <meta name="twitter:creator" content="@atologs_jp" />
  <meta name="twitter:title" content="${opts.title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />

  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />

  ${opts.jsonLd ? `<script type="application/ld+json">${opts.jsonLd}</script>` : ''}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-EVZ3ZQNZD5"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-EVZ3ZQNZD5');
    window.track = function(name, params){ try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {} };
  </script>
  ${X_PIXEL_ID ? `<!-- X (Twitter) Ads pixel -->
  <script>
    !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
    twq('config','${X_PIXEL_ID}');
  </script>` : ''}
  ${CLARITY_ID ? `<!-- Microsoft Clarity -->
  <script>
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");
  </script>` : ''}

  <style>
    /* === 全局 reset === */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    /* === 全局基础（仅设置 html/body 字体和背景）=== */
    html, body, button, input, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div {
      font-family: ${fontStack};
      font-feature-settings: "palt";
    }
    html { -webkit-text-size-adjust: 100%; }
    body {
      background: ${colors.bg};
      color: ${colors.textPrimary};
      font-size: ${fontSize.lg};
      line-height: 1.5;
    }
    main { min-height: calc(100vh - ${spacing[14]} - ${spacing[12]}); }

    /* === iOS 输入框防 auto-zoom === */
    @media (max-width: 640px) {
      input, textarea, select { font-size: 16px !important; }
    }

    /* === 移动端给 BottomNav 留位 === */
    @media (max-width: 767px) {
      body { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    }

    /* === Nav 样式 === */
    ${navStyles()}

    /* === Footer 样式 === */
    ${footerStyles()}

    /* === BottomNav 样式 === */
    ${bottomNavStyles()}

    /* === 该页特定附加样式（仅业务样式）=== */
    ${opts.extraStyles || ''}
  </style>
</head>
<body>
  ${renderNav(opts.active)}

  <main>
    ${opts.bodyContent}
  </main>

  ${renderFooter()}
  ${renderBottomNav(opts.active)}

  <script>
    (function() {
      // 1. 如果当前 URL 是 /g/<code> 形式（非 SAMPLE / 非 global），自动写 last_group_code
      var pathMatch = window.location.pathname.match(/^\\/g\\/([a-zA-Z0-9]+)$/);
      if (pathMatch) {
        var code = pathMatch[1].toUpperCase();
        if (code !== "SAMPLE" && code !== "GLOBAL" && code !== "888888" && code !== "88888") {
          localStorage.setItem("last_group_code", code);
        }
      }

      // 2. 然后再读 localStorage 决定是否激活「ダッシュボード」按钮
      var lastGroup = localStorage.getItem('last_group_code');
      if (lastGroup) {
        // Hydrate desktop nav link
        var dNav = document.querySelector('.desktop-nav a.nav-dashboard-link');
        if (dNav) {
          dNav.href = '/g/' + lastGroup;
          dNav.classList.remove('disabled');
          dNav.style.opacity = '1';
          dNav.style.cursor = 'pointer';
          dNav.style.pointerEvents = 'auto';
        }
        // Hydrate mobile bottom-nav link
        var mNav = document.querySelector('.bottom-nav a.bottom-nav-dashboard-link');
        if (mNav) {
          mNav.href = '/g/' + lastGroup;
          mNav.classList.remove('disabled');
          mNav.style.opacity = '1';
          mNav.style.pointerEvents = 'auto';
        }
      }
    })();
  </script>

  ${opts.extraScripts ? `<script>${opts.extraScripts}</script>` : ''}
</body>
</html>`;
}

export function renderFeedbackCta(): string {
  return `
  <section style="background-color: ${colors.bgMuted}; padding: 40px 24px; text-align: center; border-radius: ${radius.lg}; margin: 48px auto; max-width: 720px; border: 1px solid ${colors.border};">
    <h3 style="font-size: 20px; font-weight: 700; color: ${colors.textPrimary}; margin-bottom: 8px;">💬 ご意見お待ちしています</h3>
    <p style="font-size: 14px; color: ${colors.textSecondary}; margin-bottom: 20px; line-height: 1.6;">
      早期開発中のサイトです。改善のヒントや感想をぜひお寄せください。
    </p>
    <a href="/messages" style="display: inline-flex; align-items: center; padding: 10px 24px; background-color: ${colors.textPrimary}; color: #ffffff; border-radius: ${radius.md}; font-size: 15px; font-weight: 500; text-decoration: none;">
      メッセージを送る
    </a>
  </section>
  `;
}
