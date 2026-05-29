import { Hono } from "hono";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

export const GUIDE_MARKDOWN = `# AtoLogs — クロードコード & コーディングエージェント リーダーボード

> チームや仲間内のクロードコード (Claude Code) などのコーディングエージェント利用状況リーダーボード。トークン数、費用、アクティブ状況、使用エージェントを可視化します。アカウント登録や設定は一切不要。

ウェブサイト: https://atologs.com
GitHub: https://github.com/nagiworkshop/atologs
Discord: https://discord.gg/6QbGWJUVHq

---

## クイックスタート

\`\`\`bash
# 1. 初期化 (グループを作成し、自動同期を有効にします)
npx atologs init

# 2. 招待リンクを仲間に共有する
#    (初期化後に表示されます — 例: https://atologs.com/invite/YHAW6P)

# 3. リーダーボードを表示する
atologs
\`\`\`

---

## インストールとセットアップ

\`\`\`bash
npx atologs init
\`\`\`

この1つのコマンドで以下が実行されます：
- 表示名の入力（git config から自動検出も可能）
- 6文字の招待コードを持つグループの作成
- マシン上の対応コーディングエージェントのログの検出
- 自動同期の設定
- \`atologs\` コマンドをグローバルにインストールし、次回から \`npx\` なしで実行可能にする

---

## 対応コーディングエージェント

atologs は以下のデフォルトのログ保存場所から自動的に使用データを検出します：

| エージェント | デフォルトのログ保存場所 |
|-------|------------------|
| Claude Code | \`~/.config/claude/projects\`, \`~/.claude/projects\` |
| Codex | \`~/.codex/sessions\` |
| OpenCode | \`~/.local/share/opencode\` |
| Amp | \`~/.local/share/amp/threads\` |
| pi-agent | \`~/.pi/agent/sessions\` |

デフォルトの場所を使用している場合は、設定は不要です。カスタムの場所を使用している場合は、環境変数 \`CLAUDE_CONFIG_DIR\`, \`CODEX_HOME\`, \`OPENCODE_DATA_DIR\`, \`AMP_DATA_DIR\`, \`PI_AGENT_DIR\` で指定可能です。

---

## 仲間の招待

初期化後、以下のような招待リンクが作成されます：

    https://atologs.com/invite/YHAW6P

This link should be shared on Slack, Discord, LINE, iMessage, etc. Opening this link displays:
- Group name and member count
- One-command join instructions
- Rich social cards (OGP) when shared on chat apps

招待された仲間は、以下のコマンドを実行して参加します：
\`\`\`bash
npx atologs join YHAW6P
\`\`\`

---

## リーダーボードの表示

### コマンドライン (CLI)
\`\`\`bash
atologs                  # 本日のリーダーボードを表示 (デフォルト)
atologs -d 1             # 昨日のデータ
atologs -d 7             # 過去7日間
atologs -d 30            # 過去30日間
atologs -d all           # 全期間
atologs --global         # グローバル公開リーダーボードを表示
atologs --all            # アクティビティのないメンバーを含む全員を表示
atologs -g XYZABC        # 指定したグループを表示
\`\`\`

### ウェブダッシュボード
すべてのグループは、以下のURLでウェブダッシュボードを閲覧できます：

    https://atologs.com/g/YHAW6P

機能：
- 料金、トークン、会話回数、会話単価、エージェント割合を含むリアルタイムリーダーボード
- サブスクリプションプランを設定しているメンバーの月間ROI算出
- アクティビティの時間推移を示すグラフ
- アクティブ状態のインジケーター
- 期間セレクター（今日、昨日、7日間、30日間、全期間）

### グローバルリーダーボード
公開プロフィールに設定したユーザーは、グローバルリーダーボードに表示されます：

    https://atologs.com/g/global

---

## コマンド一覧

| コマンド | 説明 |
|---------|-------------|
| \`atologs init\` | グループを作成して開始（初回セットアップ） |
| \`atologs join <コード>\` | 6文字の招待コードを使用してグループに参加 |
| \`atologs\` | 本日のリーダーボードを表示 |
| \`atologs -d 1\\|7\\|30\\|all\` | 集計期間 of specified period (Yesterday / 7 Days / 30 Days / All Time) |
| \`atologs --global\` | グローバル公開リーダーボードを表示 |
| \`atologs --all\` | アクティビティのないメンバーを含む全員を表示 |
| \`atologs create\` | 追加のグループを作成 |
| \`atologs leave [コード]\` | グループから脱退 |
| \`atologs sync\` | 手動でデータを同期（通常は自動でバックグラウンド実行されます） |
| \`atologs sync --force\` | ローカルログを再スキャンしてすべて再アップロード |
| \`atologs profile\` | プロフィールの表示 |
| \`atologs profile --name <名前>\` | 表示名の変更 |
| \`atologs profile --avatar <URL>\` | アバター画像のURLを設定 |
| \`atologs profile --public\` | グローバルランキングに表示する（公開） |
| \`atologs profile --private\` | グローバルランキングに表示しない（非公開） |
| \`atologs profile --plan pro\\|max100\\|max200\\|api\` | 契約中のサブスクリプションプランを設定（ROI計算用） |
| \`atologs profile --url <URL>\` | 表示名にリンクするURLを設定 |
| \`atologs show-data\` | アップロードされる生データをプレビュー（プライバシー確認用） |

---

## プロフィールとプラン設定

サブスクリプションプランを設定すると、リーダーボードで月間ROI（投資対効果）が表示されます：

\`\`\`bash
atologs profile --plan max200    # Claude Maxプラン ($200/月)
atologs profile --plan max100    # Claude Maxプラン ($100/月)
atologs profile --plan pro       # Claude Proプラン ($20/月)
atologs profile --plan api       # API利用ユーザー
\`\`\`

ROIは支払ったサブスク料金に対してどれだけ価値を得られたかを示します：\`$200/1610%\` は、$200のプランに対して $3,220 相当のエージェント利用を行ったことを意味します。

その他のプロフィールオプション：
\`\`\`bash
atologs profile --public         # グローバルリーダーボードに参加する
atologs profile --url https://github.com/ユーザー名
atologs profile --avatar https://example.com/photo.jpg
\`\`\`

---

## プライバシーについて

atologs は、エージェント名、トークン数、見積もり費用、モデル名、および実行回数のみをローカルログ（Claude Code、Codex、OpenCode、Amp、pi-agent）から読み取ります。

AtoLogs のソースコードは GitHub で公開されています。
私たちの言葉ではなく、コードそのものを読んでご判断ください。
→  https://github.com/nagiworkshop/atologs

**アップロードされない情報（絶対に送信されません）：**
- プロンプトや入力内容
- エージェントからの回答
- ソースコードやファイルの中身
- ファイルパスやプロジェクト名
- 会話ログ

\`atologs show-data\` を実行することで、アップロードされるデータを正確に確認できます。

---

## 同期の仕組み

- **自動同期**: \`atologs init\` を実行すると、Claude Code のセッション終了フックと、その他のエージェント用の軽量なバックグラウンド同期が設定されます。
- **手動同期**: \`atologs sync\` コマンドでいつでも同期できます。
- **フルスキャン**: \`atologs sync --force\` でローカルログを再スキャンできます。
- アップロード前に使用データは30分ごとのブロックに集計されます。

---

## 複数グループへの参加

複数のグループに同時に参加することができます：

\`\`\`bash
atologs create              # 新たなグループを作成する
atologs join XYZABC         # 仲間のグループに参加する
atologs -g XYZABC           # 特定のグループのリーダーボードを表示する
atologs leave XYZABC        # グループから脱退する
\`\`\`

\`atologs\` を引数なしで実行すると、参加しているすべてのグループのリーダーボードが一度に表示されます。

---

## ウェブ機能一覧

| URL | 説明 |
|-----|-------------|
| \`atologs.com\` | ランディングページ（このページ） |
| \`atologs.com/g/<CODE>\` | グループダッシュボード（リアルタイムリーダーボード & グラフ） |
| \`atologs.com/g/global\` | グローバル公開リーダーボード |
| \`atologs.com/invite/<CODE>\` | 招待ページ（仲間へ共有するリンク） |

---

## よくある質問 (FAQ)

**Q: AtoLogs はソースコードやプロンプトを読み取りますか？**
A: いいえ。対応しているコーディングエージェントの利用統計データ（トークン数、費用、モデル名等）のみをローカルログから読み取ります。

**Q: アカウント作成は必要ですか？**
A: 不要です。<code class="mono">npx atologs init</code> を実行するだけです。メールアドレスやパスワードの設定は不要です。

**Q: 自動同期はどのように動作しますか？**
A: Claude Code の終了時フックと、その他のエージェント用のバックグラウンドプロセスが自動同期します。手動での同期も可能です。

**Q: 各エージェントごとに個別設定は必要ですか？**
A: 不要です。デフォルトの保存先から自動的に検出されます。カスタムの場所にある場合のみ指定してください。

**Q: 複数のグループに参加できますか？**
A: はい。\`atologs create\` または \`atologs join <コード>\` で自由に追加できます。

**Q: 月間ROIとは何ですか？**
A: プラン（例: \`atologs profile --plan max200\`）を設定すると、支払っている月額料金に対してどれだけの金額分のエージェント利用を行ったかをパーセンテージで表示します。1610% は約16倍使ったことを意味します。

**Q: グローバルリーダーボードに表示するにはどうすればよいですか？**
A: \`atologs profile --public\` を実行します。使用データが atologs.com/g/global に公開されます。

**Q: データを削除するには？**
A: 全てのグループから脱退（\`atologs leave\`）し、ローカルの \`~/.ccclub/\` ディレクトリを削除してください。サーバー上のデータは一定期間後に失効し削除されます。

---

MIT License · https://github.com/nagiworkshop/atologs
`;

