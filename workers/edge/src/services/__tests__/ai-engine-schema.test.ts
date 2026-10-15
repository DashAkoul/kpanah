import { describe, it, expect } from 'vitest';
import { jsonSchemaFor } from '../ai-engine';

/**
 * Regression tests for the per-task response schemas.
 *
 * ⚠️ زمینه: پیش از این، `runChain` همیشه اسکیمای «کل چرخهٔ ۷ درسی» را به
 * provider می‌فرستاد — حتی وقتی پرامپت یک outline یا یک درس می‌خواست. مدل
 * سعی می‌کرد شکل چرخهٔ کامل را پر کند و validation می‌شکست:
 *   • `schema: lessons.0.part1.type: Invalid literal value, expected "PATTERN_DRILL"`
 *   • `schema: title: Required`
 *
 * علاوه بر آن، `buildLessonJsonSchema` یک اسکیمای نامعتبر می‌ساخت:
 * `properties` را برابر **خودِ شیء درس** می‌گذاشت (کلیدهای `type`/
 * `properties`/`required`) به‌جای خواص درس. Gemini چنین اسکیمایی را
 * ۴۰۰ «invalid argument» می‌کند.
 *
 * این تست‌ها هر دو رجعت را قفل می‌کنند.
 */

type JsonSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
};

describe('jsonSchemaFor — dispatch', () => {
  it('returns the outline schema for the "outline" tag', () => {
    const s = jsonSchemaFor('outline') as JsonSchema;
    expect(s.properties).toBeDefined();
    expect(Object.keys(s.properties!)).toContain('days');
    // اسکیمای outline نباید آرایهٔ `lessons` کامل داشته باشد
    expect(Object.keys(s.properties!)).not.toContain('lessons');
    const days = s.properties!.days as JsonSchema;
    expect(days.type).toBe('array');
    expect(days.minItems).toBe(7);
    expect(days.maxItems).toBe(7);
  });

  it('returns the single-lesson schema for a "lesson-<n>" tag', () => {
    const s = jsonSchemaFor('lesson-3') as JsonSchema;
    expect(s.type).toBe('object');
    expect(s.properties).toBeDefined();
    // ⚠️ رجعت: خواص باید نام فیلدهای درس باشند، نه متاکلیدهای اسکیما
    const keys = Object.keys(s.properties!);
    expect(keys).toContain('dayNumber');
    expect(keys).toContain('title');
    expect(keys).toContain('titleUi');
    expect(keys).toContain('kind');
    expect(keys).toContain('part1');
    expect(keys).toContain('part2');
    // متاکلیدها هرگز نباید به‌عنوان «خاصیت» ظاهر شوند
    expect(keys).not.toContain('type');
    expect(keys).not.toContain('properties');
    expect(keys).not.toContain('required');
  });

  it('returns the full-cycle schema for an unknown tag', () => {
    const s = jsonSchemaFor('cycle') as JsonSchema;
    const lessons = s.properties!.lessons as JsonSchema;
    expect(lessons.type).toBe('array');
    expect(lessons.minItems).toBe(7);
    expect(lessons.maxItems).toBe(7);
  });
});

describe('lesson schema — structural integrity', () => {
  it('nests part1/part2 with the literal discriminator values', () => {
    const s = jsonSchemaFor('lesson-1') as JsonSchema;
    const part1 = s.properties!.part1 as JsonSchema;
    const part2 = s.properties!.part2 as JsonSchema;

    // part1.type باید enum با مقدار ثابت PATTERN_DRILL باشد
    const p1Type = part1.properties!.type as { enum?: string[] };
    expect(p1Type.enum).toEqual(['PATTERN_DRILL']);

    const p2Type = part2.properties!.type as { enum?: string[] };
    expect(p2Type.enum).toEqual(['REAL_APPLICATION']);

    // آیتم‌های واژه باید شکل درست داشته باشند
    const items = part1.properties!.items as JsonSchema;
    expect(items.type).toBe('array');
    expect(Object.keys(items.items!.properties!)).toEqual(
      expect.arrayContaining(['term', 'meaning', 'example'])
    );
  });

  it('never emits an object whose "properties" is itself a schema node', () => {
    // یک اسکیمای معتبر JSON: هر مقدار داخل `properties` باید خودش یک
    // اسکیمای شیء باشد، نه رشته/آرایه.
    const check = (node: unknown, path: string): void => {
      if (typeof node !== 'object' || node === null) return;
      const n = node as Record<string, unknown>;
      if (n.properties && typeof n.properties === 'object') {
        for (const [key, value] of Object.entries(n.properties as Record<string, unknown>)) {
          expect(
            typeof value === 'object' && value !== null && !Array.isArray(value),
            `${path}.properties.${key} must be a schema object, got ${typeof value}`
          ).toBe(true);
        }
      }
      for (const [key, value] of Object.entries(n)) {
        if (key === 'properties') continue;
        check(value, `${path}.${key}`);
      }
    };

    for (const tag of ['outline', 'lesson-1', 'lesson-7', 'cycle']) {
      check(jsonSchemaFor(tag), tag);
    }
  });
});
