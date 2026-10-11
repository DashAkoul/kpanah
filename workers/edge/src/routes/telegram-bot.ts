import type { Env, RequestContext } from '../types';
import { jsonSuccess, readJson } from '../lib/response';
import { buildStartParam } from '@kpanah/shared';
import { fulfilStarPayment } from './store';
import { generateLinkToken, storeLinkToken } from '../lib/link-token';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';
/**
 * Main Telegram bot webhook.
 *
 * Responsibilities:
 *   - /start        → welcome + open Mini App button + language hand-off
 *   - /app, /store  → deep links into the TMA
 *   - pre_checkout  → approve the Stars charge
 *   - successful_payment → credit the subscription
 *
 * Admin commands are handled by a SEPARATE bot token (see admin-bot.ts)
 * so admin tooling never shares an attack surface with user traffic.
 */

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: TelegramFrom;
    chat: { id: number; type: string };
    text?: string;
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id?: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: TelegramFrom;
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

interface TelegramFrom {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export async function handleTelegramWebhook(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  // ── اعتبارسنجی secret webhook ────────────────────────────────────
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const provided = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (provided !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }
  }

  const update = await readJson<TelegramUpdate>(request);
  if (!update) {
    return jsonSuccess({ ignored: true }, requestId, env);
  }

  // ── pre_checkout_query: باید زیر ۱۰ ثانیه پاسخ دهد ────────────────
  if (update.pre_checkout_query) {
    context.waitUntil?.(answerPreCheckout(env, update.pre_checkout_query.id, true));
    return jsonSuccess({ ok: true }, requestId, env);
  }

  const message = update.message;
  if (!message) return jsonSuccess({ ignored: true }, requestId, env);

  // ── پرداخت موفق ──────────────────────────────────────────────────
  if (message.successful_payment && message.from) {
    const payment = message.successful_payment;
    context.waitUntil?.(
      handleSuccessfulPayment(env, message.from.id, payment)
    );
    return jsonSuccess({ ok: true }, requestId, env);
  }

  // ── دستورات متنی ────────────────────────────────────────────────
  const text = (message.text ?? '').trim();
  const from = message.from;

  if (text.startsWith('/start')) {
    const startParam = text.split(' ')[1];
    context.waitUntil?.(
      handleStart(env, message.chat.id, from, startParam)
    );
    return jsonSuccess({ ok: true }, requestId, env);
  }

  if (text.startsWith('/app') || text.startsWith('/store') || text.startsWith('/buy')) {
    defer(context, sendAppButton(env, message.chat.id, from));
    return jsonSuccess({ ok: true }, requestId, env);
  }

  if (text.startsWith('/help')) {
    defer(context, sendHelp(env, message.chat.id));
    return jsonSuccess({ ok: true }, requestId, env);
  }

  return jsonSuccess({ ignored: true }, requestId, env);
}

/**
 * اجرای کار در پس‌زمینه. اگر waitUntil در دسترس نبود (مثلاً در تست)،
 * کار را fire-and-forget با گرفتن خطا اجرا می‌کنیم تا unhandled
 * rejection ایجاد نشود.
 */
function defer(context: RequestContext, work: Promise<unknown>): void {
  if (context.waitUntil) {
    context.waitUntil(work);
  } else {
    void work.catch(() => {});
  }
}

// ═════════════════════════════════════════════════════════════════════
// Handlers
// ═════════════════════════════════════════════════════════════════════

async function handleStart(
  env: Env,
  chatId: number,
  from: TelegramFrom | undefined,
  startParam: string | undefined
): Promise<void> {
  if (!from) return;

  // ثبت کاربر از همان لحظه ورود به ربات (قبل از بازکردن Mini App)
  try {
    const repo = new ContentRepository(new SupabaseClient(env), env);
    await repo.upsertUser({
      telegramId: from.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      uiLanguage: normalizeLang(from.language_code),
      languageSource: 'TELEGRAM',
    });
  } catch {
    // ثبت‌نام غیرحیاتی — auth در TMA هم انجام می‌شود
  }

  const name = from.first_name;
  const text = [
    `سلام ${name} 👋`,
    '',
    'من معلم هوشمند زبان تو هستم.',
    'درس‌ها دقیقاً بر اساس سرعت یادگیری، نقاط ضعف و هدفت ساخته می‌شوند — نه یک برنامه ثابت برای همه.',
    '',
    '🎁 هفته اول کاملاً رایگان است.',
    '',
    'برای شروع، اپلیکیشن را باز کن:',
  ].join('\n');

  await sendMessage(env, chatId, text, {
    reply_markup: await buildAuthedAppKeyboard(env, from, startParam),
  });
}

async function sendAppButton(
  env: Env,
  chatId: number,
  from: TelegramFrom | undefined
): Promise<void> {
  await sendMessage(env, chatId, 'برای ادامه، اپلیکیشن را باز کن:', {
    reply_markup: await buildAuthedAppKeyboard(env, from),
  });
}

async function sendHelp(env: Env, chatId: number): Promise<void> {
  const text = [
    '📚 راهنما',
    '',
    '/app — باز کردن اپلیکیشن آموزشی',
    '/store — خرید اشتراک',
    '/help — همین راهنما',
    '',
    'در اپلیکیشن می‌توانی:',
    '• درس روزانه‌ات را ببینی',
    '• پیشرفتت را دنبال کنی',
    '• اشتراک بخری',
    '• زبان و هدفت را تغییر دهی',
  ].join('\n');

  await sendMessage(env, chatId, text);
}

