import type { Env } from '../types';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  رسانه — ذخیره‌سازی فایل در R2 و لینک‌کردن آن در دیتابیس
 * ═════════════════════════════════════════════════════════════════════
 *
 *  معماری: فایل‌های باینری (صوت تلفظ) در **R2** می‌نشینند و دیتابیس فقط
 *  یک ردیف سبک (`media_files`) نگه می‌دارد که کلید، نوع، زبان و اندازه را
 *  دارد. لینک کاربر از route سرو کردن فایل ساخته می‌شود، نه از R2 مستقیم.
 *
 *  ⚠️ چرا route خودمان و نه URL عمومی R2: URL عمومی ربطی به احراز هویت
 *  ندارد و عوض کردن موتور ذخیره‌سازی (مثلاً مهاجرت به S3) نباید لینک‌های
 *  ذخیره‌شده در دیتابیس را بشکند.
 */

export interface MediaRow {
  id: string;
  kind: string;
  storage_key: string;
  owner_key: string;
  language: string | null;
  voice: string | null;
  mime_type: string;
  byte_size: number;
  duration_ms: number | null;
  source: string | null;
  created_at: string;
}

/** آیا R2 روی این Worker در دسترس است؟ */
export function hasMediaBucket(env: Env): boolean {
  return Boolean(env.MEDIA_BUCKET);
}

/**
 * ساخت کلید یکتا برای آبجکت در R2.
 *
 * شکل: `audio/<lang>/<hash>.mp3` — هش از متن و صدا گرفته می‌شود تا متن
 * یکسان همیشه یک فایل بگیرد (تولید دوبارهٔ صوت = هزینه).
 */
export function buildStorageKey(kind: string, lang: string, ownerKey: string): string {
  return `${kind.toLowerCase()}/${lang || 'xx'}/${ownerKey}`;
}

/** هش ساده و پایدار (FNV-1a) — برای کلید فایل کافی است */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** کلید مالك معنایی برای یک قطعه صوت */
export function buildAudioOwnerKey(lang: string, text: string, voice = 'default'): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return `tts:${lang}:${voice}:${fnv1a(normalized)}`;
}

export interface StoredMedia {
  storageKey: string;
  /** لینکی که به کاربر داده می‌شود (نسبی به origin) */
  url: string;
  mimeType: string;
  byteSize: number;
  fromCache: boolean;
}

/**
 * صوت را ذخیره می‌کند و لینک آن را برمی‌گرداند.
 *
 * ترتیب کار:
 *   ۱) اگر R2 نباشد → خطا (caller باید پیام مناسب بدهد)
 *   ۲) اگر ردیف دیتابیس با همان owner_key باشد → همان لینک (بدون تولید دوباره)
 *   ۳) وگرنه فایل را در R2 می‌گذارد و ردیف می‌سازد
 */
export async function storeAudio(
  env: Env,
  db: MediaRepo,
  input: {
    audio: Uint8Array;
    language: string;
    ownerKey: string;
    voice?: string;
    source?: string;
  }
): Promise<StoredMedia> {
  if (!env.MEDIA_BUCKET) {
    throw new Error('MEDIA_BUCKET is not configured');
  }

  const storageKey = buildStorageKey('audio', input.language, input.ownerKey);

  // ۱) اگر آبجکت از قبل هست، فقط ردیف DB را مطمئن شو
  const existing = await db.findMediaByOwnerKey('AUDIO', input.ownerKey);
  if (existing) {
    const head = await env.MEDIA_BUCKET.head(existing.storage_key);
    if (head) {
      return {
        storageKey: existing.storage_key,
        url: mediaUrl(env, existing.storage_key),
        mimeType: existing.mime_type,
        byteSize: existing.byte_size,
        fromCache: true,
      };
    }
    // ردیف هست ولی فایل نیست → دوباره بنویس
  }

  await env.MEDIA_BUCKET.put(storageKey, input.audio, {
    httpMetadata: {
      contentType: 'audio/mpeg',
      // صوت‌ها تغییرناپذیرند (کلید از هش متن است) → کش طولانی
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      ownerKey: input.ownerKey,
      language: input.language,
      voice: input.voice ?? 'default',
      source: input.source ?? 'tts',
    },
  });

  await db.upsertMediaFile({
    kind: 'AUDIO',
    storageKey,
    ownerKey: input.ownerKey,
    language: input.language,
    voice: input.voice ?? 'default',
    mimeType: 'audio/mpeg',
    byteSize: input.audio.byteLength,
    source: input.source ?? 'tts',
  });

  return {
    storageKey,
    url: mediaUrl(env, storageKey),
    mimeType: 'audio/mpeg',
    byteSize: input.audio.byteLength,
    fromCache: false,
  };
}

/** لینک سرو کردن فایل — نسبی تا origin در هر محیطی درست باشد */
export function mediaUrl(env: Env, storageKey: string): string {
  const base = env.MEDIA_URL_BASE ?? '/kpanah56/8fjg7rfb/v1/media';
  return `${base}/${storageKey}`;
}

/** خواندن فایل از R2 (برای route سرو کردن) */
export async function readMediaObject(
  env: Env,
  storageKey: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!env.MEDIA_BUCKET) return null;
  const obj = await env.MEDIA_BUCKET.get(storageKey);
  if (!obj) return null;
  return {
    body: await obj.arrayBuffer(),
    contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
  };
}

/** حدس مدت صوت از تعداد بایت (mp3 ~ ۱۶kbps برای کوتاه) — تقریبی */
export function estimateDurationMs(byteSize: number): number {
  return Math.round((byteSize / 16000) * 1000);
}

// ─────────────────────────────────────────────────────────────────────
//  توابع کمکی DB — جدا نگه داشته شده تا media.ts به repository وابسته نباشد
// ─────────────────────────────────────────────────────────────────────

export interface MediaRepo {
  findMediaByOwnerKey(
    kind: string,
    ownerKey: string
  ): Promise<{
    id: string;
    storage_key: string;
    mime_type: string;
    byte_size: number;
    duration_ms: number | null;
  } | null>;
  upsertMediaFile(input: {
    kind: string;
    storageKey: string;
    ownerKey: string;
    language: string;
    voice: string;
    mimeType: string;
    byteSize: number;
    source: string;
  }): Promise<void>;
}
