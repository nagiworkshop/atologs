import { exec } from "node:child_process";
import chalk from "chalk";
import { theme } from "./theme.js";

function run(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => resolve(err ? "" : stdout.trim()));
  });
}

/**
 * Check if `ccclub` is globally installed (not just available via npx).
 * If not, install it globally so users can run `ccclub` directly.
 */
export async function ensureGlobalInstall(): Promise<void> {
  // Check npm global list, not PATH (npx temporarily adds to PATH)
  const globalList = await run("npm list -g ccclub --depth=0");
  if (globalList.includes("ccclub@")) return;

  console.log(chalk.dim("\n  直接実行できるように、ccclub をグローバルにインストールしています..."));

  const result = await run("npm install -g ccclub");
  if (result) {
    console.log(theme.success("  完了しました！") + chalk.dim("これで直接 ") + theme.text("ccclub") + chalk.dim(" を使用できます。"));
  } else {
    console.log(chalk.dim("  自動インストールできませんでした。手動で実行してください："));
    console.log(theme.text("    npm install -g ccclub"));
  }
}
