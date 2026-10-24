import { describe, expect, it } from 'vitest';
import gold from './fixtures/freewrite-gold.json';
import { freeWriteResultSchema } from '@kpanah/shared';

/**
 * مجموعهٔ پاسخ مرجع (gold set) — اعتبار خودِ مجموعه را تضمین می‌کند.
 *
 * ⚠️ این تست کیفیت «مدل» را نمی‌سنجد (نیاز به provider فعال دارد)؛
 * فقط مطمئن می‌شود مجموعه معتبر و قابل استفاده برای سنجش انسانی/خودکار است.
 */
describe('free-write gold set', () => {
  it('has at least 8 labelled cases covering all three verdicts', () => {
    expect(gold.cases.length).toBeGreaterThanOrEqual(8);
    const labels = new Set(gold.cases.map((c) => c.label));
    expect(labels).toEqual(new Set(['CORRECT', 'PARTIAL', 'WRONG']));
  });

  it('every CORRECT case actually contains the target term', () => {
    const term = gold.term.toLowerCase();
    for (const c of gold.cases.filter((x) => x.label === 'CORRECT')) {
      expect(c.answer.toLowerCase()).toContain(term);
    }
  });

  it('every WRONG case is either empty or missing the term', () => {
    const term = gold.term.toLowerCase();
    for (const c of gold.cases.filter((x) => x.label === 'WRONG')) {
      const hasTerm = c.answer.toLowerCase().includes(term);
      expect(c.answer.trim() === '' || !hasTerm).toBe(true);
    }
  });

  it('accepts a well-formed evaluator result against the schema', () => {
    const sample = {
      verdict: 'PARTIAL',
      score: 0.6,
      feedback: 'واژه درست است اما فعل جمله اصلاح لازم دارد.',
      corrected: 'My phone number is 0912.',
    };
    expect(freeWriteResultSchema.safeParse(sample).success).toBe(true);
  });
});
