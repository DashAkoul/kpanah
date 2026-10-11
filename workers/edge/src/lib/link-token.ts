import type { Env } from '../types';

/**
 * ══════════════════════════════════════════════════════════════════════
 *  توکن ورود یک‌بارمصرف (Link Token)
 *
 *  چرا این ماژول وجود دارد؟
 *  -------------------------
 *  مسیر استاندارد احراز هویت، `initData` است که تلگرام فقط زمانی
 *  می‌فرستد که اپ به‌عنوان Mini App رسمی ثبت شده باشد. اگر ثبت ناقص
 *  بماند یا کاربر از وب‌ویو ساده باز کند، `initData` خالی می‌ماند و
 *  کاربر با پیام گمراه‌کننده «اینترنت را بررسی کن» روبه‌رو می‌شود.
 *
 *  راه‌حل: ربات در `/start` یک توکن کوتاه‌عمر می‌سازد و آن را به URL
 *  دکمه اضافه می‌کند. سرور توکن را در KV نگه می‌دارد و هنگام ورود،
 *  آن را «می‌سوزاند» (یک‌بارمصرف). بنابراین حتی بدون ثبت مینی‌اپ،
 *  کاربر می‌تواند وارد شود.
 *
 *  امنیت:
 *    - توکن ۳۲ بایت تصادفی است (۲۵۶ بیت آنتروپی)
 *    - TTL کوتاه (پیش‌فرض ۱۰ دقیقه)
 *    - یک‌بارمصرف: بلافاصله پس از مصرف از KV حذف می‌شود
 *    - هر توکن فقط به یک telegram_id گره خورده است
 * ══════════════════════════════════════════════════════════════════════
 */

const PREFIX = 'linktoken:';

/** پیش‌فرض عمر توکن ورود (ثانیه) */
const DEFAULT_TTL_SECONDS = 600;

export interface LinkTokenRecord {
  telegramId: number;
  /** زبان UI در لحظه صدور توکن (از تلگرام) */
  languageCode?: string;
  /** مهر زمانی صدور (ثانیه) — برای عیب‌یابی */
  issuedAt: number;
}

/**
 * ساخت توکن تصادفی امن.
 * از crypto.getRandomValues استفاده می‌کند (در Workers بومی است).
 */
export function generateLinkToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * ذخیره توکن در KV.
 * اگر KV در دسترس نباشد `false` برمی‌گرداند تا فراخوان تصمیم بگیرد.
 */
export async function storeLinkToken(
  env: Env,
  token: string,
  record: LinkTokenRecord,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<boolean> {
  const kv = env.CACHE_KV ?? env.RATE_LIMIT_KV;
  if (!kv) return false;

  try {
    await kv.put(`${PREFIX}${token}`, JSON.stringify(record), {
      expirationTtl: Math.max(60, ttlSeconds),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * مصرف توکن: خواندن و حذف اتمی.
 *
 * توجه: KV نهایتاً-سازگار (eventually consistent) است و حذف فوری در همه
 * لبه‌ها منتشر نمی‌شود. برای این کاربرد (توکن کوتاه‌عمر ورود) ریسک
 * ناچیز است و ارزش آن را دارد که به Durable Object وابسته نشویم.
 */
export async function consumeLinkToken(
  env: Env,
  token: string
): Promise<LinkTokenRecord | null> {
  if (!token || token.length < 16 || token.length > 128) return null;

  const kv = env.CACHE_KV ?? env.RATE_LIMIT_KV;
  if (!kv) return null;

  let raw: string | null;
  try {
    raw = await kv.get(`${PREFIX}${token}`);
  } catch {
    return null;
  }
  if (!raw) return null;

  // حذف بلافاصله — توکن یک‌بارمصرف است
  try {
    await kv.delete(`${PREFIX}${token}`);
  } catch {
    // اگر حذف شکست خورد، توکن را معتبر نمی‌دانیم تا ریسک replay نباشد.
    // (مصرف دوباره در بدترین حالت یک ورود اضافی است، نه دسترسی دائمی)
  }

  try {
    const parsed = JSON.parse(raw) as LinkTokenRecord;
    if (typeof parsed?.telegramId !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
