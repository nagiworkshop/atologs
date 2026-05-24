import { colors, fontSize, spacing } from '../design-tokens';
import type { ActivePage } from './nav';

export function renderBottomNav(active: ActivePage): string {
  return `
  <nav class="bottom-nav" aria-label="Mobile navigation">
    <a href="/"${active === 'home' ? ' class="active"' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 9v11h14V9"/></svg>
      <span>ホーム</span>
    </a>
    <a class="bottom-nav-dashboard-link disabled"${active === 'dashboard-group' ? ' class="active"' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="3" height="8" rx="0.5"/><rect x="10.5" y="7" width="3" height="13" rx="0.5"/><rect x="17" y="3" width="3" height="17" rx="0.5"/></svg>
      <span>ダッシュボード</span>
    </a>
    <a href="/g/global"${active === 'dashboard-global' ? ' class="active"' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
      <span>活用ログ</span>
    </a>
    <a href="/guide"${active === 'guide' ? ' class="active"' : ''}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3V4z"/><path d="M4 17a3 3 0 013-3h12"/></svg>
      <span>使い方</span>
    </a>
  </nav>`;
}

export function bottomNavStyles(): string {
  return `
    .bottom-nav { display: none; }
    @media (max-width: 767px) {
      .bottom-nav {
        display: flex;
        justify-content: space-around;
        align-items: center;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 40;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-top: 1px solid ${colors.border};
        padding-bottom: env(safe-area-inset-bottom);
      }
      .bottom-nav a {
        flex: 1;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: ${spacing[1]}; height: ${spacing[14]};
        font-size: ${fontSize.sm}; color: ${colors.textSecondary};
        text-decoration: none; transition: color 0.15s;
      }
      .bottom-nav a.active {
        color: ${colors.accent};
        background: ${colors.bg};
      }
      .bottom-nav a.bottom-nav-dashboard-link.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    }
  `;
}
