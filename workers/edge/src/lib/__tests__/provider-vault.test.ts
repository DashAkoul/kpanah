import { describe, it, expect } from 'vitest';
import {
  encryptProviderKey,
  decryptProviderKey,
  keyHint,
  resolveProviderKey,
  FROM_ENV_MARKER,
} from '../provider-vault';

/**
 * Provider key vault tests.
 *
 * These guard the property that matters most: a key that goes in comes back
 * out byte-identical, and a key that has been tampered with or encrypted
 * under a different master never comes back at all.
 */

const MASTER = 'test-master-secret-not-used-in-production';

describe('encrypt / decrypt round-trip', () => {
  it('recovers the original key exactly', async () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789';
    const stored = await encryptProviderKey(key, MASTER);
    expect(await decryptProviderKey(stored, MASTER)).toBe(key);
  });

  it('handles unicode and whitespace inside a key', async () => {
    const key = 'کلید-تست-۱۲۳ sk-abc xyz';
    const stored = await encryptProviderKey(key, MASTER);
    expect(await decryptProviderKey(stored, MASTER)).toBe(key);
  });

  it('handles an empty string', async () => {
    const stored = await encryptProviderKey('', MASTER);
    expect(await decryptProviderKey(stored, MASTER)).toBe('');
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const key = 'same-key-both-times';
    const a = await encryptProviderKey(key, MASTER);
    const b = await encryptProviderKey(key, MASTER);
    expect(a).not.toBe(b);
    // …but both still decrypt to the same plaintext.
    expect(await decryptProviderKey(a, MASTER)).toBe(key);
    expect(await decryptProviderKey(b, MASTER)).toBe(key);
  });

  it('stores nothing recognisable from the plaintext', async () => {
    const key = 'sk-verysecretvalue123';
    const stored = await encryptProviderKey(key, MASTER);
    expect(stored).not.toContain('verysecret');
    expect(stored).not.toContain('sk-');
  });

  it('carries the version prefix', async () => {
    const stored = await encryptProviderKey('abc', MASTER);
    expect(stored.startsWith('v1.')).toBe(true);
    // v1.<iv>.<ciphertext>
    expect(stored.slice(3).split('.')).toHaveLength(2);
  });
});

describe('decrypt failure modes', () => {
  it('returns null for a wrong master secret', async () => {
    const stored = await encryptProviderKey('my-key', MASTER);
    expect(await decryptProviderKey(stored, 'a-different-master')).toBeNull();
  });

  it('returns null for a tampered ciphertext (GCM auth tag)', async () => {
    const stored = await encryptProviderKey('my-key', MASTER);
    const [prefix, iv, ct] = stored.split('.');
    // Flip a character in the ciphertext body.
    const flipped = ct!.slice(0, -1) + (ct!.slice(-1) === 'A' ? 'B' : 'A');
    expect(await decryptProviderKey(`${prefix}.${iv}.${flipped}`, MASTER)).toBeNull();
  });

  it('returns null for a tampered IV', async () => {
    const stored = await encryptProviderKey('my-key', MASTER);
    const [prefix, iv, ct] = stored.split('.');
    const flipped = iv!.slice(0, -1) + (iv!.slice(-1) === 'A' ? 'B' : 'A');
    expect(await decryptProviderKey(`${prefix}.${flipped}.${ct}`, MASTER)).toBeNull();
  });

  it('returns null for a malformed blob', async () => {
    expect(await decryptProviderKey('not-encrypted-at-all', MASTER)).toBeNull();
    expect(await decryptProviderKey('v1.onlyonepart', MASTER)).toBeNull();
    expect(await decryptProviderKey('v1..', MASTER)).toBeNull();
    expect(await decryptProviderKey('v2.aaa.bbb', MASTER)).toBeNull();
  });

  it('returns null for an empty blob', async () => {
    expect(await decryptProviderKey('', MASTER)).toBeNull();
  });
});

describe('keyHint', () => {
  it('reveals only the last four characters', () => {
    const hint = keyHint('sk-proj-abcdefghijklmnop-WXYZ');
    expect(hint).toBe('••••WXYZ');
    expect(hint).not.toContain('proj');
  });

  it('fully masks a key that is too short to hint', () => {
    expect(keyHint('abc')).toBe('••••');
    expect(keyHint('')).toBe('••••');
  });

  it('trims surrounding whitespace before hinting', () => {
    expect(keyHint('  sk-abcdefg-QUVW  ')).toBe('••••QUVW');
  });
});

describe('resolveProviderKey', () => {
  it('reads from env when the row carries the marker', async () => {
    expect(await resolveProviderKey(FROM_ENV_MARKER, 'env-key-value', MASTER)).toBe(
      'env-key-value'
    );
  });

  it('returns null when marked as env but no env key is set', async () => {
    expect(await resolveProviderKey(FROM_ENV_MARKER, undefined, MASTER)).toBeNull();
  });

  it('decrypts when the row carries a real blob', async () => {
    const stored = await encryptProviderKey('db-key-value', MASTER);
    expect(await resolveProviderKey(stored, undefined, MASTER)).toBe('db-key-value');
  });

  it('returns null when the master secret is missing', async () => {
    const stored = await encryptProviderKey('db-key-value', MASTER);
    expect(await resolveProviderKey(stored, undefined, undefined)).toBeNull();
  });
});
