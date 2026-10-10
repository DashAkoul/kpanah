/**
 * Provider key vault.
 *
 * API keys entered through the admin panel must never be stored in plaintext.
 * This module encrypts them with AES-GCM before they reach Postgres and
 * decrypts them only inside the Worker when a request is about to be made.
 *
 * Key derivation
 * ──────────────
 * The master secret (`PROVIDER_ENCRYPTION_KEY`) is arbitrary-length text
 * supplied as a Worker secret. It is hashed with SHA-256 to produce exactly
 * 32 bytes of AES-GCM key material, which avoids any padding questions and
 * lets the operator use a passphrase instead of raw base64.
 *
 * The `v1.` prefix on the stored blob is a format version tag. If the scheme
 * ever changes we can recognise and migrate old rows instead of failing.
 */

const FORMAT_PREFIX = 'v1.';

/** Marker meaning "the real key lives in a Worker secret, not the database". */
export const FROM_ENV_MARKER = '__FROM_ENV__';

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * `atob` yields a binary string; we must map charCode → byte explicitly
 * rather than assuming the result is already bytes.
 */
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Encrypt a provider key for storage.
 *
 * Layout: `v1.<iv_b64>.<ciphertext_b64>` — the IV is stored alongside the
 * ciphertext because GCM needs it to decrypt and it is not secret.
 */
export async function encryptProviderKey(plaintext: string, masterSecret: string): Promise<string> {
  const key = await deriveKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    )
  );
  return `${FORMAT_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

/**
 * Decrypt a stored provider key.
 *
 * Returns `null` on any failure (bad format, wrong master key, tampering)
 * so callers can treat an unreadable key the same as a missing one and move
 * on to the next provider rather than crashing the whole generation.
 */
export async function decryptProviderKey(
  stored: string,
  masterSecret: string
): Promise<string | null> {
  try {
    if (!stored.startsWith(FORMAT_PREFIX)) return null;

    const parts = stored.slice(FORMAT_PREFIX.length).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

    const iv = base64ToBytes(parts[0]);
    const ciphertext = base64ToBytes(parts[1]);

    const key = await deriveKey(masterSecret);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

/**
 * A short, non-reversible fingerprint shown in the admin panel.
 *
 * Admins need to tell two keys apart ("which one is the production key?"),
 * but the panel must never receive the key itself. The last four characters
 * are enough for recognition and useless to an attacker without the rest.
 */
export function keyHint(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

/**
 * Resolve the effective key for a provider row.
 *
 * Rows seeded from migrations carry the `__FROM_ENV__` marker, meaning the
 * key should be read from the corresponding Worker secret. Everything else
 * is decrypted from the column.
 */
export async function resolveProviderKey(
  storedKey: string,
  envKey: string | undefined,
  masterSecret: string | undefined
): Promise<string | null> {
  if (storedKey === FROM_ENV_MARKER) {
    return envKey ?? null;
  }
  if (!masterSecret) return null;
  return decryptProviderKey(storedKey, masterSecret);
}
