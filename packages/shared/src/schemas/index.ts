import { z } from 'zod';
import { UI_LANGUAGE_CODES, TARGET_LANGUAGE_CODES } from '../constants/index.js';

/**
 * Strict JSON schema for AI-generated content.
 * Gemini 2.5 Flash is called with responseSchema derived from these.
 *
 * Why strict: a malformed cycle costs tokens AND leaves the user stuck
 * with a broken lesson. We validate then repair/retry.
 */

// ─────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const skillLevelSchema = z.enum(['ZERO', 'A1', 'A2', 'B1', 'B2', 'C1']);

export const lessonKindSchema = z.enum([
  'TEACHING',
  'HIDDEN_ASSESSMENT',
  'CONSOLIDATION',
]);

export const uiLanguageSchema = z.enum(UI_LANGUAGE_CODES);
export const targetLanguageSchema = z.enum(TARGET_LANGUAGE_CODES);

/** گویش انتخابی مثل en-US — اختیاری */
export const dialectSchema = z.string().max(16).nullish();

/** بودجهٔ زمانی روزانهٔ کاربر (دقیقه) */
export const dailyMinutesSchema = z.number().int().min(5).max(300).nullish();

export const planTypeSchema = z.enum([
  'TRIAL',
  '2_WEEKS',
  '1_MONTH',
  '3_MONTHS',
  '6_MONTHS',
  '1_YEAR',
]);

// ─────────────────────────────────────────────────────────────────────
// Lesson parts
// ─────────────────────────────────────────────────────────────────────

export const substitutionSchema = z.object({
  base: nonEmpty(300),
  slots: z.array(nonEmpty(80)).min(2).max(8),
});

export const patternDrillItemSchema = z.object({
  term: nonEmpty(120),
  meaning: nonEmpty(200),
  pronunciation: z.string().max(120).optional(),
  example: nonEmpty(400),
  exampleTranslation: z.string().max(400).optional(),
  substitution: substitutionSchema.optional(),
  /**
   * box به‌صورت literal union تعریف می‌شود تا خروجی infer شده با
   * LeitnerBox در types مطابق باشد. مدل این مقدار را تعیین نمی‌کند،
   * بلکه موتور تطبیقی ما آن را هنگام رندر تزریق می‌کند.
   */
  box: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).optional(),
});

export const microExerciseSchema = z
  .object({
    id: nonEmpty(40),
    kind: z.enum(['FILL_BLANK', 'REORDER', 'MATCH', 'CHOOSE']),
    prompt: nonEmpty(500),
    options: z.array(nonEmpty(200)).min(2).max(6).optional(),
    correctIndex: z.number().int().min(0).max(5).optional(),
    answer: z.string().max(200).optional(),
    explanation: z.string().max(500).optional(),
  })
  .refine(
    (e) =>
      e.kind === 'CHOOSE' || e.kind === 'MATCH'
        ? e.options !== undefined && e.correctIndex !== undefined
        : true,
    { message: 'CHOOSE/MATCH exercises require options and correctIndex' }
  );

export const patternDrillPartSchema = z.object({
  type: z.literal('PATTERN_DRILL'),
  explanation: nonEmpty(1200),
  pattern: z.string().max(300).optional(),
  patternTranslation: z.string().max(300).optional(),
  items: z.array(patternDrillItemSchema).min(3).max(12),
  microExercises: z.array(microExerciseSchema).max(6).optional(),
});

export const dialogueLineSchema = z.object({
  speaker: nonEmpty(60),
  text: nonEmpty(400),
  translation: z.string().max(400).optional(),
});

export const applicationQuestionSchema = z
  .object({
    id: nonEmpty(40),
    prompt: nonEmpty(600),
    options: z.array(nonEmpty(300)).min(2).max(5),
    correctIndex: z.number().int().min(0).max(4),
    explanation: z.string().max(600).optional(),
    linkedTerm: z.string().max(120).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range',
  });

