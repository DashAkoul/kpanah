/**
 * Minimal HS256 JWT implementation using WebCrypto.
 * (No dependencies — Workers-native, small cold-start.)
 */

import { base64UrlDecode, base64UrlEncode, hmacSha256 } from './telegram-auth';

export interface JwtPayload {
  [key: string]: unknown;
  iat?: number;
  exp?: number;
}

function encodeSegment(obj: unknown): string {
  return base64UrlEncode(JSON.stringify(obj));
}

function decodeSegment<T>(segment: string): T | null {
  try {
    const bytes = base64UrlDecode(segment);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export async function signJwt(
  payload: JwtPayload,
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const signingInput = `${encodeSegment(header)}.${encodeSegment(body)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  );

  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export interface VerifyResult<T> {
  ok: boolean;
  payload?: T;
  error?: 'malformed' | 'bad_signature' | 'expired';
}

export async function verifyJwt<T extends JwtPayload>(
  token: string,
  secret: string
): Promise<VerifyResult<T>> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'malformed' };

  const [headerSeg, payloadSeg, sigSeg] = parts as [string, string, string];
  const signingInput = `${headerSeg}.${payloadSeg}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sigSeg),
      new TextEncoder().encode(signingInput)
    );
  } catch {
    return { ok: false, error: 'malformed' };
  }

  if (!valid) return { ok: false, error: 'bad_signature' };

  const payload = decodeSegment<T>(payloadSeg);
  if (!payload) return { ok: false, error: 'malformed' };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, error: 'expired' };
  }

  return { ok: true, payload };
}