async function handleSuccessfulPayment(
  env: Env,
  telegramId: number,
  payment: NonNullable<TelegramUpdate['message']>['successful_payment']
): Promise<void> {
  if (!payment) return;

  const result = await fulfilStarPayment(env, {
    telegramChargeId: payment.telegram_payment_charge_id,
    providerChargeId: payment.provider_payment_charge_id,
    totalAmount: payment.total_amount,
    currency: payment.currency,
    invoicePayload: payment.invoice_payload,
    telegramId,
  });

  if (result.ok) {
    const expiry = result.expiresAt
      ? new Date(result.expiresAt).toLocaleDateString('fa-IR')
      : '—';

    const text = result.duplicate
      ? '✅ پرداخت شما قبلاً ثبت شده است.'
      : [
          '🎉 پرداخت با موفقیت انجام شد!',
          '',
          `اشتراک شما فعال شد و تا ${expiry} اعتبار دارد.`,
          '',
          'حالا برگرد به اپلیکیشن و ادامه بده 🚀',
        ].join('\n');

    await sendMessage(env, telegramId, text, {
      reply_markup: await buildAuthedAppKeyboardFor(env, telegramId, undefined),
    });
  } else {
    // خطای پرداخت — کاربر باید مطلع شود، و ما هم لاگ داریم در QStash logs
    await sendMessage(
      env,
      telegramId,
      '⚠️ پرداخت شما انجام شد اما در فعال‌سازی اشتراک مشکلی پیش آمد.\nبا پشتیبانی تماس بگیرید. مشکل به‌صورت خودکار ثبت شد.'
    );
  }
}

// ═════════════════════════════════════════════════════════════════════
// Telegram API helpers
// ═════════════════════════════════════════════════════════════════════

export interface InlineKeyboard {
  inline_keyboard: {
    text: string;
    web_app?: { url: string };
    url?: string;
    callback_data?: string;
  }[][];
}

export function buildAppKeyboard(
  env: Env,
  startParam?: string
): InlineKeyboard {
  const base = env.MINI_APP_URL ?? '';

  if (!base) {
    return { inline_keyboard: [] };
  }

  const params = new URLSearchParams();
  // start_param از deep link ربات به TMA منتقل می‌شود
  if (startParam) params.set('startapp', startParam);

  const qs = params.toString();
  const url = qs ? `${base}?${qs}` : base;

  return {
    inline_keyboard: [[{ text: '🎓 باز کردن اپلیکیشن', web_app: { url } }]],
  };
}

/**
 * همان دکمه، اما با توکن ورود یک‌بارمصرف.
 *
 * چرا لازم است؟ وقتی مینی‌اپ در BotFather ثبت نشده باشد، تلگرام
 * `initData` نمی‌فرستد. در آن حالت کاربر با صفحه خطا روبه‌رو می‌شود.
 * این تابع یک توکن کوتاه‌عمر می‌سازد و آن را به‌صورت `startapp` به اپ
 * می‌رساند؛ سرور با آن هویت را تأیید می‌کند.
 *
 * ⚠️ توکن از طریق query string منتقل نمی‌شود چون تلگرام آن را حذف
 * می‌کند. مسیر درست `startapp` است.
 *
 * اگر KV در دسترس نباشد، به دکمه ساده برمی‌گردیم (بدون توکن) تا
 * ربات در هر شرایطی کار کند.
 */
export async function buildAuthedAppKeyboard(
  env: Env,
  from: TelegramFrom | undefined,
  startParam?: string
): Promise<InlineKeyboard> {
  if (!from) return buildAppKeyboard(env, startParam);
  return buildAuthedAppKeyboardFor(env, from.id, from.language_code, startParam);
}

/**
 * همان دکمه با توکن، اما با شناسه خام کاربر.
 * مسیر پرداخت فقط `telegramId` را در دست دارد (بدون آبجکت `from`).
 */
export async function buildAuthedAppKeyboardFor(
  env: Env,
  telegramId: number,
  languageCode: string | undefined,
  startParam?: string
): Promise<InlineKeyboard> {
  const base = env.MINI_APP_URL ?? '';
  if (!base) return buildAppKeyboard(env, startParam);

  const token = generateLinkToken();
  const stored = await storeLinkToken(env, token, {
    telegramId,
    languageCode: normalizeLang(languageCode),
    issuedAt: Date.now(),
  });

  // KV نبود → دست‌کم دکمه ساده را بده
  if (!stored) {
    return buildAppKeyboard(env, startParam);
  }

  // ⚠️ نکته حیاتی: دکمه‌های `web_app` در تلگرام **query string را
  // حذف می‌کنند**. اگر بنویسیم `?t=<token>`، تلگرام فقط URL ثبت‌شده
  // را باز می‌کند و توکن هرگز به اپ نمی‌رسد.
  //
  // تنها راه انتقال پارامتر، `startapp` است که تلگرام آن را به
  // `tgWebAppStartParam` تبدیل می‌کند و در SDK به‌صورت
  // `initDataUnsafe.start_param` در دسترس قرار می‌دهد.
  //
  // قالب در پکیج shared تعریف شده تا با سمت کلاینت یکسان بماند.
  const merged = buildStartParam(token, startParam);

  return {
    inline_keyboard: [
      [{ text: '🎓 باز کردن اپلیکیشن', web_app: { url: `${base}?startapp=${merged}` } }],
    ],
  };
}

export async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...extra,
      }),
    });
  } catch {
    // پیام غیرحیاتی است
  }
}

async function answerPreCheckout(
  env: Env,
  queryId: string,
  ok: boolean,
  errorMessage?: string
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: queryId,
          ok,
          error_message: errorMessage,
        }),
      }
    );
  } catch {
    // ignore
  }
}

function normalizeLang(code: string | undefined): string {
  if (!code) return 'fa';
  const base = code.split('-')[0]?.toLowerCase() ?? 'fa';
  return ['fa', 'en', 'ar', 'tr', 'ru'].includes(base) ? base : 'fa';
}
