# AtoLogs · Analytics 架构

atologs.com 的埋点参考 + 运维手册。配方借鉴自姊妹项目 mirai-shigoto 的 `ANALYTICS.md`，但架构改为 **Cloudflare Worker + Hono**（非 Astro/Vercel）——worker 本身就是 SSR + 边缘，所以服务端 Measurement Protocol 比 middleware 更顺手。

---

## 追踪器清单

| 追踪器 | 作用 | 客户端 | 服务端 | 凭证 |
|---|---|---|---|---|
| **GA4（客户端 gtag）** | 主产品分析 | `gtag/js?id=G-EVZ3ZQNZD5`（`components/layout.ts` head）| `g/collect` | 硬编码 ID |
| **GA4（服务端 MP）** | 抗 Tracking-Prevention 兜底 + 服务端独有转化 | （无）| `mp/collect`（`ga-mp.ts`，由 `index.ts` 中间件 + `usage.ts` 调用）| `GA4_MP_API_SECRET` |
| **X(Twitter) Ads pixel** | 广告转化归因 / 再营销 | `static.ads-twitter.com/uwt.js`（`layout.ts`，wired `X_PIXEL_ID`）| `analytics.twitter.com` | `X_PIXEL_ID` 常量 |
| Cloudflare Web Analytics | （可选二次源，未启用）| `cloudflareinsights.com/beacon.min.js` | — | — |

> CSP 用 `script-src 'self' 'unsafe-inline' https:` + `connect-src 'self' https:`（`index.ts` 安全头中间件），已覆盖以上全部 https 源——**新增 https 追踪器无需改 CSP**。

---

## 各部件配线

```
components/layout.ts（renderLayout — 唯一页面骨架，所有页面必经）
  · GA4 gtag 片段（G-EVZ3ZQNZD5）
  · window.track(name, params) helper —— 统一发 gtag 事件
  · X Ads pixel 片段（仅 X_PIXEL_ID 非空时渲染）
  → 所有走 renderLayout 的页面都输出

ga-mp.ts（GA4 Measurement Protocol 服务端发送器）
  · sendMpEvents(env, clientId, events, userId?) —— 缺 secret 静默 no-op，绝不抛错
  · gaClientIdFromRequest(req) —— 从 _ga cookie 取 client_id（与客户端对齐，避免幽灵用户）
  · gaClientIdForUser(userId) —— 服务端独有事件的确定性合成 client_id
  · isLikelyBot(ua) —— 爬虫过滤

index.ts（Hono 全局中间件）
  · 每个 HTML GET 导航 → c.executionCtx.waitUntil(MP page_view{ssrc:'worker'})
  · 非阻塞、bot 过滤、仅有 _ga cookie 时发、排除 /api 与静态资源

routes/usage.ts
  · 用户首次成功 sync（existing 为空）→ MP first_sync 转化（client 端追不到的真激活）
```

---

## 事件清单

| 事件 | 触发 | 位置 | 建议设为 Key Event |
|---|---|---|---|
| `page_view` | 每次页面浏览（客户端 gtag + 服务端 MP 双发）| 自动 | 否 |
| `install_command_copy` | 首页复制安装命令 | `landing.ts` | **是**（意向）|
| `share_toggle` | dashboard 切换公开/非公开（带 `to` 参数）| `dashboard.ts` | 否 |
| `auth_command_copy` | 复制授权命令（公开开关弹窗）| `dashboard.ts` | 否 |
| `first_sync` | **用户首次同步成功（服务端）** | `routes/usage.ts` | **是**（真·激活）|

> 后续可继续按 mirai-shigoto 的密度加：`copy_share_link`、`period_change`、`view_global_ranking`、`feedback_submit`、`x_follow_click` 等。新增客户端事件一律走 `window.track(name, params)`，不要散落裸 `gtag()`。

---

## 环境变量

