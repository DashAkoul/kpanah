import type { Env, RequestContext } from './types';
import { withDefaults } from './config';
import {
  corsHeaders,
  jsonError,
  newRequestId,
  clientOrigin,
} from './lib/response';
import { resolveRoute, authenticate } from './middleware/auth';
import { enforceRateLimit } from './middleware/rate-limit';
import { scanPayloadForInjection } from './middleware/content-filter';

import { handleAuth, handleAuthLink, handleMe, handleHealth } from './routes/auth';
import {
  handleHome,
  handleGetTodayLesson,
  handleTelemetry,
  handleCompleteLesson,
  handleRetryCycle,
  handleDueReviews,
  handleReviewSubmit,
  handleMarkPart,
  handleSetCoinRate,
  handlePreviewDiscount,
  handleCalibrationTest,
  handleCalibrationSubmit,
  handleEvaluateFreeWrite,
  handleDelayedCheck,
  handleDelayedSubmit,
  handleOnboarding,
  handleUpdateProfile,
  handleDeleteAccount,
  handleProgress,
  handleDebugDelta,
  runCycleGeneration,
} from './routes/learn';
import { handlePlans, handleCreateInvoice } from './routes/store';
import {
  handleSupportCreate,
  handleSupportList,
  handleSupportThread,
  handleSupportReply,
  handleSupportClose,
} from './routes/support';
import {
  handleAdminUsers,
  handleAdminUserDetail,
  handleAdminGift,
  handleAdminRevoke,
  handleAdminStats,
  handleAdminSupportList,
  handleAdminSupportThread,
  handleAdminSupportReply,
  handleAdminListAdmins,
  handleAdminSetRole,
  handleAdminMessageSend,
  handleAdminMessagesList,
  handleAdminPlans,
  handleAdminPlanCreate,
  handleAdminPlanUpdate,
  handleAdminPlanDelete,
} from './routes/admin';
import { handleMessagesList, handleMessagesRead } from './routes/messages';
import { runLessonGeneration } from './routes/learn';
import { handleMediaSpeak, handleMediaFile, isMediaRequest } from './routes/media';
import {
  runHourlyMaintenance,
  runBackgroundGeneration,
  runDailyNudges,
} from './services/cron';
import {
  handleAdminListProviders,
  handleAdminCreateProvider,
  handleAdminUpdateProvider,
  handleAdminDeleteProvider,
  handleAdminReorderProviders,
  handleAdminTestProvider,
  handleAdminListProviderModels,
} from './routes/admin-ai';
import { handleTelegramWebhook } from './routes/telegram-bot';
import { handleAdminWebhook } from './routes/admin-bot';

/**
 * ══════════════════════════════════════════════════════════════════
 *  Edge Gateway — the single server entry point.
 *
 *  Request pipeline:
 *    1. CORS preflight
 *    2. route resolution (obfuscated gate path + ?action=)
 *    3. rate limiting
 *    4. authentication (skipped for PUBLIC)
 *    5. payload content scan
 *    6. dispatch
 *
 *  No VPS, no n8n, no container. Everything runs at the edge.
 * ══════════════════════════════════════════════════════════════════
 */

