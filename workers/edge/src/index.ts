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

import { handleAuth, handleMe, handleHealth } from './routes/auth';
import {
  handleHome,
  handleGetTodayLesson,
  handleTelemetry,
  handleCompleteLesson,
  handleOnboarding,
  handleUpdateProfile,
  handleDeleteAccount,
  handleProgress,
  handleDebugDelta,
  runCycleGeneration,
} from './routes/learn';
import { handlePlans, handleCreateInvoice } from './routes/store';
import {
  handleAdminUsers,
  handleAdminUserDetail,
  handleAdminGift,
  handleAdminRevoke,
  handleAdminStats,
} from './routes/admin';
import {
  handleAdminListProviders,
  handleAdminCreateProvider,
  handleAdminUpdateProvider,
  handleAdminDeleteProvider,
  handleAdminReorderProviders,
  handleAdminTestProvider,
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
    const route = resolveRoute(url);

    // ── 2. مسیر ناشناخته → پاسخ مبهم (اطلاعات لو نمی‌دهیم) ─────────
    if (!isKnownPath(url, env, route.action)) {
      return new Response('Not Found', { status: 404 });
    }

    const baseContext = { env, requestId };

    try {
      // ── 3. rate limit ─────────────────────────────────────────────
      const limited = await enforceRateLimit(request, baseContext);
      if (limited) return withCors(limited, origin);

      // ── 4. auth ───────────────────────────────────────────────────
      const auth = await authenticate(request, env, requestId, route.routeClass);
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
} satisfies ExportedHandler<Env>;

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
    case 'progress':
      return handleProgress(request, context);
    case 'debug-delta':
      return handleDebugDelta(request, context);

    // store
    case 'plans':
      return handlePlans(request, context);
    case 'create-invoice':
      return handleCreateInvoice(request, context);

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
