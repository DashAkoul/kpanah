import { purchasePlanSchema } from '@kpanah/shared';
import type { Plan } from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';

/**
 * Store & payment.
 *
 * Phase 1 (locked decision): Telegram Stars ONLY.
 * ZarinPal + receipt bot are deferred; the seams are left in place
 * (payment_receipts table, PLAN_DEFINITIONS with priceIrr).
 *
 * Stars flow:
 *   create-invoice  → createInvoiceLink (XTR) → client opens link
 *   Telegram → bot webhook successful_payment → credit subscription
 */

function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=plans
// ═════════════════════════════════════════════════════════════════════

export async function handlePlans(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);

  const plans = await r.getPlans();
  const bankInfo = await r.getSetting<Record<string, string>>('bank_info');
  const features = await r.getSetting<Record<string, boolean>>('features');

  return jsonSuccess(
    {
      plans,
      bankInfo: features?.adminBotReceipt ? bankInfo : null,
      paymentMethods: {
        telegramStars: features?.telegramStars !== false,
        zarinpal: features?.zarinpal === true,
        adminReceipt: features?.adminBotReceipt === true,
      },
      starsOnly: features?.zarinpal !== true && features?.adminBotReceipt !== true,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=create-invoice
//
// Creates a Telegram Stars invoice link. Amount is in Stars (XTR).
// Discount is already folded into `finalPriceStars` by the repository.
// ═════════════════════════════════════════════════════════════════════

export async function handleCreateInvoice(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId, userId } = context;

  if (!telegramId || !userId) {
    return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);
  }

  const body = await readJson(request);
  const parsed = purchasePlanSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'planId is required', requestId, env, 400);
  }

  const r = repo(env);
  const plans = await r.getPlans();
  const plan = plans.find((p) => p.id === parsed.data.planId);

  if (!plan) {
    return jsonError('NOT_FOUND', `Unknown plan: ${parsed.data.planId}`, requestId, env, 404);
  }

  /**
   * تخفیف با سکه: اگر کاربر بخواهد، از **همهٔ** سکه‌هایش برای تخفیف
   * استفاده می‌شود (بعد از خرید موجودی صفر می‌شود).
   */
  const useCoins = (body as { useCoins?: unknown }).useCoins === true;

  let starsAmount = plan.finalPriceStars;
  let discountPercent = 0;
  let discountIrr = 0;

  if (useCoins) {
    const user = await r.findUserById(userId);
    const coins = user?.stars_balance ?? 0;

    const economy = await r.getEconomySettings();
    const rawCfg = (economy.coinDiscount ?? {}) as Partial<CoinDiscountConfig>;
    const cfg: CoinDiscountConfig = {
      coinsPerStep: Number(rawCfg.coinsPerStep) || DEFAULT_COIN_DISCOUNT.coinsPerStep,
      percentPerStep: Number(rawCfg.percentPerStep) || DEFAULT_COIN_DISCOUNT.percentPerStep,
    };

    // قیمت پلن یک‌ماهه = مرجع تخفیف
    const monthly = plans.find((pl) => pl.planType === '1_MONTH') ?? plan;
    const monthlyFinalIrr = Math.round(
      monthly.priceIrr * (1 - monthly.discountPercent / 100)
    );
    const planFinalIrr = Math.round(plan.priceIrr * (1 - plan.discountPercent / 100));

    const d = coinDiscountFor(coins, planFinalIrr, monthlyFinalIrr, cfg);
    discountPercent = d.percent;
    discountIrr = d.irr;
    starsAmount = Math.max(1, Math.ceil(plan.finalPriceStars * (1 - d.percent / 100)));
  }

  const result = await createStarsInvoice(
    env.TELEGRAM_BOT_TOKEN,
    plan,
    userId,
    telegramId,
    { starsAmount, useCoins }
  );

  if (!result.ok) {
    return jsonError(
      'INTERNAL_ERROR',
      result.error ?? 'Could not create invoice',
      requestId,
      env,
      502,
      'errors.payment_unavailable'
    );
  }

  return jsonSuccess(
    {
      invoiceLink: result.invoiceLink,
      planId: plan.id,
      amountStars: starsAmount,
      planTitle: plan.titleFa,
      discountPercent,
      discountIrr,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// Telegram createInvoiceLink
// ═════════════════════════════════════════════════════════════════════

/**
 * تخفیف بر اساس سکه — **نرخ تبدیل به کاربر نشان داده نمی‌شود**.
 *
 * قاعده: هر `coinsPerStep` سکه = `percentPerStep`٪ تخفیف روی پلن **یک‌ماهه**.
 * برای پلن‌های دیگر، همان «مبلغ تخفیف» محاسبه و به درصدِ همان پلن تبدیل
 * می‌شود؛ پس درصد در پلن‌های بلندتر کمتر می‌شود (چون قیمتشان بیشتر است).
 */
export interface CoinDiscountConfig {
  coinsPerStep: number;
  percentPerStep: number;
}

export const DEFAULT_COIN_DISCOUNT: CoinDiscountConfig = {
  coinsPerStep: 1000,
  percentPerStep: 5,
};

/** حداکثر تخفیف مجاز (درصد) — جلوگیری از اشتراک رایگان */
const MAX_COIN_DISCOUNT_PCT = 90;

export function coinDiscountFor(
  coins: number,
  planFinalIrr: number,
  monthlyFinalIrr: number,
  cfg: CoinDiscountConfig
): { percent: number; irr: number; steps: number } {
  const step = Math.max(1, cfg.coinsPerStep);
  const steps = Math.floor(Math.max(0, coins) / step);
  if (steps <= 0 || planFinalIrr <= 0) return { percent: 0, irr: 0, steps: 0 };

  const moneyIrr = steps * monthlyFinalIrr * (cfg.percentPerStep / 100);
  const percent = Math.min(
    MAX_COIN_DISCOUNT_PCT,
    Math.floor((moneyIrr / planFinalIrr) * 100)
  );
  return { percent, irr: Math.round((planFinalIrr * percent) / 100), steps };
}

export interface InvoiceResult {
  ok: boolean;
  invoiceLink?: string;
  error?: string;
}

export async function createStarsInvoice(
  botToken: string,
  plan: Plan,
  userId: string,
  telegramId: number,
  opts: { starsAmount?: number; useCoins?: boolean } = {}
): Promise<InvoiceResult> {
  const amount = Math.max(1, Math.round(opts.starsAmount ?? plan.finalPriceStars));

  // payload برای بازگشت در successful_payment — باید قابل تجزیه باشد
  const payload = JSON.stringify({
    v: 1,
    planId: plan.id,
    planType: plan.planType,
    userId,
    telegramId,
    ...(opts.useCoins ? { coins: 1, stars: amount } : {}),
  });

  // Telegram payload محدودیت طول دارد
  if (payload.length > 128) {
    return { ok: false, error: 'invoice payload too long' };
  }

  const body = {
    title: `${plan.titleFa} — اشتراک آموزش زبان`,
    description: `${plan.durationDays} روز دسترسی کامل به معلم هوشمند تطبیقی`,
    payload,
    currency: 'XTR',
    prices: [{ label: plan.titleFa, amount }],
  };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const json = (await res.json()) as {
      ok: boolean;
      result?: string;
      description?: string;
    };

    if (!json.ok || !json.result) {
      return { ok: false, error: json.description ?? `Telegram returned not-ok` };
    }

    return { ok: true, invoiceLink: json.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ═════════════════════════════════════════════════════════════════════
// Fulfilment — called from the bot webhook on successful_payment
// ═════════════════════════════════════════════════════════════════════

export interface FulfilInput {
  telegramChargeId: string;
  providerChargeId?: string;
  totalAmount: number;
  currency: string;
  invoicePayload: string;
  telegramId: number;
}

export interface FulfilResult {
  ok: boolean;
  duplicate?: boolean;
  planType?: string;
  expiresAt?: string;
  error?: string;
}

export async function fulfilStarPayment(
  env: RequestContext['env'],
  input: FulfilInput
): Promise<FulfilResult> {
  if (input.currency !== 'XTR') {
    return { ok: false, error: `Unexpected currency: ${input.currency}` };
  }

  let payload: { planId?: string; planType?: string; userId?: string };
  try {
    payload = JSON.parse(input.invoicePayload) as typeof payload;
  } catch {
    return { ok: false, error: 'invoice payload is not valid JSON' };
  }

  if (!payload.planId || !payload.userId) {
    return { ok: false, error: 'invoice payload missing planId/userId' };
  }

  const r = repo(env);

  // idempotency: تلگرام ممکن است update را تکرار کند
  const existing = await r.findStarTransactionByChargeId(input.telegramChargeId);
  if (existing) {
    return { ok: true, duplicate: true };
  }

  // ★ اعتبارسنجی مبلغ: کاربر نباید با پرداخت کمتر اشتراک کامل بگیرد
  const planRow = await r.getPlanById(payload.planId);
  if (!planRow) {
    return { ok: false, error: `unknown plan: ${payload.planId}` };
  }

  /**
   * اگر با تخفیف سکه خریده باشد، مبلغ انتظاری همان است که در payload
   * امضاشدهٔ خودمان آمده (نه قیمت کامل پلن).
   */
  const payloadStars = Number((payload as { stars?: unknown }).stars);
  const expectedStars =
    Number.isFinite(payloadStars) && payloadStars > 0
      ? payloadStars
      : Math.round(planRow.price_stars * (1 - planRow.discount_percent / 100));

  if (input.totalAmount < expectedStars) {
    return {
      ok: false,
      error: `underpaid: got ${input.totalAmount} XTR, expected ${expectedStars}`,
    };
  }

  const user = await r.findUserById(payload.userId);
  if (!user) {
    return { ok: false, error: 'user not found for payload' };
  }

  const subscription = await r.createSubscription({
    userId: user.id,
    planType: planRow.plan_type,
    source: 'TELEGRAM_STARS',
    priceStars: input.totalAmount,
    paymentRef: input.telegramChargeId,
    extend: true,
  });

  const recorded = await r.recordStarPayment({
    userId: user.id,
    subscriptionId: subscription.id,
    telegramChargeId: input.telegramChargeId,
    providerChargeId: input.providerChargeId,
    amountStars: input.totalAmount,
    planType: planRow.plan_type,
    rawPayload: input,
  });

  // سکه‌ها برای تخفیف مصرف شده‌اند → موجودی صفر می‌شود
  if ((payload as { coins?: unknown }).coins === 1) {
    await r.updateUser(user.id, { stars_balance: 0 }).catch(() => undefined);
  }

  return {
    ok: true,
    duplicate: !recorded,
    planType: planRow.plan_type,
    expiresAt: subscription.expires_at,
  };
}
