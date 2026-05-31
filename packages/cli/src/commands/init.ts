import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, saveConfig, generateDeviceToken, getApiUrl, getDefaultDisplayName } from "../config.js";
import { installHook, isHookInstalled } from "../hook.js";
import { installHeartbeat, isHeartbeatInstalled } from "../heartbeat.js";
import { doSync } from "./sync.js";
import { ensureGlobalInstall } from "../global-install.js";
import { formatFetchError } from "../fetch-error.js";
import { theme } from "../theme.js";
import type { InitResponse } from "@ccclub/shared";

export async function initCommand(): Promise<void> {
  const existing = await loadConfig();
  if (existing) {
    console.log(chalk.yellow("すでに初期化されています！"));
    console.log(`  ユーザー: ${existing.displayName}`);
    console.log(`  参加グループ: ${existing.groups.join(", ") || "(なし)"}`);
    // Ensure hook is installed for users who initialized before hook support
    if (!isHookInstalled()) {
      const hookOk = await installHook();
      if (hookOk) console.log(chalk.green("  自動同期フックがインストールされました！"));
    }
    if (!isHeartbeatInstalled()) {
      const heartbeatOk = await installHeartbeat();
      if (heartbeatOk) console.log(chalk.green("  バックグラウンド同期がインストールされました！"));
    }
    console.log(chalk.dim('\n  "ccclub" を実行してリーダーボードを表示します'));
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const defaultName = getDefaultDisplayName();
    const prompt = defaultName
      ? chalk.bold(`表示名 (${defaultName}): `)
      : chalk.bold("表示名: ");
    const input = await rl.question(prompt);
    const displayName = input.trim() || defaultName || "";
    if (!displayName) {
      console.error(chalk.red("表示名は空にできません。"));
      return;
    }

    const spinner = ora("セットアップ中...").start();

    const token = generateDeviceToken();
    const apiUrl = getApiUrl();

    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, displayName }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      spinner.fail(`セットアップに失敗しました: ${formatFetchError(err)}`);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      spinner.fail(`セットアップに失敗しました: ${(err as { error: string }).error}`);
      return;
    }

    const data = (await res.json()) as InitResponse;

    await saveConfig({
      apiUrl,
      token,
      userId: data.userId,
      displayName: displayName.trim(),
      groups: [data.groupCode],
    });

    // Install Claude Code hook and background sync (silent, best-effort)
    const [hookOk, heartbeatOk] = await Promise.all([
      installHook(),
      installHeartbeat(),
    ]);
    spinner.succeed("ccclub が初期化されました！");

    if (!hookOk) {
      console.log(chalk.dim('  ヒント: 自動同期を設定するには "ccclub hook" を実行してください'));
    }
    if (!heartbeatOk) {
      console.log(chalk.dim('  ヒント: クロード以外のエージェント使用状況を更新するには "ccclub sync" を手動で実行してください'));
    }
    console.log("");
    console.log(chalk.bold("  ログインリンク（コピーしてブラウザで開くと、以降は自動でログインします）:"));
    console.log("");
    console.log(`    ${theme.link(`${apiUrl}/g/${data.groupCode}?token=${token}`)}`);
    console.log("");
    console.log(chalk.dim(`    ダッシュボードのURL: ${apiUrl}/g/${data.groupCode}`));
    console.log(chalk.dim("    ※ ダッシュボードから公開／非公開を自分で切り替えられます"));
    console.log(chalk.yellow("    ⚠ このリンクは認証情報を含みます。他人に共有しないでください"));
    console.log("");
    console.log(chalk.bold("  友達を招待して競い合いましょう:"));
    console.log("");
    console.log(`    ${theme.link(`${apiUrl}/invite/${data.groupCode}`)}`);
    console.log("");
    console.log(chalk.dim(`    または: npx atologs join ${data.groupCode}`));

    // First sync
    console.log("");
    await doSync(true);

    // Auto-install globally so `ccclub` works without npx
    await ensureGlobalInstall();

    printQuickStart();

  } finally {
    rl.close();
  }
}

function printQuickStart(): void {
  console.log("");
  console.log(chalk.dim("  リーダーボードを表示するには ") + theme.text("ccclub") + chalk.dim(" を実行してください。すべてのコマンドを確認するには ") + theme.text("ccclub -h") + chalk.dim(" を実行してください。"));
  console.log("");
}
