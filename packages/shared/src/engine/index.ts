import {
  CYCLE_LENGTH_DAYS,
  CYCLE_SCHEDULE,
  CYCLE_STALL_DAYS,
  dayProfile,
  LEITNER_BOXES,
  LEITNER_INTERVALS_DAYS,
} from '../constants/index.js';
import type {
  CycleDay,
  CycleStatus,
  LessonKind,
  LessonStatus,
  SkillDelta,
  WeakTerm,
} from '../types/index.js';

// ═════════════════════════════════════════════════════════════════════
// 1. Leitner box transitions (Spaced Repetition)
// ═════════════════════════════════════════════════════════════════════

export interface LeitnerInput {
  box: number;
  ease: number;
  repetitions: number;
  lapses: number;
  isCorrect: boolean;
  responseMs: number;
}

export interface LeitnerOutput {
  box: number;
  ease: number;
  repetitions: number;
  lapses: number;
  intervalDays: number;
  mastered: boolean;
}

/**
 * جعبه لایتنر ۵ خانه‌ای با ضریب آسانی (الهام از SM-2).
 *
 * - پاسخ صحیح سریع  → یک خانه بالا، ease افزایش می‌یابد
 * - پاسخ صحیح کند   → یک خانه بالا، ease دست‌نخورده
 * - پاسخ غلط        → بازگشت به خانه ۱، ease کاهش می‌یابد
 * - خانه ۵           → تثبیت‌شده (mastered)
 */
export function applyLeitnerReview(input: LeitnerInput): LeitnerOutput {
  const { isCorrect, responseMs } = input;

  let { box, ease, repetitions, lapses } = input;
  ease = clamp(ease || 2.5, 1.3, 3.2);

  if (!isCorrect) {
    box = 1;
    lapses += 1;
    repetitions = 0;
    ease = clamp(ease - 0.25, 1.3, 3.2);
  } else {
    const fast = responseMs > 0 && responseMs < 4000;
    const slow = responseMs >= 9000;

    // پاداش سرعت فقط از خانه ۲ به بالا اعمال می‌شود
    const step = fast && box >= 2 ? 2 : 1;
    box = Math.min(LEITNER_BOXES, box + step);

    repetitions += 1;
    if (fast) ease = clamp(ease + 0.08, 1.3, 3.2);
    else if (slow) ease = clamp(ease - 0.05, 1.3, 3.2);
  }

  const baseInterval = LEITNER_INTERVALS_DAYS[box] ?? 0;
  const intervalDays = Math.max(0, Math.round(baseInterval * (ease / 2.5)));

  return {
    box,
    ease: round2(ease),
    repetitions,
    lapses,
    intervalDays,
    mastered: box >= LEITNER_BOXES,
  };
}

export function nextReviewDate(intervalDays: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + Math.max(intervalDays, 0));
  return d;
}

// ═════════════════════════════════════════════════════════════════════
// 2. Delta patching: build the skill report fed back to the AI
// ═════════════════════════════════════════════════════════════════════

export interface RawTelemetryEvent {
  eventType: string;
  itemId?: string | null;
  isCorrect?: boolean | null;
  responseMs?: number | null;
  pauseMs?: number | null;
  linkedTerm?: string | null;
}

export interface LexicalSnapshot {
  term: string;
  box: number;
  lapses: number;
  successCount: number;
  failCount: number;
}

export interface BuildDeltaInput {
  events: RawTelemetryEvent[];
  lexical: LexicalSnapshot[];
  /** امتیاز آزمون پنهان روز ۶ (اگر چرخه تمام شده) */
  hiddenAssessmentScore?: number | null;
  /** برچسب حوزه‌ها برای هر itemId (مثلاً { q101: 'نقاط قوت: قیمت‌گذاری' }) */
  areaByItemId?: Record<string, string>;
}