export const realApplicationPartSchema = z.object({
  type: z.literal('REAL_APPLICATION'),
  scenario: nonEmpty(600),
  scenarioTranslation: z.string().max(600).optional(),
  dialogue: z.array(dialogueLineSchema).max(20).optional(),
  questions: z.array(applicationQuestionSchema).min(2).max(10),
});

// ─────────────────────────────────────────────────────────────────────
// Generated cycle
// ─────────────────────────────────────────────────────────────────────

export const generatedLessonSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(7),
    title: nonEmpty(150),
    titleFa: nonEmpty(150),
    kind: lessonKindSchema,
    part1: patternDrillPartSchema,
    part2: realApplicationPartSchema,
  })
  .refine(
    (l) => l.dayNumber !== 7 || l.kind === 'CONSOLIDATION',
    { message: 'Day 7 must be CONSOLIDATION' }
  )
  .refine(
    (l) => l.dayNumber !== 6 || l.kind === 'HIDDEN_ASSESSMENT',
    { message: 'Day 6 must be HIDDEN_ASSESSMENT' }
  );

export const generatedCycleSchema = z
  .object({
    title: nonEmpty(150),
    titleFa: nonEmpty(150),
    focusSummary: nonEmpty(600),
    lessons: z.array(generatedLessonSchema).length(7),
  })
  .refine(
    (c) => {
      const days = c.lessons.map((l) => l.dayNumber).sort((a, b) => a - b);
      return days.every((d, i) => d === i + 1);
    },
    { message: 'Cycle must contain exactly days 1..7, each once' }
  );

// ─────────────────────────────────────────────────────────────────────
// طرح کلی چرخه (تولید ماژولار: outline → روز ۱ → بقیه در پس‌زمینه)
// ─────────────────────────────────────────────────────────────────────

export const outlineDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  title: nonEmpty(150),
  titleFa: nonEmpty(150),
  kind: lessonKindSchema,
  // مرحلهٔ ۸ — هدف آموزشی هر روز. اختیاری برای سازگاری با کش قدیمی.
  objective: z.string().max(400).optional(),
  objectiveFa: z.string().max(400).optional(),
});

export const cycleOutlineSchema = z
  .object({
    title: nonEmpty(150),
    titleFa: nonEmpty(150),
    focusSummary: nonEmpty(600),
    days: z.array(outlineDaySchema).length(7),
  })
  .refine(
    (c) => {
      const days = c.days.map((d) => d.dayNumber).sort((a, b) => a - b);
      return days.every((d, i) => d === i + 1);
    },
    { message: 'Outline must contain exactly days 1..7, each once' }
  )
  .refine((c) => c.days[5]?.kind === 'HIDDEN_ASSESSMENT', {
    message: 'Day 6 must be HIDDEN_ASSESSMENT',
  })
  .refine((c) => c.days[6]?.kind === 'CONSOLIDATION', {
    message: 'Day 7 must be CONSOLIDATION',
  });

// ─────────────────────────────────────────────────────────────────────
// Delta report (input to AI — we also validate our own output)
// ─────────────────────────────────────────────────────────────────────

export const weakTermSchema = z.object({
  term: nonEmpty(120),
  box: z.number().int().min(1).max(5),
  lapses: z.number().int().min(0),
  failRate: z.number().min(0).max(1),
});

export const skillDeltaSchema = z.object({
  accuracyPct: z.number().min(0).max(100),
  averageResponseMs: z.number().min(0),
  maxPauseMs: z.number().min(0),
  totalAnswers: z.number().int().min(0),
  weakTerms: z.array(weakTermSchema).max(60),
  masteredTerms: z.array(z.string()).max(120),
  strongestAreas: z.array(z.string()).max(10),
  weakestAreas: z.array(z.string()).max(10),
  paceAnswersPerMinute: z.number().min(0),
  hiddenAssessmentScore: z.number().min(0).max(100).nullable(),
});

