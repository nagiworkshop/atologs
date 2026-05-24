import chalk from "chalk";
import { AGENT_LABELS } from "@ccclub/shared";
import { collectUsageEntries } from "../collector.js";
import { aggregateToBlocks } from "../aggregator.js";

export async function showDataCommand(): Promise<void> {
  console.log(chalk.bold("\n  ccclub がアップロードするデータについて:\n"));
  console.log(chalk.dim("  30分単位で集計された概要データのみが送信されます。会話内容、"));
  console.log(chalk.dim("  ファイルパス、プロジェクト名、詳細なセッション情報は一切送信されません。\n"));

  const { entries, humanTurns, sources, warnings } = await collectUsageEntries();
  const blocks = aggregateToBlocks(entries, humanTurns);

  if (blocks.length === 0) {
    console.log(chalk.yellow("  サポートされているエージェントの使用履歴が見つかりませんでした。"));
    for (const warning of warnings) console.log(chalk.dim(`  ${warning}`));
    return;
  }

  console.log(chalk.dim(`  検出された履歴数: ${entries.length}`));
  console.log(chalk.dim(`  集計されたブロック数: ${blocks.length}個\n`));
  console.log(chalk.bold("  エージェント別集計:\n"));
  for (const source of sources.filter((s) => s.entries.length > 0)) {
    console.log(chalk.dim(`    ${AGENT_LABELS[source.source]}: ${source.entries.length.toLocaleString()} 件の履歴（${source.files.toLocaleString()}個のファイル/レコードから）`));
  }
  console.log("");

  // Show last 5 blocks as example
  const recent = blocks.slice(-5);
  console.log(chalk.bold("  直近の5つのブロック（実際に送信されるデータ形式）:\n"));

  for (const block of recent) {
    console.log(chalk.cyan(`  ${AGENT_LABELS[block.source ?? "claude"]} · ${block.blockStart.slice(0, 16)} → ${block.blockEnd.slice(11, 16)}`));
    console.log(chalk.dim(`    input: ${block.inputTokens.toLocaleString()}  output: ${block.outputTokens.toLocaleString()}  cache_create: ${block.cacheCreationTokens.toLocaleString()}  cache_read: ${block.cacheReadTokens.toLocaleString()}`));
    if (block.reasoningTokens) {
      console.log(chalk.dim(`    reasoning: ${block.reasoningTokens.toLocaleString()}`));
    }
    console.log(chalk.dim(`    cost: $${block.costUSD.toFixed(4)}  calls: ${block.entryCount}  turns: ${block.chatCount || 0}  models: ${block.models.join(", ")}`));
  }

  const totalInput = blocks.reduce((s, b) => s + b.inputTokens, 0);
  const totalOutput = blocks.reduce((s, b) => s + b.outputTokens, 0);
  const totalReasoning = blocks.reduce((s, b) => s + (b.reasoningTokens || 0), 0);
  const totalCache = blocks.reduce((s, b) => s + b.cacheCreationTokens + b.cacheReadTokens, 0);
  const totalCost = blocks.reduce((s, b) => s + b.costUSD, 0);
  console.log(chalk.bold(`\n  累計: ${(totalInput + totalOutput + totalReasoning).toLocaleString()} 非キャッシュトークン · $${totalCost.toFixed(2)}`));
  console.log(chalk.dim(`    input: ${totalInput.toLocaleString()}  output: ${totalOutput.toLocaleString()}  reasoning: ${totalReasoning.toLocaleString()}  cache: ${totalCache.toLocaleString()}`));
}