export const LLMS_TXT = `# AtoLogs

> Free open-source leaderboard tool for tracking coding agent (Claude Code, Codex, OpenCode, Amp, pi-agent) usage among friends and small teams. CLI auto-detects local agent logs, syncs to a shared dashboard with tokens, cost estimates, session counts, and active status. No account, no signup, MIT licensed.

## Who is this for

- Indie developers and small teams using Claude Code / Codex / other AI coding agents
- Friends sharing a private leaderboard to motivate consistent shipping
- Anyone curious about their own coding agent cost / token usage across multiple tools
- People who want a privacy-first alternative to centralized analytics dashboards

## Key features

- Auto-detects log files of Claude Code, Codex, OpenCode, Amp, pi-agent from default paths on macOS/Linux/Windows
- 6-character invite codes for private group leaderboards
- Public global leaderboard (opt-in only — privacy first, default opt-out)
- Token counts, estimated costs (USD), active status, agent mix per member
- One-line CLI install (\`npx atologs init\`), no signup
- Self-hostable (Cloudflare Workers + KV)

## How it differs from alternatives

- vs ccusage / claude-usage-monitor: AtoLogs is multi-user team-oriented, not single-user CLI
- vs Anthropic Console: AtoLogs covers multiple agents (Claude Code, Codex, OpenCode, Amp), not just Claude
- vs GitHub Copilot dashboards: covers terminal-based coding agents, not editor copilots

## Docs

- [Full Guide](https://atologs.com/llms-full.txt): Complete documentation for atologs CLI and web dashboard
- [Landing Page](https://atologs.com/): Product overview and quick start
- [Usage Guide](https://atologs.com/guide): Step-by-step instructions
- [Sample Dashboard](https://atologs.com/sample): Live demo with 3 sample members
- [Global Leaderboard](https://atologs.com/g/global): Live public leaderboard
- [GitHub](https://github.com/nagiworkshop/atologs): Source code, README in 7 languages

## API

- GET /api/health: Health check
- POST /api/init: Create user and group
- POST /api/join: Join a group
- POST /api/sync: Upload usage data
- POST /api/profile: Update user profile
- GET /api/profile: Get user profile
- POST /api/group/create: Create additional group
- POST /api/leave: Leave a group
- GET /api/rank/:code: Get group rankings
- GET /api/rank/global: Get global rankings
- GET /api/activity/:code: Get activity chart data

## Web Pages

- /: Landing page
- /guide: Usage guide and CLI instructions
- /sample: Demo dashboard with 3 sample members
- /g/:code: Group dashboard (live leaderboard + activity chart)
- /g/global: Global public leaderboard
- /invite/:code: Invite page with OG social cards
`;

app.get("/llms.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  const processed = LLMS_TXT
    .replaceAll("https://atologs.com", origin);
  return c.text(processed, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
});

app.get("/llms-full.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  const processed = GUIDE_MARKDOWN
    .replaceAll("https://atologs.com", origin)
    .replaceAll("npx atologs init", `npx cross-env CCCLUB_API_URL=${origin} npx atologs init`)
    .replaceAll("npx atologs join", `npx cross-env CCCLUB_API_URL=${origin} npx atologs join`)
    .replaceAll("atologs sync", `npx cross-env CCCLUB_API_URL=${origin} atologs sync`)
    .replaceAll("atologs profile", `npx cross-env CCCLUB_API_URL=${origin} atologs profile`)
    .replaceAll("atologs show-data", `npx cross-env CCCLUB_API_URL=${origin} atologs show-data`)
    .replaceAll("atologs leave", `npx cross-env CCCLUB_API_URL=${origin} atologs leave`);
  return c.text(processed, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
});

export { app as guideRoute };
