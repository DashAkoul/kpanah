import { describe, it, expect } from 'vitest';
import {
  applyLeitnerReview,
  buildCycleDays,
  buildSkillDelta,
  computeStreak,
  evaluateAccess,
  scoreLesson,
  shouldGenerateNextCycle,
  nextReviewDate,
  daysRemaining,
  lessonKindForDay,
} from '../engine/index';
import { dayProfile } from '../constants/index';

// ═════════════════════════════════════════════════════════════════════
// Leitner boxes
// ═════════════════════════════════════════════════════════════════════

describe('applyLeitnerReview', () => {
  const fresh = { box: 1, ease: 2.5, repetitions: 0, lapses: 0 };

  it('promotes one box on a correct answer', () => {
    const r = applyLeitnerReview({ ...fresh, isCorrect: true, responseMs: 6000 });
    expect(r.box).toBe(2);
    expect(r.repetitions).toBe(1);
    expect(r.lapses).toBe(0);
  });

  it('promotes two boxes when fast and already above box 1', () => {
    const r = applyLeitnerReview({
      box: 2, ease: 2.5, repetitions: 2, lapses: 0,
      isCorrect: true, responseMs: 2000,
    });
    expect(r.box).toBe(4);
  });

  it('does not skip boxes from box 1 even if fast', () => {
    const r = applyLeitnerReview({ ...fresh, isCorrect: true, responseMs: 1000 });
    expect(r.box).toBe(2);
  });

  it('resets to box 1 and drops ease on a wrong answer', () => {
    const r = applyLeitnerReview({
      box: 4, ease: 2.8, repetitions: 5, lapses: 0,
      isCorrect: false, responseMs: 9000,
    });
    expect(r.box).toBe(1);
    expect(r.lapses).toBe(1);
    expect(r.repetitions).toBe(0);
    expect(r.ease).toBeLessThan(2.8);
  });

  it('caps ease at the lower bound', () => {
    let state = { box: 1, ease: 1.35, repetitions: 0, lapses: 0 };
    for (let i = 0; i < 5; i++) {
      const r = applyLeitnerReview({ ...state, isCorrect: false, responseMs: 5000 });
      state = { box: r.box, ease: r.ease, repetitions: r.repetitions, lapses: r.lapses };
    }
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('marks a term mastered at box 5', () => {
    const r = applyLeitnerReview({
      box: 4, ease: 2.5, repetitions: 4, lapses: 0,
      isCorrect: true, responseMs: 3000,
    });
    expect(r.box).toBe(5);
    expect(r.mastered).toBe(true);
  });

  it('never exceeds box 5', () => {
    const r = applyLeitnerReview({
      box: 5, ease: 2.5, repetitions: 8, lapses: 0,
      isCorrect: true, responseMs: 1500,
    });
    expect(r.box).toBe(5);
  });

  it('lowers ease on a slow but correct answer', () => {
    const r = applyLeitnerReview({
      box: 3, ease: 2.5, repetitions: 3, lapses: 0,
      isCorrect: true, responseMs: 15000,
    });
    expect(r.box).toBe(4);
    expect(r.ease).toBeLessThan(2.5);
  });

  it('produces a positive review interval for higher boxes', () => {
    const r = applyLeitnerReview({
      box: 4, ease: 2.5, repetitions: 4, lapses: 0,
      isCorrect: true, responseMs: 3000,
    });
    expect(r.intervalDays).toBeGreaterThan(0);
  });
});

describe('nextReviewDate', () => {
  it('adds the interval in days', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const next = nextReviewDate(7, from);
    expect(next.toISOString().slice(0, 10)).toBe('2026-01-08');
  });

  it('treats negative intervals as same-day', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(nextReviewDate(-5, from).toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});

// ═════════════════════════════════════════════════════════════════════
// Delta patching
// ═════════════════════════════════════════════════════════════════════

describe('buildSkillDelta', () => {
  it('computes accuracy from ANSWER events', () => {
    const delta = buildSkillDelta({
      events: [
        { eventType: 'ANSWER', isCorrect: true, responseMs: 3000 },
        { eventType: 'ANSWER', isCorrect: true, responseMs: 4000 },
        { eventType: 'ANSWER', isCorrect: false, responseMs: 5000 },
        { eventType: 'ANSWER', isCorrect: false, responseMs: 5000 },
      ],
      lexical: [],
    });
    expect(delta.accuracyPct).toBe(50);
    expect(delta.totalAnswers).toBe(4);
  });

  it('returns zero accuracy with no answers', () => {
    const delta = buildSkillDelta({ events: [], lexical: [] });
    expect(delta.accuracyPct).toBe(0);
    expect(delta.totalAnswers).toBe(0);
    expect(delta.averageResponseMs).toBe(0);
  });

  it('finds the longest pause', () => {
    const delta = buildSkillDelta({
      events: [
        { eventType: 'PAUSE', pauseMs: 2000 },
        { eventType: 'PAUSE', pauseMs: 9000 },
        { eventType: 'PAUSE', pauseMs: 1500 },
      ],
      lexical: [],
    });
    expect(delta.maxPauseMs).toBe(9000);
  });

  it('surfaces weak terms sorted by failure rate', () => {
    const delta = buildSkillDelta({
      events: [],
      lexical: [
        { term: 'alpha', box: 1, lapses: 0, successCount: 1, failCount: 9 },
        { term: 'beta', box: 2, lapses: 1, successCount: 5, failCount: 5 },
        { term: 'gamma', box: 5, lapses: 0, successCount: 9, failCount: 0 },
      ],
    });

    expect(delta.weakTerms[0]!.term).toBe('alpha');
    expect(delta.weakTerms.map((w) => w.term)).not.toContain('gamma');
    expect(delta.masteredTerms).toContain('gamma');
  });

  it('ranks strongest and weakest areas', () => {
    const delta = buildSkillDelta({
      events: [
        { eventType: 'ANSWER', itemId: 'a', isCorrect: true, responseMs: 2000 },
        { eventType: 'ANSWER', itemId: 'a', isCorrect: true, responseMs: 2000 },
        { eventType: 'ANSWER', itemId: 'b', isCorrect: false, responseMs: 2000 },
        { eventType: 'ANSWER', itemId: 'b', isCorrect: false, responseMs: 2000 },
      ],
      lexical: [],
      areaByItemId: { a: 'negotiation', b: 'listening' },
    });

    expect(delta.strongestAreas[0]).toBe('negotiation');
    expect(delta.weakestAreas[0]).toBe('listening');
  });

  it('passes through the hidden assessment score', () => {
    const delta = buildSkillDelta({
      events: [],
      lexical: [],
      hiddenAssessmentScore: 73,
    });
    expect(delta.hiddenAssessmentScore).toBe(73);
  });

  it('defaults hidden assessment score to null', () => {
    const delta = buildSkillDelta({ events: [], lexical: [] });
    expect(delta.hiddenAssessmentScore).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Cycle day unlocking
// ═════════════════════════════════════════════════════════════════════

describe('buildCycleDays', () => {
  const titles = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [i + 1, `Lesson ${i + 1}`])
  );

  it('unlocks only the first incomplete day', () => {
    const days = buildCycleDays({
      cycleStatus: 'ACTIVE',
      completedDays: [1, 2],
      lessonTitles: titles,
    });

    expect(days[0]!.status).toBe('COMPLETED');
    expect(days[1]!.status).toBe('COMPLETED');
    expect(days[2]!.status).toBe('AVAILABLE');
    expect(days[2]!.isActive).toBe(true);
    expect(days[3]!.status).toBe('LOCKED');
  });

  it('locks everything when the cycle is not active', () => {
    const days = buildCycleDays({
      cycleStatus: 'COMPLETED',
      completedDays: [],
      lessonTitles: titles,
    });
    expect(days.every((d) => d.status === 'LOCKED')).toBe(true);
    expect(days.every((d) => !d.isActive)).toBe(true);
  });

  it('returns exactly 7 days', () => {
    const days = buildCycleDays({
      cycleStatus: 'ACTIVE',
      completedDays: [],
      lessonTitles: {},
    });
    expect(days).toHaveLength(7);
  });

  it('assigns the right content kind per day', () => {
    const days = buildCycleDays({
      cycleStatus: 'ACTIVE',
      completedDays: [],
      lessonTitles: titles,
    });
    expect(days[5]!.kind).toBe('HIDDEN_ASSESSMENT');
    expect(days[6]!.kind).toBe('CONSOLIDATION');
    expect(days[0]!.kind).toBe('TEACHING');
  });
});

describe('lessonKindForDay', () => {
  it('maps day 6 to hidden assessment', () => {
    expect(lessonKindForDay(6)).toBe('HIDDEN_ASSESSMENT');
  });
  it('maps day 7 to consolidation', () => {
    expect(lessonKindForDay(7)).toBe('CONSOLIDATION');
  });
  it('maps days 1-5 to teaching', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(lessonKindForDay(d)).toBe('TEACHING');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// Delta patching trigger
// ═════════════════════════════════════════════════════════════════════

describe('shouldGenerateNextCycle', () => {
  const startedTwoDaysAgo = new Date(Date.now() - 2 * 86_400_000);

  it('generates once all 7 days are complete', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'ACTIVE',
      completedDays: [1, 2, 3, 4, 5, 6, 7],
      cycleStartedAt: startedTwoDaysAgo,
    });
    expect(r.shouldGenerate).toBe(true);
    expect(r.reason).toBe('CYCLE_COMPLETE');
  });

  it('does not generate while the cycle is mid-flight', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'ACTIVE',
      completedDays: [1, 2, 3],
      cycleStartedAt: startedTwoDaysAgo,
    });
    expect(r.shouldGenerate).toBe(false);
    expect(r.reason).toBe('CYCLE_IN_PROGRESS');
  });

  it('pauses the calendar after the stall window (token protection)', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'ACTIVE',
      completedDays: [1, 2, 3],
      cycleStartedAt: new Date(Date.now() - 20 * 86_400_000),
      stallDays: 12,
    });
    expect(r.shouldGenerate).toBe(false);
    expect(r.reason).toBe('CALENDAR_PAUSED_STALL');
  });

  it('does not double-generate when one is already running', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'ACTIVE',
      completedDays: [1, 2, 3, 4, 5, 6, 7],
      cycleStartedAt: startedTwoDaysAgo,
      hasGeneratingCycle: true,
    });
    expect(r.shouldGenerate).toBe(false);
    expect(r.reason).toBe('ALREADY_GENERATING');
  });

  it('refuses to generate when the cycle never started', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'GENERATING',
      completedDays: [],
      cycleStartedAt: null,
    });
    expect(r.shouldGenerate).toBe(false);
    expect(r.reason).toBe('CYCLE_NOT_STARTED');
  });

  it('honours a custom stall window', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'ACTIVE',
      completedDays: [1],
      cycleStartedAt: new Date(Date.now() - 5 * 86_400_000),
      stallDays: 3,
    });
    expect(r.reason).toBe('CALENDAR_PAUSED_STALL');
  });

  /**
   * ⚠️ ایمنی: اگر چرخه قبلاً COMPLETED شده ولی همهٔ روزها کامل‌اند،
   * تولید چرخهٔ جدید باید همچنان امکان‌پذیر باشد (مثلاً از طریق کرون
   * یا retry-cycle). این تست رگرسیون برای باگی است که `markCycleCompleted`
   * قبل از `shouldGenerateNextCycle` صدا زده می‌شد و وضعیت COMPLETED
   * باعث می‌شد هیچ‌وقت چرخهٔ جدیدی ساخته نشود.
   */
  it('recovers generation for a COMPLETED cycle with all days done', () => {
    const r = shouldGenerateNextCycle({
      cycleStatus: 'COMPLETED',
      completedDays: [1, 2, 3, 4, 5, 6, 7],
      cycleStartedAt: startedTwoDaysAgo,
    });
    expect(r.shouldGenerate).toBe(true);
    expect(r.reason).toBe('CYCLE_COMPLETE_RECOVERY');
  });
});

