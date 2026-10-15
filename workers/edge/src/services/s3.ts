import { AwsClient } from 'aws4fetch';
import type { Env } from '../types';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  کلاینت S3 — ذخیره‌سازی سازگار با S3 (Backblaze B2)
 * ═════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ چرا S3 و نه R2: سرویس R2 کلادفلر در ایران در دسترس نیست. Backblaze B2
 *  یک API **سازگار با S3** دارد، ولی binding نیتیو Cloudflare نیست — پس
 *  نمی‌توان از `env.BUCKET.put()` استفاده کرد و باید با HTTP + امضای
 *  **SigV4** کار کنیم. کتابخانهٔ `aws4fetch` (۳KB) همین امضا را با WebCrypto
 *  می‌سازد و به `node:crypto` وابسته نیست — پس روی Worker اجرا می‌شود.
 *
 *  فایل‌ها **Private** می‌مانند: کاربر هیچ‌وقت مستقیم به B2 دسترسی ندارد؛
 *  همهٔ ترافیک از route خودمان (`/media/audio/...`) رد می‌شود. این‌طور
 *  عوض‌کردن موتور ذخیره‌سازی لینک‌های ذخیره‌شده در دیتابیس را نمی‌شکند.
 */

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * تنظیمات S3 را از env می‌خواند.
 *
 * ⚠️ کلیدها **secret** هستند (`wrangler secret put`) و هرگز نباید در
 * `wrangler.toml` بیایند — آن فایل commit می‌شود.
 */
export function s3Config(env: Env): S3Config | null {
  const endpoint = env.MEDIA_S3_ENDPOINT?.trim().replace(/\/$/, '');
  const bucket = env.MEDIA_S3_BUCKET?.trim();
  const accessKeyId = env.MEDIA_S3_KEY_ID?.trim();
  const secretAccessKey = env.MEDIA_S3_APP_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint,
    bucket,
    // B2 منطقه را از endpoint می‌گیرد: s3.<region>.backblazeb2.com
    region: env.MEDIA_S3_REGION?.trim() || regionFromEndpoint(endpoint) || 'us-east-1',
    accessKeyId,
    secretAccessKey,
  };
}

/** آیا ذخیره‌سازی S3 پیکربندی شده است؟ */
export function hasS3(env: Env): boolean {
  return s3Config(env) !== null;
}

/** استخراج منطقه از endpoint — الگوی B2: `s3.<region>.backblazeb2.com` */
function regionFromEndpoint(endpoint: string): string | null {
  const m = /^https?:\/\/s3\.([^.]+)\.backblazeb2\.com$/i.exec(endpoint);
  return m?.[1] ?? null;
}

function client(cfg: S3Config): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: cfg.region,
  });
}

/**
 * URL آبجکت (path-style: `endpoint/bucket/key`).
 * هر بخش کلید جداگانه encode می‌شود تا `/`ها حفظ شوند.
 */
function objectUrl(cfg: S3Config, key: string): string {
  const encodedKey = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}/${encodedKey}`;
}

/** نوشتن یک آبجکت */
export async function putObject(
  env: Env,
  key: string,
  body: Uint8Array,
  options: { contentType?: string; cacheControl?: string } = {}
): Promise<void> {
  const cfg = s3Config(env);
  if (!cfg) throw new Error('S3 storage is not configured');

  const res = await client(cfg).fetch(objectUrl(cfg, key), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': options.contentType ?? 'application/octet-stream',
      ...(options.cacheControl ? { 'Cache-Control': options.cacheControl } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`S3 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** آیا آبجکت وجود دارد؟ (بدون دانلود بدنه) */
export async function headObject(env: Env, key: string): Promise<boolean> {
  const cfg = s3Config(env);
  if (!cfg) return false;
  try {
    const res = await client(cfg).fetch(objectUrl(cfg, key), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/** خواندن یک آبجکت (برای route سرو کردن فایل) */
export async function getObject(
  env: Env,
  key: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const cfg = s3Config(env);
  if (!cfg) return null;

  const res = await client(cfg).fetch(objectUrl(cfg, key), { method: 'GET' });
  if (!res.ok) return null;

  return {
    body: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  };
}

/** حذف یک آبجکت */
export async function deleteObject(env: Env, key: string): Promise<boolean> {
  const cfg = s3Config(env);
  if (!cfg) return false;
  const res = await client(cfg).fetch(objectUrl(cfg, key), { method: 'DELETE' });
  return res.ok;
}
