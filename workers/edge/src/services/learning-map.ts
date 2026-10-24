import { SYSTEM_RULES_VERSION } from '@kpanah/shared';
import type {
  DecisionRecord,
  GeneratedLesson,
  LearningMap,
  MapStage,
  StageCriteria,
} from '@kpanah/shared';

/** حداکثر تصمیم‌های نگه‌داری‌شده در نقشه (جلوگیری از رشد بی‌پایان) */
const MAX_DECISIONS = 200;

/** حداقل تعداد پاسخ برای این‌که شواهد «کافی» تلقی شود */
export const MIN_EVIDENCE_ANSWERS = 10;

/**
 * افزودن یک تصمیم به نقشه.
 * ⚠️ هر تصمیم باید `ruleId` ثابت داشته باشد تا قابل بازتولید و جست‌وجو باشد.
 */
export function appendDecision(
  map: LearningMap,
  decision: Omit<DecisionRecord, 'id' | 'at'>,
  now: Date = new Date()
): LearningMap {
  const record: DecisionRecord = {
    id: `d-${now.getTime()}-${(map.decisions?.length ?? 0) + 1}`,
    at: now.toISOString(),
    ...decision,
  };
  const list = [...(map.decisions ?? []), record].slice(-MAX_DECISIONS);
  return { ...map, decisions: list, updatedAt: record.at };
}

/**
 * «نقشهٔ ثابت، اجرای تطبیقی» — قلب معماری.
 *
 * ⚠️ چرا این فایل لازم شد: پیش از این، هر چرخه مستقل و بر اساس آمار ساخته
 * می‌شد و هیچ مرجع ثابتی وجود نداشت که بگوید «مسیر کاربر چیست». نتیجه:
 * نه پیش‌نیاز معنا داشت، نه معیار عبور، نه ردیابی هدف.
 *
 * نقشه **قطعی** ساخته می‌شود (بدون AI) تا از یک کاربر و یک هدف، همیشه یک
 * نقشه در بیاید؛ تنها اجرا (چرخه/درس) تطبیقی است.
 */

interface StageTemplate {
  key: string;
  title: string;
  titleUi: string;
  objective: string;
  objectiveUi: string;
  skills: string[];
  criteria: StageCriteria;
  estimatedCycles: number;
}

/** مراحل مشترک همهٔ اهداف */
const CORE_STAGES: StageTemplate[] = [
  {
    key: 'foundation',
    title: 'Foundations of interaction',
    titleUi: 'پایه‌های ارتباط',
    objective: 'Greet, introduce yourself and ask two simple questions about the other person.',
    objectiveUi: 'سلام و معرفی خودت و پرسیدن دو سؤال ساده از طرف مقابل',
    skills: ['vocabulary', 'listening', 'speaking'],
    criteria: { minAccuracy: 65, minMasteredTerms: 15, maxWeakTerms: 6 },
    estimatedCycles: 2,
  },
  {
    key: 'survival',
    title: 'Essential situations',
    titleUi: 'موقعیت‌های ضروری',
    objective: 'Handle ordering, prices, directions and asking for help without switching language.',
    objectiveUi: 'سفارش دادن، پرسیدن قیمت و مسیر و کمک خواستن بدون تغییر زبان',
    skills: ['vocabulary', 'listening', 'speaking'],
    criteria: { minAccuracy: 70, minMasteredTerms: 30, maxWeakTerms: 5 },
    estimatedCycles: 2,
  },
  {
    key: 'interaction',
    title: 'Two-way conversation',
    titleUi: 'گفت‌وگوی دوطرفه',
    objective: 'Keep a short exchange going: answer, ask back and clarify when you do not understand.',
    objectiveUi: 'ادامه دادن یک گفت‌وگوی کوتاه: جواب دادن، سؤال برگرداندن و رفع سوءتفاهم',
    skills: ['listening', 'speaking', 'grammar'],
    criteria: { minAccuracy: 75, minMasteredTerms: 45, maxWeakTerms: 4 },
    estimatedCycles: 2,
  },
  {
    key: 'transfer',
    title: 'New situations',
    titleUi: 'موقعیت تازه',
    objective: 'Use what you learned in a situation you have never seen before.',
    objectiveUi: 'به کار بردن آموخته‌ها در موقعیتی که قبلاً ندیده‌ای',
    skills: ['speaking', 'listening'],
    criteria: { minAccuracy: 80, minMasteredTerms: 60, maxWeakTerms: 3 },
    estimatedCycles: 1,
  },
];