export const cycleGenerationInputSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    skillLevel: skillLevelSchema,
    learningGoal: z.string().max(200).nullable(),
    uiLanguage: uiLanguageSchema,
    targetLanguage: targetLanguageSchema,
  }),
  cycleNumber: z.number().int().min(1),
  delta: skillDeltaSchema,
  previousCycleSummary: z.string().max(2000).nullable(),
});

// ─────────────────────────────────────────────────────────────────────
// API request payloads (from the client)
// ─────────────────────────────────────────────────────────────────────

export const authRequestSchema = z.object({
  initData: z.string().min(10),
});

/**
 * ورود با توکن یک‌بارمصرف لینک (وقتی initData در دسترس نیست).
 * توکن base64url با ۳۲ بایت آنتروپی است → ۴۳ کاراکتر.
 */
export const authLinkRequestSchema = z.object({
  token: z.string().min(16).max(128),
});

export const onboardingRequestSchema = z.object({
  uiLanguage: uiLanguageSchema,
  targetLanguage: targetLanguageSchema,
  skillLevel: skillLevelSchema,
  learningGoal: nonEmpty(100),
  /** گویش انتخابی (مثل en-US) */
  dialect: dialectSchema,
  /** دقیقهٔ روزانهٔ انتخابی */
  dailyMinutes: dailyMinutesSchema,
  /** نتیجهٔ آزمون تعیین سطح (اگر انجام شده باشد) */
  placement: z
    .object({
      score: z.number().min(0).max(100),
      estimatedLevel: skillLevelSchema,
      answers: z.number().int().min(0).max(100),
    })
    .nullish(),
});

export const updateProfileSchema = z.object({
  uiLanguage: uiLanguageSchema.optional(),
  targetLanguage: targetLanguageSchema.optional(),
  dialect: dialectSchema,
  dailyMinutes: dailyMinutesSchema,
  learningGoal: z.string().max(200).optional(),
  timezone: z.string().max(64).optional(),
});

export const completeLessonSchema = z.object({
  lessonId: z.string().uuid(),
  durationSeconds: z.number().int().min(0).max(86_400),
  answers: z
    .array(
      z.object({
        itemId: nonEmpty(60),
        isCorrect: z.boolean(),
        responseMs: z.number().int().min(0).max(600_000),
        linkedTerm: z.string().max(120).optional(),
        usedHint: z.boolean().optional(),
      })
    )
    .max(200),
});

export type CompleteLessonInput = z.infer<typeof completeLessonSchema>;

