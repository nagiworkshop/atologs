import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types.js";
import {
  generateUUID,
  hashIP,
  sanitizeContent,
  isValidContent
} from "../utils/messages-helpers.js";
import { renderLayout } from "../components/layout.js";
import { colors, spacing, fontSize, radius } from "../design-tokens.js";

const app = new Hono<{ Bindings: Env }>();

async function validateAdmin(c: any): Promise<boolean> {
  // 1. Check Cookie
  const sessionId = getCookie(c, "admin_session");
  if (sessionId) {
    const sessionExists = await c.env.KV.get(`admin_session:${sessionId}`);
    if (sessionExists) {
      return true;
    }
  }

  // 2. Check Query & Authorization Bearer
  const token = c.req.query("token") ?? c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (token) {
    const adminToken = await c.env.KV.get("admin_token");
    if (adminToken && token === adminToken) {
      return true;
    }
  }

  return false;
}

// ─── 1. PUBLIC API: POST /api/messages ───
app.post("/api/messages", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { nickname, content } = body;

    // 校验内容
    if (!isValidContent(content)) {
      return c.json(
        { ok: false, error: "メッセージ内容は1文字以上1000文字以内で入力してください。" },
        400
      );
    }

    // 校验昵称
    if (nickname && nickname.length > 50) {
      return c.json(
        { ok: false, error: "お名前は50文字以内で入力してください。" },
        400
      );
    }

    // 获取客户端 IP 并哈希
    const ip = c.req.header("CF-Connecting-IP") || "127.0.0.1";
    const ipHash = await hashIP(ip);

    // 检查 Rate Limits
    const dayKey = `ratelimit:${ipHash}:day`;
    const hourKey = `ratelimit:${ipHash}:hour`;

    const dayVal = await c.env.KV.get(dayKey);
    const dayCount = dayVal ? parseInt(dayVal, 10) : 0;
    if (dayCount >= 3) {
      return c.json(
        { ok: false, error: "投稿制限に達しました（1日3回まで）。" },
        429
      );
    }

    const hourVal = await c.env.KV.get(hourKey);
    const hourCount = hourVal ? parseInt(hourVal, 10) : 0;
    if (hourCount >= 10) {
      return c.json(
        { ok: false, error: "投稿制限に達しました（1時間10回まで）。" },
        429
      );
    }

    // 创建留言数据
    const uuid = generateUUID();
    const cleanContent = sanitizeContent(content);
    const cleanNickname = nickname ? sanitizeContent(nickname).trim() : "匿名";
    const finalNickname = cleanNickname || "匿名";

    const now = new Date();
    const createdAt = now.toISOString();
    const createdDate = createdAt.slice(0, 10); // YYYY-MM-DD

    const messageObj = {
      id: uuid,
      nickname: finalNickname,
      content: cleanContent,
      status: "pending",
      createdAt,
      createdDate,
      ipHash
    };

    // 写入数据库
    await c.env.KV.put(`messages:${uuid}`, JSON.stringify(messageObj));

    // 追加到 pending 列表
    let pendingList: string[] = [];
    const pendingVal = await c.env.KV.get("messages:list:pending");
    if (pendingVal) {
      try {
        pendingList = JSON.parse(pendingVal);
      } catch {}
    }
    pendingList.push(uuid);
    await c.env.KV.put("messages:list:pending", JSON.stringify(pendingList));

    // 更新频率计数（递增并设置 TTL）
    await c.env.KV.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 });
    await c.env.KV.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 });

    return c.json({
      ok: true,
      id: uuid,
      message: "投稿ありがとうございます。確認後に公開されます。"
    });
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return c.json({ ok: false, error: "内部サーバーエラーが発生しました。" }, 500);
  }
});

// ─── 2. PUBLIC API: GET /api/messages ───
app.get("/api/messages", async (c) => {
  try {
    let approvedIds: string[] = [];
    const approvedVal = await c.env.KV.get("messages:list:approved");
    if (approvedVal) {
      try {
        approvedIds = JSON.parse(approvedVal);
      } catch {}
    }

    // 并行读取详细留言内容
    const promises = approvedIds.map((id) => c.env.KV.get(`messages:${id}`));
    const results = await Promise.all(promises);

    const messages = results
      .map((str) => {
        if (!str) return null;
        try {
          const m = JSON.parse(str);
          return {
            id: m.id,
            nickname: m.nickname,
            content: m.content,
            createdDate: m.createdDate
          };
        } catch {
          return null;
        }
      })
      .filter((m) => m !== null);

    c.header("Cache-Control", "public, max-age=60");
    return c.json({ messages });
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return c.json({ ok: false, error: "内部サーバーエラーが発生しました。" }, 500);
  }
});

