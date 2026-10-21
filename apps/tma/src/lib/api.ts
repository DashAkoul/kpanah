import type { ApiResponse, ApiErrorCode } from '@kpanah/shared';
import {
  getWebApp,
  isTelegram,
  readLinkToken,
  stripLinkTokenFromUrl,
} from './telegram';

/**
 * ─────────────────────────────────────────────────────────────────────
 *  Debug tracer
 *
 *  Enabled when BOTH:
 *    • VITE_DEBUG_API === 'true'   (build/dev-time flag), or DEV mode
 *
 *  When on, every API call and auth decision is logged to the console
 *  with a `[kpanah:api]` prefix AND appended to `window.__KPANAH_LOG__`
 *  so it can be copied out of the Mini App (where devtools are hard to
 *  open). This is how we diagnose the real Telegram client, which sends
 *  a different initData blob than any local test.
 * ─────────────────────────────────────────────────────────────────────
 */
const DEBUG_API =
  import.meta.env.VITE_DEBUG_API === 'true' || Boolean(import.meta.env.DEV);

export interface TraceEntry {
  t: string;
  kind: 'request' | 'response' | 'error' | 'auth';
  data: Record<string, unknown>;
}

declare global {
  interface Window {
    __KPANAH_LOG__?: TraceEntry[];
  }
}

function trace(kind: TraceEntry['kind'], data: Record<string, unknown>): void {
  if (!DEBUG_API) return;
  const entry: TraceEntry = { t: new Date().toISOString(), kind, data };
  try {
    if (typeof window !== 'undefined') {
      window.__KPANAH_LOG__ = window.__KPANAH_LOG__ ?? [];
      window.__KPANAH_LOG__.push(entry);
    }
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.log(`[kpanah:api] ${kind}`, data);
}

/**
 * Snapshot of the client environment — the first thing to look at when
 * auth fails: is initData present, what platform, what API base.
 */
export function debugSnapshot(): Record<string, unknown> {
  const wa = getWebApp();
  return {
    apiBase: API_BASE,
    gatePath: GATE_PATH,
    location: typeof window !== 'undefined' ? window.location.href : '(no window)',
    hasTelegramSDK: Boolean(wa),
    platform: wa?.platform ?? null,
    version: wa?.version ?? null,
    initDataLength: wa?.initData ? wa.initData.length : 0,
    initDataPreview: wa?.initData ? wa.initData.slice(0, 60) + '…' : null,
    startParam: wa?.initDataUnsafe?.start_param ?? null,
    hasLinkToken: Boolean(readLinkToken()),
  };
}


/**
 * API client for the Edge Gateway.
 *
 * Every call goes through the single obfuscated route with ?action=...
 * The JWT is held in memory + sessionStorage (never localStorage: a
 * 15-minute token does not need cross-tab persistence and this limits
 * blast radius if a script is injected).
 */

const GATE_PATH = import.meta.env.VITE_GATE_PATH ?? '/kpanah56/8fjg7rfb/v1/gate';

/**
 * API origin. Must point at the Edge Worker, NOT the Pages origin.
 *
 * ⚠️ If this is left empty the client makes *relative* calls to the Pages
 * origin, where there is no `/kpanah56/.../gate` route → Cloudflare Pages
 * returns a 404 HTML page → `response.json()` throws → the user sees
 * "Temporary server issue" forever, even though the Worker is healthy.
 *
 * The build is supposed to set VITE_API_BASE (see SETUP_GUIDE.md), but we
 * keep an explicit fallback to the public Worker URL so a forgotten env var
 * can never silently break login again.
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '') ||
  'https://api.infolange.kdns.fr';

// برای صفحهٔ عیب‌یابی `/debug.html` — مقدار واقعی API_BASE را روی window
// می‌گذاریم تا بتوانیم از داخل مینی‌اپ واقعی هم آن را ببینیم.
try {
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__KPANAH_API_BASE__ = API_BASE;
    (window as unknown as Record<string, unknown>).__KPANAH_GATE__ = GATE_PATH;
  }
} catch {
  // ignore
}


const TOKEN_KEY = 'kpanah.jwt';

let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function setToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiClientError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status: number,
    public userMessageKey?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isAuthError(): boolean {
    return (
      this.code === 'UNAUTHORIZED' ||
      this.code === 'INVALID_INIT_DATA' ||
      this.code === 'TOKEN_EXPIRED'
    );
  }

  get needsSubscription(): boolean {
    return this.code === 'SUBSCRIPTION_REQUIRED';
  }
}

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** درخواست بدون توکن (فقط auth) */
  anonymous?: boolean;
  signal?: AbortSignal;
}

