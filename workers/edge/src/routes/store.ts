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

  const result = await createStarsInvoice(
    env.TELEGRAM_BOT_TOKEN,
    plan,
    userId,
    telegramId
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
      amountStars: plan.finalPriceStars,
      planTitle: plan.titleFa,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// Telegram createInvoiceLink
// ═════════════════════════════════════════════════════════════════════

export interface InvoiceResult {
  ok: boolean;
  invoiceLink?: string;
  error?: string;
}

export async function createStarsInvoice(
  botToken: string,
  plan: Plan,
  userId: string,
  telegramId: number
): Promise<InvoiceResult> {
  // payload برای بازگشت در successful_payment — باید قابل تجزیه باشد
  const payload = JSON.stringify({
    v: 1,
    planId: plan.id,
    planType: plan.planType,
    userId,
    telegramId,
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
    prices: [{ label: plan.titleFa, amount: plan.finalPriceStars }],
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

  const expectedStars = Math.round(
    planRow.price_stars * (1 - planRow.discount_percent / 100)
  );

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

  return {
    ok: true,
    duplicate: !recorded,
    planType: planRow.plan_type,
    expiresAt: subscription.expires_at,
  };
}
