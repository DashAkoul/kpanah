import type { Env, RequestContext } from '../types';
import { jsonSuccess, jsonError } from '../lib/response';
import {
  buildAudioOwnerKey,
  estimateDurationMs,
  hasMediaStorage,
  mediaUrl,
  readMediaObject,
  storeAudio,
} from '../services/media';
import { cleanForSpeech, synthesizeSpeech } from '../services/tts';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  صوت — تولید درخواستی + سرو کردن فایل
 * ═════════════════════════════════════════════════════════════════════
 *
 *  دو route:
 *
 *  ۱) `POST .../media/speak` — متن را می‌گیرد و صوت می‌سازد.
 *     ⚠️ تولید صوت **درخواستی** است، نه هنگام ساخت درس: کاربر وقتی دکمهٔ
 *     پخش را می‌زند. دلیل: اگر هنگام تولید درس برای همهٔ واژه‌ها صوت
 *     بسازیم، یک چرخهٔ ۷ روزه ۵۰-۷۰ فراخوانی TTS می‌خواهد — هم کند است هم
 *     بی‌مصرف (کاربر فقط چند کلمه را پخش می‌کند).
 *
 *  ۲) `GET .../media/<key>` — فایل را از storage (S3/B2) می‌خواند و سرو می‌کند.
 *     ⚠️ هدر کش طولانی: کلید فایل از هش متن ساخته شده، پس محتوا هرگز
 *     تغییر نمی‌کند. یک بار ساخته شده، برای همیشه همان فایل سرو می‌شود.
 */

/** آدرس پایهٔ همهٔ routeهای رسانه */
const MEDIA_BASE = '/kpanah56/8fjg7rfb/v1/media';

export function isMediaRequest(url: URL): { route: 'speak' | 'file'; key?: string } | null {
  if (!url.pathname.startsWith(MEDIA_BASE)) return null;
  const raw = url.pathname.slice(MEDIA_BASE.length).replace(/^\//, '');

  // ⚠️ `url.pathname` شکل percent-encoded را برمی‌گرداند. کلید آبجکت
  // (ownerKey) ممکن است `:` داشته باشد که مرورگر دست‌نخورده می‌فرستد ولی
  // بعضی کلاینت‌ها `%3A` می‌کنند. اگر decode نکنیم، دو URL متفاوت به دو
  // آبجکت متفاوت نگاشت می‌شوند و cache بی‌اثر می‌شود.
  let rest = raw;
  try {
    rest = decodeURIComponent(raw);
  } catch {
    // اگر دنبالهٔ escape ناقص بود، همان خام را استفاده کن
  }

  if (rest === 'speak') return { route: 'speak' };
  if (rest.startsWith('audio/')) return { route: 'file', key: rest };
  return null;
}

/** خروجی مشترک خطا (۵۰۳ = موقتاً در دسترس نیست) */
function unavailable(requestId: string, env: Env, reason: string): Promise<Response> {
  return Promise.resolve(jsonError('AI_UNAVAILABLE', reason, requestId, env, 503));
}

export async function handleMediaSpeak(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  if (!hasMediaStorage(env)) {
    return unavailable(
      requestId,
      env,
      'media storage is not configured (S3/B2 credentials missing)'
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text : '';
  const language = typeof body.language === 'string' ? body.language : 'en';
  const voice = typeof body.voice === 'string' ? body.voice : 'default';

  if (!text.trim()) {
    return jsonError('VALIDATION_ERROR', 'text is required', requestId, env, 400);
  }
  if (text.length > 500) {
    // بیش از این یعنی کلیپ کامل درس است، نه تلفچ یک واژه
    return jsonError('VALIDATION_ERROR', 'text too long (max 500)', requestId, env, 400);
  }

  const speakable = cleanForSpeech(text);
  if (!speakable) {
    return jsonError('VALIDATION_ERROR', 'nothing to speak', requestId, env, 400);
  }

  const r = new ContentRepository(new SupabaseClient(env), env);
  const ownerKey = buildAudioOwnerKey(language, speakable, voice);

  // ۱) اگر قبلاً ساخته شده، همان لینک را بده (صفر فراخوانی TTS)
  const cached = await r.findMediaByOwnerKey('AUDIO', ownerKey);
  if (cached) {
    // ⚠️ باگ رفع‌شده: پیش از این مسیر cache-hit **خام MP3** برمی‌گرداند
    // در حالی که مسیر cache-miss JSON می‌داد. کلاینت همیشه `res.json()`
    // می‌خواند → پخش دومِ همان واژه (برای هر کاربر) با خطا می‌شکست.
    // حالا هر دو مسیر یک شکل پاسخ دارند.
    if (await readMediaObject(env, cached.storage_key)) {
      return jsonSuccess(
        {
          url: mediaUrl(env, cached.storage_key),
          mimeType: cached.mime_type,
          byteSize: cached.byte_size,
          durationMs: cached.duration_ms ?? estimateDurationMs(cached.byte_size),
          fromCache: true,
        },
        requestId,
        env
      );
    }
    // ردیف هست ولی فایل در storage نیست → از نو بساز
  }

  // ۲) تولید صوت با سرویس آنلاین
  const tts = await synthesizeSpeech(env, speakable, language);
  if (!tts.ok || !tts.audio) {
    return unavailable(requestId, env, tts.error ?? 'speech synthesis failed');
  }

  // ۳) ذخیره در storage (S3/B2) + ثبت در DB
  const stored = await storeAudio(env, r, {
    audio: tts.audio,
    language,
    ownerKey,
    voice,
    source: env.TTS_PROVIDER ?? 'online-tts',
  });

  return jsonSuccess(
    {
      url: stored.url,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      durationMs: estimateDurationMs(stored.byteSize),
      fromCache: stored.fromCache,
    },
    requestId,
    env
  );
}

/** سرو کردن فایل از R2 با کش طولانی (کلید = هش متن، پس تغییرناپذیر) */
export async function handleMediaFile(
  key: string,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  if (!hasMediaStorage(env)) {
    return unavailable(requestId, env, 'media storage is not configured');
  }

  const obj = await readMediaObject(env, key);
  if (!obj) {
    return jsonError('NOT_FOUND', 'media not found', requestId, env, 404);
  }

  return audioResponse(obj, requestId, env, 31_536_000); // ۱ سال
}

/** پاسخ صوتی با هدرهای کش */
function audioResponse(
  obj: { body: ArrayBuffer; contentType: string },
  requestId: string,
  env: Env,
  maxAge: number
): Response {
  const etag = `"${simpleHash(obj.body)}"`;
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.contentType,
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      ETag: etag,
      'X-Request-Id': requestId,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/** هش سبک برای ETag — بدون وابستگی به crypto */
function simpleHash(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(view.length / 4096));
  for (let i = 0; i < view.length; i += step) {
    hash ^= view[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
