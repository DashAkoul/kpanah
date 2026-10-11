/**
 * ══════════════════════════════════════════════════════════════════════
 *  قالب پارامتر deep-link مینی‌اپ تلگرام
 *
 *  چرا در پکیج shared است؟
 *  ----------------------
 *  هم ربات (Worker) توکن را می‌سازد و هم اپ (TMA) آن را می‌خواند.
 *  اگر قالب در دو جا جداگانه نوشته شود، دیر یا زود از هم واگرا می‌شوند
 *  و باگ «توکن نمی‌رسد» دوباره برمی‌گردد. اینجا یک منبع حقیقت داریم.
 *
 *  ⚠️ چرا query string نه؟
 *  دکمه‌های `web_app` در تلگرام **query string را حذف می‌کنند**.
 *  اگر URL دکمه `?t=<token>` باشد، تلگرام فقط آدرس ثبت‌شده را باز
 *  می‌کند و توکن هرگز به اپ نمی‌رسد. تنها مسیر قابل‌اعتماد:
 *
 *      url: "https://app.example.com?startapp=t_<token>"
 *                    ↓ تلگرام تبدیل می‌کند
 *      tgWebAppStartParam = "t_<token>"
 *                    ↓ SDK
 *      initDataUnsafe.start_param = "t_<token>"
 *
 *  قالب:
 *    t_<token>                → فقط توکن
 *    t_<token>_<startParam>   → توکن + deep-link اصلی
 * ══════════════════════════════════════════════════════════════════════
 */

/** پیشوندی که توکن ورود را از سایر deep-link ها جدا می‌کند */
export const APP_START_PREFIX = 't_';

/** حداقل طول توکن قابل‌قبول (۳۲ بایت base64url ≈ ۴۳ کاراکتر) */
const MIN_TOKEN_LENGTH = 16;

/**
 * ساخت مقدار `startapp` از توکن و پارامتر اختیاری.
 *
 * @example
 *   buildStartParam('abc123...')            // → 't_abc123...'
 *   buildStartParam('abc123...', 'store')   // → 't_abc123..._store'
 */
export function buildStartParam(token: string, startParam?: string): string {
  const base = `${APP_START_PREFIX}${token}`;
  return startParam ? `${base}_${startParam}` : base;
}

/**
 * استخراج توکن از مقدار `startapp`.
 * اگر مقدار با پیشوند مورد انتظار شروع نشود یا توکن کوتاه باشد،
 * `null` برمی‌گرداند تا با deep-link های نامرتبط اشتباه نشود.
 */
export function extractTokenFromStartParam(
  value: string | null | undefined
): string | null {
  if (!value || !value.startsWith(APP_START_PREFIX)) return null;

  const rest = value.slice(APP_START_PREFIX.length);
  const separator = rest.indexOf('_');
  const token = separator === -1 ? rest : rest.slice(0, separator);

  return token.length >= MIN_TOKEN_LENGTH ? token : null;
}

/**
 * استخراج پارامتر deep-link اصلی (بدون توکن).
 * برای `t_<token>` مقدار `undefined` می‌دهد و برای
 * `t_<token>_store` مقدار `'store'`.
 */
export function extractStartParam(
  value: string | null | undefined
): string | undefined {
  if (!value || !value.startsWith(APP_START_PREFIX)) {
    return value ?? undefined;
  }

  const rest = value.slice(APP_START_PREFIX.length);
  const separator = rest.indexOf('_');
  return separator === -1 ? undefined : rest.slice(separator + 1);
}
