# Changelog

## [v1.1.0] - 2026-05-30

### Added
- Sharing toggle now appears on the group dashboard even when logged out, as a friendly login entry. Visitors see the public/private switch; clicking it while logged out prompts for a login token. Only the authenticated owner can actually change visibility — privacy model unchanged.

## [v1.0.9] - 2026-05-29

### Changed
- CLI is now the standalone npm package `atologs` (forked from ccclub). All docs instruct `npx atologs`.
- CLI default endpoint is atologs.com.

### Added
- `atologs init` prints a pre-authenticated dashboard link so members can log in via browser and toggle public/private sharing.

## [v1.0.8] - 2026-05-26

### Added
- Official X (Twitter) account @atologs_jp linked from footer, twitter:site + twitter:creator meta tags for proper attribution on share cards, and JSON-LD sameAs for SEO entity disambiguation.

## [v1.0.7] - 2026-05-26

### Fixed
- Repo package.json name corrected from atolog_cc to atologs (matches public repo identity).
- CLI package.json homepage and repository URL now point to atologs.com and nagiworkshop/atologs.

## [v1.0.6] - 2026-05-26

### Fixed
- All in-page GitHub links now point to the public nagiworkshop/atologs repo (previously pointed to the private atolog_cc repo, which returned 404 for visitors).

### Added
- Custom GA4 event install_command_copy fired when users copy the install command from the landing page hero. Helps measure top-of-funnel conversion.

## [v1.0.5] - 2026-05-26

### Added
- SEO + GEO improvements: JSON-LD structured data (Schema.org WebSite, Organization, SoftwareApplication on landing; TechArticle on guide).
- Expanded sitemap.xml to cover /guide and /sample pages.
- Expanded llms.txt with use cases, key features, and competitive positioning for better LLM citation.
- Distinct meta descriptions per page (landing, guide, sample).

### Fixed
- /sample page canonical URL now correctly points to /sample instead of /g/SAMPLE.
- Typo in default meta description (个人 → 個人).
- llms.txt repo links now point to public nagiworkshop/atologs.

### Changed
- robots.txt and sitemap.xml now use dynamic request origin instead of hardcoded host.

## [v1.0.4] - 2026-05-26

### Added
- Google Analytics 4 tracking with the project owners own measurement ID. Site-wide coverage via base layout.

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
