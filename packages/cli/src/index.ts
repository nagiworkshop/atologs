import { Command, Option } from "commander";
import { initCommand } from "./commands/init.js";
import { joinCommand } from "./commands/join.js";
import { syncCommand } from "./commands/sync.js";
import { rankCommand } from "./commands/rank.js";
import { profileCommand } from "./commands/profile.js";
import { showDataCommand } from "./commands/show-data.js";
import { createGroupCommand } from "./commands/group.js";
import { leaveCommand } from "./commands/leave.js";
import { hookCommand } from "./commands/hook.js";
import { startUpdateCheck } from "./update-check.js";

declare const __VERSION__: string;
const VERSION = __VERSION__;
startUpdateCheck(VERSION);

const program = new Command();

// Keep the shorter -v alias while letting Commander own the standard -V/--version flags.
if (process.argv.slice(2).includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

program
  .name("atologs")
  .description("Claude Code, Codex, OpenCode, Amp, pi-agent の使用状況を友達と競い合うリーダーボード")
  .version(VERSION);

// Default command — just running `ccclub` shows the leaderboard
program
  .command("rank", { isDefault: true, hidden: true })
  .description("リーダーボードを表示")
  .option("-d, --days [days]", "集計期間: 1 | 7 | 30 | all (デフォルト: 今日)")
  .addOption(new Option("-p, --period [period]").hideHelp())
  .option("-g, --group <code>", "グループ招待コード")
  .option("--global", "グローバル公開ランキングを表示")
  .option("--cache", "キャッシュトークンを含めて集計")
  .option("--all", "アクティビティのないメンバーも含めて全員表示")
  .action(rankCommand);

// --- Setup (one-time) ---

program
  .command("init")
  .description("グループを作成して開始する（初回セットアップ）")
  .action(initCommand);

program
  .command("join")
  .description("6桁の招待コードでグループに参加")
  .argument("[invite-code]", "6桁の招待コード")
  .action((code: string | undefined) => {
    if (!code) {
      console.log(`\n  使用方法:  ccclub join <code>\n\n  例:\n    ccclub join YHAW6P\n\n  友達から6桁の招待コードを教えてもらうか、自分でグループを作成してください:\n    ccclub init\n`);
      return;
    }
    return joinCommand(code);
  });

// --- Regular use ---

program
  .command("sync")
  .description("ローカルのエージェント使用状況を今すぐアップロード（セットアップ後は自動同期も動作します）")
  .addOption(new Option("-s, --silent").hideHelp())
  .option("-f, --force", "ローカルの使用状況ログを再スキャンしてすべてアップロード")
  .addOption(new Option("--full", "Same as --force").hideHelp())
  .action((options: { silent?: boolean; full?: boolean; force?: boolean }) =>
    syncCommand({ ...options, full: options.full || options.force }),
  );

program
  .command("profile")
  .description("プロフィールの表示・更新")
  .option("-n, --name <name>", "表示名を設定")
  .option("--avatar <url>", "アバターURLを設定（空でリセット）")
  .option("--public", "プロフィールをグローバルランキングで公開")
  .option("--private", "グローバルランキングで非公開にする")
  .option("--plan <plan>", "pro ($20) | max100 ($100) | max200 ($200) | api | none")
  .option("--url <url>", "名前をURL（GitHub、ウェブサイトなど）とリンク")
  .action(profileCommand);

program
  .command("create")
  .description("グループを追加作成")
  .action(createGroupCommand);

program
  .command("leave")
  .description("グループから脱退")
  .argument("[code]", "グループ招待コード")
  .action((code: string | undefined) => leaveCommand(code));

program
  .command("show-data")
  .description("アップロードされるデータをプレビュー（プライバシー確認）")
  .action(showDataCommand);

// Internal — auto-installed, users don't need to run this
program
  .command("hook", { hidden: true })
  .description("自動同期フックを設定")
  .action(hookCommand);

program.addHelpText("after", `
セットアップ:
  ccclub init             グループを作成して自動同期を有効化
  ccclub join <code>      友達のグループに参加

対応エージェント:
  Claude Code, Codex, OpenCode, Amp, pi-agent

リーダーボードのオプション:
  -d <period>              集計期間: 1 | 7 | 30 | all (デフォルト: 今日)
  -g <code>                特定のグループを表示
  --global                 グローバル公開リーダーボード
  --cache                  キャッシュトークンを合計に含める
  --all                    アクティビティのないメンバーも全員表示

使用例:
  $ npx ccclub init        初回セットアップ
  $ ccclub                 今日のリーダーボードを表示 (デフォルト)
  $ ccclub -d 1|7|30|all   集計期間の指定 (デフォルト: 今日)
  $ ccclub --global        グローバル公開リーダーボードを表示
  $ ccclub show-data       アップロードされるデータの確認
`);

program.parse();
