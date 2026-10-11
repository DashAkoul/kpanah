/**
 * Telegram WebApp initData validation.
 *
 * This is real security — unlike the "E2E encryption" in the original spec,
 * which cannot work in a Mini App (the key would ship inside the JS bundle).
 *
 * Algorithm (per Telegram docs):
 *   secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
 *   data_check_string = sorted(key=value pairs joined by "\n", hash excluded)
 *   valid  ⟺  HMAC_SHA256(data_check_string, secret_key) === hash
 */

import type { TelegramUser } from '@kpanah/shared';
import { telegramInitDataUserSchema } from '@kpanah/shared';

export interface InitDataValidationOptions {
  /** حداکثر عمر مجاز initData به ثانیه (پیش‌فرض ۲۴ ساعت) */
  maxAgeSeconds?: number;
  /** در محیط dev اجازه می‌دهد از داده جعلی استفاده شود */
  allowDevBypass?: boolean;
}

export interface InitDataResult {
  ok: boolean;
  user?: TelegramUser;
  authDate?: number;
  queryId?: string;
  startParam?: string;
  error?: string;
}

export async function validateInitData(
  initData: string,
  botToken: string,
  options: InitDataValidationOptions = {}
): Promise<InitDataResult> {
  const maxAge = options.maxAgeSeconds ?? 86_400;

  if (!initData || typeof initData !== 'string') {
    return { ok: false, error: 'initData is empty' };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, error: 'initData is not valid urlencoded data' };
  }

  const hash = params.get('hash');
  if (!hash) {
    return { ok: false, error: 'hash parameter missing' };
  }

  // ── 1. بازسازی data_check_string ──────────────────────────────────
  //
  //  ⚠️ نکتهٔ حیاتی دربارهٔ کلاینت‌های جدید تلگرام:
  //
  //  کلاینت‌های قدیمی: فقط `hash` از محاسبه حذف می‌شد.
  //  کلاینت‌های جدید (tdesktop ≥ 9.6، موبایل‌های اخیر) یک فیلد
  //  `signature` اضافه کرده‌اند که **بخشی از دادهٔ امضاشده است** و
  //  باید در data_check_string بماند.
  //
  //  اگر همیشه `signature` را حذف کنیم، هش کاربران کلاینت جدید
  //  مطابقت نمی‌کند و ورود با «Temporary server issue» شکست می‌خورد.
  //
  //  راه‌حل: هر دو حالت را حساب می‌کنیم و اگر هرکدام مطابق بود،
  //  معتبر است. این هم با کلاینت قدیم و هم جدید سازگار است.
  const buildDataCheckString = (includeSignature: boolean): string => {
    const entries: [string, string][] = [];
    for (const [key, value] of params.entries()) {
      if (key === 'hash') continue;
      if (key === 'signature' && !includeSignature) continue;
      entries.push([key, value]);
    }
    entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return entries.map(([k, v]) => `${k}=${v}`).join('\n');
  };

  const hasSignature = params.has('signature');

  // ── 2. کلید مخفی ──────────────────────────────────────────────────
  const secretKey = await hmacSha256(
    new TextEncoder().encode('WebAppData'),
    new TextEncoder().encode(botToken)
  );

  const computeHash = async (dataCheckString: string): Promise<string> =>
    bytesToHex(
      await hmacSha256(secretKey, new TextEncoder().encode(dataCheckString))
    );

  // ── 3. امضای مورد انتظار ──────────────────────────────────────────
  // ابتدا حالت «با signature» (کلاینت جدید)، سپس حالت «بدون signature».
  const hashWithSig = await computeHash(buildDataCheckString(true));
  const hashWithoutSig = hasSignature
    ? await computeHash(buildDataCheckString(false))
    : hashWithSig;

  const given = hash.toLowerCase();
  const matches =
    timingSafeEqualHex(hashWithSig, given) ||
    timingSafeEqualHex(hashWithoutSig, given);

  if (!matches) {
    return { ok: false, error: 'hash mismatch — initData was not signed by this bot' };
  }

  // ── 4. تازگی ──────────────────────────────────────────────────────
  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number(authDateRaw) : undefined;

  if (authDate !== undefined) {
    if (!Number.isFinite(authDate)) {
      return { ok: false, error: 'auth_date is not a number' };
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > maxAge) {
      return { ok: false, error: `initData expired (age ${ageSeconds}s)` };
    }
    // auth_date در آینده = تلاش دستکاری
    if (ageSeconds < -300) {
      return { ok: false, error: 'auth_date is in the future' };
    }
  }

  // ── 5. کاربر ──────────────────────────────────────────────────────
  const userRaw = params.get('user');
  if (!userRaw) {
    return { ok: false, error: 'user parameter missing' };
  }

  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    return { ok: false, error: 'user parameter is not valid JSON' };
  }

  const parsedUser = telegramInitDataUserSchema.safeParse(userJson);
  if (!parsedUser.success) {
    return {
      ok: false,
      error: `user payload invalid: ${parsedUser.error.issues[0]?.message ?? 'unknown'}`,
    };
  }

  return {
    ok: true,
    user: parsedUser.data,
    authDate,
    queryId: params.get('query_id') ?? undefined,
    startParam: params.get('start_param') ?? undefined,
  };
}

/**
 * اعتبارسنجی initData برای ربات ادمین که از توکن متفاوتی استفاده می‌کند.
 */
export async function buildAdminCheck(
  adminIds: string | undefined,
  telegramId: number
): Promise<boolean> {
  if (!adminIds) return false;
  const ids = adminIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  return ids.includes(telegramId);
}

// ─────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────

export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** مقایسه با زمان ثابت — مقاوم به timing attack */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
