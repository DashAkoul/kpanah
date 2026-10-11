import { describe, it, expect } from 'vitest';
import {
  buildStartParam,
  extractTokenFromStartParam,
  extractStartParam,
  APP_START_PREFIX,
} from '../utils/deep-link';

/**
 * Deep-link parameter tests.
 *
 * Rationale: the bot writes this value and the Mini App reads it back
 * through Telegram's `tgWebAppStartParam`. A mismatch here reproduces
 * the exact production bug where the login token never reached the app.
 */

const TOKEN = 'LTxVCZct82S4xS8LcmJJ1YdXqapmgeQ8Qvj4vV7p3IE';

describe('buildStartParam', () => {
  it('prefixes the token', () => {
    expect(buildStartParam(TOKEN)).toBe(`${APP_START_PREFIX}${TOKEN}`);
  });

  it('appends an optional deep-link parameter', () => {
    expect(buildStartParam(TOKEN, 'store')).toBe(`${APP_START_PREFIX}${TOKEN}_store`);
  });

  it('omits the separator when there is no extra parameter', () => {
    expect(buildStartParam(TOKEN)).not.toContain('_store');
  });
});

describe('extractTokenFromStartParam', () => {
  it('recovers a token from the bare form', () => {
    expect(extractTokenFromStartParam(`${APP_START_PREFIX}${TOKEN}`)).toBe(TOKEN);
  });

  it('recovers only the token from the combined form', () => {
    expect(extractTokenFromStartParam(`${APP_START_PREFIX}${TOKEN}_store`)).toBe(TOKEN);
  });

  it('recovers the token even when the extra param itself has underscores', () => {
    expect(
      extractTokenFromStartParam(`${APP_START_PREFIX}${TOKEN}_open_store_now`)
    ).toBe(TOKEN);
  });

  it('rejects values without the expected prefix', () => {
    expect(extractTokenFromStartParam('store')).toBeNull();
    expect(extractTokenFromStartParam('')).toBeNull();
    expect(extractTokenFromStartParam(null)).toBeNull();
    expect(extractTokenFromStartParam(undefined)).toBeNull();
  });

  it('rejects a too-short token even with a valid prefix', () => {
    expect(extractTokenFromStartParam(`${APP_START_PREFIX}short`)).toBeNull();
  });
});

describe('extractStartParam', () => {
  it('returns the trailing parameter when present', () => {
    expect(extractStartParam(`${APP_START_PREFIX}${TOKEN}_store`)).toBe('store');
  });

  it('returns undefined when only a token was sent', () => {
    expect(extractStartParam(`${APP_START_PREFIX}${TOKEN}`)).toBeUndefined();
  });

  it('passes through a plain deep-link value untouched', () => {
    expect(extractStartParam('store')).toBe('store');
    expect(extractStartParam(null)).toBeUndefined();
  });
});

describe('round-trip: build → extract', () => {
  it('survives with no extra parameter', () => {
    const built = buildStartParam(TOKEN);
    expect(extractTokenFromStartParam(built)).toBe(TOKEN);
    expect(extractStartParam(built)).toBeUndefined();
  });

  it('survives with an extra parameter', () => {
    const built = buildStartParam(TOKEN, 'store');
    expect(extractTokenFromStartParam(built)).toBe(TOKEN);
    expect(extractStartParam(built)).toBe('store');
  });

  it('handles a realistic generated token', () => {
    // 32 random bytes → 43 base64url chars, same as lib/link-token.ts
    const real = 'APnX-tcQT5t9Dutghu8Wu10z4GHGZZLwBIJf1auJ5HI';
    const built = buildStartParam(real, 'lesson');
    expect(extractTokenFromStartParam(built)).toBe(real);
    expect(extractStartParam(built)).toBe('lesson');
  });
});
