import type { ApiResponse, ApiErrorCode } from '@kpanah/shared';
import { getWebApp, isTelegram } from './telegram';

/**
 * API client for the Edge Gateway.
 *
 * Every call goes through the single obfuscated route with ?action=...
 * The JWT is held in memory + sessionStorage (never localStorage: a
 * 15-minute token does not need cross-tab persistence and this limits
 * blast radius if a script is injected).
 */

const GATE_PATH = import.meta.env.VITE_GATE_PATH ?? '/kpanah56/8fjg7rfb/v1/gate';
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

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

export async function callApi<T>(
  action: string,
  options: CallOptions = {}
): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const url = `${API_BASE}${GATE_PATH}?action=${encodeURIComponent(action)}`;

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
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Network request failed',
      0,
      'errors.network'
    );
  }

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
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      `Malformed response (${response.status})`,
      response.status,
      'errors.server_error'
    );
  }

  if (json.ok) return json.data;

  const error = json.error;

  if (
    error.code === 'UNAUTHORIZED' ||
    error.code === 'TOKEN_EXPIRED' ||
    error.code === 'INVALID_INIT_DATA'
  ) {
    setToken(null);
  }

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

  if (isTelegram() && wa?.initData) {
    return callApi<AuthResult<unknown>>('auth', {
      method: 'POST',
      body: { initData: wa.initData },
      anonymous: true,
    });
  }

  // ── حالت پیش‌نمایش ────────────────────────────────────────────────
  if (import.meta.env.VITE_ENABLE_MOCK === 'true' || import.meta.env.DEV) {
    return mockAuth();
  }

  throw new ApiClientError(
    'INVALID_INIT_DATA',
    'This app must be opened inside Telegram',
    401,
    'errors.open_in_telegram'
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
  progress: () => callApi<unknown>('progress'),

  completeLesson: (body: unknown) =>
    callApi<unknown>('complete-lesson', { method: 'POST', body }),

  telemetry: (body: unknown) =>
    callApi<{ accepted: number }>('telemetry', { method: 'POST', body }),

  onboarding: (body: unknown) =>
    callApi<unknown>('onboarding', { method: 'POST', body }),

  updateProfile: (body: unknown) =>
    callApi<unknown>('update-profile', { method: 'POST', body }),

  deleteAccount: () =>
    callApi<{ deleted: boolean }>('delete-account', { method: 'POST', body: {} }),

  createInvoice: (planId: string) =>
    callApi<{ invoiceLink: string; amountStars: number }>('create-invoice', {
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