export default {
  async fetch(request: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const env = withDefaults(rawEnv);
    const requestId = newRequestId();
    const origin = clientOrigin(request);

    // ── 1. CORS preflight ───────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);

    // ── ۱.۵) مسیرهای رسانه (صوت) ────────────────────────────────────
    // ⚠️ قبل از دروازهٔ اصلی چک می‌شود: GET فایل باید بدون auth کار کند
    // (کلید از هش متن ساخته شده و محتوای عمومی است)، و POST تولید صوت
    // می‌تواند ناشناس بماند چون کل اثر، تولید است نه افشای داده.
    const media = isMediaRequest(url);
    if (media) {
      try {
        if (media.route === 'speak' && request.method === 'POST') {
          // ⚠️ امنیت: این مسیر از دروازهٔ اصلی عبور نمی‌کند، پس rate-limit
          // خودکار هم ندارد. بدون این، هر کسی می‌تواند بی‌نهایت صوت بسازد
          // و باکس B2 را پر کند. اینجا صریحاً اعمال می‌شود (کلید = IP چون
          // هنوز احراز هویتی انجام نشده).
          const limited = await enforceRateLimit(request, { env, requestId });
          if (limited) return withCors(limited, origin);
          // ⚠️ باگ رفع‌شده: پاسخ این مسیر CORS نداشت. preflight (OPTIONS) هدر
          // را می‌گرفت ولی پاسخ واقعی POST نه → مرورگر پاسخ را بلاک می‌کرد و
          // دکمهٔ «گوش کن» در اپ هیچ کاری نمی‌کرد (بدون هیچ خطای مرئی).
          return withCors(await handleMediaSpeak(request, { env, requestId }), origin);
        }
        if (media.route === 'file' && request.method === 'GET' && media.key) {
          // فایل صوتی هم CORS می‌گیرد تا `<audio>`/fetch روی دامنهٔ فرانت
          // بدون مشکل پخش شود.
          return withCors(await handleMediaFile(media.key, { env, requestId }), origin);
        }
        return new Response('Not Found', { status: 404 });
      } catch (err) {
        console.error(`[${requestId}] media route failed:`, err);
        return new Response('Media Error', { status: 500 });
      }
    }

    const route = resolveRoute(url);

    // ── 2. مسیر ناشناخته → پاسخ مبهم (اطلاعات لو نمی‌دهیم) ─────────
    if (!isKnownPath(url, env, route.action)) {
      return new Response('Not Found', { status: 404 });
    }

    const baseContext = { env, requestId };

    try {
      // ── 3. rate limit ─────────────────────────────────────────────
      // Rate limiting is advisory: if it fails, we prefer serving the
      // request over a hard 500 for every caller.
      try {
        const limited = await enforceRateLimit(request, baseContext);
        if (limited) return withCors(limited, origin);
      } catch (err) {
        console.warn(`[${requestId}] rate limit skipped:`, err);
      }

      // ── 4. auth ───────────────────────────────────────────────────
      const auth = await authenticate(request, env, requestId, route.routeClass, route.action);
      if (auth.error) return withCors(auth.error, origin);

      const context: RequestContext = {
        ...auth.context,
        waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
      };

      // ── 5. content scan (فقط برای payload های حاوی متن کاربر) ─────
      const scanTarget = request.method === 'POST' && route.routeClass === 'AUTHENTICATED';
      let bodyText: string | null = null;

      if (scanTarget) {
        bodyText = await request.clone().text();
        if (bodyText) {
          try {
            const parsed = JSON.parse(bodyText) as unknown;
            const strict =
              route.action === 'update-profile' ||
              route.action === 'onboarding' ||
              route.action === 'admin-gift';
            const scan = scanPayloadForInjection(parsed, { strict });
            if (!scan.allowed) {
              return withCors(
                await jsonError(
                  'CONTENT_REJECTED',
                  `Request rejected: ${scan.reason}${scan.detail ? ` (${scan.detail})` : ''}`,
                  requestId,
                  env,
                  400,
                  'errors.invalid_input'
                ),
                origin
              );
            }
          } catch {
            // بدنه JSON نبود — به route اجازه بده خطای 400 بدهد
          }
        }
      }

      // ── 6. dispatch ───────────────────────────────────────────────
      const response = await dispatch(request, context, route.action, url, env, ctx);
      return withCors(response, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // در production پیام داخلی را به کاربر لو نمی‌دهیم
      console.error(`[${requestId}] Unhandled:`, message, err);

      return withCors(
        await jsonError(
          'INTERNAL_ERROR',
          'An unexpected error occurred',
          requestId,
          env,
          500,
          'errors.server_error'
        ),
        origin
      );
    }
  },

  /**
   * ══════════════════════════════════════════════════════════════════
   *  Cron Triggers
   *
   *  ⚠️ این سه کرون در wrangler.toml تعریف شده بودند ولی **handler نداشتند**
   *  و هیچ کاری نمی‌کردند. اینجا پیاده شده‌اند.
   *
   *  چرا Cron به‌جای Queues: Cloudflare Queues/Workflows فقط روی پلن پولی
   *  فعال است. Cron رایگان است و همین کار را انجام می‌دهد. اگر پلن ارتقا
   *  یافت، binding `GENERATION_QUEUE` را اضافه کنید؛ کد خودکار صف را ترجیح
   *  می‌دهد و کرون نقش تور اطمینان را بازی می‌کند.
   * ══════════════════════════════════════════════════════════════════
   */
  async scheduled(controller: ScheduledController, rawEnv: Env): Promise<void> {
    const env = withDefaults(rawEnv);
    const cron = controller.cron;

    try {
      if (cron === '0 * * * *') {
        const res = await runHourlyMaintenance(env);
        console.log(
          `[cron:hourly] expired subscriptions: ${res.expired}, pruned cache rows: ${res.prunedCache}`
        );
      } else if (cron === '*/5 * * * *') {
        const res = await runBackgroundGeneration(env);
        // یادآور روزانه در پنجرهٔ ±۵ دقیقهٔ ساعتِ انتخابی کاربر
        const nudge = await runDailyNudges(env);
        console.log(
          `[cron:gen] cycles=${res.cycles} lessons=${res.lessons} retried=${res.retried} failed=${res.failed} nudges=${nudge.sent}`
        );
      } else if (cron === '0 9 * * *') {
        const res = await runDailyNudges(env);
        console.log(`[cron:nudge] sent=${res.sent}`);
      } else {
        // کرون ناشناخته: کار نگهداری سبک را انجام بده
        await runHourlyMaintenance(env);
      }
    } catch (err) {
      console.error(`[cron:${cron}] failed:`, err instanceof Error ? err.message : err);
    }
  },

  /**
   * Cloudflare Queues consumer — تولید پس‌زمینهٔ درس.
   *
   * پیام‌ها از دو جا می‌آیند:
   *  ۱. `runCycleGeneration` → شهر `generate-lesson` برای روزهای ۲..۷
   *  ۲. `scheduleCycleGeneration` → شهر `generate-cycle`
   *
   * consumer جدا از درخواست کاربر اجرا می‌شود، پس سقف زمانی Worker
   * مهم نیست (هر batch تا ۳۰ ثانیه فرصت دارد و retry با DLQ).
   */
  async queue(batch: MessageBatch<unknown>, rawEnv: Env): Promise<void> {
    const env = withDefaults(rawEnv);

    for (const msg of batch.messages) {
      const body = msg.body as
        | { kind?: string; userId?: string; cycleId?: string; cycleNumber?: number; dayNumber?: number }
        | null;

      try {
        if (body?.kind === 'generate-cycle' && body.userId && typeof body.cycleNumber === 'number') {
          // ⚠️ اگر Workflow فعال باشد، این پیام تولید شده چون Circuit Breaker
          // صف را به‌عنوان fallback برداشت. اول بررسی کن آخرین چرخه هنوز
          // GENERATING است (Workflow در حال کارش) یا کاملاً تمام شده.
          // اگر چرخه در انتظار بود یعنی Workflow شکست خورده و ما جانشینیم.
          const res = await runCycleGeneration(env, body.userId, body.cycleNumber);
          if (!res.ok) {
            // اگر موقتاً خطا داد، retry (محدودیت retry رسید به DLQ می‌رود)
            msg.retry();
          }
        } else if (
          body?.kind === 'generate-lesson' &&
          body.userId &&
          body.cycleId &&
          typeof body.cycleNumber === 'number' &&
          typeof body.dayNumber === 'number'
        ) {
          const res = await runLessonGeneration(
            env,
            body.userId,
            body.cycleId,
            body.cycleNumber,
            body.dayNumber
          );
          if (!res.ok) msg.retry();
        } else {
          // پیام ناشناخته — دور بریز (skip)
          msg.retry();
        }
      } catch (err) {
        console.error(
          `[queue] message failed:`,
          err instanceof Error ? err.message : String(err)
        );
        msg.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;

// ═════════════════════════════════════════════════════════════════════
// Workflow export — باید در همان Worker باشه تا binding پیدا کند
// ═════════════════════════════════════════════════════════════════════

export { CycleGenerationWorkflow } from './workflow';


// ═════════════════════════════════════════════════════════════════════
// Path validation
// ═════════════════════════════════════════════════════════════════════

function isKnownPath(url: URL, env: Env, action: string): boolean {
  const path = url.pathname.replace(/\/$/, '');

  // دروازه اصلی (مبهم‌سازی‌شده)
  if (path === env.GATE_PATH) return Boolean(action);

  // وب‌هوک‌ها و مسیرهای داخلی
  if (path.endsWith('/telegram/webhook')) return true;
  if (path.endsWith('/telegram/admin-webhook')) return true;
  if (path.endsWith('/internal/queue')) return true;

  // سلامت‌سنجی ساده (بدون افشای ساختار)
  if (path === '/ping') return true;

  return false;
}

// ═════════════════════════════════════════════════════════════════════
// Dispatch table
// ═════════════════════════════════════════════════════════════════════

async function dispatch(
  request: Request,
  context: RequestContext,
  action: string,
  url: URL,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const path = url.pathname.replace(/\/$/, '');

  // ── وب‌هوک‌ها ────────────────────────────────────────────────────
  if (path.endsWith('/telegram/webhook')) {
    return handleTelegramWebhook(request, context);
  }
  if (path.endsWith('/telegram/admin-webhook')) {
    return handleAdminWebhook(request, context);
  }
  if (path.endsWith('/internal/queue')) {
    return handleQueueCallback(request, context, url, env);
  }
  if (path === '/ping') {
    return new Response(JSON.stringify({ pong: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── دروازه اصلی ─────────────────────────────────────────────────
  switch (action) {
    // auth & profile
    case 'auth':
      return handleAuth(request, context);
    case 'auth-link':
      return handleAuthLink(request, context);
    case 'me':
      return handleMe(request, context);
    case 'health':
      return handleHealth(request, context);
    case 'onboarding':
      return handleOnboarding(request, context);
    case 'update-profile':
      return handleUpdateProfile(request, context);
    case 'delete-account':
      return handleDeleteAccount(request, context);

    // learn
    case 'home':
      return handleHome(request, context);
    case 'get-today-lesson':
      return handleGetTodayLesson(request, context);
    case 'telemetry':
      return handleTelemetry(request, context);
    case 'complete-lesson':
      return handleCompleteLesson(request, context);
    case 'retry-cycle':
      return handleRetryCycle(request, context);
    case 'due-reviews':
      return handleDueReviews(request, context);
    case 'review-submit':
      return handleReviewSubmit(request, context);
    case 'mark-part':
      return handleMarkPart(request, context);
    case 'set-coin-rate':
      return handleSetCoinRate(request, context);
    case 'preview-discount':
      return handlePreviewDiscount(request, context);
    case 'calibration-test':
      return handleCalibrationTest(request, context);
    case 'calibration-submit':
      return handleCalibrationSubmit(request, context);
    case 'evaluate-free-write':
      return handleEvaluateFreeWrite(request, context);
    case 'delayed-check':
      return handleDelayedCheck(request, context);
    case 'delayed-submit':
      return handleDelayedSubmit(request, context);
    case 'progress':
      return handleProgress(request, context);
    case 'debug-delta':
      return handleDebugDelta(request, context);

    // store
    case 'plans':
      return handlePlans(request, context);
    case 'create-invoice':
      return handleCreateInvoice(request, context);

    // پشتیبانی (تیکت)
    case 'support-create':
      return handleSupportCreate(request, context);
    case 'support-list':
      return handleSupportList(request, context);
    case 'support-thread':
      return handleSupportThread(request, context);
    case 'support-reply':
      return handleSupportReply(request, context);
    case 'support-close':
      return handleSupportClose(request, context);

    // admin
    case 'admin-users':
      return handleAdminUsers(request, context);
    case 'admin-user-detail':
      return handleAdminUserDetail(request, context);
    case 'admin-gift':
      return handleAdminGift(request, context);
    case 'admin-revoke':
      return handleAdminRevoke(request, context);
    case 'admin-stats':
      return handleAdminStats(request, context);

    // admin — پشتیبانی
    case 'admin-support-list':
      return handleAdminSupportList(request, context);
    case 'admin-support-thread':
      return handleAdminSupportThread(request, context);
    case 'admin-support-reply':
      return handleAdminSupportReply(request, context);

    // admin — نقش‌ها (RBAC)
    case 'admin-list-admins':
      return handleAdminListAdmins(request, context);
    case 'admin-set-role':
      return handleAdminSetRole(request, context);
    case 'admin-message-send':
      return handleAdminMessageSend(request, context);
    case 'admin-messages-list':
      return handleAdminMessagesList(request, context);
    case 'admin-plans':
      return handleAdminPlans(request, context);
    case 'admin-plan-create':
      return handleAdminPlanCreate(request, context);
    case 'admin-plan-update':
      return handleAdminPlanUpdate(request, context);
    case 'admin-plan-delete':
      return handleAdminPlanDelete(request, context);

    // پیام‌های مدیر به کاربر
    case 'messages-list':
      return handleMessagesList(request, context);
    case 'messages-read':
      return handleMessagesRead(request, context);

    // admin — AI provider pool
    case 'admin-ai-providers':
      return handleAdminListProviders(request, context);
    case 'admin-ai-provider-create':
      return handleAdminCreateProvider(request, context);
    case 'admin-ai-provider-update':
      return handleAdminUpdateProvider(request, context);
    case 'admin-ai-provider-delete':
      return handleAdminDeleteProvider(request, context);
    case 'admin-ai-provider-reorder':
      return handleAdminReorderProviders(request, context);
    case 'admin-ai-provider-test':
      return handleAdminTestProvider(request, context);
    case 'admin-ai-provider-models':
      return handleAdminListProviderModels(request, context);

    default:
      return jsonError('NOT_FOUND', `Unknown action`, context.requestId, env, 404);
  }
}

// ═════════════════════════════════════════════════════════════════════
// Queue callback (QStash → Worker)
// ═════════════════════════════════════════════════════════════════════

async function handleQueueCallback(
  request: Request,
  context: RequestContext,
  url: URL,
  env: Env
): Promise<Response> {
  const kind = url.searchParams.get('internal');

  // ── تولید یک درس در پس‌زمینه (تولید ماژولار) ──────────────────────
  if (kind === 'generate-lesson') {
    const body = (await request.json().catch(() => null)) as
      | { userId?: string; cycleId?: string; cycleNumber?: number; dayNumber?: number }
      | null;

    if (
      !body?.userId ||
      !body.cycleId ||
      typeof body.cycleNumber !== 'number' ||
      typeof body.dayNumber !== 'number'
    ) {
      return jsonError(
        'VALIDATION_ERROR',
        'userId, cycleId, cycleNumber and dayNumber required',
        context.requestId,
        env,
        400
      );
    }

    const result = await runLessonGeneration(
      env,
      body.userId,
      body.cycleId,
      body.cycleNumber,
      body.dayNumber
    );

    if (!result.ok) {
      return jsonError(
        'AI_UNAVAILABLE',
        result.error ?? 'Lesson generation failed',
        context.requestId,
        env,
        500
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (kind !== 'generate-cycle') {
    return jsonError('NOT_FOUND', 'Unknown job kind', context.requestId, env, 404);
  }

  const body = (await request.json().catch(() => null)) as
    | { userId?: string; cycleNumber?: number }
    | null;

  if (!body?.userId || typeof body.cycleNumber !== 'number') {
    return jsonError('VALIDATION_ERROR', 'userId and cycleNumber required', context.requestId, env, 400);
  }

  const result = await runCycleGeneration(env, body.userId, body.cycleNumber);

  if (!result.ok) {
    // وضعیت 500 باعث retry خودکار QStash می‌شود
    return jsonError(
      'AI_UNAVAILABLE',
      result.error ?? 'Cycle generation failed',
      context.requestId,
      env,
      500
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ═════════════════════════════════════════════════════════════════════
// CORS
// ═════════════════════════════════════════════════════════════════════

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