export function buildSkillDelta(input: BuildDeltaInput): SkillDelta {
  const answers = input.events.filter((e) => e.eventType === 'ANSWER');
  const totalAnswers = answers.length;
  const correct = answers.filter((a) => a.isCorrect === true).length;

  const responseTimes = answers
    .map((a) => a.responseMs ?? 0)
    .filter((v) => v > 0);
  const averageResponseMs = responseTimes.length
    ? Math.round(sum(responseTimes) / responseTimes.length)
    : 0;

  const pauses = input.events
    .map((e) => e.pauseMs ?? 0)
    .filter((v) => v > 0);
  const maxPauseMs = pauses.length ? Math.max(...pauses) : 0;

  // حوزه‌ها را بر اساس درست/غلط بودن تجمیع می‌کنیم
  const areaStats = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const area = a.itemId ? input.areaByItemId?.[a.itemId] : undefined;
    if (!area) continue;
    const cur = areaStats.get(area) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    areaStats.set(area, cur);
  }

  const rankedAreas = [...areaStats.entries()]
    .map(([area, s]) => ({ area, rate: s.total ? s.correct / s.total : 0 }))
    .sort((a, b) => b.rate - a.rate);

  // سرعت = تعداد پاسخ تقسیم بر مجموع زمان صرف‌شده (دقیقه)
  const totalResponseMs = sum(responseTimes);

  const weakTerms: WeakTerm[] = input.lexical
    .filter((l) => l.box <= 2 || l.lapses > 0)
    .map((l) => {
      const total = l.successCount + l.failCount;
      return {
        term: l.term,
        box: l.box,
        lapses: l.lapses,
        failRate: total > 0 ? round2(l.failCount / total) : 0,
      };
    })
    .sort((a, b) => b.failRate - a.failRate || a.box - b.box)
    .slice(0, 60);

  const masteredTerms = input.lexical
    .filter((l) => l.box >= LEITNER_BOXES)
    .map((l) => l.term)
    .slice(0, 120);

  return {
    accuracyPct: totalAnswers ? round2((correct / totalAnswers) * 100) : 0,
    averageResponseMs,
    maxPauseMs,
    totalAnswers,
    weakTerms,
    masteredTerms,
    strongestAreas: rankedAreas.slice(0, 5).map((a) => a.area),
    weakestAreas: rankedAreas.slice(-5).reverse().map((a) => a.area),
    paceAnswersPerMinute:
      totalResponseMs > 0
        ? round2((answers.length * 60_000) / totalResponseMs)
        : 0,
    hiddenAssessmentScore: input.hiddenAssessmentScore ?? null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// 3. Cycle scheduling
// ═════════════════════════════════════════════════════════════════════

export function lessonKindForDay(dayNumber: number): LessonKind {
  return (CYCLE_SCHEDULE as Record<number, LessonKind>)[dayNumber] ?? 'TEACHING';
}

export interface BuildCycleDaysInput {
  cycleStatus: CycleStatus;
  /** روزهایی که تکمیل شده‌اند */
  completedDays: number[];
  lessonTitles: Record<number, string>;
  /**
   * مرحلهٔ ۸ — هدف آموزشی هر روز (اختیاری). اگر نیاید، از پروفایل ثابت
   * روز (`DAY_PROFILES`) پر می‌شود تا UI همیشه مرحله را نشان بدهد.
   */
  objectives?: Record<number, string>;
  objectivesFa?: Record<number, string>;
}

/**
 * نقشه راه ۷ روزه برای UI.
 * قاعده قفل: روز n فقط وقتی AVAILABLE است که روز n-1 تمام شده باشد.
 */
export function buildCycleDays(input: BuildCycleDaysInput): CycleDay[] {
  const { cycleStatus, completedDays, lessonTitles, objectives, objectivesFa } = input;
  const completedSet = new Set(completedDays);

  let currentDay: number | null = null;
  for (let d = 1; d <= CYCLE_LENGTH_DAYS; d++) {
    if (!completedSet.has(d)) {
      currentDay = d;
      break;
    }
  }

  return Array.from({ length: CYCLE_LENGTH_DAYS }, (_, i) => {
    const dayNumber = i + 1;
    const isCompleted = completedSet.has(dayNumber);
    const profile = dayProfile(dayNumber);

    let status: LessonStatus;
    if (isCompleted) status = 'COMPLETED';
    else if (cycleStatus === 'ACTIVE' && dayNumber === currentDay) status = 'AVAILABLE';
    else status = 'LOCKED';

    return {
      dayNumber,
      title: lessonTitles[dayNumber] ?? `Day ${dayNumber}`,
      kind: lessonKindForDay(dayNumber),
      status,
      isCompleted,
      isActive: dayNumber === currentDay && cycleStatus === 'ACTIVE',
      isLocked: status === 'LOCKED',
      // مرحلهٔ ۸ — برای نمایش «این روز چه چیزی یاد می‌دهد»
      phase: profile.phase,
      objective: objectives?.[dayNumber] ?? profile.objective,
      objectiveFa: objectivesFa?.[dayNumber] ?? profile.objectiveFa,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════
// 4. Delta Patching trigger rules
// ═════════════════════════════════════════════════════════════════════

export interface ShouldGenerateInput {
  cycleStatus: CycleStatus;
  completedDays: number[];
  cycleStartedAt: Date | null;
  now?: Date;
  stallDays?: number;
  /** آیا چرخه بعدی همین حالا در حال تولید است؟ */
  hasGeneratingCycle?: boolean;
}

export interface ShouldGenerateResult {
  shouldGenerate: boolean;
  reason:
    | 'CYCLE_COMPLETE'
    | 'CYCLE_COMPLETE_RECOVERY'
    | 'CYCLE_IN_PROGRESS'
    | 'ALREADY_GENERATING'
    | 'CALENDAR_PAUSED_STALL'
    | 'CYCLE_NOT_STARTED';
}

/**
 * تصمیم‌گیری «الان چرخه جدید بسازیم یا نه» — جلوگیری از توکن‌سوزی.
 *
 * قواعد:
 *  1. فقط پس از تکمیل روز ۷ → تولید.
 *  2. اگر کاربر بیش از CYCLE_STALL_DAYS روز در چرخه مانده و تمام نکرده
 *     → تقویم متوقف، هیچ فراخوانی AI انجام نمی‌شود.
 *  3. اگر چرخه بعدی در حال تولید است → دوباره نفرست.
 */
export function shouldGenerateNextCycle(
  input: ShouldGenerateInput
): ShouldGenerateResult {
  const now = input.now ?? new Date();
  const stallDays = input.stallDays ?? CYCLE_STALL_DAYS;

  if (input.hasGeneratingCycle) {
    return { shouldGenerate: false, reason: 'ALREADY_GENERATING' };
  }

  if (!input.cycleStartedAt) {
    return { shouldGenerate: false, reason: 'CYCLE_NOT_STARTED' };
  }

  const days = new Set(input.completedDays);
  const allComplete = Array.from(
    { length: CYCLE_LENGTH_DAYS },
    (_, i) => i + 1
  ).every((d) => days.has(d));

  if (input.cycleStatus === 'ACTIVE' && allComplete) {
    return { shouldGenerate: true, reason: 'CYCLE_COMPLETE' };
  }

  /**
   * ⚠️ ایمنی: اگر چرخه قبلاً COMPLETED شده ولی همهٔ روزها کامل‌اند،
   * احتمالاً تولید چرخهٔ جدید از دست رفته (مثلاً به خاطر ری‌استارت
   * Worker بین `markCycleCompleted` و `createGeneratingCycle`). این
   * شاخه اجازه می‌دهد کرون یا تلاش مجدد چرخهٔ جدید را بسازد.
   */
  if (input.cycleStatus === 'COMPLETED' && allComplete) {
    return { shouldGenerate: true, reason: 'CYCLE_COMPLETE_RECOVERY' };
  }

  const daysElapsed = diffInDays(input.cycleStartedAt, now);
  if (input.cycleStatus === 'ACTIVE' && daysElapsed > stallDays) {
    return { shouldGenerate: false, reason: 'CALENDAR_PAUSED_STALL' };
  }

  return { shouldGenerate: false, reason: 'CYCLE_IN_PROGRESS' };
}

// ═════════════════════════════════════════════════════════════════════
// 5. Access control (freemium)
// ═════════════════════════════════════════════════════════════════════

export interface AccessInput {
  hasActiveSubscription: boolean;
  trialStartedAt: Date | null;
  now?: Date;
  freeTrialDays?: number;
}

export interface AccessResult {
  hasAccess: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  reason: 'SUBSCRIPTION' | 'TRIAL' | 'TRIAL_EXPIRED' | 'NO_SUBSCRIPTION';
}

export function evaluateAccess(input: AccessInput): AccessResult {
  const now = input.now ?? new Date();
  const trialDays = input.freeTrialDays ?? 7;

  if (input.hasActiveSubscription) {
    return {
      hasAccess: true,
      isTrial: false,
      trialDaysLeft: 0,
      reason: 'SUBSCRIPTION',
    };
  }

  if (!input.trialStartedAt) {
    return {
      hasAccess: true,
      isTrial: true,
      trialDaysLeft: trialDays,
      reason: 'TRIAL',
    };
  }

  const used = diffInDays(input.trialStartedAt, now);
  const left = Math.max(0, trialDays - used);

  if (left > 0) {
    return { hasAccess: true, isTrial: true, trialDaysLeft: left, reason: 'TRIAL' };
  }

  return {
    hasAccess: false,
    isTrial: false,
    trialDaysLeft: 0,
    reason: 'TRIAL_EXPIRED',
  };
}

export function daysRemaining(expiresAt: Date, now: Date = new Date()): number {
  const ms = expiresAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

// ═════════════════════════════════════════════════════════════════════
// 6. Streak calculation
// ═════════════════════════════════════════════════════════════════════

/**
 * استریک بر اساس **تاریخ محلی کاربر** (نه UTC).
 *
 * ⚠️ باگ رفع‌شده: `diffInDays` روی تاریخ UTC حساب می‌کرد. کاربر تهران که
 * ساعت ۰۰:۳۰ محلی درس می‌خواند، در UTC همان روزِ قبل بود → دو روز متوالی
 * «یک روز» حساب می‌شد و استریک ۴ روزه «۱» نشان می‌داد.
 */
export function computeStreakLocal(
  lastDate: string | null,
  currentStreak: number,
  todayDate: string
): { streak: number; isNewDay: boolean } {
  if (!lastDate) return { streak: 1, isNewDay: true };
  if (lastDate === todayDate) return { streak: currentStreak || 1, isNewDay: false };

  const a = Date.parse(`${lastDate}T00:00:00Z`);
  const b = Date.parse(`${todayDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { streak: 1, isNewDay: true };

  const gap = Math.round((b - a) / 86_400_000);
  if (gap === 1) return { streak: (currentStreak || 0) + 1, isNewDay: true };
  return { streak: 1, isNewDay: true };
}

export function computeStreak(
  lastActiveDate: Date | null,
  currentStreak: number,
  now: Date = new Date()
): { streak: number; isNewDay: boolean } {
  if (!lastActiveDate) return { streak: 1, isNewDay: true };

  const gap = diffInDays(lastActiveDate, now);

  if (gap === 0) return { streak: currentStreak || 1, isNewDay: false };
  if (gap === 1) return { streak: (currentStreak || 0) + 1, isNewDay: true };
  return { streak: 1, isNewDay: true };
}

// ═════════════════════════════════════════════════════════════════════
// 7. Quality scoring (for stars reward)
// ═════════════════════════════════════════════════════════════════════

export interface LessonScoreInput {
  answers: { isCorrect: boolean; responseMs: number }[];
  usedHints: number;
}

export interface LessonScore {
  score: number;        // 0..100
  accuracy: number;     // 0..100
  speedBonus: number;   // 0..100
  isPerfect: boolean;
}

export function scoreLesson(input: LessonScoreInput): LessonScore {
  const total = input.answers.length;
  if (total === 0) {
    return { score: 0, accuracy: 0, speedBonus: 0, isPerfect: false };
  }

  const correct = input.answers.filter((a) => a.isCorrect).length;
  const accuracy = round2((correct / total) * 100);

  const fast = input.answers.filter(
    (a) => a.isCorrect && a.responseMs > 0 && a.responseMs < 5000
  ).length;
  const speedBonus = round2((fast / total) * 100);

  const hintPenalty = Math.min(20, input.usedHints * 4);

  const score = clamp(
    Math.round(accuracy * 0.7 + speedBonus * 0.3 - hintPenalty),
    0,
    100
  );

  return {
    score,
    accuracy,
    speedBonus,
    isPerfect: score >= 95 && input.usedHints === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function diffInDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}