/**
 * فراخوانی دروازه + **re-auth بی‌صدا** روی 401.
 *
 * ⚠️ باگ رفع‌شده: TTL توکن ۱۵ دقیقه بود. کاربر مبتدی بیش از این در یک درس
 * می‌ماند → توکن منقضی می‌شد → `complete-lesson` با 401 برمی‌گشت و چون
 * هیچ `onError` ای نبود، دکمهٔ «انجام شد» **بی‌صدا** هیچ کاری نمی‌کرد و
 * هیچ telemetry ای ثبت نمی‌شد. حالا یک‌بار initData تازه گرفته و درخواست
 * تکرار می‌شود.
 */
export async function callApi<T>(
  action: string,
  options: CallOptions = {}
): Promise<T> {
  try {
    return await callApiOnce<T>(action, options);
  } catch (err) {
    const authFail =
      err instanceof ApiClientError && err.isAuthError && action !== 'auth';
    if (!authFail || options.anonymous) throw err;

    try {
      const fresh = await authenticate();
      setToken(fresh.token);
      return await callApiOnce<T>(action, options);
    } catch {
      throw err;
    }
  }
}

async function callApiOnce<T>(
  action: string,
  options: CallOptions = {}
): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const url = `${API_BASE}${GATE_PATH}?action=${encodeURIComponent(action)}`;

  trace('request', { action, method, url, anonymous });

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    trace('error', {
      action,
      url,
      reason: 'network-fetch-threw',
      error: (err as Error)?.message,
    });
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Network request failed',
      0,
      'errors.network'
    );
  }

  trace('response', {
    action,
    url,
    status: response.status,
    contentType: response.headers.get('content-type'),
  });

  // پاسخ رمزنگاری‌شده (لایه اختیاری) — فعلاً خاموش است
  if (response.headers.get('X-Payload-Encrypted') === '1') {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Encrypted payloads are not enabled in this client build',
      response.status
    );
  }

  let json: ApiResponse<T>;
  try {
    // متن خام را جدا می‌خوانیم تا اگر HTML بود (مثلاً 404 صفحات Pages)
    // دقیقاً ببینیم چه چیزی برگشته — این همان چیزی است که «server_error»
    // مبهم را توضیح می‌دهد.
    const rawText = await response.text();
    trace('response', {
      action,
      rawPreview: rawText.slice(0, 300),
      rawLength: rawText.length,
    });
    json = JSON.parse(rawText) as ApiResponse<T>;
  } catch (err) {
    trace('error', {
      action,
      reason: 'malformed-response-not-json',
      status: response.status,
      error: (err as Error)?.message,
    });
    throw new ApiClientError(
      'INTERNAL_ERROR',
      `Malformed response (${response.status})`,
      response.status,
      'errors.server_error'
    );
  }

  if (json.ok) {
    trace('response', { action, ok: true });
    return json.data;
  }

  const error = json.error;

  if (
    error.code === 'UNAUTHORIZED' ||
    error.code === 'TOKEN_EXPIRED' ||
    error.code === 'INVALID_INIT_DATA'
  ) {
    setToken(null);
  }

  trace('error', {
    action,
    ok: false,
    code: error.code,
    message: error.message,
    status: response.status,
    userMessageKey: error.userMessageKey,
  });

  throw new ApiClientError(
    error.code,
    error.message,
    response.status,
    error.userMessageKey
  );
}

// ─────────────────────────────────────────────────────────────────────
// Auth bootstrap
// ─────────────────────────────────────────────────────────────────────

export interface AuthResult<T> {
  token: string;
  user: T;
}

/**
 * Exchanges Telegram initData for a JWT.
 * In preview mode (plain browser) this falls back to a local mock so the
 * UI can be developed without a bot.
 */