| 变量 | 机密 | 用途 | 缺失时 |
|---|---|---|---|
| `GA4_MP_API_SECRET` | **是** | `ga-mp.ts` 服务端 MP | 服务端 MP（page_view 兜底 + first_sync）**静默跳过** |
| `X_PIXEL_ID`（`layout.ts` 常量，非 env）| 否 | X Ads pixel | pixel **不渲染** |

设计原则：**缺凭证 = 静默 no-op，绝不报错**。所以代码可立即部署，填齐凭证才激活——fork/preview 安全。

---

## 外部配置清单（代码已就绪，等填）

1. **创建 GA4 MP API secret** → GA4 → Admin → Data Streams → atologs.com 流 → Measurement Protocol API secrets → Create → 复制 secret → `wrangler secret put GA4_MP_API_SECRET` 设为 Worker secret。
2. **创建 X Ads pixel** → X Ads Manager → Tools → Conversion tracking → Website tag → 拿短 pixel ID（形如 `rC3xs`）→ 填进 `layout.ts` 的 `X_PIXEL_ID` 常量。
3. **标记 Key Events** → GA4 → Admin → Events（**事件上线有数据后才会出现**）→ 把 `install_command_copy` 和 `first_sync` 标为 Key Event（= 转化）。

---

## 已知失败模式 + 防御

| # | 风险 | 根因 | 防御 |
|---|---|---|---|
| 1 | 内联 client JS 静默坏掉 | worker 用模板字面量拼 HTML/JS；裸 backtick / `${}` / 换行嵌入会破坏（v1.1.1 翻车史）| `window.track` 等只写进 `<script>` 字符串里，不在客户端字符串内做模板插值；改动后必跑 `wrangler deploy --dry-run` 确认 bundle 通过 |
| 2 | 真实用户 `g/collect` 被浏览器 Tracking Prevention 拦（Chromium 137+）| 行业级浏览器策略 | `index.ts` 边缘中间件用 MP 服务端补发 `page_view`（依赖浏览器策略 = 0）|
| 3 | 服务端 page_view 双计数（客户端没被拦时两边都发）| client + server 各发一次 | 仅在有 `_ga` cookie 时发（对齐 client_id），并打 `ssrc=worker` 参数可区分；早期可接受，需要时给中间件加 consent/dedupe |
| 4 | 广告投了却 0 转化 | 没装 X pixel + 没配 Key Events | 本次加 X pixel + first_sync 转化 + 上面 Key Event 清单 |

---

## 验证 runbook

异常排查顺序：

1. **客户端链**：DevTools Network 开 `https://atologs.com/` → 应见 `gtag/js?id=G-EVZ3ZQNZD5`(200) + `g/collect`(204)；Console `typeof window.track === 'function'`、`typeof gtag === 'function'`。
2. **服务端链**（设了 MP secret 后）：GA4 Realtime 找带 `ssrc=worker` 的事件 = 服务端命中；Worker logs 看 `mp/collect` fetch。
3. **X pixel**（填了 ID 后）：Network 应见 `static.ads-twitter.com/uwt.js`(200) + `analytics.twitter.com/.../adsct`。
4. **转化**：GA4 Realtime/事件报告里确认 `install_command_copy`、`first_sync` 在涨；标 Key Event 后看「重要事件」从 0 起来。

---

## 改 analytics 栈时

新增追踪器 / 换 ID / 加事件：
1. 客户端片段进 `components/layout.ts`（唯一骨架，自动覆盖全站）。
2. 服务端事件走 `ga-mp.ts` 的 `sendMpEvents`，用 `c.executionCtx.waitUntil` 非阻塞发。
3. 客户端事件一律 `window.track(name, params)`。
4. `wrangler deploy --dry-run` 确认 bundle 通过（防内联 JS 翻车）。
5. 更新本文档的事件清单 / 追踪器表。
6. 部署：`wrangler deploy`，部署后跑上面的验证 runbook 确认数据接收。

最后更新：2026-06-03 · work-log 043
