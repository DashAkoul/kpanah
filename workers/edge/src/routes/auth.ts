import { authRequestSchema } from '@kpanah/shared';
import { SECURITY, languageFromTelegramCode } from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { validateInitData } from '../lib/telegram-auth';
import { signJwt } from '../lib/jwt';
import { ContentRepository, toUserProfile } from '../services/repository';
import { SupabaseClient } from '../services/supabase';
import { isAdminFromEnv } from './admin';

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
  const isAdmin = isAdminFromEnv(env, tgUser.id);

  // اگر کاربر ادمین است ولی پرچم در دیتابیس ست نشده، همگام‌سازی کن
  if (isAdmin !== user.is_admin) {
    await repo.updateUser(user.id, { is_admin: isAdmin });
    user.is_admin = isAdmin;
  }

  const token = await signJwt(
    {
      telegram_id: tgUser.id,
      sub: user.id,
      ui_language: user.ui_language ?? detectedLanguage,
    },
    env.JWT_SECRET,
    SECURITY.jwtTtlSeconds
  );

  const profile = toUserProfile(user, subscription, { isAdmin });

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
  const profile = toUserProfile(user, subscription, {
    isAdmin: isAdminFromEnv(env, telegramId),
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
