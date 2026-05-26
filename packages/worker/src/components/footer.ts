import { colors, fontStack, fontSize, spacing, containers, VERSION } from '../design-tokens';

export function renderFooter(): string {
  return `
  <footer class="footer-shared">
    <div class="footer-container">
      <div class="footer-links">
        <a href="https://github.com/nagiworkshop/atologs" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span>·</span>
        <a href="https://x.com/atologs_jp" target="_blank" rel="noopener noreferrer">X (@atologs_jp)</a>
        <span>·</span>
        <a href="/guide">使い方</a>
        <span>·</span>
        <a href="/guide#about">このサイトについて</a>
        <span>·</span>
        <a href="/messages">みんなのメッセージ</a>
      </div>
      <div>AtoLogs ${VERSION.app} · CLI ${VERSION.cli} (<a href="https://github.com/nagiworkshop/atologs/releases" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Releases</a>) · MIT License</div>
      <div style="margin-top: ${spacing[1]}; opacity: 0.7;">Made with care by Nagi</div>
    </div>
  </footer>`;
}

export function footerStyles(): string {
  return `
    .footer-shared {
      background: ${colors.bgMuted};
      border-top: 1px solid ${colors.border};
      margin-top: ${spacing[12]};
      padding: ${spacing[8]} 0;
      font-size: ${fontSize.base};
      color: ${colors.textMuted};
      text-align: center;
      line-height: 1.6;
    }
    .footer-container {
      max-width: ${containers.wide};
      margin: 0 auto;
      padding: 0 ${spacing[4]};
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: ${spacing[4]};
      margin-bottom: ${spacing[2]};
      color: ${colors.textFaint};
    }
    .footer-shared a {
      color: ${colors.textMuted};
      text-decoration: none;
      transition: color 0.15s;
    }
    .footer-shared a:hover {
      color: ${colors.textPrimary};
    }
  `;
}
