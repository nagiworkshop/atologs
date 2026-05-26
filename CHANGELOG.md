# Changelog

## [v1.0.2] - 2026-05-26

### Added
- Site-wide Google Analytics (GA4) coverage. GA snippet moved from dashboard pages only to base layout, so all pages (home, guide, messages, login, leaderboards) now report to GA.

## [v1.0.1] - 2026-05-26

### Changed
- Replace emoji favicon with AtoLogs logo SVG.

## [v1.0.0] - 2026-05-24

### Released
- Initial public release of AtoLogs.
- Forked from [mazzzystar/ccclub](https://github.com/mazzzystar/ccclub) (MIT) with extended moderation, admin authorization, and branding for atologs.com.
- Features:
  - Coding agent token usage leaderboards (Claude / Codex / OpenCode / Amp / pi-agent)
  - 6-letter group invite codes (security by obscurity)
  - Public messages wall with admin moderation
  - Admin login page with rate-limited session cookie auth
  - Multi-language READMEs (EN / 中 / 日 / 한 / DE / FR / ES)

### Tech Stack
- Cloudflare Workers (Hono framework)
- Cloudflare KV (data persistence)
- Vanilla SSR + minimal client-side hydration
