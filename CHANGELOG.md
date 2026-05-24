# Changelog

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
