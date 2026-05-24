import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import ora from "ora";
import type { LeaveResponse } from "@ccclub/shared";
import { requireConfig, saveConfig } from "../config.js";
import { formatFetchError } from "../fetch-error.js";

export async function leaveCommand(code?: string): Promise<void> {
  const config = await requireConfig();

  if (config.groups.length === 0) {
    console.log(chalk.yellow("  どのグループにも参加していません。"));
    return;
  }

  // Determine which group to leave
  let targetCode: string;
  if (code) {
    targetCode = code.toUpperCase();
    if (!config.groups.includes(targetCode)) {
      console.log(chalk.red(`  グループ ${targetCode} に参加していません。`));
      return;
    }
  } else if (config.groups.length === 1) {
    targetCode = config.groups[0];
  } else {
    // Multiple groups — ask which one
    console.log(chalk.bold("\n  参加中のグループ:\n"));
    for (let i = 0; i < config.groups.length; i++) {
      console.log(`    ${i + 1}. ${config.groups[i]}`);
    }
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const input = await rl.question(chalk.bold("\n  どのグループから脱退しますか？（番号）: "));
      const idx = parseInt(input.trim(), 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= config.groups.length) {
        console.log(chalk.red("  選択肢が無効です。"));
        return;
      }
      targetCode = config.groups[idx];
    } finally {
      rl.close();
    }
  }

  // Confirm before leaving
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(chalk.bold(`  グループ ${targetCode} から脱退しますか？ [y/N] `));
    if (answer.trim().toLowerCase() !== "y") {
      console.log(chalk.dim("  キャンセルされました。"));
      return;
    }
  } finally {
    rl.close();
  }

  const spinner = ora("グループから脱退中...").start();

  try {
    const res = await fetch(`${config.apiUrl}/api/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ inviteCode: targetCode }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      spinner.fail(`失敗しました: ${(err as { error: string }).error}`);
      return;
    }

    const data = (await res.json()) as LeaveResponse;

    // Remove from local config
    config.groups = config.groups.filter((g) => g !== targetCode);
    await saveConfig(config);

    spinner.succeed(`グループ「${data.groupName}」から脱退しました`);
  } catch (err) {
    spinner.fail(`失敗しました: ${formatFetchError(err)}`);
  }
}
