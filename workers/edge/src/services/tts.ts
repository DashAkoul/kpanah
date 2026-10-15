import type { Env } from '../types';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  تبدیل متن به صوت (TTS) — سرویس آنلاین، بدون AI
 * ═════════════════════════════════════════════════════════════════════
 *
 *  چرا «آنلاین» و نه «AI»: تلفظ یک واژه یا جملهٔ کوتاه نیازی به مدل
 *  زبانی ندارد. یک موتور TTS کلاسیک هم همان «bonjour» را درست تلفظ می‌کند،
 *  ولی:
 *    • چند ده برابر ارزان‌تر است (یا رایگان)
 *    • تأخیر بسیار کمتر (مهم برای پخش زیر انگشت کاربر)
 *    • توکن LLM مصرف نمی‌کند
 *
 *  ⚠️ این سرویس فقط برای **تلفظ** است، نه برای تولید صوت طنز/احساسی.
 *
 *  انتخاب موتور با env انجام می‌شود تا بدون تغییر کد قابل تعویض باشد:
 *    TTS_PROVIDER = 'google' (پیش‌فرض) | 'custom'
 *    TTS_BASE_URL  = آدرس سرویس سفارشی (اگر custom باشد)
 *
 *  ⚠️ محدودیت موتور پیش‌فرض (Google Translate TTS): هر درخواست حداکثر
 *  ~۲۰۰ کاراکتر. پس متن‌های بلند را تکه‌تکه می‌فرستیم.
 */

export type TtsVoice = {
  /** شناسهٔ صدا برای کلید کش — مثلاً 'en-female' */
  id: string;
  /** کد زبان BCP-47 — مثلاً 'en' */
  language: string;
  /** جنسیت/لحن — فقط برای نمایش در UI */
  label: string;
};

/** حد اکثر کاراکتر در هر درخواست به موتور پیش‌فرض */
const CHUNK_LIMIT = 180;

/** آدرس موتور پیش‌فرض */
const DEFAULT_TTS_BASE = 'https://translate.google.com/translate_tts';

export interface TtsResult {
  ok: boolean;
  /** بایت‌های فایل صوتی (mp3) */
  audio?: Uint8Array;
  mimeType: string;
  error?: string;
  /** چند تکه مجبور شدیم جدا بفرستیم (برای لاگ/عیب‌یابی) */
  chunks?: number;
}

/** متن را به تکه‌های قابل‌تأمین بر اساس مرزد کلمات می‌شکند (نه از وسط کلمه) */
export function splitForTts(text: string, limit = CHUNK_LIMIT): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= limit) return clean ? [clean] : [];

  const chunks: string[] = [];
  let current = '';
  for (const word of clean.split(' ')) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= limit) {
      current = `${current} ${word}`;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * ساخت آدرس موتور TTS.
 *
 * برای Google Translate TTS پارامترها ie (encoding) و tl (target language)
 * و client لازم است. اگر سرویس دیگری تنظیم شد، آدرس پایه + متن کافی است.
 */
function buildTtsUrl(env: Env, chunk: string, lang: string): string {
  const base = env.TTS_BASE_URL ?? DEFAULT_TTS_BASE;
  const url = new URL(base);
  if (base.includes('translate_tts')) {
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('tl', lang);
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('q', chunk);
  } else {
    url.searchParams.set('q', chunk);
    url.searchParams.set('lang', lang);
  }
  return url.toString();
}

/** یک تکه را به صوت تبدیل می‌کند */
async function synthesizeChunk(
  env: Env,
  chunk: string,
  lang: string
): Promise<Uint8Array> {
  const res = await fetch(buildTtsUrl(env, chunk, lang), {
    headers: {
      // بدون این هدر Google صفحهٔ HTML برمی‌گرداند نه mp3
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`TTS HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
    // محتوای غیرصوتی — معمولاً صفحهٔ خطای HTML
    throw new Error(`TTS returned ${contentType || 'unknown content-type'}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

/**
 * تبدیل متن به صوت.
 *
 * اگر متن از سقف موتور بلندتر باشد، چند تکه گرفته و به هم چسبانده می‌شود.
 * (چسباندن سادهٔ mp3 کار می‌کند چون فریم‌ها مستقل‌اند — کیفیت در تکه‌های
 * بلند کمی افت می‌کند ولی برای تلفظ کوتاه مشکلی نیست.)
 */
export async function synthesizeSpeech(
  env: Env,
  text: string,
  lang: string
): Promise<TtsResult> {
  const chunks = splitForTts(text);
  if (chunks.length === 0) {
    return { ok: false, error: 'empty text', mimeType: 'audio/mpeg' };
  }

  const parts: Uint8Array[] = [];
  for (const chunk of chunks) {
    try {
      parts.push(await synthesizeChunk(env, chunk, lang));
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        mimeType: 'audio/mpeg',
      };
    }
  }

  // چسباندن تکه‌ها
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.length;
  }

  return { ok: true, audio: merged, mimeType: 'audio/mpeg', chunks: parts.length };
}

/**
 * متن را برای گفتار آماده می‌کند.
 *
 * ⚠️ موتورهای TTS نشانه‌های نوشتاری را با الفبا می‌خوانند (مثلاً
 * «...» را «دوتا نقطه» می‌خوانند). این تابع آن‌ها را پاک می‌کند.
 * اگر `speakText` از AI آمده باشد، همین یک بار تمیزکاری نهایی است.
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ') // پرانتز
    .replace(/\[[^\]]*\]/g, ' ') // کروشه
    .replace(/[{}]/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[|/\\]+/g, ' ')
    .replace(/\.{2,}/g, '.') // ... → .
    .replace(/_+/g, ' ') // جای خالی
    .replace(/\s+/g, ' ')
    .trim();
}
