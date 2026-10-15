import { adminGiftSchema, planUpsertSchema, PLAN_DURATION_DAYS } from '@kpanah/shared';
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

// ═════════════════════════════════════════════════════════════════════
// Admin — پشتیبانی (تیکت‌ها)
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminSupportList(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  const r = repo(env);
  const tickets = await r.listAllSupportTickets({ category, status });
  return jsonSuccess({ tickets }, requestId, env);
}

export async function handleAdminSupportThread(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const ticketId = new URL(request.url).searchParams.get('ticketId');
  if (!ticketId) {
    return jsonError('VALIDATION_ERROR', 'ticketId is required', requestId, env, 400);
  }

  const r = repo(env);
  const thread = await r.getSupportThreadAdmin(ticketId);
  if (!thread) return jsonError('NOT_FOUND', 'Ticket not found', requestId, env, 404);

  return jsonSuccess(thread, requestId, env);
}

export async function handleAdminSupportReply(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const body = await readJson<{ ticketId?: string; body?: string }>(request);
  const ticketId = body?.ticketId;
  const message = (body?.body ?? '').trim().slice(0, 2000);

  if (!ticketId || message.length < 1) {
    return jsonError('VALIDATION_ERROR', 'ticketId and body are required', requestId, env, 400);
  }

  const r = repo(env);
  await r.addSupportMessage({
    ticketId,
    userId: '',
    author: 'ADMIN',
    body: message,
  });

  return jsonSuccess({ ok: true }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// Admin — مدیریت نقش‌ها (RBAC)
// ═════════════════════════════════════════════════════════════════════

const ROLES = ['SUPER_ADMIN', 'SUPPORT', 'MARKETING', 'FINANCE'] as const;

/** آیدی‌های ادمین از env (همیشه SUPER_ADMIN) */
function envAdminIds(env: RequestContext['env']): number[] {
  return (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * لیست ادمین‌ها (فقط SUPER_ADMIN).
 *
 * ⚠️ ادمین‌های env ممکن است `admin_role = null` در DB داشته باشند، پس در
 * پرس‌وجوی «admin_role not null» نمی‌آمدند و لیست خالی/ناقص بود. اینجا آن‌ها
 * را با نقش SUPER_ADMIN ادغام می‌کنیم و `is_env: true` می‌گذاریم تا UI
 * اجازهٔ حذف/تغییرشان را ندهد.
 */
export async function handleAdminListAdmins(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);

  const dbAdmins = await r.listAdmins();
  const envIds = envAdminIds(env);

  const present = new Set(
    dbAdmins.map((a) => Number((a as { telegram_id: number }).telegram_id))
  );

  // ادمین‌های env که در DB نقش ثبت‌شده ندارند را اضافه کن
  const missing = envIds.filter((id) => !present.has(id));
  const envRows = await r.findUsersByTelegramIds(missing);

  const envAdmins = envRows.map((row) => ({
    ...row,
    admin_role: 'SUPER_ADMIN',
    is_env: true,
  }));

  // نقش ادمین‌های DB را هم نرمال کن
  const admins = dbAdmins.map((a) => ({
    ...a,
    is_env: envIds.includes(Number((a as { telegram_id: number }).telegram_id)),
  }));

  return jsonSuccess(
    { admins: [...envAdmins, ...admins], roles: ROLES },
    requestId,
    env
  );
}

/** تعیین/حذف نقش ادمین یک کاربر (فقط SUPER_ADMIN) */
export async function handleAdminSetRole(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, adminRole } = context;
  if (adminRole !== 'SUPER_ADMIN') {
    return jsonError('UNAUTHORIZED', 'Only the main admin can change roles', requestId, env, 403);
  }

  const body = await readJson<{ telegramId?: number; role?: string | null; title?: string | null }>(
    request
  );
  const telegramId = body?.telegramId;
  const role = body?.role ?? null;
  const title =
    body?.title === undefined ? undefined : (body.title ?? '').trim().slice(0, 60) || null;

  if (!telegramId || (role !== null && !ROLES.includes(role as never))) {
    return jsonError('VALIDATION_ERROR', 'telegramId and a valid role are required', requestId, env, 400);
  }

  // ادمین env قابل تغییر نیست (همیشه SUPER_ADMIN است)
  if (envAdminIds(env).includes(telegramId)) {
    // ولی لقبش قابل ثبت است
    if (title !== undefined) {
      const r = repo(env);
      const ok = await r.setAdminRole(telegramId, 'SUPER_ADMIN', title);
      if (!ok) {
        return jsonError('NOT_FOUND', 'کاربری با این آیدی پیدا نشد.', requestId, env, 404);
      }
      return jsonSuccess({ ok: true, telegramId, role: 'SUPER_ADMIN', title }, requestId, env);
    }
    return jsonError(
      'VALIDATION_ERROR',
      'این کاربر از طریق تنظیمات سرور (env) مدیر است و نقشش قابل تغییر نیست.',
      requestId,
      env,
      409
    );
  }

  const r = repo(env);
  const ok = await r.setAdminRole(telegramId, role, title);
  if (!ok) {
    return jsonError(
      'NOT_FOUND',
      'کاربری با این آیدی پیدا نشد — کاربر باید ابتدا ربات را استارت کند.',
      requestId,
      env,
      404
    );
  }

  return jsonSuccess({ ok: true, telegramId, role, title }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// Admin — ارسال پیام به کاربران
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminMessageSend(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId: senderTelegramId } = context;
  const body = await readJson<{
    telegramId?: number | null;
    broadcast?: boolean;
    title?: string;
    body?: string;
    kind?: string;
    sendViaBot?: boolean;
  }>(request);

  const text = (body?.body ?? '').trim().slice(0, 3000);
  const title = (body?.title ?? '').trim().slice(0, 150) || null;
  const kind = ['INFO', 'PROMO', 'UPDATE', 'WARNING'].includes(body?.kind ?? '')
    ? body!.kind!
    : 'INFO';

  if (text.length < 2) {
    return jsonError('VALIDATION_ERROR', 'body is required', requestId, env, 400);
  }

  const r = repo(env);
  const botText = title ? `${title}\n\n${text}` : text;
  const viaBot = body?.sendViaBot !== false;

  // نام فرستنده برای تاریخچهٔ پنل مدیر (با لقب، اگر ثبت شده باشد)
  let senderName: string | null = null;
  if (senderTelegramId) {
    const me = await r.findUserByTelegramId(senderTelegramId);
    const base =
      [me?.first_name, me?.last_name].filter(Boolean).join(' ') ||
      me?.username ||
      `#${senderTelegramId}`;
    const title = (me as { admin_title?: string | null } | null)?.admin_title;
    senderName = title ? `${base} (${title})` : base;
  }

  // ── پیام همگانی ──────────────────────────────────────────────────
  if (body?.broadcast) {
    const users = await r.listAllTelegramIds();
    let sent = 0;
    for (const u of users) {
      try {
        await r.createAdminMessage({
          userId: u.id,
          telegramId: u.telegram_id,
          title,
          body: text,
          kind,
          senderTelegramId: senderTelegramId ?? null,
          senderName,
          sentViaBot: viaBot,
        });
        if (viaBot) {
          await sendBotMessage(env, u.telegram_id, botText);
        }
        sent++;
      } catch {
        /* ادامه بده */
      }
    }
    return jsonSuccess({ ok: true, broadcast: true, sent }, requestId, env);
  }

  // ── پیام به یک کاربر ─────────────────────────────────────────────
  const targetTelegramId = body?.telegramId;
  if (!targetTelegramId) {
    return jsonError('VALIDATION_ERROR', 'telegramId or broadcast is required', requestId, env, 400);
  }

  // کاربر را پیدا کن تا userId را داشته باشیم
  const target = await r.findUserByTelegramId(targetTelegramId);
  if (!target) {
    return jsonError(
      'NOT_FOUND',
      'کاربری با این آیدی پیدا نشد — کاربر باید ابتدا ربات را استارت کند.',
      requestId,
      env,
      404
    );
  }

  await r.createAdminMessage({
    userId: target.id,
    telegramId: targetTelegramId,
    title,
    body: text,
    kind,
    senderTelegramId: senderTelegramId ?? null,
    senderName,
    sentViaBot: viaBot,
  });

  if (viaBot) {
    await sendBotMessage(env, targetTelegramId, botText);
  }

  return jsonSuccess({ ok: true, sent: 1 }, requestId, env);
}

/** تاریخچهٔ همهٔ پیام‌های ارسالی — با نام ادمین فرستنده (پنل مدیر) */
export async function handleAdminMessagesList(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);
  const messages = await r.listAllAdminMessages(150);
  return jsonSuccess({ messages }, requestId, env);
}

/** ارسال پیام ساده از ربات */
async function sendBotMessage(env: RequestContext['env'], chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    /* غیرحیاتی */
  }
}

// ═════════════════════════════════════════════════════════════════════
// Admin — CRUD اشتراک‌ها (SUPER_ADMIN / FINANCE)
// ═════════════════════════════════════════════════════════════════════

/** لیست همهٔ پلن‌ها (شامل غیرفعال) برای پنل مدیر */
export async function handleAdminPlans(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);
  const plans = await r.listAllPlans();
  return jsonSuccess({ plans }, requestId, env);
}

