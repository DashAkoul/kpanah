import { PLAN_DURATION_DAYS, PLAN_DEFINITIONS } from '@kpanah/shared';
import type { PlanType } from '@kpanah/shared';
import type { Env, RequestContext } from '../types';
import { jsonSuccess, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/**
 * Admin bot webhook — SEPARATE token from the user bot.
 *
 * Per the locked decisions, phase 1 admin scope is:
 *   /gift <telegram_id> <plan>   → give a subscription
 *   /user <telegram_id>          → inspect a user
 *   /stats                       → dashboard
 *   /revoke <telegram_id>        → expire a subscription
 *   /plans                       → price list reference
 *
 * Every mutation is written to admin_grants (audit trail).
 */

interface AdminUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number };
    text?: string;
  };
  callback_query?: { id: string; from: { id: number }; data?: string };
}

/** دستورات قابل استفاده — به‌عنوان راهنما هم استفاده می‌شود */
const COMMANDS = [
  ['/gift <telegram_id> <plan> [روزهای اضافه]', 'اهدای اشتراک'],
  ['/user <telegram_id>', 'مشاهده اطلاعات کاربر'],
  ['/revoke <telegram_id>', 'لغو اشتراک فعال'],
  ['/stats', 'آمار کلی پلتفرم'],
  ['/plans', 'فهرست پلن‌ها و قیمت‌ها'],
  ['/help', 'راهنما'],
] as const;

