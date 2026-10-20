import { authRequestSchema, authLinkRequestSchema } from '@kpanah/shared';
import { SECURITY, languageFromTelegramCode } from '@kpanah/shared';
import type { Env, RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { validateInitData } from '../lib/telegram-auth';
import { signJwt } from '../lib/jwt';
import { consumeLinkToken } from '../lib/link-token';
import { ContentRepository, toUserProfile } from '../services/repository';
import { SupabaseClient } from '../services/supabase';
import { isAdminFromEnv } from './admin';

/** اطلاعات کاربر تلگرام — مشترک بین دو مسیر ورود */
interface TelegramIdentity {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

/**
 * POST /gate?action=auth
 *
 * The only unauthenticated endpoint. Exchanges a Telegram-signed initData
 * blob for a short-lived JWT. Everything else trusts that JWT.
 */
export async function handleAuth(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  const body = await readJson(request);
  const parsed = authRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      'initData is required',
      requestId,
      env,
      400
    );
  }

  const validation = await validateInitData(
    parsed.data.initData,
    env.TELEGRAM_BOT_TOKEN,
    { maxAgeSeconds: SECURITY.initDataMaxAgeSeconds }
  );

  if (!validation.ok || !validation.user) {
    return jsonError(
      'INVALID_INIT_DATA',
      validation.error ?? 'initData validation failed',
      requestId,
      env,
      401,
      'errors.invalid_session'
    );
  }

  const tgUser = validation.user;

  return issueSession(env, requestId, {
    id: tgUser.id,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name,
    username: tgUser.username,
    photo_url: tgUser.photo_url,
    language_code: tgUser.language_code,
  });
}

/**
 * POST /gate?action=auth-link
 *
 * مسیر ورود جایگزین برای زمانی که `initData` در دسترس نیست
 * (مینی‌اپ در BotFather ثبت نشده، یا اپ در وب‌ویو ساده باز شده است).
 *
 * ربات در `/start` یک توکن یک‌بارمصرف می‌سازد و به URL دکمه اضافه
 * می‌کند. اینجا آن توکن بررسی و سوزانده می‌شود.
 */
export async function handleAuthLink(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  const body = await readJson(request);
  const parsed = authLinkRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      'token is required',
      requestId,
      env,
      400
    );
  }

  const record = await consumeLinkToken(env, parsed.data.token);

  if (!record) {
    return jsonError(
      'INVALID_INIT_DATA',
      'Link token is invalid, expired, or already used',
      requestId,
      env,
      401,
      'errors.invalid_session'
    );
  }

  // نام کاربر را از تلگرام می‌گیریم تا پروفایل کامل باشد.
  // (توکن فقط id را حمل می‌کند تا اطلاعات شخصی در URL لو نرود)
  const fallback: TelegramIdentity = {
    id: record.telegramId,
    first_name: `User ${record.telegramId}`,
    language_code: record.languageCode,
  };

  return issueSession(env, requestId, fallback);
}

/**
 * صدور JWT + پروفایل — منطق مشترک هر دو مسیر ورود.
 */