// ═════════════════════════════════════════════════════════════════════
// Freemium access
// ═════════════════════════════════════════════════════════════════════

describe('evaluateAccess', () => {
  it('grants access with an active subscription', () => {
    const r = evaluateAccess({
      hasActiveSubscription: true,
      trialStartedAt: new Date(Date.now() - 100 * 86_400_000),
    });
    expect(r.hasAccess).toBe(true);
    expect(r.reason).toBe('SUBSCRIPTION');
  });

  it('grants a fresh trial', () => {
    const r = evaluateAccess({
      hasActiveSubscription: false,
      trialStartedAt: null,
    });
    expect(r.hasAccess).toBe(true);
    expect(r.isTrial).toBe(true);
    expect(r.trialDaysLeft).toBe(7);
  });

  it('keeps access inside the trial window', () => {
    const r = evaluateAccess({
      hasActiveSubscription: false,
      trialStartedAt: new Date(Date.now() - 3 * 86_400_000),
    });
    expect(r.hasAccess).toBe(true);
    expect(r.trialDaysLeft).toBe(4);
  });

  it('blocks access after the trial expires', () => {
    const r = evaluateAccess({
      hasActiveSubscription: false,
      trialStartedAt: new Date(Date.now() - 10 * 86_400_000),
    });
    expect(r.hasAccess).toBe(false);
    expect(r.reason).toBe('TRIAL_EXPIRED');
  });

  it('respects a custom trial length', () => {
    const r = evaluateAccess({
      hasActiveSubscription: false,
      trialStartedAt: new Date(Date.now() - 3 * 86_400_000),
      freeTrialDays: 2,
    });
    expect(r.hasAccess).toBe(false);
  });
});

