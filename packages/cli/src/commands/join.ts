import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, saveConfig, generateDeviceToken, getApiUrl, getDefaultDisplayName } from "../config.js";
import { installHook } from "../hook.js";
import { doSync } from "./sync.js";
import { ensureGlobalInstall } from "../global-install.js";
import { formatFetchError } from "../fetch-error.js";
import type { JoinResponse } from "@ccclub/shared";

export async function joinCommand(inviteCode: string): Promise<void> {
  let config = await loadConfig();
  const apiUrl = getApiUrl();
  let token: string;
  let displayName: string;

  if (config) {
    token = config.token;
    displayName = config.displayName;
  } else {
    // New user, ask for name (with auto-detected default)
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const defaultName = getDefaultDisplayName();
      const prompt = defaultName
        ? chalk.bold(`表示名 (${defaultName}): `)
        : chalk.bold("表示名: ");
      const input = await rl.question(prompt);
      displayName = input.trim() || defaultName || "";
      if (!displayName) {
        console.error(chalk.red("表示名は空にできません。"));
        return;
      }
    } finally {
      rl.close();
    }
    token = generateDeviceToken();
  }

  const spinner = ora("グループに参加中...").start();

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, displayName, inviteCode }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    spinner.fail(`グループ参加に失敗しました: ${formatFetchError(err)}`);
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    spinner.fail(`グループ参加に失敗しました: ${(err as { error: string }).error}`);
    return;
  }

  const data = (await res.json()) as JoinResponse;

  // Save / update config
  if (config) {
    if (!config.groups.includes(data.groupCode)) {
      config.groups.push(data.groupCode);
    }
    await saveConfig(config);
  } else {
    await saveConfig({
      apiUrl,
      token,
      userId: data.userId,
      displayName,
      groups: [data.groupCode],
    });
    await installHook();
  }

  spinner.succeed(`グループ「${data.groupName}」に参加しました！`);

  // First sync if new user
  if (!config) {
    console.log("");
    await doSync(true);
    // Auto-install globally so `ccclub` works without npx
    await ensureGlobalInstall();
  }

  console.log("");
  console.log(chalk.dim("  リーダーボードを表示するには ") + chalk.white("ccclub") + chalk.dim(" を実行してください。すべてのコマンドを確認するには ") + chalk.white("ccclub -h") + chalk.dim(" を実行してください。"));
  console.log("");
}
