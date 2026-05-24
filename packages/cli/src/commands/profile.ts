import chalk from "chalk";
import ora from "ora";
import type { ProfileResponse } from "@ccclub/shared";
import { PLAN_LABELS } from "@ccclub/shared";
import { requireConfig, saveConfig } from "../config.js";
import { formatFetchError } from "../fetch-error.js";

export async function profileCommand(options: {
  name?: string;
  avatar?: string;
  public?: boolean;
  private?: boolean;
  plan?: string;
  url?: string;
}): Promise<void> {
  const config = await requireConfig();

  const hasUpdate = options.name !== undefined || options.avatar !== undefined || options.public || options.private || options.plan !== undefined || options.url !== undefined;

  if (!hasUpdate) {
    // Show current profile
    const spinner = ora("プロフィールを取得中...").start();
    try {
      const res = await fetch(`${config.apiUrl}/api/profile`, {
        headers: { Authorization: `Bearer ${config.token}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        spinner.fail("プロフィールの取得に失敗しました");
        return;
      }
      const profile = (await res.json()) as ProfileResponse;
      spinner.stop();

      console.log(chalk.bold("\n  あなたのプロフィール"));
      console.log(`  名前:       ${profile.displayName}`);
      console.log(`  アバター:   ${profile.avatar || chalk.dim("(デフォルト)")}`);
      console.log(`  公開設定:   ${profile.visibility === "public" ? chalk.green("公開") : chalk.dim("非公開")}`);
      console.log(`  プラン:     ${profile.plan ? PLAN_LABELS[profile.plan as keyof typeof PLAN_LABELS] || profile.plan : chalk.dim("(未設定)")}`);
      console.log(`  URL:        ${profile.url || chalk.dim("(未設定)")}`);
      console.log();
      console.log(chalk.dim("  更新コマンド: ccclub profile --name <名前> --avatar <画像URL> --plan <プラン>"));
      console.log();
    } catch (err) {
      spinner.fail(`エラー: ${formatFetchError(err)}`);
    }
    return;
  }

  // Validate plan
  const validPlans = ["pro", "max100", "max200", "api"];
  if (options.plan !== undefined) {
    const p = options.plan.toLowerCase();
    if (p && p !== "none" && !validPlans.includes(p)) {
      console.log(chalk.red(`\n  無効なプラン: "${options.plan}"`));
      console.log(chalk.dim("  有効なオプション: ") + chalk.white("pro") + chalk.dim(" ($20), ") + chalk.white("max100") + chalk.dim(" ($100), ") + chalk.white("max200") + chalk.dim(" ($200), ") + chalk.white("api"));
      console.log(chalk.dim("  プランをクリアするには: ") + chalk.white('ccclub profile --plan none'));
      return;
    }
  }

  // Build update payload
  const body: Record<string, string> = {};
  if (options.name !== undefined) body.displayName = options.name;
  if (options.avatar !== undefined) body.avatar = options.avatar;
  if (options.public) body.visibility = "public";
  if (options.private) body.visibility = "private";
  if (options.plan !== undefined) body.plan = options.plan === "none" ? "" : options.plan;
  if (options.url !== undefined) body.url = options.url;

  const spinner = ora("プロフィールを更新中...").start();
  try {
    const res = await fetch(`${config.apiUrl}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      spinner.fail("プロフィールの更新に失敗しました");
      return;
    }

    const profile = (await res.json()) as ProfileResponse;
    spinner.stop();

    // Update local config if displayName changed
    if (body.displayName && body.displayName !== config.displayName) {
      config.displayName = body.displayName;
      await saveConfig(config);
    }

    console.log(chalk.green("\n  プロフィールを更新しました！"));
    console.log(`  名前:       ${profile.displayName}`);
    console.log(`  アバター:   ${profile.avatar || chalk.dim("(デフォルト)")}`);
    console.log(`  公開設定:   ${profile.visibility === "public" ? chalk.green("公開") : chalk.dim("非公開")}`);
    console.log(`  プラン:     ${profile.plan ? PLAN_LABELS[profile.plan as keyof typeof PLAN_LABELS] || profile.plan : chalk.dim("(未設定)")}`);
    console.log(`  URL:        ${profile.url || chalk.dim("(未設定)")}`);
    console.log();
  } catch (err) {
    spinner.fail(`エラー: ${formatFetchError(err)}`);
  }
}
