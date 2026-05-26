import { colors, fontStack, fontSize, spacing, containers } from '../design-tokens';

export type ActivePage = 'home' | 'guide' | 'dashboard-group' | 'dashboard-global';

const ACTIVE_STYLE = `border-bottom: 2px solid ${colors.textPrimary}; padding-bottom: 4px; font-weight: 600; color: ${colors.textPrimary};`;

export function renderNav(active: ActivePage): string {
  const isHome = active === 'home';
  const isGuide = active === 'guide';
  const isGroup = active === 'dashboard-group';
  const isGlobal = active === 'dashboard-global';

  return `
  <header>
    <div class="header-container">
      <div class="logo-area">
        <a href="/" class="logo-link">
          <svg viewBox="0 0 114.21 112.52" fill="currentColor" style="width: 20px; height: 20px; flex-shrink: 0;" aria-hidden="true">
            <path d="M56.44,38.28c4.32-.09,8.55-.33,12.77-.23,7.46.18,14.72,1.57,21.64,4.44,7.59,3.15,14.03,7.76,18.48,14.83,2.63,4.18,4.19,8.74,4.68,13.66.5,5.04.07,9.98-1.55,14.8-2.13,6.32-5.97,11.43-11.1,15.62-6.18,5.06-13.38,7.91-21.08,9.64-.3.07-.86-.16-1.01-.42-3.08-5.32-6.12-10.67-9.22-16.1,2.04-.82,4.05-1.62,6.05-2.44,3.03-1.24,6.07-2.46,8.78-4.34,7.22-5,10.01-14.8,5.23-22.91-1.09-1.85-2.43-3.45-4.08-4.81-.56-.46-.81-.47-1.2.18-1.45,2.43-2.92,4.85-4.45,7.23-4.49,7-9.35,13.73-14.56,20.21-1.1,1.36-2.37,2.59-3.5,3.93-.26.31-.43.9-.34,1.29,1.04,4.78,2.13,9.54,3.21,14.31.05.22.07.45.12.78-7.72,1.52-15.43,3.03-23.22,4.56-.71-2.6-1.42-5.16-2.15-7.83-.59.16-1.15.29-1.7.46-5.9,1.83-11.91,2.78-18.09,2.41-4.35-.26-8.48-1.26-12.11-3.88-2.6-1.88-4.45-4.32-5.77-7.19C.48,92.59-.15,88.47.03,84.21c.16-3.65,1.07-7.12,2.46-10.48,2.52-6.07,6.49-11.1,11.35-15.45,5.7-5.1,12.03-9.32,18.59-13.21.75-.45,1.11-.91,1.09-1.86-.07-3.21-.03-6.42-.03-9.67-6.63-.43-13.36-.87-20.18-1.32.1-1.85.17-3.43.26-5.01.26-4.33.54-8.66.76-12.99.04-.85.37-1.02,1.16-.99,6.09.29,12.17.52,18.26.8.93.04,1.21-.26,1.33-1.19.52-4.1,1.15-8.19,1.74-12.29.02-.16.08-.31.14-.56,7.35.24,14.68.48,22.01.72-.58,4.06-1.15,8.04-1.74,12.18,8.78-1.08,17.23-2.45,25.76-4.42.48,6.06.95,12.02,1.42,18.09-1.25.28-2.42.58-3.6.8-7.87,1.42-15.74,2.82-23.61,4.26-.31.06-.8.45-.81.7-.07,1.92-.03,3.84-.02,5.77,0,.12.07.24.06.19ZM33.61,62.08c-.2.08-.33.11-.43.18-3.76,2.57-7.2,5.49-9.89,9.21-1.86,2.57-3.41,5.29-3.86,8.47-.49,3.46.14,6.6,3.13,8.86,1.32,1,2.87,1.31,4.48,1.36,3.29.11,6.36-.62,9.05-2.6.26-.19.51-.65.48-.95-.16-1.51-.45-3-.65-4.5-.57-4.52-1.14-9.05-1.67-13.57-.25-2.12-.42-4.25-.64-6.45ZM68.38,53.58c-.17-.08-.28-.17-.4-.19-3.75-.87-7.49-.7-11.21.17-.22.05-.52.51-.5.77.25,4.76.53,9.52.84,14.27.07,1.1.31,2.2.49,3.4,2.59-2.51,9.61-14.53,10.79-18.41Z"/>
          </svg>
          <span>AtoLogs</span>
        </a>
      </div>

      <nav class="desktop-nav">
        <a href="/"${isHome ? ` style="${ACTIVE_STYLE}"` : ''}>ホーム</a>
        <a class="nav-dashboard-link disabled"${isGroup ? ` style="${ACTIVE_STYLE}"` : ''}>ダッシュボード</a>
        <a href="/g/global"${isGlobal ? ` style="${ACTIVE_STYLE}"` : ''}>活用ログ</a>
        <a href="/guide"${isGuide ? ` style="${ACTIVE_STYLE}"` : ''}>使い方</a>
      </nav>

      <div class="right-nav">
        <a href="https://github.com/nagiworkshop/atologs" target="_blank" rel="noopener noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          <span class="github-txt">GitHub</span>
        </a>
      </div>
    </div>
  </header>`;
}

export function navStyles(): string {
  return `
    header {
      position: sticky;
      top: 0;
      z-index: 30;
      border-bottom: 1px solid ${colors.border};
      background: ${colors.bgWhite};
    }
    .header-container {
      max-width: ${containers.wide};
      margin: 0 auto;
      padding: 0 ${spacing[4]};
      height: ${spacing[14]};
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-area { display: flex; align-items: center; }
    .logo-area a.logo-link {
      display: flex;
      align-items: center;
      gap: ${spacing[2]};
      font-size: ${fontSize['2xl']};
      font-weight: 700;
      color: ${colors.textPrimary};
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .logo-area a.logo-link:hover { opacity: 0.8; }
    .desktop-nav { display: none; }
    @media (min-width: 768px) {
      .desktop-nav {
        display: flex;
        align-items: center;
        gap: ${spacing[6]};
      }
    }
    .desktop-nav a {
      font-size: ${fontSize.lg};
      color: ${colors.textSecondary};
      font-weight: 500;
      text-decoration: none;
      transition: color 0.15s;
    }
    .desktop-nav a:hover { color: ${colors.textPrimary}; }
    .nav-dashboard-link.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
    .right-nav {
      display: flex;
      align-items: center;
      gap: ${spacing[4]};
      font-size: ${fontSize.base};
      font-weight: 500;
      color: ${colors.textMuted};
    }
    .right-nav a {
      color: ${colors.textMuted};
      text-decoration: none;
      transition: color 0.15s;
      display: flex;
      align-items: center;
      gap: ${spacing[1.5]};
    }
    .right-nav a:hover { color: ${colors.textPrimary}; }
    .right-nav .github-txt { display: none; }
    @media (min-width: 640px) {
      .right-nav .github-txt { display: inline-block; }
    }
  `;
}