export const telemetryBatchSchema = z.object({
  lessonId: z.string().uuid().optional(),
  events: z
    .array(
      z.object({
        eventType: z.enum([
          'ANSWER',
          'PAUSE',
          'SKIP',
          'REPLAY',
          'HINT_USED',
          'LESSON_START',
          'LESSON_END',
          'SESSION_START',
          'SESSION_END',
        ]),
        itemId: z.string().max(60).optional(),
        isCorrect: z.boolean().optional(),
        responseMs: z.number().int().min(0).max(600_000).optional(),
        pauseMs: z.number().int().min(0).max(600_000).optional(),
        payload: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(200),
});

export const purchasePlanSchema = z.object({
  planId: z.string().min(1).max(40),
});

// ─────────────────────────────────────────────────────────────────────
// Admin — CRUD اشتراک‌ها (پنل مدیر)
// ─────────────────────────────────────────────────────────────────────

/** ساخت/ویرایش پلن. `id` نبود (یا خالی) یعنی «ساخت جدید». */
export const planUpsertSchema = z.object({
  id: z
    .string()
    .max(40)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  planType: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_]+$/, 'planType must be A-Z, 0-9 or _'),
  titleFa: z.string().min(1).max(80),
  titleEn: z.string().min(1).max(80),
  durationDays: z.number().int().min(1).max(3650),
  priceIrr: z.number().int().min(0).max(1_000_000_000).default(0),
  priceStars: z.number().int().min(1).max(1_000_000),
  discountPercent: z.number().int().min(0).max(90).default(0),
  badge: z.enum(['POPULAR', 'BEST_VALUE']).nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const planDeleteSchema = z.object({
  id: z.string().min(1).max(40),
});

// Admin
export const adminGiftSchema = z.object({
  telegramId: z.number().int().positive(),
  planType: planTypeSchema,
  note: z.string().max(500).optional(),
  extend: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────
// AI provider management (admin panel)
//
// These guard the panel → Worker boundary. The API key is only ever sent
// one way (client → server); responses carry `keyHint` instead.
// ─────────────────────────────────────────────────────────────────────

export const aiProtocolSchema = z.enum(['gemini', 'openai_compatible', 'anthropic']);

/**
 * Wire-compatible vendor presets the panel offers as a starting point.
 * `custom` means the admin fills every field by hand.
 */
export const aiVendorPresetSchema = z.enum([
  'gemini',
  'deepseek',
  'openai',
  'anthropic',
  'groq',
  'openrouter',
  'together',
  'custom',
]);

export const createAiProviderSchema = z
  .object({
    label: z.string().min(1).max(80),
    protocol: aiProtocolSchema,
    vendor: z.string().min(1).max(40),
    model: z.string().min(1).max(120),
    baseUrl: z.string().url().max(300).nullish(),
    apiKey: z.string().min(8).max(500),
    priority: z.number().int().min(1).max(999).default(100),
    isActive: z.boolean().default(true),
    temperature: z.number().min(0).max(2).nullish(),
    maxOutputTokens: z.number().int().min(256).max(200_000).nullish(),
    supportsJsonSchema: z.boolean().default(false),
    note: z.string().max(500).nullish(),
  })
  // A custom OpenAI-compatible gateway must declare where it lives; the
  // known vendors all have a baked-in default.
  .refine(
    (v) => v.protocol !== 'openai_compatible' || Boolean(v.baseUrl) || v.vendor === 'deepseek',
    {
      message:
        'baseUrl is required for openai_compatible providers unless vendor is "deepseek"',
      path: ['baseUrl'],
    }
  );

/**
 * Update payload. Every field is optional — the panel sends only what
 * changed. Omitting `apiKey` means "keep the stored key", which is how an
 * admin can rename a provider without re-typing the secret.
 */
export const updateAiProviderSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  protocol: aiProtocolSchema.optional(),
  vendor: z.string().min(1).max(40).optional(),
  model: z.string().min(1).max(120).optional(),
  baseUrl: z.string().url().max(300).nullish(),
  apiKey: z.string().min(8).max(500).optional(),
  priority: z.number().int().min(1).max(999).optional(),
  isActive: z.boolean().optional(),
  temperature: z.number().min(0).max(2).nullish(),
  maxOutputTokens: z.number().int().min(256).max(200_000).nullish(),
  supportsJsonSchema: z.boolean().optional(),
  note: z.string().max(500).nullish(),
});

/** Bulk reorder, sent when an admin drags rows in the panel. */
export const reorderAiProvidersSchema = z.object({
  order: z.array(z.string().uuid()).min(1).max(50),
});

/** "Test this provider now" — optionally against a specific stored row. */
export const testAiProviderSchema = z.object({
  providerId: z.string().uuid().optional(),
  /** Ad-hoc credentials for testing before saving. */
  draft: createAiProviderSchema.optional(),
});

// Telegram Stars update (subset we care about)
export const telegramSuccessfulPaymentSchema = z.object({
  telegram_payment_charge_id: z.string().min(1),
  provider_payment_charge_id: z.string().optional(),
  currency: z.string(),
  total_amount: z.number().int().min(1),
  invoice_payload: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// Telegram initData
// ─────────────────────────────────────────────────────────────────────

export const telegramInitDataUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().optional(),
});

export type TelegramInitDataUser = z.infer<typeof telegramInitDataUserSchema>;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/** اعتبارسنجی با پیام خطای قابل‌خواندن (برای retry با AI) */
export function validateWithDetail<T>(
  schema: z.ZodType<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`
    ),
  };
}
