import { adminGiftSchema, PLAN_DURATION_DAYS } from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/**
 * Admin console backing endpoints.
 *
 * Scope for phase 1 (per locked decisions):
 *   - manual subscription gifting (all 5 plans)
 *   - revoke / look up users
 *   - dashboard stats
 *
 * NOT in scope yet: receipt review (ZarinPal / OCR) — deferred to phase 2.
 */

export function isAdminFromEnv(
  env: RequestContext['env'],
  telegramId: number
): boolean {
  const ids = (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  return ids.includes(telegramId);
}

function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=admin-users
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminUsers(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);

  const limit = clampInt(url.searchParams.get('limit'), 1, 100, 25);
  const offset = clampInt(url.searchParams.get('offset'), 0, 100_000, 0);
  const search = url.searchParams.get('q') ?? undefined;

  const r = repo(env);
  const users = await r.listUsersForAdmin(limit, offset, search);

  return jsonSuccess({ users, limit, offset }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=admin-user-detail&telegramId=...
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminUserDetail(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);

  const telegramId = Number(url.searchParams.get('telegramId'));
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return jsonError('VALIDATION_ERROR', 'telegramId is required', requestId, env, 400);
  }

  const r = repo(env);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) {
    return jsonError('NOT_FOUND', 'User not found', requestId, env, 404);
  }

  const [subscription, latest, cycle, lexical, stats] = await Promise.all([
    r.getActiveSubscription(user.id),
    r.getLatestSubscription(user.id),
    r.getActiveCycle(user.id),
    r.getLexicalItems(user.id, user.target_language),
    r.getTelemetryForCycle('00000000-0000-0000-0000-000000000000'),
  ]);

  return jsonSuccess(
    {
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        uiLanguage: user.ui_language,
        targetLanguage: user.target_language,
        skillLevel: user.skill_level,
        learningGoal: user.learning_goal,
        onboardingDone: user.onboarding_done,
        streakCount: user.streak_count,
        longestStreak: user.longest_streak,
        starsBalance: user.stars_balance,
        isBlocked: user.is_blocked,
        createdAt: user.created_at,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            planType: subscription.plan_type,
            status: subscription.status,
            source: subscription.source,
            startsAt: subscription.starts_at,
            expiresAt: subscription.expires_at,
          }
        : null,
      lastSubscription: latest
        ? { planType: latest.plan_type, status: latest.status, expiresAt: latest.expires_at }
        : null,
      cycle: cycle
        ? { id: cycle.id, cycleNumber: cycle.cycle_number, status: cycle.status, title: cycle.title }
        : null,
      lexical: {
        total: lexical.length,
        mastered: lexical.filter((l) => l.mastered).length,
        boxes: [1, 2, 3, 4, 5].map(
          (b) => lexical.filter((l) => l.box === b).length
        ),
      },
      telemetryCount: stats.length,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-gift
//
// هدیه دستی اشتراک — دقیقاً همان چیزی که در تصمیمات قفل شد.
// اگر extend=true باشد، از انتهای اشتراک فعال فعلی محاسبه می‌شود.
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminGift(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId: adminUserId } = context;

  const body = await readJson(request);
  const parsed = adminGiftSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid gift payload',
      requestId,
      env,
      400
    );
  }

  const { telegramId, planType, note, extend } = parsed.data;

  const r = repo(env);

  // ادمین را در دیتابیس پیدا کن (برای audit trail)
  let adminRowId = adminUserId ?? null;
  if (!adminRowId) {
    const admin = await r.findUserByTelegramId(context.telegramId!);
    adminRowId = admin?.id ?? null;
  }

  const target = await r.findUserByTelegramId(telegramId);
  if (!target) {
    return jsonError(
      'NOT_FOUND',
      `No user with telegram_id ${telegramId}. The user must start the bot first.`,
      requestId,
      env,
      404
    );
  }

  const existing = await r.getActiveSubscription(target.id);

  const subscription = await r.createSubscription({
    userId: target.id,
    planType,
    source: 'ADMIN_GIFT',
    grantedBy: adminRowId,
    grantNote: note ?? null,
    extend,
  });

  if (adminRowId) {
    await r.logAdminGrant({
      adminUserId: adminRowId,
      targetUserId: target.id,
      subscriptionId: subscription.id,
      action: extend && existing ? 'EXTEND' : 'GIFT',
      planType,
      daysDelta: PLAN_DURATION_DAYS[planType],
      note,
    });
  }

  // اطلاع‌رسانی به کاربر از طریق ربات (اختیاری و غیرحیاتی)
  context.waitUntil?.(
    notifyUserOfGift(env, target.telegram_id, planType, subscription.expires_at)
  );

  return jsonSuccess(
    {
      granted: true,
      target: {
        telegramId: target.telegram_id,
        name: [target.first_name, target.last_name].filter(Boolean).join(' ') || '—',
      },
      subscription: {
        id: subscription.id,
        planType: subscription.plan_type,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at,
        source: subscription.source,
      },
      replacedActive: Boolean(existing) && !extend,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-revoke
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminRevoke(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, userId: adminUserId } = context;

  const body = await readJson(request);
  const telegramId = Number((body as { telegramId?: unknown } | null)?.telegramId);

  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return jsonError('VALIDATION_ERROR', 'telegramId is required', requestId, env, 400);
  }

  const r = repo(env);

  let adminRowId = adminUserId ?? null;
  if (!adminRowId) {
    const admin = await r.findUserByTelegramId(context.telegramId!);
    adminRowId = admin?.id ?? null;
  }

  const target = await r.findUserByTelegramId(telegramId);
  if (!target) {
    return jsonError('NOT_FOUND', 'User not found', requestId, env, 404);
  }

  const active = await r.getActiveSubscription(target.id);
  if (!active) {
    return jsonError('NOT_FOUND', 'No active subscription to revoke', requestId, env, 409);
  }

  await r.expireSubscription(active.id);

  if (adminRowId) {
    await r.logAdminGrant({
      adminUserId: adminRowId,
      targetUserId: target.id,
      subscriptionId: active.id,
      action: 'REVOKE',
      planType: active.plan_type,
      note: 'Revoked by admin console',
    });
  }

  return jsonSuccess({ revoked: true, subscriptionId: active.id }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=admin-stats
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminStats(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);

  const stats = await r.adminStats();
  const plans = await r.getPlans();

  return jsonSuccess({ stats, plans }, requestId, env);
}

// ─────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * پیام تشکر برای کاربری که هدیه گرفته. اگر ربات در دسترس نبود،
 * خطا را نمی‌بلعد تا درخواست ادمین fail نشود.
 */
async function notifyUserOfGift(
  env: RequestContext['env'],
  telegramId: number,
  planType: string,
  expiresAt: string
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  const labels: Record<string, string> = {
    '2_WEEKS': '۲ هفته‌ای',
    '1_MONTH': '۱ ماهه',
    '3_MONTHS': '۳ ماهه',
    '6_MONTHS': '۶ ماهه',
    '1_YEAR': '۱ ساله',
    TRIAL: 'آزمایشی',
  };

  const expiry = new Date(expiresAt).toLocaleDateString('fa-IR');
  const text = [
    '🎁 یک هدیه برای شما!',
    '',
    `پلن ${labels[planType] ?? planType} به‌صورت رایگان به حساب شما اضافه شد.`,
    `اعتبار تا: ${expiry}`,
    '',
    'موفق باشید! 🚀',
  ].join('\n');

  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId, text }),
      }
    );
  } catch {
    // غیرحیاتی
  }
}