/** مرحلهٔ پایانی مخصوص هر هدف */
const GOAL_STAGES: Record<string, StageTemplate> = {
  TRAVEL: {
    key: 'travel_ready',
    title: 'Travel independence',
    titleUi: 'سفر مستقل',
    objective: 'Handle an airport, a hotel and a restaurant on your own.',
    objectiveUi: 'از فرودگاه، هتل و رستوران به‌تنهایی سر دربیاور',
    skills: ['speaking', 'listening'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
  BUSINESS: {
    key: 'business_ready',
    title: 'Work conversation',
    titleUi: 'مکالمهٔ کاری',
    objective: 'Introduce your work, answer interview-style questions and negotiate a simple deal.',
    objectiveUi: 'معرفی کارت، پاسخ به سؤال‌های مصاحبه و مذاکرهٔ ساده',
    skills: ['speaking', 'listening', 'grammar'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
  EXAM: {
    key: 'exam_ready',
    title: 'Exam performance',
    titleUi: 'عملکرد آزمون',
    objective: 'Answer timed questions accurately across reading and listening.',
    objectiveUi: 'پاسخ دقیق و زمان‌دار به سؤال‌های خواندن و شنیدن',
    skills: ['reading', 'listening', 'grammar'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
  DAILY: {
    key: 'daily_ready',
    title: 'Everyday fluency',
    titleUi: 'روزمرهٔ روان',
    objective: 'Talk about your day, plans and opinions in short natural exchanges.',
    objectiveUi: 'دربارهٔ روزت، برنامه‌ها و نظرت در گفت‌وگوی کوتاه صحبت کن',
    skills: ['speaking', 'listening'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
  MIGRATION: {
    key: 'migration_ready',
    title: 'Life abroad',
    titleUi: 'زندگی در خارج',
    objective: 'Deal with documents, appointments and official conversations.',
    objectiveUi: 'رسیدگی به مدارک، قرار اداری و گفت‌وگوهای رسمی',
    skills: ['speaking', 'listening', 'vocabulary'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
  ACADEMIC: {
    key: 'academic_ready',
    title: 'Academic usage',
    titleUi: 'کاربرد دانشگاهی',
    objective: 'Follow a lecture outline and express an argument clearly.',
    objectiveUi: 'دنبال کردن سرفصل درس و بیان استدلال به‌صورت روشن',
    skills: ['reading', 'speaking', 'grammar'],
    criteria: { minAccuracy: 85, minMasteredTerms: 75, maxWeakTerms: 2 },
    estimatedCycles: 1,
  },
};

const OUTCOMES: Record<string, string> = {
  TRAVEL: 'سفر بدون نیاز به راهنما',
  BUSINESS: 'کار و مذاکره به زبان مقصد',
  EXAM: 'نمرهٔ هدف در آزمون',
  DAILY: 'گفت‌وگوی روزمرهٔ روان',
  MIGRATION: 'زندگی روزمره در کشور مقصد',
  ACADEMIC: 'تحصیل به زبان مقصد',
};

/** ساخت قطعی نقشه از پروفایل — بدون AI */
export function buildLearningMap(input: {
  id: string;
  goal: string | null;
  targetLanguage: string;
  uiLanguage: string;
  now?: Date;
}): LearningMap {
  const goal = input.goal ?? 'DAILY';
  const templates = [...CORE_STAGES, GOAL_STAGES[goal] ?? GOAL_STAGES.DAILY!];

  const stages: MapStage[] = templates.map((t, index) => ({
    id: t.key,
    order: index + 1,
    title: t.title,
    titleUi: t.titleUi,
    objective: t.objective,
    objectiveUi: t.objectiveUi,
    skills: t.skills,
    prerequisites: index === 0 ? [] : [templates[index - 1]!.key],
    criteria: t.criteria,
    status: index === 0 ? 'IN_PROGRESS' : 'PLANNED',
    estimatedCycles: t.estimatedCycles,
    masteredAt: null,
  }));

  const nowIso = (input.now ?? new Date()).toISOString();

  return {
    id: input.id,
    version: 1,
    rulesVersion: SYSTEM_RULES_VERSION,
    goal,
    targetLanguage: input.targetLanguage,
    uiLanguage: input.uiLanguage,
    outcome: OUTCOMES[goal] ?? OUTCOMES.DAILY!,
    createdAt: nowIso,
    updatedAt: nowIso,
    stages,
    currentStageId: stages[0]!.id,
    history: [
      { at: nowIso, kind: 'CREATED', reason: 'نقشهٔ اولیه از هدف و سطح کاربر ساخته شد' },
    ],
    violations: [],
  };
}

/**
 * بازنگری **رسمی** نقشه — تنها راه مجاز تغییر مسیر (مورد ۶.۴ چک‌لیست).
 *
 * ⚠️ وقتی کاربر هدفش را عوض می‌کند، مسیر قبلی دیگر معتبر نیست: مراحل با
 * هدف جدید بازساخته می‌شوند، نسخه بالا می‌رود و دلیل در `history` ثبت
 * می‌شود. کالیبراسیون و تصمیم‌ها حفظ می‌شوند (شواهد کاربر پاک نمی‌شود).
 */
export function reviseLearningMap(
  map: LearningMap,
  input: { goal: string; targetLanguage: string; uiLanguage: string; reason: string },
  now: Date = new Date()
): LearningMap {
  const rebuilt = buildLearningMap({
    id: map.id,
    goal: input.goal,
    targetLanguage: input.targetLanguage,
    uiLanguage: input.uiLanguage,
    now,
  });

  return {
    ...rebuilt,
    version: map.version + 1,
    createdAt: map.createdAt,
    // کالیبراسیون و سابقهٔ تصمیم‌ها حفظ می‌شوند
    calibration: map.calibration ?? null,
    decisions: map.decisions ?? [],
    history: [
      ...map.history,
      {
        at: (now ?? new Date()).toISOString(),
        kind: 'REVISED' as const,
        from: map.currentStageId,
        to: rebuilt.currentStageId,
        reason: `${input.reason} (v${map.version} → v${map.version + 1})`,
      },
    ],
  };
}

export function currentStage(map: LearningMap): MapStage {
  return map.stages.find((s) => s.id === map.currentStageId) ?? map.stages[0]!;
}

/**
 * ارزیابی عبور از مرحله بر اساس **شواهد ثبت‌شده**.
 * معیارها قبلاً در نقشه ذخیره شده‌اند و اینجا فقط مقایسه می‌شوند.
 */
export function evaluateStage(
  map: LearningMap,
  evidence: { accuracyPct: number; masteredTerms: number; weakTerms: number },
  now: Date = new Date()
): { map: LearningMap; advanced: boolean; reason: string } {
  const stage = currentStage(map);
  const { criteria } = stage;

  const passed =
    evidence.accuracyPct >= criteria.minAccuracy &&
    evidence.masteredTerms >= criteria.minMasteredTerms &&
    evidence.weakTerms <= criteria.maxWeakTerms;

  const nowIso = now.toISOString();

  if (!passed) {
    const weak =
      evidence.accuracyPct < criteria.minAccuracy - 10 ||
      evidence.weakTerms > criteria.maxWeakTerms + 2;

    return {
      map: {
        ...map,
        stages: map.stages.map((s) =>
          s.id === stage.id
            ? { ...s, status: weak ? ('NEEDS_WORK' as const) : ('IN_PROGRESS' as const) }
            : s
        ),
        updatedAt: nowIso,
      },
      advanced: false,
      reason: `معیار مرحلهٔ «${stage.titleUi}» برآورده نشد (دقت ${evidence.accuracyPct}٪ از ${criteria.minAccuracy}٪)`,
    };
  }

  const next = map.stages.find((s) => s.order === stage.order + 1) ?? null;

  return {
    map: {
      ...map,
      currentStageId: next?.id ?? stage.id,
      stages: map.stages.map((s) => {
        if (s.id === stage.id) {
          return { ...s, status: 'MASTERED' as const, masteredAt: nowIso };
        }
        if (next && s.id === next.id) return { ...s, status: 'IN_PROGRESS' as const };
        return s;
      }),
      updatedAt: nowIso,
      history: [
        ...map.history,
        {
          at: nowIso,
          kind: 'STAGE_MASTERED' as const,
          from: stage.id,
          to: next?.id ?? null,
          reason: `دقت ${evidence.accuracyPct}٪ · ${evidence.masteredTerms} واژهٔ تثبیت‌شده · ${evidence.weakTerms} واژهٔ ضعیف`,
        },
      ],
    },
    advanced: true,
    reason: `مرحلهٔ «${stage.titleUi}» با شواهد کافی تأیید شد`,
  };
}

/**
 * اعتبارسنجی محتوا نسبت به نقشه — **قبل از انتشار**.
 * قواعد فعلی (حداقلی و قابل‌آزمون):
 *  ۱. درس باید حداقل ۳ آیتم بخش ۱ داشته باشد.
 *  ۲. هر واژهٔ لینک‌شده در بخش ۲ باید در بخش ۱ همان درس باشد.
 *  ۳. بخش ۲ حداقل ۲ سؤال داشته باشد.
 */
export function validateLessonAgainstMap(
  lesson: GeneratedLesson,
  map: LearningMap,
  cycleId: string,
  now: Date = new Date()
): { ok: boolean; violations: { at: string; cycleId: string; rule: string; detail: string }[] } {
  const violations: { at: string; cycleId: string; rule: string; detail: string }[] = [];
  const at = now.toISOString();

  const terms = new Set(
    (lesson.part1?.items ?? []).map((i) => i.term.trim().toLowerCase())
  );

  if (terms.size < 3) {
    violations.push({
      at,
      cycleId,
      rule: 'MIN_ITEMS',
      detail: `بخش ۱ فقط ${terms.size} آیتم دارد (حداقل ۳)`,
    });
  }

  const questions = lesson.part2?.questions ?? [];
  if (questions.length < 2) {
    violations.push({
      at,
      cycleId,
      rule: 'MIN_QUESTIONS',
      detail: `بخش ۲ فقط ${questions.length} سؤال دارد (حداقل ۲)`,
    });
  }

  for (const q of questions) {
    const linked = q.linkedTerm?.trim().toLowerCase();
    if (linked && !terms.has(linked)) {
      violations.push({
        at,
        cycleId,
        rule: 'OFF_MAP_TERM',
        detail: `سؤال «${q.id}» به واژهٔ «${q.linkedTerm}» اشاره می‌کند که در بخش ۱ نیست`,
      });
    }
  }

  void map;
  return { ok: violations.length === 0, violations };
}
