import type { Env, RequestContext } from '../types';
import { jsonError, getClientIp } from '../lib/response';
import { numberEnv } from '../config';

/**
 * Rate limiting.
 *
 * Two windows:
 *   - per IP per minute (burst protection)
 *   - per user per day   (cost protection against token abuse)
 *
 * Uses KV when bound; falls back to an in-memory map for `wrangler dev`
 * and unit tests. In-memory is per-isolate, so it is best-effort only —
 * production must bind RATE_LIMIT_KV.
 */

interface Counter {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Counter>();
let lastSweep = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export async function enforceRateLimit(
  request: Request,
  context: RequestContext
): Promise<Response | null> {
  const { env, requestId } = context;

  const perMinute = numberEnv(env.RATE_LIMIT_PER_MINUTE, 60);
  const perDay = numberEnv(env.RATE_LIMIT_PER_DAY, 2000);

  const ip = getClientIp(request);
  const userId = context.telegramId ? String(context.telegramId) : null;

  const minuteKey = `rl:min:${ip}`;
  const dayKey = userId ? `rl:day:${userId}` : `rl:day:ip:${ip}`;

  const minute = await bump(env, minuteKey, 60, perMinute);
  if (!minute.allowed) {
    return rateLimited(env, requestId, minute, 'minute');
  }

  const day = await bump(env, dayKey, 86_400, perDay);
  if (!day.allowed) {
    return rateLimited(env, requestId, day, 'day');
  }

  return null;
}

async function bump(
  env: Env,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_KV) {
    // KV can fail transiently (eventual consistency, quota, cold isolate).
    // Rate limiting is a safety net, not a correctness requirement — a KV
    // hiccup must never take down the whole API. Fall back to the per-isolate
    // counter and let the request through.
    try {
      return await bumpKV(env.RATE_LIMIT_KV, key, windowSeconds, limit);
    } catch (err) {
      console.warn('rate-limit: KV unavailable, falling back to memory', err);
      return bumpMemory(key, windowSeconds, limit);
    }
  }
  return bumpMemory(key, windowSeconds, limit);
}

async function bumpKV(
  kv: KVNamespace,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const raw = await kv.get(key);
  let counter: Counter | null = null;

  if (raw) {
    try {
      counter = JSON.parse(raw) as Counter;
    } catch {
      counter = null;
    }
  }

  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowSeconds * 1000 };
  }

  counter.count += 1;

  // TTL = پنجره + کمی حاشیه
  const ttl = Math.max(1, Math.ceil((counter.resetAt - now) / 1000) + 5);
  await kv.put(key, JSON.stringify(counter), { expirationTtl: ttl });

  return {
    allowed: counter.count <= limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
    limit,
  };
}

function bumpMemory(key: string, windowSeconds: number, limit: number): RateLimitResult {
  const now = Date.now();

  // پاک‌سازی دوره‌ای برای جلوگیری از رشد بی‌پایان
  if (now - lastSweep > 60_000) {
    for (const [k, v] of memoryStore) {
      if (v.resetAt <= now) memoryStore.delete(k);
    }
    lastSweep = now;
  }

  let counter = memoryStore.get(key);
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + windowSeconds * 1000 };
  }
  counter.count += 1;
  memoryStore.set(key, counter);

  return {
    allowed: counter.count <= limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
    limit,
  };
}

async function rateLimited(
  env: Env,
  requestId: string,
  result: RateLimitResult,
  window: 'minute' | 'day'
): Promise<Response> {
  const res = await jsonError(
    'RATE_LIMITED',
    `Rate limit exceeded (${window})`,
    requestId,
    env,
    429,
    'errors.too_many_requests'
  );
  res.headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
  res.headers.set('X-RateLimit-Limit', String(result.limit));
  res.headers.set('X-RateLimit-Remaining', '0');
  return res;
}

/** برای تست‌ها */
export function __resetRateLimitStore(): void {
  memoryStore.clear();
  lastSweep = 0;
}
