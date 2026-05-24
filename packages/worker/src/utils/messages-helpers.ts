/**
 * AtoLogs 留言系统辅助工具函数
 */

/**
 * 生成随机 UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 对 IP 进行 SHA-256 散列并截取前 16 字符（隐私保护）
 */
export async function hashIP(ip: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 16);
}

/**
 * 对 HTML 标签进行转义防 XSS，并去除 <script> 标签等危害
 */
export function sanitizeContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 校验留言内容长度是否在 1-1000 字之间且非空
 */
export function isValidContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return trimmed.length >= 1 && trimmed.length <= 1000;
}