export async function authenticate(): Promise<AuthResult<unknown>> {
  const wa = getWebApp();

  trace('auth', { step: 'begin', snapshot: debugSnapshot() });

  // ── مسیر ۱: مسیر استاندارد ────────────────────────────────────────
  // تلگرام امضای هویت (initData) را فرستاده است.
  if (isTelegram() && wa?.initData) {
    trace('auth', { step: 'path1-standard-initdata', len: wa.initData.length });
    return callApi<AuthResult<unknown>>('auth', {
      method: 'POST',
      body: { initData: wa.initData },
      anonymous: true,
    });
  }

  // ── حالت پیش‌نمایش ────────────────────────────────────────────────
  if (import.meta.env.VITE_ENABLE_MOCK === 'true' || import.meta.env.DEV) {
    trace('auth', { step: 'preview-mock' });
    return mockAuth();
  }

  // ── مسیر ۲: توکن یک‌بارمصرف لینک ─────────────────────────────────
  // این مسیر برای زمانی است که مینی‌اپ در BotFather ثبت نشده و
  // در نتیجه initData خالی است. ربات توکن را در URL گذاشته است.
  const linkToken = readLinkToken();
  trace('auth', { step: 'path2-link-token', hasLinkToken: Boolean(linkToken) });
  if (linkToken) {
    try {
      const result = await callApi<AuthResult<unknown>>('auth-link', {
        method: 'POST',
        body: { token: linkToken },
        anonymous: true,
      });
      // توکن یک‌بارمصرف است — از URL پاکش کن
      stripLinkTokenFromUrl();
      return result;
    } catch (err) {
      trace('auth', {
        step: 'path2-link-token-failed',
        error: (err as Error)?.message,
      });
      stripLinkTokenFromUrl();
      // اگر توکن منقضی/مصرف‌شده بود، به تشخیص دقیق ادامه بده
    }
  }

  // ── تشخیص دقیق: چرا initData نداریم؟ ─────────────────────────────
  // این خطاها ظاهر یکسانی دارند اما علت‌شان کاملاً متفاوت است؛ پیام
  // اشتباه کاربر را ساعت‌ها به دنبال مشکل اینترنت می‌فرستد.
  if (!wa) {
    trace('auth', { step: 'fail-no-sdk' });
    throw new ApiClientError(
      'INVALID_INIT_DATA',
      'Telegram SDK unavailable — the web app script did not load',
      401,
      'errors.open_in_telegram'
    );
  }

  // SDK هست ولی initData خالی است. علت‌های رایج:
  //   1. کاربر لینک را در مرورگر عادی باز کرده
  //   2. اپ از دکمه‌ای باز شده که توکن ندارد و مینی‌اپ هم ثبت نشده
  trace('auth', { step: 'fail-empty-initdata', platform: wa.platform });
  throw new ApiClientError(
    'INVALID_INIT_DATA',
    `initData is empty (platform=${wa.platform})`,
    401,
    'errors.init_data_missing'
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mock (dev / preview only)
// ─────────────────────────────────────────────────────────────────────

/**
 * Preview authentication.
 *
 * The fixtures are imported lazily so that a production build — where
 * `mocks/user` is aliased to an empty stub — never pulls them into the
 * initial chunk. The returned user is deliberately cast because the stub
 * exports `null` while the real module exports a full `UserProfile`.
 */
async function mockAuth(): Promise<AuthResult<unknown>> {
  const mocks = await import('../mocks/user');
  setToken('mock-token');
  return { token: 'mock-token', user: mocks.MOCK_USER };
}

export const api = {
  auth: () => authenticate(),

  me: () => callApi<{ user: unknown }>('me'),
  health: () => callApi<Record<string, unknown>>('health', { anonymous: true }),
  plans: () => callApi<{ plans: unknown[] }>('plans', { anonymous: true }),

  home: () => callApi<unknown>('home'),
  getTodayLesson: () => callApi<unknown>('get-today-lesson'),
  /** تلاش مجدد برای چرخهٔ شکست‌خورده (دکمهٔ «تلاش مجدد» در تب آموزش) */
  retryCycle: () =>
    callApi<{ ok: boolean; via: string; alreadyGenerating?: boolean; recovered?: string }>(
      'retry-cycle',
      { method: 'POST' }
    ),
  progress: () => callApi<unknown>('progress'),

  completeLesson: (body: unknown) =>
    callApi<unknown>('complete-lesson', { method: 'POST', body }),

  telemetry: (body: unknown) =>
    callApi<{ accepted: number }>('telemetry', { method: 'POST', body }),

  /** واژه‌های سررسیده برای «مرور آزاد» (بین دو درس) */
  dueReviews: () =>
    callApi<{
      items: {
        term: string;
        meaning: string;
        example: string;
        exampleTranslation?: string;
        pronunciation?: string;
        box: number;
      }[];
      count: number;
      totalDue: number;
    }>('due-reviews'),

  /** آزمون کالیبراسیون (سطح برآوردی) */
  calibrationTest: () =>
    callApi<{
      alreadyCalibrated: boolean;
      items?: { term: string; options: string[]; correctIndex: number }[];
      calibration?: unknown;
    }>('calibration-test'),

  calibrationSubmit: (body: {
    answers: { term: string; isCorrect: boolean; responseMs: number }[];
  }) =>
    callApi<{ estimated: string; scorePct: number; mismatch: boolean; stage: string }>(
      'calibration-submit',
      { method: 'POST', body }
    ),

  /** تعیین ارزش هر سکه (فقط مدیر) */
  setCoinRate: (body: { coinsPerStep?: number; percentPerStep?: number }) =>
    callApi<{ economy: Record<string, unknown> }>('set-coin-rate', {
      method: 'POST',
      body,
    }),

  /** ثبت تکمیل یک بخش از درس (سمت سرور) */
  markPart: (body: { lessonId: string; part: 1 | 2 | 3 }) =>
    callApi<{ partsDone: number }>('mark-part', { method: 'POST', body }),

  /** ثبت نتیجهٔ مرور آزاد — لایتنر و آمار را به‌روز می‌کند */
  submitReview: (body: {
    answers: { term: string; isCorrect: boolean; responseMs: number }[];
  }) => callApi<{ ok: boolean; updated: number }>('review-submit', { method: 'POST', body }),

  onboarding: (body: unknown) =>
    callApi<unknown>('onboarding', { method: 'POST', body }),

  updateProfile: (body: unknown) =>
    callApi<unknown>('update-profile', { method: 'POST', body }),

  deleteAccount: () =>
    callApi<{ deleted: boolean }>('delete-account', { method: 'POST', body: {} }),

  // ── پشتیبانی (تیکت) ──────────────────────────────────────────────
  supportCreate: (body: { subject: string; body: string; category: string }) =>
    callApi<{ ticket: unknown }>('support-create', { method: 'POST', body }),

  supportList: () => callApi<{ tickets: unknown[] }>('support-list'),

  // ⚠️ ticketId باید به‌صورت query param برود. قبلاً به شکل
  // `action=support-thread&ticketId=…` ساخته می‌شد و چون `action` کلید
  // encode می‌شد، سرور اکشن را نمی‌شناخت → 404 → «تیکت باز نمی‌شد».
  supportThread: (ticketId: string) =>
    callApiWithQuery<{ ticket: unknown; messages: unknown[] }>(
      'support-thread',
      new URLSearchParams({ ticketId })
    ),

  supportReply: (ticketId: string, body: string) =>
    callApi<{ ok: boolean }>('support-reply', {
      method: 'POST',
      body: { ticketId, body },
    }),

  supportClose: (ticketId: string) =>
    callApi<{ ok: boolean }>('support-close', {
      method: 'POST',
      body: { ticketId },
    }),

  // ── پشتیبانی (ادمین) ─────────────────────────────────────────────
  adminSupportList: () => callApi<{ tickets: unknown[] }>('admin-support-list'),

  adminSupportThread: (ticketId: string) =>
    callApiWithQuery<{ ticket: unknown; messages: unknown[] }>(
      'admin-support-thread',
      new URLSearchParams({ ticketId })
    ),

  adminSupportReply: (ticketId: string, body: string) =>
    callApi<{ ok: boolean }>('admin-support-reply', {
      method: 'POST',
      body: { ticketId, body },
    }),

  // ── نقش‌های ادمین (RBAC) ─────────────────────────────────────────
  adminListAdmins: () => callApi<{ admins: unknown[]; roles: string[] }>('admin-list-admins'),

  adminSetRole: (telegramId: number, role: string | null, title?: string | null) =>
    callApi<{ ok: boolean }>('admin-set-role', {
      method: 'POST',
      body: { telegramId, role, title },
    }),

  adminMessageSend: (body: {
    telegramId?: number | null;
    broadcast?: boolean;
    title?: string;
    body: string;
    kind?: string;
    sendViaBot?: boolean;
  }) => callApi<{ ok: boolean; sent: number }>('admin-message-send', { method: 'POST', body }),

  /** تاریخچهٔ همهٔ پیام‌های ارسالی (با نام ادمین فرستنده) */
  adminMessagesList: () => callApi<{ messages: unknown[] }>('admin-messages-list'),

  // ── پیام‌های مدیر به کاربر ───────────────────────────────────────
  messagesList: () => callApi<{ messages: unknown[] }>('messages-list'),

  messagesRead: (ids?: string[]) =>
    callApi<{ ok: boolean }>('messages-read', { method: 'POST', body: { ids } }),

  // ── CRUD اشتراک‌ها (پنل مدیر) ────────────────────────────────────
  adminPlans: () => callApi<{ plans: unknown[] }>('admin-plans'),

  adminPlanCreate: (body: unknown) =>
    callApi<unknown>('admin-plan-create', { method: 'POST', body }),

  adminPlanUpdate: (body: unknown) =>
    callApi<unknown>('admin-plan-update', { method: 'POST', body }),

  adminPlanDelete: (id: string) =>
    callApi<{ deleted: boolean }>('admin-plan-delete', { method: 'POST', body: { id } }),

  createInvoice: (planId: string, useCoins = false) =>
    callApi<{
      invoiceLink: string;
      amountStars: number;
      discountPercent?: number;
      discountIrr?: number;
    }>('create-invoice', {
      method: 'POST',
      body: { planId, useCoins },
    }),

  previewDiscount: (planId: string) =>
    callApi<{ percent: number; irr: number; finalStars: number }>('preview-discount', {
      method: 'POST',
      body: { planId },
    }),

  adminUsers: (params: { limit?: number; offset?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.q) qs.set('q', params.q);
    return callApiWithQuery<{ users: unknown[] }>('admin-users', qs);
  },

  adminUserDetail: (telegramId: number) =>
    callApiWithQuery<unknown>(
      'admin-user-detail',
      new URLSearchParams({ telegramId: String(telegramId) })
    ),

  adminGift: (body: unknown) =>
    callApi<unknown>('admin-gift', { method: 'POST', body }),

  adminRevoke: (telegramId: number) =>
    callApi<unknown>('admin-revoke', {
      method: 'POST',
      body: { telegramId },
    }),

  adminStats: () => callApi<unknown>('admin-stats'),

  // ── AI provider pool ──────────────────────────────────────────────
  // The provider list carries `keyHint` only; keys never travel back.

  adminAiProviders: () => callApi<unknown>('admin-ai-providers'),

  adminAiProviderCreate: (body: unknown) =>
    callApi<unknown>('admin-ai-provider-create', { method: 'POST', body }),

  adminAiProviderUpdate: (id: string, body: unknown) =>
    callApiWithQuery<unknown>(
      'admin-ai-provider-update',
      new URLSearchParams({ id }),
      { method: 'POST', body }
    ),

  adminAiProviderDelete: (id: string) =>
    callApiWithQuery<unknown>(
      'admin-ai-provider-delete',
      new URLSearchParams({ id }),
      { method: 'POST' }
    ),

  adminAiProviderReorder: (order: string[]) =>
    callApi<unknown>('admin-ai-provider-reorder', {
      method: 'POST',
      body: { order },
    }),

  adminAiProviderTest: (id: string) =>
    callApiWithQuery<unknown>(
      'admin-ai-provider-test',
      new URLSearchParams({ id }),
      { method: 'POST' }
    ),

  /** تست کلید + دریافت فهرست مدل‌های قابل‌استفاده (منوی کشویی مدل) */
  adminAiProviderModels: (body: {
    id?: string;
    protocol?: string;
    vendor?: string;
    baseUrl?: string | null;
    apiKey?: string;
  }) =>
    body.id
      ? callApiWithQuery<{ ok: boolean; models: string[]; error?: string }>(
          'admin-ai-provider-models',
          new URLSearchParams({ id: body.id }),
          { method: 'POST' }
        )
      : callApi<{ ok: boolean; models: string[]; error?: string }>(
          'admin-ai-provider-models',
          { method: 'POST', body }
        ),
};

/** variant که query string اضافه می‌کند */
export async function callApiWithQuery<T>(
  action: string,
  query: URLSearchParams,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const url = `${API_BASE}${GATE_PATH}?action=${encodeURIComponent(action)}&${query.toString()}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let bodyText: string | undefined;
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyText = JSON.stringify(init.body);
  }

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: bodyText,
  });
  const json = (await response.json()) as ApiResponse<T>;
  if (json.ok) return json.data;

  throw new ApiClientError(
    json.error.code,
    json.error.message,
    response.status,
    json.error.userMessageKey
  );
}
