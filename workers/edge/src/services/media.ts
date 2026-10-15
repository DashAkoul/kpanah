import type { Env } from '../types';
import { getObject, hasS3, headObject, putObject } from './s3';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  رسانه — ذخیره‌سازی فایل در S3 (Backblaze B2) و لینک‌کردن در دیتابیس
 * ═════════════════════════════════════════════════════════════════════
 *
 *  معماری: فایل‌های باینری (صوت تلفظ) در **S3-compatible storage** می‌نشینند
 *  و دیتابیس فقط یک ردیف سبک (`media_files`) نگه می‌دارد که کلید، نوع، زبان
 *  و اندازه را دارد. لینک کاربر از route سرو کردن فایل ساخته می‌شود، نه از
 *  storage مستقیم.
 *
 *  ⚠️ چرا S3 و نه R2: R2 در ایران در دسترس نیست → Backblaze B2 که API
 *  سازگار با S3 دارد. جزئیات امضا در `services/s3.ts`.
 *
 *  ⚠️ چرا route خودمان و نه URL عمومی storage: باکس **Private** است و عوض
 *  کردن موتور ذخیره‌سازی نباید لینک‌های ذخیره‌شده در دیتابیس را بشکند.
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

/** آیا ذخیره‌سازی رسانه (S3/B2) روی این Worker پیکربندی شده است؟ */
export function hasMediaStorage(env: Env): boolean {
  return hasS3(env);
}

/**
 * ساخت کلید یکتا برای آبجکت در storage.
 *
 * شکل: `audio/<lang>/<ownerKey>` — کلید از هش متن ساخته می‌شود تا متن
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
 *   ۱) اگر storage پیکربندی نشده → خطا (caller پیام مناسب می‌دهد)
 *   ۲) اگر ردیف دیتابیس با همان owner_key باشد → همان لینک (بدون تولید دوباره)
 *   ۳) وگرنه فایل را در storage می‌گذارد و ردیف می‌سازد
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
  if (!hasMediaStorage(env)) {
    throw new Error('media storage is not configured (S3/B2 env missing)');
  }

  const storageKey = buildStorageKey('audio', input.language, input.ownerKey);

  // ۱) اگر آبجکت از قبل هست، فقط ردیف DB را مطمئن شو
  const existing = await db.findMediaByOwnerKey('AUDIO', input.ownerKey);
  if (existing) {
    if (await headObject(env, existing.storage_key)) {
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

  await putObject(env, storageKey, input.audio, {
    contentType: 'audio/mpeg',
    // صوت‌ها تغییرناپذیرند (کلید از هش متن است) → کش طولانی
    cacheControl: 'public, max-age=31536000, immutable',
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

/** لینک سرو کردن فایل — از route خودمان (باکس Private است) */
export function mediaUrl(env: Env, storageKey: string): string {
  const base = env.MEDIA_URL_BASE ?? '/kpanah56/8fjg7rfb/v1/media';
  return `${base}/${storageKey}`;
}

/** خواندن فایل از storage (برای route سرو کردن) */
export async function readMediaObject(
  env: Env,
  storageKey: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!hasMediaStorage(env)) return null;
  return getObject(env, storageKey);
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