describe('daysRemaining', () => {
  it('rounds up partial days', () => {
    expect(daysRemaining(new Date(Date.now() + 1.5 * 86_400_000))).toBe(2);
  });
  it('returns 0 for a past date', () => {
    expect(daysRemaining(new Date(Date.now() - 86_400_000))).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Streak
// ═════════════════════════════════════════════════════════════════════

describe('computeStreak', () => {
  it('starts a streak at 1 with no history', () => {
    const r = computeStreak(null, 0);
    expect(r.streak).toBe(1);
    expect(r.isNewDay).toBe(true);
  });

  it('increments for consecutive days', () => {
    const r = computeStreak(new Date(Date.now() - 86_400_000), 5);
    expect(r.streak).toBe(6);
    expect(r.isNewDay).toBe(true);
  });

  it('keeps the streak on the same day', () => {
    const r = computeStreak(new Date(), 5);
    expect(r.streak).toBe(5);
    expect(r.isNewDay).toBe(false);
  });

  it('resets after a gap of two or more days', () => {
    const r = computeStreak(new Date(Date.now() - 3 * 86_400_000), 9);
    expect(r.streak).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Lesson scoring
// ═════════════════════════════════════════════════════════════════════

describe('scoreLesson', () => {
  it('returns zeros with no answers', () => {
    const r = scoreLesson({ answers: [], usedHints: 0 });
    expect(r.score).toBe(0);
    expect(r.isPerfect).toBe(false);
  });

  it('scores a perfect fast run as perfect', () => {
    const r = scoreLesson({
      answers: Array.from({ length: 5 }, () => ({ isCorrect: true, responseMs: 2000 })),
      usedHints: 0,
    });
    expect(r.accuracy).toBe(100);
    expect(r.isPerfect).toBe(true);
  });

  it('penalises hints', () => {
    const base = { answers: Array.from({ length: 5 }, () => ({ isCorrect: true, responseMs: 2000 })) };
    const withHints = scoreLesson({ ...base, usedHints: 3 });
    const withoutHints = scoreLesson({ ...base, usedHints: 0 });
    expect(withHints.score).toBeLessThan(withoutHints.score);
    expect(withHints.isPerfect).toBe(false);
  });

  it('never returns a negative score', () => {
    const r = scoreLesson({
      answers: Array.from({ length: 5 }, () => ({ isCorrect: false, responseMs: 20000 })),
      usedHints: 5,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('caps the hint penalty', () => {
    const answers = Array.from({ length: 5 }, () => ({ isCorrect: true, responseMs: 1000 }));
    const a = scoreLesson({ answers, usedHints: 5 });
    const b = scoreLesson({ answers, usedHints: 50 });
    expect(a.score).toBe(b.score);
  });
});

// ═════════════════════════════════════════════════════════════════════
// مرحلهٔ ۸ — پروفایل آموزشی هر روز (بهینه‌سازی ۱..۷)
// ═════════════════════════════════════════════════════════════════════

describe('dayProfile — arc of the 7-day cycle', () => {
  it('covers every day 1..7', () => {
    for (let d = 1; d <= 7; d++) {
      const p = dayProfile(d);
      expect(p.objective.length).toBeGreaterThan(10);
      expect(p.objectiveFa.length).toBeGreaterThan(5);
      expect(p.items.min).toBeLessThanOrEqual(p.items.max);
      expect(p.part2.min).toBeLessThanOrEqual(p.part2.max);
      expect(p.newItemRatio).toBeGreaterThanOrEqual(0);
      expect(p.newItemRatio).toBeLessThanOrEqual(1);
    }
  });

  it('day 1 is all-new content (first contact)', () => {
    expect(dayProfile(1).newItemRatio).toBe(1);
  });

  it('review share grows toward the end of the cycle', () => {
    const ratios = [1, 2, 3, 4, 5].map((d) => dayProfile(d).newItemRatio);
    expect(ratios[ratios.length - 1]).toBeLessThan(ratios[0]!);
    expect(dayProfile(7).newItemRatio).toBe(0); // تثبیت = فقط مرور
  });

  it('day 5 (fluency) and day 6 (assessment) are mostly review', () => {
    expect(dayProfile(5).newItemRatio).toBeLessThanOrEqual(0.3);
    expect(dayProfile(6).newItemRatio).toBeLessThanOrEqual(0.15);
  });

  it('falls back to day 1 profile for out-of-range numbers', () => {
    expect(dayProfile(99).phase).toBe(dayProfile(1).phase);
    expect(dayProfile(0).phase).toBe(dayProfile(1).phase);
  });

  it('each day has a distinct phase label', () => {
    const phases = new Set([1, 2, 3, 4, 5, 6, 7].map((d) => dayProfile(d).phase));
    expect(phases.size).toBe(7);
  });
});

describe('buildCycleDays — objectives surfaced to the UI', () => {
  const base = {
    cycleStatus: 'ACTIVE' as const,
    completedDays: [] as number[],
  };

  it('falls back to the fixed profile when DB has no objective', () => {
    const days = buildCycleDays({ ...base, lessonTitles: {} });
    expect(days).toHaveLength(7);
    expect(days[2]!.phase).toBe('APPLY');
    expect(days[2]!.objective).toBe(dayProfile(3).objective);
    expect(days[2]!.objectiveFa).toBe(dayProfile(3).objectiveFa);
  });

  it('uses the DB objective when present', () => {
    const days = buildCycleDays({
      ...base,
      lessonTitles: {},
      objectives: { 3: 'Order food at a restaurant' },
    });
    expect(days[2]!.objective).toBe('Order food at a restaurant');
  });

  it('keeps locking rules intact (day n unlocks after n-1)', () => {
    const days = buildCycleDays({ ...base, completedDays: [1], lessonTitles: {} });
    expect(days[0]!.isCompleted).toBe(true);
    expect(days[1]!.isActive).toBe(true);
    expect(days[2]!.isLocked).toBe(true);
  });
});