async function issueSession(
  env: Env,
  requestId: string,
  tgUser: TelegramIdentity
): Promise<Response> {
  // زبان از تلگرام استخراج می‌شود؛ کاربر بعداً می‌تواند دستی تغییر دهد
  const detectedLanguage = languageFromTelegramCode(tgUser.language_code);

  const db = new SupabaseClient(env);
  const repo = new ContentRepository(db, env);

  const user = await repo.upsertUser({
    telegramId: tgUser.id,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name,
    username: tgUser.username,
    photoUrl: tgUser.photo_url,
    uiLanguage: detectedLanguage,
    languageSource: 'TELEGRAM',
  });

  if (user.is_blocked) {
    return jsonError(
      'UNAUTHORIZED',
      'Account is blocked',
      requestId,
      env,
      403,
      'errors.account_blocked'
    );
  }

  const subscription = await repo.getActiveSubscription(user.id);
  // نقش ادمین: لیست env → SUPER_ADMIN، وگرنه نقش ذخیره‌شده در دیتابیس.
  // ⚠️ اگر نقش را اینجا resolve نکنیم، مدیرِ env با adminRole=null می‌ماند و
  // تب «مدیران» او را غیرمجاز می‌بیند («فقط مدیر اصلی به این بخش دسترسی دارد»).
  const dbRole = (user as { admin_role?: string | null }).admin_role ?? null;
  const adminRole = isAdminFromEnv(env, tgUser.id) ? 'SUPER_ADMIN' : dbRole;
  const isAdmin = Boolean(adminRole);

  // اگر کاربر ادمین است ولی پرچم در دیتابیس ست نشده، همگام‌سازی کن
  if (isAdmin !== user.is_admin) {
    await repo.updateUser(user.id, { is_admin: isAdmin });
    user.is_admin = isAdmin;
  }

  const token = await signJwt(
    {
      // ⚠️ نام‌ها باید دقیقاً با AuthClaims بخوانند (camelCase).
      // میدلور auth.ts این فیلدها را مستقیم روی context می‌گذارد:
      //   telegramId: claims.telegramId
      // اگر اینجا snake_case بنویسیم، telegramId همیشه undefined
      // می‌شود و همه مسیرهای محافظت‌شده خطای «no identity» می‌دهند.
      telegramId: tgUser.id,
      userId: user.id,
      uiLanguage: user.ui_language ?? detectedLanguage,
    },
    env.JWT_SECRET,
    SECURITY.jwtTtlSeconds
  );

  /**
   * ⚠️ ترجیحات (دقایق روزانه/گویش) در `app_settings` است، نه در جدول users.
   * بدون این، پاسخ `auth` مقدار `dailyMinutes: null` می‌داد و در تنظیمات
   * **هیچ گزینه‌ای انتخاب‌شده دیده نمی‌شد**.
   */
  const prefs = await repo.getUserPrefs(user.id);
  const profile = toUserProfile(user, subscription, { isAdmin, adminRole });
  profile.dailyMinutes = prefs.dailyMinutes;
  profile.dialect = prefs.dialect;
  profile.reminderOn = prefs.reminderOn;
  profile.reminderTime = prefs.reminderTime;

  return jsonSuccess({ token, user: profile }, requestId, env);
}

/**
 * GET|POST /gate?action=me
 * Refresh profile after settings change.
 */
export async function handleMe(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) {
    return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);
  }

  const db = new SupabaseClient(env);
  const repo = new ContentRepository(db, env);

  const user = await repo.findUserByTelegramId(telegramId);
  if (!user) {
    return jsonError('NOT_FOUND', 'User not found', requestId, env, 404);
  }

  const subscription = await repo.getActiveSubscription(user.id);
  const dbRole = (user as { admin_role?: string | null }).admin_role ?? null;
  const adminRole = isAdminFromEnv(env, telegramId) ? 'SUPER_ADMIN' : dbRole;
  const profile = toUserProfile(user, subscription, {
    isAdmin: Boolean(adminRole),
    adminRole,
  });

  return jsonSuccess({ user: profile }, requestId, env);
}

/**
 * GET /gate?action=health
 */
export async function handleHealth(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  return jsonSuccess(
    {
      status: 'ok',
      time: new Date().toISOString(),
      version: '0.1.0',
      features: {
        telegramStars: true,
        adminGift: true,
        payloadEncryption:
          String(env.ENABLE_PAYLOAD_ENCRYPTION ?? 'false') === 'true',
        aiProviders: {
          gemini: Boolean(env.GEMINI_API_KEY),
          deepseek: Boolean(env.DEEPSEEK_API_KEY),
          anthropic: Boolean(env.ANTHROPIC_API_KEY),
        },
      },
    },
    requestId,
    env
  );
}
