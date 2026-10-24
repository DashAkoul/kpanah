import { describe, expect, it } from 'vitest';
import { errorTypeFor } from '../error-taxonomy';

describe('errorTypeFor', () => {
  it('returns null for correct answers', () => {
    expect(errorTypeFor('meaning-0', true)).toBeNull();
    expect(errorTypeFor('write-1', true, true)).toBeNull();
  });

  it('maps each item family to its own category', () => {
    expect(errorTypeFor('meaning-0', false)).toBe('VOCABULARY');
    expect(errorTypeFor('example-2', false)).toBe('GRAMMAR');
    expect(errorTypeFor('pattern-1', false)).toBe('APPLICATION');
    expect(errorTypeFor('write-3', false)).toBe('PRODUCTION');
    expect(errorTypeFor('story-q1', false)).toBe('COMPREHENSION');
  });

  it('falls back to VOCABULARY only when a hint was used, else OTHER', () => {
    expect(errorTypeFor('unknown', false, true)).toBe('VOCABULARY');
    expect(errorTypeFor('unknown', false, false)).toBe('OTHER');
  });
});
