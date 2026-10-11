import type { Env, RequestContext } from '../types';
import { jsonError, newRequestId, getBearerToken } from '../lib/response';
import { verifyJwt } from '../lib/jwt';
import { numberEnv } from '../config';
import type { AuthClaims } from '../types';

/**
 * مسیرهای عمومی که به توکن نیاز ندارند.
 * (auth = نقطه ورود، webhook = تلگرام، qstash = صف داخلی)
 */
export type RouteClass = 'PUBLIC' | 'AUTHENTICATED' | 'ADMIN' | 'INTERNAL';

export interface RouteMeta {
  action: string;
  routeClass: RouteClass;
}

/**
 * استخراج اکشن از query string دروازه.
 * POST /kpanah56/8fjg7rfb/v1/gate?action=get-today-lesson
 */
export function resolveRoute(url: URL): RouteMeta {
  const action = url.searchParams.get('action') ?? '';
  const internal = url.searchParams.get('internal') ?? '';
  const path = url.pathname;

  // مسیرهای وب‌هوک تلگرام
  if (path.endsWith('/telegram/webhook')) {
    return { action: 'telegram-webhook', routeClass: 'PUBLIC' };
  }
  if (path.endsWith('/telegram/admin-webhook')) {
    return { action: 'telegram-admin-webhook', routeClass: 'PUBLIC' };
  }
  // callback صف
  if (path.endsWith('/internal/queue')) {
    return { action: internal || 'queue', routeClass: 'INTERNAL' };
  }

  return { action, routeClass: routeClassForAction(action) };
}

function routeClassForAction(action: string): RouteClass {
  switch (action) {
    case 'auth':
    case 'auth-link':
    case 'health':
    case 'plans':
      return 'PUBLIC';
    case 'admin-users':
    case 'admin-user-detail':
    case 'admin-gift':
    case 'admin-revoke':
    case 'admin-stats':
    case 'admin-ai-providers':
    case 'admin-ai-provider-create':
    case 'admin-ai-provider-update':
    case 'admin-ai-provider-delete':
    case 'admin-ai-provider-reorder':
    case 'admin-ai-provider-test':
      return 'ADMIN';
    default:
      return 'AUTHENTICATED';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────

export interface AuthOutcome {
  context: RequestContext;
  error?: Response;
}

export async function authenticate(
  request: Request,
  env: Env,
  requestId: string,
  routeClass: RouteClass
): Promise<AuthOutcome> {
  const base: RequestContext = { env, requestId };

  if (routeClass === 'PUBLIC') {
    return { context: base };
  }

  if (routeClass === 'INTERNAL') {
    const ok = await verifyQStash(request, env);
    if (!ok) {
      return {
        context: base,
        error: await jsonError(
          'UNAUTHORIZED', 'Invalid queue signature', requestId, env, 401
        ),
      };
    }
    return { context: base };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      context: base,
      error: await jsonError(
        'UNAUTHORIZED', 'Missing bearer token', requestId, env, 401, 'errors.session_expired'
      ),
    };
  }

  const verified = await verifyJwt<AuthClaims>(token, env.JWT_SECRET);
  if (!verified.ok) {
    const code = verified.error === 'expired' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED';
    return {
      context: base,
      error: await jsonError(
        code,
        `Token rejected: ${verified.error}`,
        requestId,
        env,
        401,
        'errors.session_expired'
      ),
    };
  }

  const claims = verified.payload!;

  if (routeClass === 'ADMIN') {
    const isAdmin = await isAdminUser(claims.telegramId, env);
    if (!isAdmin) {
      return {
        context: base,
        error: await jsonError(
          'UNAUTHORIZED', 'Admin privileges required', requestId, env, 403
        ),
      };
    }
  }

  return {
    context: { ...base, claims, telegramId: claims.telegramId, userId: claims.userId },
  };
}

async function isAdminUser(telegramId: number, env: Env): Promise<boolean> {
  const ids = (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  return ids.includes(telegramId);
}

// ─────────────────────────────────────────────────────────────────────
// QStash signature verification
// ─────────────────────────────────────────────────────────────────────

async function verifyQStash(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('Upstash-Signature');
  if (!signature) return false;

  const keys = [env.QSTASH_CURRENT_SIGNING_KEY, env.QSTASH_NEXT_SIGNING_KEY].filter(
    (k): k is string => Boolean(k)
  );
  if (keys.length === 0) return false;

  const body = await request.clone().text();

  for (const key of keys) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      // QStash از JWT می‌کند امضا؛ بدنه در claim `body` است.
      const parts = signature.split('.');
      if (parts.length !== 3) continue;
      const signingInput = `${parts[0]}.${parts[1]}`;
      const valid = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        base64UrlToBytes(parts[2]!),
        new TextEncoder().encode(signingInput)
      );
      if (!valid) continue;

      const payload = JSON.parse(
        new TextDecoder().decode(base64UrlToBytes(parts[1]!))
      ) as { body?: string };

      // مقایسه بدنه برای اطمینان از عدم دستکاری
      if (typeof payload.body === 'string') {
        const expected = await sha256HexBase64(payload.body);
        const actual = await sha256HexBase64(body);
        if (expected !== actual) continue;
      }
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256HexBase64(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let bin = '';
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export { numberEnv };
