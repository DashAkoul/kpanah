import { describe, it, expect } from 'vitest';
import {
  validateWithDetail,
  generatedCycleSchema,
  completeLessonSchema,
  adminGiftSchema,
  telegramInitDataUserSchema,
  createAiProviderSchema,
  updateAiProviderSchema,
  reorderAiProvidersSchema,
} from '../schemas/index';

/**
 * Schema tests. These guard the AI contract: if the model returns
 * something structurally wrong we must catch it before writing to the DB.
 */

function makeItem(overrides: Record<string, unknown> = {}) {
  return { term: 'term', meaning: 'معنی', example: 'An example.', ...overrides };
}

function makeLesson(dayNumber: number, kind: string) {
  return {
    dayNumber,
    title: `Lesson ${dayNumber}`,
    titleFa: `درس ${dayNumber}`,
    kind,
    part1: {
      type: 'PATTERN_DRILL',
      explanation: 'توضیح کافی و طولانی برای این بخش از درس.',
      items: [makeItem(), makeItem(), makeItem()],
    },
    part2: {
      type: 'REAL_APPLICATION',
      scenario: 'یک موقعیت واقعی برای تمرین.',
      questions: [
        { id: 'q1', prompt: 'سؤال؟', options: ['الف', 'ب'], correctIndex: 1 },
        { id: 'q2', prompt: 'سؤال؟', options: ['الف', 'ب'], correctIndex: 0 },
      ],
    },
  };
}

function makeCycle() {
  return {
    title: 'Cycle',
    titleFa: 'چرخه',
    focusSummary: 'خلاصه این چرخه.',
    lessons: [
      makeLesson(1, 'TEACHING'),
      makeLesson(2, 'TEACHING'),
      makeLesson(3, 'TEACHING'),
      makeLesson(4, 'TEACHING'),
      makeLesson(5, 'TEACHING'),
      makeLesson(6, 'HIDDEN_ASSESSMENT'),
      makeLesson(7, 'CONSOLIDATION'),
    ],
  };
}

describe('generatedCycleSchema', () => {
  it('accepts a well-formed cycle', () => {
    const r = validateWithDetail(generatedCycleSchema, makeCycle());
    expect(r.success).toBe(true);
  });

  it('rejects a cycle with fewer than 7 lessons', () => {
    const cycle = makeCycle();
    cycle.lessons = cycle.lessons.slice(0, 6);
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
  });

  it('rejects duplicate day numbers', () => {
    const cycle = makeCycle();
    cycle.lessons[6] = makeLesson(6, 'CONSOLIDATION');
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
  });

  it('requires day 6 to be the hidden assessment', () => {
    const cycle = makeCycle();
    cycle.lessons[5] = makeLesson(6, 'TEACHING');
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
    expect(r.errors?.join(' ')).toContain('HIDDEN_ASSESSMENT');
  });

  it('requires day 7 to be consolidation', () => {
    const cycle = makeCycle();
    cycle.lessons[6] = makeLesson(7, 'TEACHING');
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
    expect(r.errors?.join(' ')).toContain('CONSOLIDATION');
  });

  it('rejects an out-of-range correctIndex', () => {
    const cycle = makeCycle();
    cycle.lessons[0]!.part2.questions[0]!.correctIndex = 5;
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
  });

  it('rejects a pattern drill with too few items', () => {
    const cycle = makeCycle();
    cycle.lessons[0]!.part1.items = [makeItem()];
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
  });

  it('rejects an empty required string', () => {
    const cycle = makeCycle();
    cycle.lessons[0]!.title = '   ';
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(false);
  });

  it('accepts optional substitution slots', () => {
    const cycle = makeCycle();
    cycle.lessons[0]!.part1.items[0] = makeItem({
      substitution: { base: 'We offer ___ .', slots: ['a discount', 'free shipping'] },
    });
    const r = validateWithDetail(generatedCycleSchema, cycle);
    expect(r.success).toBe(true);
  });
});

