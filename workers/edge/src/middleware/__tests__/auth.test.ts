import { describe, it, expect } from 'vitest';
import { authenticate, resolveRoute } from '../auth';
import { withDefaults } from '../../config';
import type { Env } from '../../types';

/**
 * Regression tests for the request pipeline's rejection paths.
 *
 * Rationale: an unauthenticated call to a protected action must return a
 * clean 401, never an unhandled 500. Same for a bad token. These paths run
 * before any route logic, so a failure here would surface as a 500 on every
 * protected endpoint — exactly the bug found in production smoke testing.
 */

const baseEnv = withDefaults({
  JWT_SECRET: 'test-secret-key-that-is-long-enough-for-hs256',
} as Env);

describe('resolveRoute', () => {
  it('classifies the public actions correctly', () => {
    for (const action of ['auth', 'health', 'plans']) {
      const url = new URL(`https://x.dev/gate?action=${action}`);
      expect(resolveRoute(url).routeClass).toBe('PUBLIC');
    }
  });

  it('classifies admin actions as ADMIN', () => {
    const url = new URL('https://x.dev/gate?action=admin-ai-providers');
    expect(resolveRoute(url).routeClass).toBe('ADMIN');
  });

  it('defaults unknown actions to AUTHENTICATED', () => {
    const url = new URL('https://x.dev/gate?action=me');
    expect(resolveRoute(url).routeClass).toBe('AUTHENTICATED');
  });

  it('recognises the telegram webhook paths', () => {
    const a = resolveRoute(new URL('https://x.dev/telegram/webhook'));
    expect(a.action).toBe('telegram-webhook');
    expect(a.routeClass).toBe('PUBLIC');

    const b = resolveRoute(new URL('https://x.dev/telegram/admin-webhook'));
    expect(b.action).toBe('telegram-admin-webhook');
    expect(b.routeClass).toBe('PUBLIC');
  });
});

describe('authenticate — rejection paths must not throw', () => {
  it('returns a 401 (not a throw) when the bearer token is missing', async () => {
    const req = new Request('https://x.dev/gate?action=me', { method: 'GET' });
    const outcome = await authenticate(req, baseEnv, 'req-1', 'AUTHENTICATED');

    expect(outcome.error).toBeDefined();
    expect(outcome.error!.status).toBe(401);

    const body = (await outcome.error!.json()) as {
      ok: boolean;
      error: { code: string; userMessageKey?: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.userMessageKey).toBe('errors.session_expired');
  });

  it('returns a 401 for an ADMIN action with no token', async () => {
    const req = new Request('https://x.dev/gate?action=admin-users', { method: 'GET' });
    const outcome = await authenticate(req, baseEnv, 'req-2', 'ADMIN');

    expect(outcome.error).toBeDefined();
    expect(outcome.error!.status).toBe(401);
  });

  it('returns a 401 (not a throw) for a malformed token', async () => {
    const req = new Request('https://x.dev/gate?action=me', {
      method: 'GET',
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    });
    const outcome = await authenticate(req, baseEnv, 'req-3', 'AUTHENTICATED');

    expect(outcome.error).toBeDefined();
    expect(outcome.error!.status).toBe(401);
  });

  it('returns a 401 when the scheme is not Bearer', async () => {
    const req = new Request('https://x.dev/gate?action=me', {
      method: 'GET',
      headers: { Authorization: 'Basic abc123' },
    });
    const outcome = await authenticate(req, baseEnv, 'req-4', 'AUTHENTICATED');

    expect(outcome.error).toBeDefined();
    expect(outcome.error!.status).toBe(401);
  });

  it('lets PUBLIC actions through without a token', async () => {
    const req = new Request('https://x.dev/gate?action=health', { method: 'GET' });
    const outcome = await authenticate(req, baseEnv, 'req-5', 'PUBLIC');

    expect(outcome.error).toBeUndefined();
    expect(outcome.context.requestId).toBe('req-5');
  });

  it('rejects an INTERNAL call without a QStash signature', async () => {
    const req = new Request('https://x.dev/internal/queue', { method: 'POST' });
    const outcome = await authenticate(req, baseEnv, 'req-6', 'INTERNAL');

    expect(outcome.error).toBeDefined();
    expect(outcome.error!.status).toBe(401);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 *  قرارداد JWT ↔ RequestContext
 *
 *  ریشه باگ production: `auth.ts` توکن را با `telegram_id` (snake_case)
 *  امضا می‌کرد، اما میدلور `claims.telegramId` (camelCase) می‌خواند.
 *  نتیجه: `telegramId` همیشه undefined → همه مسیرهای محافظت‌شده
 *  خطای «no identity» می‌دادند و اپ پیام «Temporary server issue»
 *  نشان می‌داد.
 *
 *  این تست قرارداد را قفل می‌کند تا هرگز برنگردد.
 * ═══════════════════════════════════════════════════════════════════
 */
describe('sign → verify → context contract', () => {
  it('a token signed by the auth route yields telegramId on the context', async () => {
    const { signJwt } = await import('../../lib/jwt');

    // دقیقاً همان بدنه‌ای که routes/auth.ts می‌سازد
    const token = await signJwt(
      {
        telegramId: 123456789,
        userId: 'user-uuid-abc',
        uiLanguage: 'fa',
      },
      baseEnv.JWT_SECRET,
      900
    );

    const req = new Request('https://x.dev/gate?action=home', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const outcome = await authenticate(req, baseEnv, 'req-contract', 'AUTHENTICATED');

    expect(outcome.error).toBeUndefined();
    expect(outcome.context.telegramId).toBe(123456789);
    expect(outcome.context.userId).toBe('user-uuid-abc');
  });

  it('does NOT accept snake_case claim names (guards the original bug)', async () => {
    const { signJwt } = await import('../../lib/jwt');

    // شکل قدیمی و باگ‌دار — نباید به context راه پیدا کند
    const token = await signJwt(
      { telegram_id: 123456789, sub: 'user-uuid-abc', ui_language: 'fa' },
      baseEnv.JWT_SECRET,
      900
    );

    const req = new Request('https://x.dev/gate?action=home', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const outcome = await authenticate(req, baseEnv, 'req-old', 'AUTHENTICATED');

    // توکن معتبر است (امضا درست)، اما هویت استخراج نمی‌شود
    expect(outcome.error).toBeUndefined();
    expect(outcome.context.telegramId).toBeUndefined();
  });
});
