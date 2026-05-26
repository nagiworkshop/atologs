/**
 * AtoLogs 设计系统单一真理源（Single Source of Truth）
 * 任何颜色 / 字号 / 间距都必须从这里取。
 * 严禁在任何页面文件里硬编码 hex 颜色或 px 数值。
 */

// 颜色系统（参考排行榜页风格 + DESIGN_SPEC.md）
export const colors = {
  // 背景
  bg: '#fafaf9',           // 全局背景（暖白）
  bgWhite: '#ffffff',      // 卡片背景
  bgMuted: '#f5f5f5',      // 浅灰背景

  // 文字
  textPrimary: '#171717',  // 主文字（neutral-900）
  textSecondary: '#404040',// 次文字（neutral-700）
  textMuted: '#737373',    // 辅助文字（neutral-500）
  textFaint: '#a3a3a3',    // 极弱文字（neutral-400）

  // 边框
  border: '#e5e5e0',       // 主边框（暖灰）
  borderLight: '#f0f0ec',  // 浅边框

  // 强调
  accent: '#4338ca',       // 主强调色（indigo-700）
  accentDark: '#1e1b4b',   // 强调态深色（indigo-900）

  // 状态
  danger: '#e11d48',       // 危险（rose-600）
  dangerBg: '#fff1f2',     // 危险背景（rose-50）
  success: '#059669',      // 成功（emerald-600）
  successBg: '#ecfdf5',    // 成功背景（emerald-50）
  successDark: '#065f46',  // 成功深色（emerald-800）
  warning: '#78350f',      // 警告文字（amber-900）
  warningBg: '#fffbeb',    // 警告背景（amber-50）

  // 代码块
  codeBg: '#171717',       // 代码块背景（neutral-900）
  codeFg: '#fef3c7',       // 代码块文字（amber-100）

  // 排行榜奖牌
  gold: '#d97706',
  silver: '#4b5563',
  bronze: '#b45309',
} as const;

// 字体堆栈（日语优先）
export const fontStack =
  '"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo UI", system-ui, sans-serif';

// 字号阶梯
export const fontSize = {
  xs: '10px',
  sm: '11px',
  base: '12px',
  md: '13px',
  lg: '14px',
  xl: '15px',
  '2xl': '16px',
  '3xl': '18px',
  '4xl': '20px',
  '5xl': '24px',
  '6xl': '30px',
  hero: '48px',
} as const;

// 间距系统（4 的倍数）
export const spacing = {
  '0': '0',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '9': '36px',
  '10': '40px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
} as const;

// 圆角
export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

// 阴影（极少用）
export const shadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
  xl: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
} as const;

// 断点（响应式）
export const breakpoints = {
  sm: 640,   // 大手机
  md: 768,   // 平板 / 桌面分界
  lg: 1024,  // 桌面
} as const;

// 容器最大宽度
export const containers = {
  narrow: '448px',   // 表单页（max-w-md）
  reading: '672px',  // 阅读页（max-w-2xl）
  medium: '768px',   // 设置页（max-w-3xl）
  wide: '1024px',    // 主页 / 排行榜（max-w-5xl）
} as const;

// 版本号（footer 显示用）
export const VERSION = {
  app: 'v1.0.7',
  cli: 'v0.3.15',
} as const;

// 动态头像背景色列表
export const avatarColors = [
  '#c45c5c', '#d4845a', '#d4a03e', '#8aaa5a', '#5aad7d',
  '#4a9b8a', '#4a8aaa', '#5a7aaa', '#7a6aaa', '#9a5aaa',
  '#aa5a8a', '#c46a7a'
] as const;

// 排行榜图表折线颜色列表
export const chartColors = [
  '#4f46e5', '#059669', '#d97706', '#2563eb', '#db2777',
  '#7c3aed', '#0891b2', '#ea580c'
] as const;


