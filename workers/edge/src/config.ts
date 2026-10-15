import type { Env } from './types';

/**
 * Env با مقادیر پیش‌فرض ایمن — در تست محلی و preview کار می‌کند.
 */
export const DEFAULT_ENV: Partial<Env> = {
  AI_PRIMARY_MODEL: 'gemini-3.8-flash',
  /** تولید ماژولار (outline → روز ۱ → بقیه در پس‌زمینه). 'false' = خاموش */
  MODULAR_GENERATION: 'true',
  AI_FALLBACK_MODELS: 'deepseek-chat,claude-3-5-sonnet-latest',
  ENABLE_PAYLOAD_ENCRYPTION: 'false',
  RATE_LIMIT_PER_MINUTE: '60',
  RATE_LIMIT_PER_DAY: '2000',
  FREE_TRIAL_DAYS: '7',
  CYCLE_STALL_DAYS: '12',
  /**
   * سقف مصرف توکن AI هر کاربر در ۲۴ ساعت (محافظت از کلید در برابر حلقهٔ
   * باگ‌دار). یک چرخهٔ کامل ~۸ فراخوانی و چند ده هزار توکن است، پس ۳۰۰k
   * حدود ۴ برابر مصرف عادی جا دارد و فقط جلوی فاجعه را می‌گیرد.
   */
  AI_TOKEN_BUDGET_PER_DAY: '300000',
  /** شخصی‌سازی واقعی کش درس (نقاط ضعف در کلید). `false` = کش مشترک */
  PERSONALIZED_CACHE: 'true',
  GATE_PATH: '/kpanah56/8fjg7rfb/v1/gate',
};

export function withDefaults(env: Env): Env {
  const merged = { ...DEFAULT_ENV, ...env } as Env;
  merged.GATE_PATH = normalizePath(merged.GATE_PATH || DEFAULT_ENV.GATE_PATH!);
  return merged;
}

export function normalizePath(p: string): string {
  const withSlash = p.startsWith('/') ? p : `/${p}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

export function isEncryptionEnabled(env: Env): boolean {
  return String(env.ENABLE_PAYLOAD_ENCRYPTION ?? 'false').toLowerCase() === 'true';
}

export function numberEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