export async function handleAdminWebhook(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  const update = await readJson<AdminUpdate>(request);
  if (!update) return jsonSuccess({ ignored: true }, requestId, env);

  const message = update.message;
  if (!message?.from) return jsonSuccess({ ignored: true }, requestId, env);

  const adminId = message.from.id;
  if (!isAdmin(env, adminId)) {
    await adminSend(env, message.chat.id, '⛔️ شما دسترسی مدیریتی ندارید.');
    return jsonSuccess({ denied: true }, requestId, env);
  }

  const text = (message.text ?? '').trim();
  const [command, ...args] = text.split(/\s+/);
  const repo = new ContentRepository(new SupabaseClient(env), env);

  context.waitUntil?.(
    dispatchAdminCommand(env, repo, message.chat.id, adminId, command ?? '', args)
  );

  return jsonSuccess({ ok: true }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// Command dispatch
// ═════════════════════════════════════════════════════════════════════

async function dispatchAdminCommand(
  env: Env,
  repo: ContentRepository,
  chatId: number,
  adminId: number,
  command: string,
  args: string[]
): Promise<void> {
  switch (command) {
    case '/start':
    case '/help':
      return adminHelp(env, chatId);

    case '/plans':
      return adminPlans(env, chatId);

    case '/stats':
      return adminStats(env, repo, chatId);

    case '/gift':
      return adminGift(env, repo, chatId, adminId, args);

    case '/user':
      return adminUser(env, repo, chatId, args);

    case '/revoke':
      return adminRevoke(env, repo, chatId, adminId, args);

    default:
      return adminHelp(env, chatId);
  }
}

async function adminHelp(env: Env, chatId: number): Promise<void> {
  const lines = [
    '🛠 <b>پنل مدیریت</b>',
    '',
    ...COMMANDS.map(([cmd, desc]) => `<code>${escapeHtml(cmd)}</code>\n   ${desc}`),
    '',
    '<b>پلن‌های معتبر:</b>',
    PLAN_DEFINITIONS.map(
      (p) => `   <code>${p.planType}</code> — ${p.titleFa} (${p.durationDays} روز)`
    ).join('\n'),
    '',
    'مثال:',
    '<code>/gift 123456789 1_MONTH</code>',
    '<code>/gift 123456789 3_MONTHS 15</code> → ۱۵ روز اضافه',
  ];
  await adminSend(env, chatId, lines.join('\n'));
}

async function adminPlans(env: Env, chatId: number): Promise<void> {
  const lines = [
    '💳 <b>فهرست پلن‌ها</b>',
    '',
    ...PLAN_DEFINITIONS.map((p) => {
      const finalIrr = Math.round(p.priceIrr * (1 - p.discountPercent / 100));
      return [
        `<b>${p.titleFa}</b>  <code>${p.planType}</code>`,
        `   ${p.durationDays} روز`,
        `   ${finalIrr.toLocaleString('fa-IR')} تومان  |  ${p.priceStars} ⭐`,
      ].join('\n');
    }),
  ];
  await adminSend(env, chatId, lines.join('\n'));
}

async function adminStats(
  env: Env,
  repo: ContentRepository,
  chatId: number
): Promise<void> {
  try {
    const stats = await repo.adminStats();
    const text = [
      '📊 <b>آمار پلتفرم</b>',
      '',
      `کل کاربران: <b>${stats.totalUsers}</b>`,
      `اشتراک فعال: <b>${stats.activeSubscriptions}</b>`,
      `رسید در انتظار: <b>${stats.receiptsPending}</b>`,
    ].join('\n');
    await adminSend(env, chatId, text);
  } catch (err) {
    await adminSend(env, chatId, `❌ خطا: ${escapeHtml(String(err))}`);
  }
}

async function adminGift(
  env: Env,
  repo: ContentRepository,
  chatId: number,
  adminId: number,
  args: string[]
): Promise<void> {
  const [rawId, rawPlan, rawExtra] = args;

  const telegramId = Number(rawId);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env, chatId, '❌ شناسه تلگرام نامعتبر.\nمثال: <code>/gift 123456789 1_MONTH</code>');
    return;
  }

  const planType = normalizePlan(rawPlan);
  if (!planType) {
    await adminSend(
      env,
      chatId,
      `❌ پلن نامعتبر: <code>${escapeHtml(rawPlan ?? '')}</code>\n` +
        `پلن‌های معتبر:\n${PLAN_DEFINITIONS.map((p) => `• <code>${p.planType}</code>`).join('\n')}`
    );
    return;
  }

  const extraDays = Number(rawExtra);
  const bonusDays = Number.isFinite(extraDays) && extraDays > 0 ? Math.trunc(extraDays) : 0;

  const target = await repo.findUserByTelegramId(telegramId);
  if (!target) {
    await adminSend(
      env,
      chatId,
      `❌ کاربری با شناسه <code>${telegramId}</code> پیدا نشد.\n` +
        'کاربر باید ابتدا ربات را استارت کرده باشد.'
    );
    return;
  }

  const admin = await repo.findUserByTelegramId(adminId);

  const sub = await repo.createSubscription({
    userId: target.id,
    planType,
    source: 'ADMIN_GIFT',
    grantedBy: admin?.id ?? null,
    grantNote: `Gifted via admin bot by ${adminId}`,
    extend: true,
  });

  if (bonusDays > 0) {
    const base = new Date(sub.expires_at);
    base.setUTCDate(base.getUTCDate() + bonusDays);
    await repo['db'].update('subscriptions', { id: sub.id }, {
      expires_at: base.toISOString(),
    });
    sub.expires_at = base.toISOString();
  }

  if (admin) {
    await repo.logAdminGrant({
      adminUserId: admin.id,
      targetUserId: target.id,
      subscriptionId: sub.id,
      action: 'GIFT',
      planType,
      daysDelta: (PLAN_DURATION_DAYS[planType] ?? 30) + bonusDays,
      note: 'Gifted via admin bot',
    });
  }

  const name = [target.first_name, target.last_name].filter(Boolean).join(' ') || '—';
  const expiry = new Date(sub.expires_at).toLocaleDateString('fa-IR');

  await adminSend(
    env,
    chatId,
    [
      '✅ <b>اشتراک اهدا شد</b>',
      '',
      `کاربر: ${escapeHtml(name)}`,
      `شناسه: <code>${target.telegram_id}</code>`,
      `پلن: <b>${planType}</b>`,
      bonusDays > 0 ? `روز اضافه: <b>${bonusDays}</b>` : '',
      `اعتبار تا: <b>${expiry}</b>`,
    ]
      .filter(Boolean)
      .join('\n')
  );

  // اطلاع‌رسانی به کاربر
  await notifyGift(env, target.telegram_id, planType, expiry);
}

