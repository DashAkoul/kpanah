import type { ApiError, ApiErrorCode, ApiResponse, ApiSuccess } from '@kpanah/shared';
import type { Env } from '../types';
import { isEncryptionEnabled } from '../config';

// ─────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────

export function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ─────────────────────────────────────────────────────────────────────
// Envelope
// ─────────────────────────────────────────────────────────────────────

export function newRequestId(): string {
  return crypto.randomUUID();
}

export async function jsonSuccess<T>(
  data: T,
  requestId: string,
  env: Env,
  init?: ResponseInit
): Promise<Response> {
  const payload: ApiSuccess<T> = { ok: true, data, requestId, ts: Date.now() };
  return respond(payload, 200, env, init);
}

export async function jsonError(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  env: Env,
  status = 400,
  userMessageKey?: string
): Promise<Response> {
  const payload: ApiError = {
    ok: false,
    error: { code, message, userMessageKey },
    requestId,
    ts: Date.now(),
  };
  return respond(payload, status, env, undefined, true);
}

async function respond(
  payload: unknown,
  status: number,
  env: Env,
  init?: ResponseInit,
  isError = false
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Cache-Control', 'no-store');

  let body: string;

  if (isEncryptionEnabled(env) && env.PAYLOAD_ENCRYPTION_KEY) {
    body = JSON.stringify(await encryptPayload(payload, env.PAYLOAD_ENCRYPTION_KEY));
    headers.set('X-Payload-Encrypted', '1');
  } else {
    body = JSON.stringify(payload);
  }

  return new Response(body, { status, headers });
}

// ─────────────────────────────────────────────────────────────────────
// Optional payload encryption layer (disabled by default)
//
// Why optional: in a Mini App the key must live in the client bundle,
// so this adds obfuscation, not confidentiality. Kept for cases where
// the client is a trusted native app (Phase 2).
// ─────────────────────────────────────────────────────────────────────

async function encryptPayload(
  payload: unknown,
  secret: string
): Promise<{ iv: string; ct: string; alg: string }> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    )
  );
  return { alg: 'A256GCM', iv: toB64(iv), ct: toB64(ct) };
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function clientOrigin(request: Request): string | null {
  return request.headers.get('Origin');
}
