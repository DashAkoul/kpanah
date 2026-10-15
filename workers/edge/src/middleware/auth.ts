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
    case 'admin-support-list':
    case 'admin-support-thread':
    case 'admin-support-reply':
    case 'admin-plans':
    case 'admin-plan-create':
    case 'admin-plan-update':
    case 'admin-plan-delete':
    case 'admin-message-send':
    case 'admin-messages-list':
    case 'admin-list-admins':
    case 'admin-set-role':
    case 'admin-ai-providers':
    case 'admin-ai-provider-create':
    case 'admin-ai-provider-update':
    case 'admin-ai-provider-delete':
    case 'admin-ai-provider-reorder':
    case 'admin-ai-provider-test':
    case 'admin-ai-provider-models':
      return 'ADMIN';
    default:
      return 'AUTHENTICATED';
  }
}

/**
 * RBAC — کدام نقش‌ها به کدام اکشن‌های ادمین دسترسی دارند.
 *
 * SUPER_ADMIN همه‌چیز. بقیه فقط دامنهٔ خودشان:
 *   SUPPORT   → تیکت‌ها + دیدن کاربران (بدون داده مالی حساس)
 *   MARKETING → آمار/کاربران + پیام همگانی
 *   FINANCE   → کاربران + اشتراک‌ها + آمار
 */
export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'MARKETING' | 'FINANCE';

const ADMIN_ACTION_ROLES: Record<string, AdminRole[]> = {
  'admin-users': ['SUPER_ADMIN', 'SUPPORT', 'MARKETING', 'FINANCE'],
  'admin-user-detail': ['SUPER_ADMIN', 'SUPPORT', 'MARKETING', 'FINANCE'],
  'admin-stats': ['SUPER_ADMIN', 'MARKETING', 'FINANCE'],
  'admin-gift': ['SUPER_ADMIN', 'FINANCE'],
  'admin-revoke': ['SUPER_ADMIN', 'FINANCE'],
  'admin-support-list': ['SUPER_ADMIN', 'SUPPORT'],
  'admin-support-thread': ['SUPER_ADMIN', 'SUPPORT'],
  'admin-support-reply': ['SUPER_ADMIN', 'SUPPORT'],
  'admin-plans': ['SUPER_ADMIN', 'FINANCE'],
  'admin-plan-create': ['SUPER_ADMIN', 'FINANCE'],
  'admin-plan-update': ['SUPER_ADMIN', 'FINANCE'],
  'admin-plan-delete': ['SUPER_ADMIN', 'FINANCE'],
  'admin-message-send': ['SUPER_ADMIN', 'MARKETING'],
  'admin-messages-list': ['SUPER_ADMIN', 'MARKETING'],
  // مدیریت نقش‌ها فقط برای مدیر اصلی
  'admin-list-admins': ['SUPER_ADMIN'],
  'admin-set-role': ['SUPER_ADMIN'],
  // کلید AI فقط برای مدیر اصلی
  'admin-ai-providers': ['SUPER_ADMIN'],
  'admin-ai-provider-create': ['SUPER_ADMIN'],
  'admin-ai-provider-update': ['SUPER_ADMIN'],
  'admin-ai-provider-delete': ['SUPER_ADMIN'],
  'admin-ai-provider-reorder': ['SUPER_ADMIN'],
  'admin-ai-provider-test': ['SUPER_ADMIN'],
  'admin-ai-provider-models': ['SUPER_ADMIN'],
};

/** آیا این نقش اجازهٔ این اکشن را دارد؟ */
export function roleAllows(action: string, role: AdminRole): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const allowed = ADMIN_ACTION_ROLES[action];
  if (!allowed) return false;
  return allowed.includes(role);
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
  routeClass: RouteClass,
  /** اکشن درخواست — برای بررسی RBAC روی مسیرهای ADMIN */
  action = ''
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
    const role = await resolveAdminRole(claims.telegramId, env);
    if (!role) {
      return {
        context: base,
        error: await jsonError(
          'UNAUTHORIZED', 'Admin privileges required', requestId, env, 403
        ),
      };
    }
    if (!roleAllows(action, role)) {
      return {
        context: base,
        error: await jsonError(
          'UNAUTHORIZED',
          `Your role (${role}) cannot perform ${action}`,
          requestId,
          env,
          403
        ),
      };
    }
    return {
      context: {
        ...base,
        claims,
        telegramId: claims.telegramId,
        userId: claims.userId,
        adminRole: role,
      },
    };
  }

  return {
    context: { ...base, claims, telegramId: claims.telegramId, userId: claims.userId },
  };
}

/**
 * نقش ادمین کاربر را تعیین می‌کند.
 *  ۱. اگر در TELEGRAM_ADMIN_IDS باشد → SUPER_ADMIN
 *  ۲. وگرنه نقش ذخیره‌شده در دیتابیس (`users.admin_role`) بررسی می‌شود
 */
async function resolveAdminRole(telegramId: number, env: Env): Promise<AdminRole | null> {
  const ids = (env.TELEGRAM_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (ids.includes(telegramId)) return 'SUPER_ADMIN';

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegramId}&select=admin_role&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { admin_role: AdminRole | null }[];
    return rows[0]?.admin_role ?? null;
  } catch {
    return null;
  }
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