describe('completeLessonSchema', () => {
  const uuid = '00000000-0000-0000-0000-000000000001';

  it('accepts a valid completion payload', () => {
    const r = completeLessonSchema.safeParse({
      lessonId: uuid,
      durationSeconds: 300,
      answers: [{ itemId: 'q1', isCorrect: true, responseMs: 2500 }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects a non-uuid lessonId', () => {
    const r = completeLessonSchema.safeParse({
      lessonId: 'not-a-uuid',
      durationSeconds: 300,
      answers: [],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a negative response time', () => {
    const r = completeLessonSchema.safeParse({
      lessonId: uuid,
      durationSeconds: 300,
      answers: [{ itemId: 'q1', isCorrect: true, responseMs: -1 }],
    });
    expect(r.success).toBe(false);
  });

  it('accepts an empty answers array (early exit)', () => {
    const r = completeLessonSchema.safeParse({
      lessonId: uuid,
      durationSeconds: 5,
      answers: [],
    });
    expect(r.success).toBe(true);
  });
});

describe('adminGiftSchema', () => {
  it('accepts a gift request and defaults extend to false', () => {
    const r = adminGiftSchema.parse({
      telegramId: 123456789,
      planType: '3_MONTHS',
    });
    expect(r.extend).toBe(false);
  });

  it('rejects an unknown plan type', () => {
    const r = adminGiftSchema.safeParse({
      telegramId: 123456789,
      planType: 'LIFETIME',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-numeric telegram id', () => {
    const r = adminGiftSchema.safeParse({
      telegramId: 'abc',
      planType: '1_MONTH',
    });
    expect(r.success).toBe(false);
  });
});

describe('telegramInitDataUserSchema', () => {
  it('accepts a minimal Telegram user', () => {
    const r = telegramInitDataUserSchema.safeParse({ id: 42, first_name: 'Ali' });
    expect(r.success).toBe(true);
  });

  it('rejects a user without an id', () => {
    const r = telegramInitDataUserSchema.safeParse({ first_name: 'Ali' });
    expect(r.success).toBe(false);
  });
});

describe('validateWithDetail', () => {
  it('produces readable error paths', () => {
    const r = validateWithDetail(generatedCycleSchema, { title: '', titleFa: '' });
    expect(r.success).toBe(false);
    expect(r.errors?.length).toBeGreaterThan(0);
    expect(r.errors?.[0]).toMatch(/^(title|titleFa|focusSummary|lessons)/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// AI provider schemas
//
// These guard the admin panel → Worker boundary. The important properties:
// a key is always required on create, optional on update (so editing a
// label doesn't force re-entering the secret), and an OpenAI-compatible
// provider must declare where its endpoint lives.
// ═════════════════════════════════════════════════════════════════════

describe('createAiProviderSchema', () => {
  const base = {
    label: 'Gemini main',
    protocol: 'gemini' as const,
    vendor: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: 'AIzaSyTestKeyValue123',
  };

  it('accepts a minimal valid payload and applies defaults', () => {
    const result = createAiProviderSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data!.priority).toBe(100);
    expect(result.data!.isActive).toBe(true);
    expect(result.data!.supportsJsonSchema).toBe(false);
  });

  it('rejects an API key shorter than 8 characters', () => {
    expect(createAiProviderSchema.safeParse({ ...base, apiKey: 'short' }).success).toBe(false);
  });

  it('rejects an empty label', () => {
    expect(createAiProviderSchema.safeParse({ ...base, label: '' }).success).toBe(false);
  });

  it('rejects an empty model', () => {
    expect(createAiProviderSchema.safeParse({ ...base, model: '' }).success).toBe(false);
  });

  it('rejects an unknown protocol', () => {
    expect(
      createAiProviderSchema.safeParse({ ...base, protocol: 'telepathy' }).success
    ).toBe(false);
  });

  it('requires baseUrl for a non-deepseek OpenAI-compatible provider', () => {
    const result = createAiProviderSchema.safeParse({
      ...base,
      protocol: 'openai_compatible',
      vendor: 'groq',
      model: 'llama-3.3-70b-versatile',
    });
    expect(result.success).toBe(false);
  });

  it('allows an OpenAI-compatible provider to omit baseUrl when it is deepseek', () => {
    const result = createAiProviderSchema.safeParse({
      ...base,
      protocol: 'openai_compatible',
      vendor: 'deepseek',
      model: 'deepseek-chat',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid baseUrl', () => {
    const result = createAiProviderSchema.safeParse({
      ...base,
      protocol: 'openai_compatible',
      vendor: 'custom',
      baseUrl: 'https://api.example.com/v1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed baseUrl', () => {
    const result = createAiProviderSchema.safeParse({
      ...base,
      protocol: 'openai_compatible',
      vendor: 'custom',
      baseUrl: 'not a url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range temperature', () => {
    expect(createAiProviderSchema.safeParse({ ...base, temperature: 5 }).success).toBe(false);
    expect(createAiProviderSchema.safeParse({ ...base, temperature: -1 }).success).toBe(false);
  });

  it('rejects a priority outside 1..999', () => {
    expect(createAiProviderSchema.safeParse({ ...base, priority: 0 }).success).toBe(false);
    expect(createAiProviderSchema.safeParse({ ...base, priority: 1000 }).success).toBe(false);
  });
});

describe('updateAiProviderSchema', () => {
  it('accepts an empty object (nothing to change)', () => {
    expect(updateAiProviderSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a label-only change without an apiKey', () => {
    const result = updateAiProviderSchema.safeParse({ label: 'Renamed' });
    expect(result.success).toBe(true);
    expect(result.data!.apiKey).toBeUndefined();
  });

  it('accepts a new apiKey when it is long enough', () => {
    expect(
      updateAiProviderSchema.safeParse({ apiKey: 'AIzaSyNewKeyValue' }).success
    ).toBe(true);
  });

  it('rejects a too-short apiKey when one is supplied', () => {
    expect(updateAiProviderSchema.safeParse({ apiKey: 'abc' }).success).toBe(false);
  });

  it('accepts toggling isActive alone', () => {
    expect(updateAiProviderSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('reorderAiProvidersSchema', () => {
  it('accepts a list of uuids', () => {
    const result = reorderAiProvidersSchema.safeParse({
      order: [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty order list', () => {
    expect(reorderAiProvidersSchema.safeParse({ order: [] }).success).toBe(false);
  });

  it('rejects non-uuid entries', () => {
    expect(reorderAiProvidersSchema.safeParse({ order: ['not-a-uuid'] }).success).toBe(false);
  });
});
