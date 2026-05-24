# CLAUDE.md


## 维护 5 条铁律（长期生效）

1. **任何 AI 进项目** → 必须读 `CLAUDE.md` + `REDESIGN_SPEC.md`
2. **任何 AI 说"做完了"** → 必须跑 `bash scripts/audit-consistency.sh` 并通过
3. **怀疑视觉崩了** → 跑 `audit` 脚本，5 秒能知道结果
4. **加新功能** → 先看 `design-tokens.ts` 有没有相关 token
5. **AI 想加新颜色/字号** → 必须先扩充 `design-tokens.ts`，再在页面中引用

---

## 网站维护细则（2026-05-21 重做后）

> 所有 AI 维护者（Gemini / Claude / Cursor / 其他）进入项目第一件事必须读完本文件。

### A · 前端改动 5 条细则

1. **颜色 / 字号 / 间距 / 圆角** → 必须从 `packages/worker/src/design-tokens.ts` 导入。**禁止硬编码 hex 颜色或 px 数值**。
2. **Header / Nav / Footer / BottomNav** → 必须由 `packages/worker/src/components/layout.ts` 提供的 `renderLayout()` 渲染。**禁止在页面文件里手写**。
3. **新页面创建** → 必须用 `renderLayout(opts)` 包裹整页骨架。
4. **页面文件里禁止**：
   - 写 `<!DOCTYPE>` `<html>` `<head>` `<body>` 骨架
   - 写 `<header>` `<footer>` `<nav class="bottom-nav">`
   - 写 `<script src="https://cdn.tailwindcss.com">` 或类似 CDN 引用
   - 加大段 `<style>` 块（仅允许业务特定 `extraStyles`，且不许覆盖 nav/footer/bottom-nav 选择器）
5. **新组件 / 新 design token** → 必须先扩展 `design-tokens.ts` 或 `components/`，再在页面里 import 使用。**禁止"临时硬编码以后再说"**。

### B · 完成任何 AI 改动后必须做的事

1. **跑 audit 脚本**：
   ```bash
   bash scripts/audit-consistency.sh atologs.com
   ```
   必须全部通过（exit code 0），才算"做完了"。
2. **不许用 localhost 验证**：所有验证必须 curl 真实生产 URL。
3. **不许"声称完成"**：除非 audit 脚本全过 + 实际输出已贴给用户。

### C · 加新功能 / 新页面流程

```
Step 1: 读 REDESIGN_SPEC.md 中相关章节
Step 2: 确认新需求是否需要新 design-token / 新 component
        如果需要 → 先扩展 design-tokens.ts 或 components/
        如果不需要 → 直接用现有的
Step 3: 写新页面文件 = 调用 renderLayout({...}) + 主体内容 + extraStyles（仅业务）
Step 4: 部署到 pre.atologs.com 验证
Step 5: bash scripts/audit-consistency.sh pre.atologs.com 全过
Step 6: 部署到 atologs.com
Step 7: bash scripts/audit-consistency.sh atologs.com 全过
Step 8: 通知用户完成（附 audit 实际输出）
```

### D · AI 工具切换说明

无论是 Gemini / Claude / Cursor / 其他 AI 维护本项目，进入项目第一件事：

1. 读 `CLAUDE.md`（本文件）
2. 读 `REDESIGN_SPEC.md`
3. 在执行任何代码改动前 echo："I have read REDESIGN_SPEC and will follow the 5 rules."

### E · 违反铁律的后果

违反任一条 = 项目会重新出现"4 页样式各写各的"病灶。
2026-05-21 之前 N 次返工就是因为没有这套铁律。

如果你（AI）觉得现有铁律阻碍了你完成任务，**停下来告诉用户，让用户决定是否修改铁律**，不许擅自绕过。

### F · 引用文档

- 项目章程：`REDESIGN_SPEC.md`
- 长期维护检查脚本：`scripts/audit-consistency.sh`
- 设计 token 单一真理源：`packages/worker/src/design-tokens.ts`
- 共享 layout：`packages/worker/src/components/layout.ts`