// ─── 3. ADMIN API: GET /api/admin/messages ───
app.get("/api/admin/messages", async (c) => {
  if (!(await validateAdmin(c))) {
    return c.text("403 Forbidden", 403);
  }

  try {
    let pendingIds: string[] = [];
    let approvedIds: string[] = [];

    const pendingVal = await c.env.KV.get("messages:list:pending");
    if (pendingVal) {
      try {
        pendingIds = JSON.parse(pendingVal);
      } catch {}
    }

    const approvedVal = await c.env.KV.get("messages:list:approved");
    if (approvedVal) {
      try {
        approvedIds = JSON.parse(approvedVal);
      } catch {}
    }

    const pendingPromises = pendingIds.map((id) => c.env.KV.get(`messages:${id}`));
    const approvedPromises = approvedIds.map((id) => c.env.KV.get(`messages:${id}`));

    const [pendingStrs, approvedStrs] = await Promise.all([
      Promise.all(pendingPromises),
      Promise.all(approvedPromises)
    ]);

    const parseList = (strs: (string | null)[]) =>
      strs
        .map((str) => {
          if (!str) return null;
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        })
        .filter((m) => m !== null);

    return c.json({
      pending: parseList(pendingStrs),
      approved: parseList(approvedStrs)
    });
  } catch (err) {
    console.error("GET /api/admin/messages error:", err);
    return c.json({ ok: false, error: "内部サーバーエラーが発生しました。" }, 500);
  }
});

// ─── 4. ADMIN API: POST /api/admin/messages/:id/approve ───
app.post("/api/admin/messages/:id/approve", async (c) => {
  if (!(await validateAdmin(c))) {
    return c.text("403 Forbidden", 403);
  }

  try {
    const id = c.req.param("id");
    const msgStr = await c.env.KV.get(`messages:${id}`);
    if (!msgStr) {
      return c.json({ ok: false, error: "メッセージが見つかりません。" }, 404);
    }

    const msg = JSON.parse(msgStr);
    msg.status = "approved";
    await c.env.KV.put(`messages:${id}`, JSON.stringify(msg));

    // 从 pending 移出
    let pendingList: string[] = JSON.parse((await c.env.KV.get("messages:list:pending")) || "[]");
    pendingList = pendingList.filter((x) => x !== id);
    await c.env.KV.put("messages:list:pending", JSON.stringify(pendingList));

    // 移入 approved 并限制最长 50
    let approvedList: string[] = JSON.parse((await c.env.KV.get("messages:list:approved")) || "[]");
    approvedList = approvedList.filter((x) => x !== id);
    approvedList.unshift(id);

    if (approvedList.length > 50) {
      const oldestId = approvedList.pop();
      if (oldestId) {
        await c.env.KV.delete(`messages:${oldestId}`);
      }
    }
    await c.env.KV.put("messages:list:approved", JSON.stringify(approvedList));

    return c.json({ ok: true });
  } catch (err) {
    console.error("POST approve error:", err);
    return c.json({ ok: false, error: "内部サーバーエラーが発生しました。" }, 500);
  }
});

