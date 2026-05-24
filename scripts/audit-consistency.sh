#!/usr/bin/env bash
# AtoLogs 跨页一致性 audit 脚本
# 用法：bash scripts/audit-consistency.sh [domain]
# 默认 domain = atologs.com
# 例：bash scripts/audit-consistency.sh pre.atologs.com

set -e

DOMAIN="${1:-atologs.com}"
BASE="https://${DOMAIN}"
PAGES=("/" "/guide" "/g/global" "/g/ZL3P92")

echo "================================================"
echo "  AtoLogs 跨页一致性审计 · ${DOMAIN}"
echo "  时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

FAIL_COUNT=0

# --- 测试 1：4 页 <header> 都是空标签 ---
echo ""
echo "🔍 测试 1：<header> 必须是空标签"
for url in "${PAGES[@]}"; do
  hdr=$(curl -s "${BASE}${url}" | grep -oE '<header[^>]*>' | head -1)
  if [ "$hdr" = "<header>" ]; then
    echo "  ✅ ${url} : ${hdr}"
  else
    echo "  ❌ ${url} : ${hdr}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 2：4 页 <style> 数 = 1 ---
echo ""
echo "🔍 测试 2：<style> 块数应该 = 1（不许在页面文件加额外 <style>）"
for url in "${PAGES[@]}"; do
  cnt=$(curl -s "${BASE}${url}" | grep -c '<style')
  if [ "$cnt" = "1" ]; then
    echo "  ✅ ${url} : ${cnt}"
  else
    echo "  ❌ ${url} : ${cnt} 个 <style> 块（违反规则）"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 3：4 页 nav 链接顺序完全相同 ---
echo ""
echo "🔍 测试 3：4 页 nav 链接顺序必须一致（ホーム / ダッシュボード / 活用ログ / 使い方）"
for url in "${PAGES[@]}"; do
  links=$(curl -s "${BASE}${url}" | awk '/<nav class="desktop-nav"/,/<\/nav>/' | grep -oE '>[^<]+</a>' | tr '\n' '|' | head -c 100)
  echo "  ${url} : ${links}"
done
echo "  （上面 4 行应该完全相同 — 顺序：ホーム → ダッシュボード → 活用ログ → 使い方）"

# --- 测试 4：4 页 GitHub SVG 完全一致 ---
echo ""
echo "🔍 测试 4：4 页 GitHub SVG 必须包含 width=\"18\" height=\"18\""
for url in "${PAGES[@]}"; do
  hits=$(curl -s "${BASE}${url}" | awk '/<div class="right-nav"/,/<\/div>/' | grep -c 'width="18" height="18"')
  if [ "$hits" -ge "1" ]; then
    echo "  ✅ ${url} : ${hits} 处"
  else
    echo "  ❌ ${url} : ${hits} 处（应该 ≥ 1）"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 5：4 页 footer rel="noopener noreferrer" 完整覆盖 ---
echo ""
echo "🔍 测试 5：所有 target=\"_blank\" 必须配 rel=\"noopener noreferrer\""
for url in "${PAGES[@]}"; do
  blank=$(curl -s "${BASE}${url}" | grep -c 'target="_blank"')
  ref=$(curl -s "${BASE}${url}" | grep -c 'rel="noopener noreferrer"')
  if [ "$ref" -ge "$blank" ]; then
    echo "  ✅ ${url} : target=_blank=${blank}, noopener=${ref}"
  else
    echo "  ❌ ${url} : target=_blank=${blank}, noopener=${ref}（不够）"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 6：每页 active 高亮在正确位置 ---
echo ""
echo "🔍 测试 6：每页 active 高亮位置"
for url in "${PAGES[@]}"; do
  active=$(curl -s "${BASE}${url}" | awk '/<nav class="desktop-nav"/,/<\/nav>/' | grep 'border-bottom' | grep -oE '>[^<]+</a>' | head -1)
  if [ -n "$active" ]; then
    echo "  ✅ ${url} : active = ${active}"
  else
    echo "  ❌ ${url} : 找不到 active 高亮"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 7：HTTP 状态 ---
echo ""
echo "🔍 测试 7：4 页 HTTP 状态必须 200"
for url in "${PAGES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${url}" --max-time 10)
  if [ "$code" = "200" ]; then
    echo "  ✅ ${url} : ${code}"
  else
    echo "  ❌ ${url} : ${code}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 测试 8：API endpoint 健康 ---
echo ""
echo "🔍 测试 8：核心 API endpoint 健康"
for ep in /api/health /api/version /api/rank/global; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${ep}" --max-time 10)
  if [ "$code" = "200" ]; then
    echo "  ✅ ${ep} : ${code}"
  else
    echo "  ❌ ${ep} : ${code}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# --- 汇总 ---
echo ""
echo "================================================"
if [ "$FAIL_COUNT" = "0" ]; then
  echo "  ✅ 全部通过 · 跨页一致性 OK"
  echo "================================================"
  exit 0
else
  echo "  ❌ 发现 ${FAIL_COUNT} 个问题"
  echo "  → 不许声称'重构完成'，先修复以上失败项"
  echo "================================================"
  exit 1
fi
