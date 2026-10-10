import { PROMPT_INJECTION_PATTERNS, SECURITY } from '@kpanah/shared';

/**
 * Content filtering — before any user-supplied text reaches the AI.
 *
 * Threat model:
 *   1. Prompt injection — user tries to hijack the tutor's persona.
 *   2. Token abuse — user pastes a novel to burn our API budget.
 *   3. Jailbreak phrasing — DAN / "pretend you are".
 *
 * Note per spec §6.6: we are deliberately NOT aggressive here. The spec
 * explicitly says focus on personalisation over anti-abuse policing.
 * So: block clear attacks, allow normal learning mistakes.
 */

export interface ContentCheckResult {
  allowed: boolean;
  reason?: 'injection' | 'too_long' | 'blocked_pattern';
  detail?: string;
  sanitized?: string;
}

export function checkUserContent(input: unknown, maxLength = SECURITY.maxPromptLength): ContentCheckResult {
  if (typeof input !== 'string') {
    return { allowed: true };
  }

  const text = input.normalize('NFKC');

  // 1. طول — محافظت از توکن
  if (text.length > maxLength) {
    return {
      allowed: false,
      reason: 'too_long',
      detail: `length ${text.length} > ${maxLength}`,
      sanitized: text.slice(0, maxLength),
    };
  }

  // 2. الگوهای تزریق
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        reason: 'injection',
        detail: `matched ${String(pattern)}`,
      };
    }
  }

  // 3. کاراکترهای کنترلی و zero-width (پنهان‌سازی دستور)
  if (/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/.test(text)) {
    return {
      allowed: false,
      reason: 'blocked_pattern',
      detail: 'invisible control characters detected',
    };
  }

  return { allowed: true, sanitized: text };
}

/**
 * پیمایش بازگشتی روی payload و بررسی تمام رشته‌ها.
 * برای مسیرهایی که کاربر فقط پاسخ درس می‌فرستد، سخت‌گیرانه نیستیم:
 * فقط طول و کاراکتر مخفی چک می‌شود (پاسخ‌ها متن آموزشی‌اند).
 */
export function scanPayloadForInjection(
  value: unknown,
  options: { strict?: boolean } = {}
): ContentCheckResult {
  const strict = options.strict ?? false;
  const strings = collectStrings(value);

  for (const s of strings) {
    if (s.length > SECURITY.maxPromptLength) {
      return { allowed: false, reason: 'too_long', detail: s.slice(0, 80) };
    }
    if (/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/.test(s)) {
      return { allowed: false, reason: 'blocked_pattern', detail: 'invisible chars' };
    }
    if (strict) {
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(s)) {
          return { allowed: false, reason: 'injection', detail: String(pattern) };
        }
      }
    }
  }

  return { allowed: true };
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap((v) => collectStrings(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((v) =>
      collectStrings(v, depth + 1)
    );
  }
  return [];
}

/**
 * پرامپت سیستمی محافظ برای فراخوانی AI.
 * محتوای کاربر هرگز به‌عنوان دستور تفسیر نمی‌شود.
 */
export function wrapUntrusted(content: string, label = 'USER_CONTENT'): string {
  return `<${label}>\n${content}\n</${label}>`;
}