// ─── 5. ADMIN API: POST /api/admin/messages/:id/reject ───
app.post("/api/admin/messages/:id/reject", async (c) => {
  if (!(await validateAdmin(c))) {
    return c.text("403 Forbidden", 403);
  }

  try {
    const id = c.req.param("id");
    const msgStr = await c.env.KV.get(`messages:${id}`);
    if (!msgStr) {
      return c.json({ ok: false, error: "メッセージが見つかりません。" }, 404);
    }

    const msg = JSON.parse(msgStr);
    msg.status = "rejected";
    // 30天自动过期清理（2592000秒）
    await c.env.KV.put(`messages:${id}`, JSON.stringify(msg), { expirationTtl: 2592000 });

    // 从 pending 移出
    let pendingList: string[] = JSON.parse((await c.env.KV.get("messages:list:pending")) || "[]");
    pendingList = pendingList.filter((x) => x !== id);
    await c.env.KV.put("messages:list:pending", JSON.stringify(pendingList));

    // 从 approved 移出（如果已存在）
    let approvedList: string[] = JSON.parse((await c.env.KV.get("messages:list:approved")) || "[]");
    if (approvedList.includes(id)) {
      approvedList = approvedList.filter((x) => x !== id);
      await c.env.KV.put("messages:list:approved", JSON.stringify(approvedList));
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("POST reject error:", err);
    return c.json({ ok: false, error: "内部サーバーエラーが発生しました。" }, 500);
  }
});

// ─── 6. PAGE: GET /feedback ───
app.get("/feedback", (c) => {
  return c.redirect("/messages#feedback", 301);
});

// ─── 7. PAGE: GET /messages (PUBLIC WALL) ───
app.get("/messages", (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");

  const bodyContent = `
    <!-- Section 1: Hero -->
    <section style="background-color: ${colors.bg};">
      <div class="section-container hero-padding" style="text-align: center;">
        <h1 class="hero-title" style="font-weight: 700; letter-spacing: -0.025em; color: ${colors.textPrimary}; line-height: 1.25; margin-bottom: ${spacing[4]};">
          みんなのメッセージ
        </h1>
        <p class="hero-sub" style="color: ${colors.textSecondary}; margin-bottom: ${spacing[2]};">
          AtoLogs を利用している仲間たちからの公開メッセージボードです。
        </p>
        <p style="font-size: ${fontSize.base}; color: ${colors.textMuted}; margin-bottom: ${spacing[6]};">
          投稿された内容は運営確認後、公開されます。
        </p>
        <div style="display: flex; justify-content: center;">
          <a href="#post-form" class="cta-btn">投稿する</a>
        </div>
      </div>
    </section>

    <!-- Section 2: 留言列表 -->
    <section style="background-color: ${colors.bgWhite}; border-top: 1px solid ${colors.border}; border-bottom: 1px solid ${colors.border};">
      <div class="section-container" style="padding-top: 56px; padding-bottom: 56px;">
        <h2 style="font-size: 28px; font-weight: 700; color: ${colors.textPrimary}; margin-bottom: ${spacing[8]}; text-align: center;">
          みんなの投稿（最新 50 件）
        </h2>
        
        <div id="list-error" class="error-msg"></div>
        
        <div id="messages-list" class="messages-grid">
          <div class="empty-state">読み込み中...</div>
        </div>
      </div>
    </section>

    <!-- Section 3: 投稿表单 -->
    <section id="post-form" style="background-color: ${colors.bg};">
      <div class="section-container" style="padding-top: 56px; padding-bottom: 56px;">
        <div style="max-width: 672px; margin: 0 auto;">
          <h2 style="font-size: 28px; font-weight: 700; color: ${colors.textPrimary}; margin-bottom: ${spacing[6]}; text-align: center;">
            メッセージを投稿
          </h2>
          
          <!-- 送信成功カード -->
          <div id="success-card" class="success-card" style="display: none;">
            <div class="success-icon">✓</div>
            <h3 class="success-title">ご意見、ありがとうございました。</h3>
            <p class="success-desc">投稿を受け付けました。運営による確認が行われた後、承認されたメッセージが公開されます。</p>
            <button onclick="resetFeedbackForm()" class="reset-btn">もう一件送る</button>
          </div>

          <!-- 投稿フォーム -->
          <form id="feedback-form" onsubmit="handleFeedbackSubmit(event)" class="feedback-form">
            <div id="form-error" class="error-msg"></div>

            <div class="form-group">
              <label for="feedback-name" class="form-label">お名前（任意）</label>
              <input type="text" id="feedback-name" placeholder="お名前、またはニックネーム（未入力時は「匿名」）" maxlength="50" class="form-input" />
            </div>

            <div class="form-group">
              <label for="feedback-content" class="form-label">メッセージ内容<span class="form-label-required">●</span></label>
              <div class="textarea-wrapper">
                <textarea id="feedback-content" required maxlength="1000" rows="6" placeholder="改善のご意見やご感想などをご記入ください" oninput="updateCharCount()" class="form-textarea"></textarea>
                <div id="char-counter" class="char-counter">0/1000</div>
              </div>
            </div>

            <div class="form-footer">
              <button type="submit" id="submit-btn" disabled class="submit-btn">送信する</button>
              <span class="form-footer-hint">送信後、運営が確認した内容のみが公開されます</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;

  const extraStyles = `
    html {
      scroll-behavior: smooth;
    }
    .section-container {
      max-width: 1024px;
      margin: 0 auto;
      padding-left: 24px;
      padding-right: 24px;
    }
    .hero-padding {
      padding-top: 56px;
      padding-bottom: 32px;
    }
    .hero-title {
      font-size: 3rem;
      font-weight: 700;
      color: ${colors.textPrimary};
    }
    .hero-sub {
      font-size: 1.125rem;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 24px;
      background-color: ${colors.textPrimary};
      color: #ffffff;
      border-radius: ${radius.md};
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      transition: background-color 0.15s ease-in-out, transform 0.1s;
      cursor: pointer;
    }
    .cta-btn:hover {
      background-color: ${colors.accent};
    }
    .cta-btn:active {
      transform: scale(0.98);
    }
    @media (max-width: 767px) {
      .section-container {
        padding-left: 16px;
        padding-right: 16px;
      }
      .hero-padding {
        padding-top: 32px !important;
        padding-bottom: 24px !important;
      }
      .hero-title {
        font-size: 1.875rem !important;
      }
      .hero-sub {
        font-size: 0.95rem !important;
      }
    }
    .messages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    @media (max-width: 767px) {
      .messages-grid {
        grid-template-columns: 1fr;
      }
    }
    .message-card {
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.2s, transform 0.2s;
    }
    .message-card:hover {
      border-color: ${colors.accent};
      transform: translateY(-2px);
    }
    .message-header {
      font-size: ${fontSize.md};
      color: ${colors.textMuted};
    }
    .message-header strong {
      font-weight: 700;
      color: ${colors.textPrimary};
    }
    .message-header time {
      font-size: ${fontSize.base};
      color: ${colors.textFaint};
    }
    .message-content {
      font-size: ${fontSize.lg};
      color: ${colors.textSecondary};
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .feedback-form {
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: ${radius.xl};
      padding: ${spacing[6]};
    }
    .form-group {
      margin-bottom: ${spacing[5]};
    }
    .form-label {
      display: block;
      font-size: ${fontSize.lg};
      font-weight: 500;
      color: ${colors.textSecondary};
      margin-bottom: ${spacing[2]};
    }
    .form-label-required {
      color: ${colors.danger};
      font-weight: 750;
      margin-left: ${spacing[1]};
    }
    .form-input, .form-textarea {
      width: 100%;
      border: 1px solid ${colors.border};
      border-radius: ${radius.lg};
      padding: ${spacing[3]};
      font-size: ${fontSize.xl};
      color: ${colors.textPrimary};
      background: ${colors.bgWhite};
      outline: none;
      transition: border-color 0.2s;
    }
    .form-input:focus, .form-textarea:focus {
      border-color: ${colors.accent};
    }
    .form-textarea {
      resize: vertical;
      min-height: 120px;
    }
    .textarea-wrapper {
      position: relative;
    }
    .char-counter {
      position: absolute;
      bottom: ${spacing[2]};
      right: ${spacing[3]};
      font-size: ${fontSize.xs};
      color: ${colors.textFaint};
      pointer-events: none;
    }
    .submit-btn {
      background: ${colors.textPrimary};
      color: ${colors.bgWhite};
      border: none;
      border-radius: ${radius.md};
      min-height: 48px;
      padding: 0 ${spacing[8]};
      font-size: ${fontSize.xl};
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }
    .submit-btn:hover {
      background: ${colors.accent};
    }
    .submit-btn:active {
      transform: scale(0.98);
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: ${colors.textFaint};
    }
    .form-footer {
      display: flex;
      flex-direction: column;
      gap: ${spacing[4]};
      margin-top: ${spacing[4]};
    }
    @media (min-width: 640px) {
      .form-footer {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .form-footer-hint {
      font-size: ${fontSize.md};
      color: ${colors.textFaint};
    }
    .success-card {
      background: ${colors.successBg};
      border: 1px solid ${colors.border};
      border-radius: ${radius.xl};
      padding: ${spacing[8]};
      text-align: center;
    }
    .success-icon {
      width: 48px;
      height: 48px;
      background: ${colors.successBg};
      color: ${colors.success};
      border: 2px solid ${colors.success};
      border-radius: ${radius.full};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${fontSize["4xl"]};
      font-weight: 700;
      margin: 0 auto ${spacing[4]};
    }
    .success-title {
      font-size: ${fontSize["2xl"]};
      font-weight: 700;
      color: ${colors.textPrimary};
      margin-bottom: ${spacing[2]};
    }
    .success-desc {
      font-size: ${fontSize.base};
      color: ${colors.textSecondary};
      margin-bottom: ${spacing[6]};
    }
    .reset-btn {
      font-size: ${fontSize.base};
      color: ${colors.accent};
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      text-decoration: underline;
    }
    .reset-btn:hover {
      color: ${colors.accentDark};
    }
    .empty-state {
      text-align: center;
      padding: ${spacing[12]};
      color: ${colors.textFaint};
      font-size: ${fontSize.base};
      border: 1px dashed ${colors.border};
      border-radius: ${radius.xl};
      background: ${colors.bgWhite};
      grid-column: 1 / -1;
    }
    .error-msg {
      color: ${colors.danger};
      font-size: ${fontSize.base};
      background: ${colors.dangerBg};
      border: 1px solid ${colors.border};
      border-radius: ${radius.lg};
      padding: ${spacing[3]};
      margin-bottom: ${spacing[4]};
      display: none;
    }
  `;

  const extraScripts = `
    function updateCharCount() {
      const content = document.getElementById('feedback-content');
      const counter = document.getElementById('char-counter');
      const submitBtn = document.getElementById('submit-btn');
      if (!content || !counter || !submitBtn) return;
      const count = content.value.trim().length;
      counter.textContent = count + '/1000';
      submitBtn.disabled = (count < 1 || count > 1000);
    }

    async function loadMessages() {
      const listContainer = document.getElementById('messages-list');
      if (!listContainer) return;
      try {
        const res = await fetch('/api/messages');
        if (!res.ok) throw new Error('メッセージの取得に失敗しました。');
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) {
          listContainer.innerHTML = '<div class="empty-state">メッセージはまだありません。最初の一言を投稿してみませんか？</div>';
          return;
        }
        listContainer.innerHTML = data.messages.map(m => \`
          <article class="message-card">
            <header class="message-header">
              <strong>\${escapeHTML(m.nickname)}</strong> · <time>\${escapeHTML(m.createdDate)}</time>
            </header>
            <p class="message-content">\${escapeHTML(m.content)}</p>
          </article>
        \`).join('');
      } catch (err) {
        const errDiv = document.getElementById('list-error');
        if (errDiv) {
          errDiv.textContent = err.message;
          errDiv.style.display = 'block';
        }
        listContainer.innerHTML = '<div class="empty-state">メッセージの読み込みに失敗しました。</div>';
      }
    }

    function escapeHTML(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    async function handleFeedbackSubmit(e) {
      e.preventDefault();
      const form = document.getElementById('feedback-form');
      const success = document.getElementById('success-card');
      const submitBtn = document.getElementById('submit-btn');
      const formError = document.getElementById('form-error');
      if (!form || !success || !submitBtn || !formError) return;

      formError.style.display = 'none';
      formError.textContent = '';
      submitBtn.disabled = true;

      const nickname = document.getElementById('feedback-name').value;
      const content = document.getElementById('feedback-content').value;

      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: nickname || undefined, content })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '送信に失敗しました。');
        }
        form.style.display = 'none';
        success.style.display = 'block';
        loadMessages(); // 重新加载公开面板列表（注意：刚提交是 pending 状态，列表需要刷新）
      } catch (err) {
        formError.textContent = err.message;
        formError.style.display = 'block';
        submitBtn.disabled = false;
      }
    }

    function resetFeedbackForm() {
      const form = document.getElementById('feedback-form');
      const success = document.getElementById('success-card');
      if (!form || !success) return;
      form.reset();
      updateCharCount();
      success.style.display = 'none';
      form.style.display = 'block';
    }

    // 页面加载自动拉取
    document.addEventListener('DOMContentLoaded', loadMessages);
  `;

  const htmlContent = renderLayout({
    title: "みんなのメッセージ — AtoLogs",
    description: "AtoLogsを利用している仲間たちからのメッセージを表示する公開メッセージボードです。",
    active: "" as any,
    bodyContent,
    extraStyles,
    extraScripts
  });

  return c.html(htmlContent);
});

// ─── 8. GET /admin (ADMIN LOGIN PAGE) ───
app.get("/admin", async (c) => {
  if (await validateAdmin(c)) {
    return c.redirect("/admin/feedback", 302);
  }

  const error = c.req.query("error");
  let errorMsg = "";
  if (error === "1") {
    errorMsg = `<div class="error-msg" style="display: block;">パスワードが正しくありません</div>`;
  } else if (error === "ratelimit") {
    errorMsg = `<div class="error-msg" style="display: block;">試行回数が上限を超えました（20回/時）</div>`;
  }

  const bodyContent = `
    <div class="login-container">
      <form action="/admin/login" method="POST" class="login-form">
        <h1 class="login-title">管理者ログイン</h1>
        ${errorMsg}
        <div class="form-group">
          <input type="password" name="password" placeholder="パスワード" required autofocus class="form-input" />
        </div>
        <button type="submit" class="submit-btn login-btn">ログイン</button>
      </form>
    </div>
  `;

  const extraStyles = `
    .login-container {
      max-width: 448px;
      margin: 80px auto;
      padding: ${spacing[6]} ${spacing[4]};
    }
    .login-form {
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: ${radius.xl};
      padding: ${spacing[8]};
    }
    .login-title {
      font-size: ${fontSize["3xl"]};
      font-weight: 700;
      color: ${colors.textPrimary};
      margin-bottom: ${spacing[6]};
      text-align: center;
    }
    .login-btn {
      width: 100%;
    }
    .error-msg {
      color: ${colors.danger};
      font-size: ${fontSize.base};
      background: ${colors.dangerBg};
      border: 1px solid ${colors.border};
      border-radius: ${radius.lg};
      padding: ${spacing[3]};
      margin-bottom: ${spacing[4]};
      display: none;
    }
    .form-group {
      margin-bottom: ${spacing[5]};
    }
    .form-input {
      width: 100%;
      border: 1px solid ${colors.border};
      border-radius: ${radius.lg};
      padding: ${spacing[3]};
      font-size: ${fontSize.base};
      color: ${colors.textPrimary};
      background: ${colors.bgWhite};
      outline: none;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      border-color: ${colors.accent};
    }
    .submit-btn {
      background: ${colors.textPrimary};
      color: ${colors.bgWhite};
      border: none;
      border-radius: ${radius.md};
      min-height: 48px;
      padding: 0 ${spacing[8]};
      font-size: ${fontSize.base};
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }
    .submit-btn:hover {
      background: ${colors.accent};
    }
    .submit-btn:active {
      transform: scale(0.98);
    }
  `;

  const htmlContent = renderLayout({
    title: "管理者ログイン — AtoLogs",
    description: "AtoLogs 管理者ログイン",
    active: "" as any,
    bodyContent,
    extraStyles,
    extraScripts: ""
  });

  return c.html(htmlContent);
});

// ─── 9. POST /admin/login (ADMIN LOGIN ACTION) ───
app.post("/admin/login", async (c) => {
  try {
    const body = await c.req.parseBody();
    const password = typeof body.password === "string" ? body.password : "";

    const ip = c.req.header("CF-Connecting-IP") || "127.0.0.1";
    const ipHash = await hashIP(ip);
    const limitKey = `ratelimit:login:${ipHash}:hour`;

    const countVal = await c.env.KV.get(limitKey);
    const count = countVal ? parseInt(countVal, 10) : 0;
    if (count >= 20) {
      return c.redirect("/admin?error=ratelimit", 302);
    }

    const adminToken = await c.env.KV.get("admin_token");
    if (adminToken && password === adminToken) {
      const sessionId = generateUUID();
      const createdAt = new Date().toISOString();
      await c.env.KV.put(
        `admin_session:${sessionId}`,
        JSON.stringify({ createdAt }),
        { expirationTtl: 86400 }
      );

      setCookie(c, "admin_session", sessionId, {
        path: "/",
        maxAge: 86400,
        httpOnly: true,
        secure: true,
        sameSite: "Strict"
      });

      return c.redirect("/admin/feedback", 302);
    } else {
      await c.env.KV.put(limitKey, String(count + 1), { expirationTtl: 3600 });
      return c.redirect("/admin?error=1", 302);
    }
  } catch (err) {
    console.error("POST /admin/login error:", err);
    return c.redirect("/admin?error=1", 302);
  }
});

// ─── 10. GET /admin/logout (ADMIN LOGOUT ACTION) ───
app.get("/admin/logout", async (c) => {
  const sessionId = getCookie(c, "admin_session");
  if (sessionId) {
    await c.env.KV.delete(`admin_session:${sessionId}`);
  }
  deleteCookie(c, "admin_session", { path: "/" });
  return c.redirect("/admin", 302);
});

// ─── 11. PAGE: GET /admin/feedback (ADMIN INTERFACE) ───
app.get("/admin/feedback", async (c) => {
  if (!(await validateAdmin(c))) {
    return c.redirect("/admin", 302);
  }

  c.header("Cache-Control", "no-cache, no-store, must-revalidate");

  // 读取待审核及已审核的真实数据
  let pendingIds: string[] = [];
  let approvedIds: string[] = [];

  const pendingVal = await c.env.KV.get("messages:list:pending");
  if (pendingVal) {
    try {
      pendingIds = JSON.parse(pendingVal);
    } catch {}
  }

  const approvedVal = await c.env.KV.get("messages:list:approved");
  if (approvedVal) {
    try {
      approvedIds = JSON.parse(approvedVal);
    } catch {}
  }

  const pendingPromises = pendingIds.map((id) => c.env.KV.get(`messages:${id}`));
  const approvedPromises = approvedIds.map((id) => c.env.KV.get(`messages:${id}`));

  const [pendingStrs, approvedStrs] = await Promise.all([
    Promise.all(pendingPromises),
    Promise.all(approvedPromises)
  ]);

  const parseList = (strs: (string | null)[]) =>
    strs
      .map((str) => {
        if (!str) return null;
        try {
          return JSON.parse(str);
        } catch {
          return null;
        }
      })
      .filter((m) => m !== null);

  const pending = parseList(pendingStrs);
  const approved = parseList(approvedStrs);

  const escapeHTML = (str: string) => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const bodyContent = `
    <div class="main-container">
      <div style="max-width: 768px; margin: 0 auto;">
        <div class="admin-header">
          <h1 class="admin-title">管理者ダッシュボード</h1>
          <div class="admin-header-actions">
            <a href="/messages" class="admin-back-link">メッセージボードへ</a>
            <a href="/admin/logout" class="admin-logout-btn">ログアウト</a>
          </div>
        </div>

        <div class="admin-tabs">
          <button id="tab-pending-btn" onclick="switchAdminTab('pending')" class="admin-tab-btn active">
            承認待ちメッセージ
            <span class="admin-badge">${pending.length}</span>
          </button>
          <button id="tab-approved-btn" onclick="switchAdminTab('approved')" class="admin-tab-btn">
            公開中メッセージ
            <span class="admin-badge admin-badge-approved">${approved.length}</span>
          </button>
        </div>

        <!-- 待审核列表 -->
        <div id="tab-pending-content" class="admin-card-list">
          ${
            pending.length === 0
              ? `
            <div class="admin-empty">
              <span style="font-size: 24px; display: block; margin-bottom: 8px;">🎉</span>
              承認待ちのメッセージはありません。
            </div>
          `
              : pending
                  .map(
                    (m) => `
            <div class="admin-card">
              <div class="admin-card-header">
                <span class="admin-card-user">${escapeHTML(m.nickname)} <span class="ip-hash">(ipHash: ${m.ipHash})</span></span>
                <span class="admin-card-date">${m.createdAt}</span>
              </div>
              <p class="admin-card-content">${escapeHTML(m.content)}</p>
              <div class="admin-card-actions">
                <button onclick="moderateMessage('${m.id}', 'approve')" class="admin-btn btn-approve">承認する</button>
                <button onclick="moderateMessage('${m.id}', 'reject')" class="admin-btn btn-reject">却下する</button>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>

        <!-- 已审核列表 -->
        <div id="tab-approved-content" class="admin-card-list" style="display: none;">
          ${
            approved.length === 0
              ? `
            <div class="admin-empty">
              公開中のメッセージはありません。
            </div>
          `
              : approved
                  .map(
                    (m) => `
            <div class="admin-card">
              <div class="admin-card-header">
                <span class="admin-card-user">${escapeHTML(m.nickname)} <span class="ip-hash">(ipHash: ${m.ipHash})</span></span>
                <span class="admin-card-date">${m.createdAt}</span>
              </div>
              <p class="admin-card-content">${escapeHTML(m.content)}</p>
              <div class="admin-card-actions">
                <button onclick="moderateMessage('${m.id}', 'reject')" class="admin-btn btn-reject-faded">公開を取り消し却下する</button>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>
    </div>
  `;

  const extraStyles = `
    .main-container {
      flex: 1;
      max-width: 1024px;
      width: 100%;
      margin: 0 auto;
      padding: ${spacing[8]} ${spacing[4]};
    }
    @media (min-width: 768px) {
      .main-container {
        padding: ${spacing[12]} ${spacing[6]};
      }
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${colors.border};
      padding-bottom: ${spacing[4]};
      margin-bottom: ${spacing[6]};
    }
    .admin-title {
      font-size: ${fontSize["4xl"]};
      font-weight: 700;
      color: ${colors.textPrimary};
    }
    .admin-header-actions {
      display: flex;
      align-items: center;
      gap: ${spacing[4]};
    }
    .admin-back-link {
      font-size: ${fontSize.base};
      color: ${colors.accent};
      text-decoration: none;
    }
    .admin-back-link:hover {
      text-decoration: underline;
    }
    .admin-logout-btn {
      background: ${colors.bgMuted};
      color: ${colors.textPrimary};
      border: 1px solid ${colors.border};
      border-radius: ${radius.md};
      min-height: 32px;
      padding: 0 ${spacing[3]};
      font-size: ${fontSize.base};
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }
    .admin-logout-btn:hover {
      background: ${colors.dangerBg};
      color: ${colors.danger};
      border-color: ${colors.danger};
    }
    .admin-logout-btn:active {
      transform: scale(0.98);
    }
    .admin-tabs {
      display: flex;
      border-bottom: 1px solid ${colors.border};
      gap: ${spacing[1]};
      margin-bottom: ${spacing[6]};
    }
    .admin-tab-btn {
      background: none;
      border: none;
      padding: ${spacing[2]} ${spacing[4]};
      font-size: ${fontSize.base};
      font-weight: 500;
      color: ${colors.textSecondary};
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .admin-tab-btn:hover {
      color: ${colors.textPrimary};
    }
    .admin-tab-btn.active {
      color: ${colors.accent};
      border-bottom-color: ${colors.accent};
      font-weight: 600;
    }
    .admin-badge {
      background: ${colors.danger};
      color: ${colors.bgWhite};
      font-size: ${fontSize.xs};
      font-weight: 700;
      border-radius: ${radius.full};
      padding: 2px 6px;
      margin-left: 6px;
    }
    .admin-badge-approved {
      background: ${colors.success};
    }
    .admin-card-list {
      display: flex;
      flex-direction: column;
      gap: ${spacing[4]};
    }
    .admin-card {
      background: ${colors.bgWhite};
      border: 1px solid ${colors.border};
      border-radius: ${radius.xl};
      padding: ${spacing[5]};
    }
    .admin-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${spacing[3]};
    }
    .admin-card-user {
      font-weight: 700;
      color: ${colors.textPrimary};
      font-size: ${fontSize.base};
    }
    .ip-hash {
      font-weight: 400;
      font-size: ${fontSize.xs};
      color: ${colors.textMuted};
      margin-left: ${spacing[2]};
    }
    .admin-card-date {
      font-size: ${fontSize.xs};
      color: ${colors.textFaint};
    }
    .admin-card-content {
      font-size: ${fontSize.base};
      color: ${colors.textSecondary};
      line-height: 1.6;
      white-space: pre-wrap;
      margin-bottom: ${spacing[4]};
      word-break: break-all;
    }
    .admin-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: ${spacing[3]};
    }
    .admin-btn {
      border: none;
      border-radius: ${radius.md};
      padding: 0 ${spacing[4]};
      min-height: 40px;
      font-size: ${fontSize.base};
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }
    .admin-btn:active {
      transform: scale(0.98);
    }
    .btn-approve {
      background: ${colors.success};
      color: ${colors.bgWhite};
    }
    .btn-approve:hover {
      background: ${colors.successDark};
    }
    .btn-reject {
      background: ${colors.danger};
      color: ${colors.bgWhite};
    }
    .btn-reject:hover {
      background: ${colors.dangerBg};
      color: ${colors.danger};
    }
    .btn-reject-faded {
      background: ${colors.bgMuted};
      color: ${colors.textMuted};
      border: 1px solid ${colors.border};
    }
    .btn-reject-faded:hover {
      background: ${colors.dangerBg};
      color: ${colors.danger};
    }
    .admin-empty {
      text-align: center;
      padding: ${spacing[12]};
      color: ${colors.textFaint};
      font-size: ${fontSize.base};
      border: 1px dashed ${colors.border};
      border-radius: ${radius.xl};
      background: ${colors.bgWhite};
    }
  `;

  const extraScripts = `
    const token = new URLSearchParams(window.location.search).get('token') || '';

    function switchAdminTab(tab) {
      const pendingBtn = document.getElementById('tab-pending-btn');
      const approvedBtn = document.getElementById('tab-approved-btn');
      const pendingContent = document.getElementById('tab-pending-content');
      const approvedContent = document.getElementById('tab-approved-content');
      if (!pendingBtn || !approvedBtn || !pendingContent || !approvedContent) return;

      if (tab === 'pending') {
        pendingBtn.classList.add('active');
        approvedBtn.classList.remove('active');
        pendingContent.style.display = 'flex';
        approvedContent.style.display = 'none';
      } else {
        approvedBtn.classList.add('active');
        pendingBtn.classList.remove('active');
        approvedContent.style.display = 'flex';
        pendingContent.style.display = 'none';
      }
    }

    async function moderateMessage(id, action) {
      if (!confirm(action === 'approve' ? 'このメッセージを承認して公開しますか？' : 'このメッセージを却下（削除）しますか？')) {
        return;
      }
      try {
        const res = await fetch(\`/api/admin/messages/\${id}/\${action}?token=\${encodeURIComponent(token)}\`, {
          method: 'POST'
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '操作に失敗しました。');
        }
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    }
  `;

  const htmlContent = renderLayout({
    title: "管理画面 — AtoLogs",
    description: "AtoLogs 管理画面",
    active: "" as any,
    bodyContent,
    extraStyles,
    extraScripts
  });

  return c.html(htmlContent);
});

export { app as feedbackPages };