async function adminUser(
  env: Env,
  repo: ContentRepository,
  chatId: number,
  args: string[]
): Promise<void> {
  const telegramId = Number(args[0]);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env, chatId, '❌ مثال: <code>/user 123456789</code>');
    return;
  }

  const user = await repo.findUserByTelegramId(telegramId);
  if (!user) {
    await adminSend(env, chatId, '❌ کاربر پیدا نشد.');
    return;
  }

  const [sub, cycle, lexical] = await Promise.all([
    repo.getActiveSubscription(user.id),
    repo.getActiveCycle(user.id),
    repo.getLexicalItems(user.id, user.target_language),
  ]);

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';

  await adminSend(
    env,
    chatId,
    [
      '👤 <b>اطلاعات کاربر</b>',
      '',
      `نام: ${escapeHtml(name)}`,
      `یوزرنیم: ${user.username ? '@' + escapeHtml(user.username) : '—'}`,
      `شناسه: <code>${user.telegram_id}</code>`,
      '',
      `زبان رابط: <b>${user.ui_language ?? '—'}</b>`,
      `زبان هدف: <b>${user.target_language}</b>`,
      `سطح: <b>${user.skill_level}</b>`,
      `هدف: <b>${user.learning_goal ?? '—'}</b>`,
      '',
      `اشتراک: <b>${sub ? sub.plan_type : 'بدون اشتراک'}</b>`,
      sub ? `انقضا: ${new Date(sub.expires_at).toLocaleDateString('fa-IR')}` : '',
      `منبع: ${sub?.source ?? '—'}`,
      '',
      `استریک: 🔥 ${user.streak_count} روز`,
      `استارز: ⭐ ${user.stars_balance}`,
      `چرخه: ${cycle ? `#${cycle.cycle_number} (${cycle.status})` : '—'}`,
      `واژگان: ${lexical.length} (تثبیت‌شده: ${lexical.filter((l) => l.mastered).length})`,
    ]
      .filter(Boolean)
      .join('\n')
  );
}

async function adminRevoke(
  env: Env,
  repo: ContentRepository,
  chatId: number,
  adminId: number,
  args: string[]
): Promise<void> {
  const telegramId = Number(args[0]);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    await adminSend(env, chatId, '❌ مثال: <code>/revoke 123456789</code>');
    return;
  }

  const target = await repo.findUserByTelegramId(telegramId);
  if (!target) {
    await adminSend(env, chatId, '❌ کاربر پیدا نشد.');
    return;
  }

  const active = await repo.getActiveSubscription(target.id);
  if (!active) {
    await adminSend(env, chatId, '❌ این کاربر اشتراک فعال ندارد.');
    return;
  }

  await repo.expireSubscription(active.id);

  const admin = await repo.findUserByTelegramId(adminId);
  if (admin) {
    await repo.logAdminGrant({
      adminUserId: admin.id,
      targetUserId: target.id,
      subscriptionId: active.id,
      action: 'REVOKE',
      planType: active.plan_type,
      note: 'Revoked via admin bot',
    });
  }

  await adminSend(
    env,
    chatId,
    `✅ اشتراک <code>${telegramId}</code> (${active.plan_type}) لغو شد.`
  );
}

// ═════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════

function isAdmin(env: Env, telegramId: number): boolean {
  const ids = (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  return ids.includes(telegramId);
}

function normalizePlan(raw: string | undefined): PlanType | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[-\s]/g, '_');
  const aliases: Record<string, PlanType> = {
    '2W': '2_WEEKS', '2_WEEK': '2_WEEKS', '2_WEEKS': '2_WEEKS',
    '1M': '1_MONTH', '1_MONTH': '1_MONTH', MONTH: '1_MONTH',
    '3M': '3_MONTHS', '3_MONTH': '3_MONTHS', '3_MONTHS': '3_MONTHS',
    '6M': '6_MONTHS', '6_MONTH': '6_MONTHS', '6_MONTHS': '6_MONTHS',
    '1Y': '1_YEAR', '1_YEAR': '1_YEAR', YEAR: '1_YEAR',
    TRIAL: 'TRIAL',
  };
  return aliases[upper] ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function adminSend(
  env: Env,
  chatId: number,
  text: string
): Promise<void> {
  const token = env.TELEGRAM_ADMIN_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // ignore
  }
}

async function notifyGift(
  env: Env,
  telegramId: number,
  planType: string,
  expiry: string
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

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: [
          '🎁 <b>یک هدیه برای شما!</b>',
          '',
          `پلن <b>${labels[planType] ?? planType}</b> به‌صورت رایگان به حساب شما اضافه شد.`,
          `اعتبار تا: <b>${expiry}</b>`,
          '',
          'موفق باشید! 🚀',
        ].join('\n'),
        parse_mode: 'HTML',
      }),
    });
  } catch {
    // ignore
  }
}