/** ساخت پلن جدید */
export async function handleAdminPlanCreate(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const body = await readJson(request);
  const parsed = planUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid plan payload',
      requestId,
      env,
      400
    );
  }

  const r = repo(env);
  try {
    const plan = await r.createPlan(parsed.data);
    return jsonSuccess({ plan }, requestId, env);
  } catch (err) {
    return jsonError(
      'VALIDATION_ERROR',
      err instanceof Error ? err.message : 'Could not create plan',
      requestId,
      env,
      409
    );
  }
}

/** ویرایش پلن (قیمت، تخفیف، عنوان، فعال/غیرفعال …) */
export async function handleAdminPlanUpdate(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const body = await readJson<Record<string, unknown>>(request);
  const parsed = planUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid plan payload',
      requestId,
      env,
      400
    );
  }

  const id =
    (typeof body?.id === 'string' ? body.id : undefined) ??
    new URL(request.url).searchParams.get('id') ??
    '';
  if (!id) {
    return jsonError('VALIDATION_ERROR', 'id is required', requestId, env, 400);
  }

  const r = repo(env);
  try {
    const plan = await r.updatePlan(id, parsed.data);
    return jsonSuccess({ plan }, requestId, env);
  } catch (err) {
    return jsonError(
      'NOT_FOUND',
      err instanceof Error ? err.message : 'Could not update plan',
      requestId,
      env,
      404
    );
  }
}

/** حذف پلن */
export async function handleAdminPlanDelete(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const body = await readJson<{ id?: string }>(request).catch(() => null);
  const id =
    body?.id ?? new URL(request.url).searchParams.get('id') ?? '';
  if (!id) {
    return jsonError('VALIDATION_ERROR', 'id is required', requestId, env, 400);
  }

  const r = repo(env);
  await r.deletePlan(id);
  return jsonSuccess({ deleted: true, id }, requestId, env);
}
