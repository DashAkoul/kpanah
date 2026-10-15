export interface Env {
  // Telegram
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ADMIN_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_IDS?: string;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Auth
  JWT_SECRET: string;

  // Queue
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  /** آدرس خود Worker برای callback های QStash */
  SELF_URL?: string;
  /**
   * آیا از QStash برای کارهای پس‌زمینه استفاده شود؟ پیش‌فرض `false` —
   * مسیر درون‌Worker (`waitUntil`) پایدارتر است و به QStash وابسته نیست.
   */
  USE_QSTASH?: string;
  /** بودجهٔ زمانی تولید پس‌زمینهٔ دروس (میلی‌ثانیه) */
  BACKGROUND_BUDGET_MS?: string;

  // AI
  GEMINI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_PRIMARY_MODEL?: string;
  AI_FALLBACK_MODELS?: string;
  /**
   * تولید ماژولار دروس: ابتدا «نقشهٔ» چرخه، بعد محتوای روز ۱، و بقیه در
   * پس‌زمینه. مقدار `'false'` آن را خاموش می‌کند (تولید کامل ۷ روزه).
   */
  MODULAR_GENERATION?: string;

  /**
   * Master secret for encrypting AI provider keys that admins enter through
   * the panel. Arbitrary-length passphrase; it is SHA-256 hashed into 32 bytes
   * of AES-GCM key material. Rotating it makes existing stored keys
   * unreadable, so change it only alongside re-entering the provider keys.
   */
  PROVIDER_ENCRYPTION_KEY?: string;

  // Security
  GATE_PATH?: string;
  ENABLE_PAYLOAD_ENCRYPTION?: string;
  PAYLOAD_ENCRYPTION_KEY?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_DAY?: string;

  // Business
  FREE_TRIAL_DAYS?: string;
  CYCLE_STALL_DAYS?: string;

  /** آدرس عمومی اپلیکیشن مینی‌اپ برای دکمه‌های ربات */
  MINI_APP_URL?: string;

  // KV / DO
  RATE_LIMIT_KV?: KVNamespace;
  CACHE_KV?: KVNamespace;

  // Queues (تولید پس‌زمینه) — اختیاری؛ اگر binding نباشد fallback اجرا می‌شود
  GENERATION_QUEUE?: {
    send(message: unknown): Promise<void>;
  };

  // Workflows (تولید durable چرخه) — اختیاری
  CYCLE_WORKFLOW?: {
    create(params: unknown): Promise<{ id: string }>;
    get(id: string): Promise<{ status(): Promise<unknown> }>;
  };
}

/**
 * داده‌ای که در JWT قرار می‌گیرد.
 *
 * ⚠️ این نام‌ها باید دقیقاً با آنچه `signJwt` می‌نویسد یکی باشد.
 * میدلور `middleware/auth.ts` مقادیر را مستقیم روی RequestContext
 * کپی می‌کند (`telegramId: claims.telegramId`)، پس هر اختلاف
 * snake_case/camelCase باعث undefined شدن هویت می‌شود.
 */
export interface AuthClaims {
  /** لازم است تا با JwtPayload سازگار باشد */
  [key: string]: unknown;
  telegramId: number;
  userId: string;
  uiLanguage: string;
  iat: number;
  exp: number;
}

export interface RequestContext {
  env: Env;
  requestId: string;
  claims?: AuthClaims;
  telegramId?: number;
  userId?: string;
  /** نقش ادمین (در صورت احراز دسترسی ADMIN) — برای RBAC */
  adminRole?: 'SUPER_ADMIN' | 'SUPPORT' | 'MARKETING' | 'FINANCE';
  /**
   * از ExecutionContext به ارث می‌رسد. برای کارهای پس‌زمینه‌ای که
   * نباید پاسخ کاربر را معطل کنند (پردازش تلگرام، تولید چرخه، ...).
   * در تست‌ها ممکن است undefined باشد، پس همیشه اختیاری صدا زده می‌شود.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}
