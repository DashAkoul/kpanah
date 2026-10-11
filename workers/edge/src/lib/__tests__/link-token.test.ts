import { describe, it, expect, vi } from 'vitest';
import {
  generateLinkToken,
  storeLinkToken,
  consumeLinkToken,
} from '../link-token';
import type { Env } from '../../types';

/**
 * Link-token tests.
 *
 * The property that matters: a token works exactly once, expires
 * correctly, and never resolves to a user it was not issued for.
 */

/** KV stub with TTL awareness — enough to exercise the real code paths. */
function makeKv(): KVNamespace {
  const store = new Map<string, { value: string; expiresAt: number }>();

  return {
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const ttl = opts?.expirationTtl ?? 0;
      store.set(key, {
        value,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : Number.POSITIVE_INFINITY,
      });
    },
    async get(key: string) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as KVNamespace;
}

function makeEnv(kv?: KVNamespace): Env {
  return { CACHE_KV: kv } as unknown as Env;
}

describe('generateLinkToken', () => {
  it('returns a url-safe base64 string of the expected length', () => {
    const token = generateLinkToken();
    // 32 bytes → 43 base64url chars (no padding)
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('never repeats (256 bits of entropy)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateLinkToken());
    expect(seen.size).toBe(500);
  });
});

describe('store / consume round-trip', () => {
  it('resolves the issuing telegram_id', async () => {
    const env = makeEnv(makeKv());
    const token = generateLinkToken();

    expect(await storeLinkToken(env, token, { telegramId: 12345, issuedAt: Date.now() })).toBe(true);

    const record = await consumeLinkToken(env, token);
    expect(record).not.toBeNull();
    expect(record!.telegramId).toBe(12345);
  });

  it('is single-use: the second consume returns null', async () => {
    const env = makeEnv(makeKv());
    const token = generateLinkToken();
    await storeLinkToken(env, token, { telegramId: 777, issuedAt: Date.now() });

    expect(await consumeLinkToken(env, token)).not.toBeNull();
    expect(await consumeLinkToken(env, token)).toBeNull();
  });

  it('carries the language code through', async () => {
    const env = makeEnv(makeKv());
    const token = generateLinkToken();
    await storeLinkToken(env, token, {
      telegramId: 1,
      languageCode: 'fa',
      issuedAt: Date.now(),
    });

    const record = await consumeLinkToken(env, token);
    expect(record!.languageCode).toBe('fa');
  });
});

describe('rejection paths', () => {
  it('rejects an unknown token', async () => {
    const env = makeEnv(makeKv());
    expect(await consumeLinkToken(env, generateLinkToken())).toBeNull();
  });

  it('rejects an expired token', async () => {
    const env = makeEnv(makeKv());
    const token = generateLinkToken();
    // ttl of 60s is the enforced minimum; go past it
    await storeLinkToken(env, token, { telegramId: 1, issuedAt: Date.now() }, 60);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120_000);
    expect(await consumeLinkToken(env, token)).toBeNull();
    vi.useRealTimers();
  });

  it('rejects empty, short, and overlong tokens without touching KV', async () => {
    const kv = makeKv();
    const getSpy = vi.spyOn(kv, 'get' as never);
    const env = makeEnv(kv);

    expect(await consumeLinkToken(env, '')).toBeNull();
    expect(await consumeLinkToken(env, 'short')).toBeNull();
    expect(await consumeLinkToken(env, 'x'.repeat(200))).toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed stored payloads', async () => {
    const kv = makeKv();
    await kv.put('linktoken:garbage-value-1234567890', 'not-json', { expirationTtl: 600 });
    expect(await consumeLinkToken(makeEnv(kv), 'garbage-value-1234567890')).toBeNull();
  });

  it('rejects a stored record with no telegramId', async () => {
    const kv = makeKv();
    await kv.put('linktoken:notgarbage-value-1234567', JSON.stringify({ issuedAt: 1 }), {
      expirationTtl: 600,
    });
    expect(await consumeLinkToken(makeEnv(kv), 'notgarbage-value-1234567')).toBeNull();
  });
});

describe('degraded environments', () => {
  it('returns false from store when no KV is bound', async () => {
    expect(await storeLinkToken(makeEnv(undefined), generateLinkToken(), {
      telegramId: 1,
      issuedAt: Date.now(),
    })).toBe(false);
  });

  it('returns null from consume when no KV is bound', async () => {
    expect(await consumeLinkToken(makeEnv(undefined), generateLinkToken())).toBeNull();
  });

  it('falls back to RATE_LIMIT_KV when CACHE_KV is absent', async () => {
    const env = { RATE_LIMIT_KV: makeKv() } as unknown as Env;
    const token = generateLinkToken();
    expect(await storeLinkToken(env, token, { telegramId: 9, issuedAt: Date.now() })).toBe(true);
    expect((await consumeLinkToken(env, token))!.telegramId).toBe(9);
  });

  it('survives a KV that throws', async () => {
    const throwing = {
      async put() {
        throw new Error('KV down');
      },
      async get() {
        throw new Error('KV down');
      },
      async delete() {
        throw new Error('KV down');
      },
    } as unknown as KVNamespace;
    const env = makeEnv(throwing);

    expect(await storeLinkToken(env, generateLinkToken(), { telegramId: 1, issuedAt: 1 })).toBe(false);
    expect(await consumeLinkToken(env, generateLinkToken())).toBeNull();
  });
});
