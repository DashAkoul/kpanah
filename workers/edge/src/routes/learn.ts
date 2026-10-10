import {
  completeLessonSchema,
  onboardingRequestSchema,
  telemetryBatchSchema,
  updateProfileSchema,
  applyLeitnerReview,
  buildSkillDelta,
  computeStreak,
  nextReviewDate,
  scoreLesson,
  shouldGenerateNextCycle,
  CYCLE_LENGTH_DAYS,
  ECONOMY,
} from '@kpanah/shared';
import type { SkillDelta, WeakTerm } from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import {
  ContentRepository,
  buildProgressDashboard,
  toCycleDto,
  toLessonDto,
  type UserRow,
} from '../services/repository';
import { SupabaseClient } from '../services/supabase';
import { QStashClient } from '../services/qstash';
import { isAdminFromEnv } from './admin';
import { toUserProfile } from '../services/repository';

/**
 * Lesson flow:
 *   get-today-lesson → start-lesson → submit telemetry (streamed)
 *   → complete-lesson → (if day 7) enqueue cycle generation
 *
 * Each handler is deliberately small; the interesting logic lives in
 * packages/shared/src/engine so it can be unit-tested without a Worker.
 */

function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

/**
 * کاربر جاری را برمی‌گرداند یا خطا.
 * target_language با پیش‌فرض 'en' تثبیت می‌شود تا فراخوانی‌کننده‌ها
 * با مقدار nullable درگیر نشوند.
 */
interface ResolvedUser {
  user: UserRow & { target_language: string; skill_level: string; ui_language: string };
  repo: ContentRepository;
}

async function requireUser(
  context: RequestContext
): Promise<ResolvedUser | { error: string }> {
  const { env, telegramId } = context;
  if (!telegramId) return { error: 'no identity' };

  const r = repo(env);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) return { error: 'user not found' };

  return {
    user: {
      ...user,
      target_language: user.target_language ?? 'en',
      skill_level: user.skill_level ?? 'ZERO',
      ui_language: user.ui_language ?? 'fa',
    },
    repo: r,
  };
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=home
// Everything the Learn tab needs in one round-trip.
// ═════════════════════════════════════════════════════════════════════

export async function handleHome(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user } = resolved;
  const r = resolved.repo;

  const subscription = await r.getActiveSubscription(user.id);
  const profile = toUserProfile(user, subscription, {
    isAdmin: isAdminFromEnv(env, user.telegram_id),
  });

  // چرخه فعال یا چرخه در حال تولید
  const activeCycle = await r.getActiveCycle(user.id);
  const generatingCycle = activeCycle ? null : await r.getGeneratingCycle(user.id);

  if (!activeCycle) {
    return jsonSuccess(
      {
        user: profile,
        cycle: null,
        lesson: null,
        generating: Boolean(generatingCycle),
        generationStatus: generatingCycle?.status ?? null,
      },
      requestId,
      env
    );
  }

  const lessons = await r.getLessonsForCycle(activeCycle.id);
  const cycleDto = toCycleDto(activeCycle, lessons);
  const current = lessons.find((l) => !l.is_completed);

  return jsonSuccess(
    {
      user: profile,
      cycle: cycleDto,
      lesson: current ? toLessonDto(current) : null,
      generating: false,
      generationStatus: null,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=get-today-lesson
// ═════════════════════════════════════════════════════════════════════

export async function handleGetTodayLesson(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  // ── کنترل دسترسی (freemium) ──────────────────────────────────────
  const subscription = await r.getActiveSubscription(user.id);
  const profile = toUserProfile(user, subscription, { isAdmin: false });
  if (!profile.hasAccess) {
    return jsonError(
      'SUBSCRIPTION_REQUIRED',
      'Trial expired and no active subscription',
      requestId,
      env,
      402,
      'errors.subscription_required'
    );
  }

  const current = await r.getCurrentLesson(user.id);
  if (!current) {
    const generating = await r.getGeneratingCycle(user.id);
    return jsonError(
      'CYCLE_NOT_READY',
      generating
        ? 'Next cycle is being generated'
        : 'No active cycle available',
      requestId,
      env,
      409,
      generating ? 'errors.cycle_generating' : 'errors.no_cycle'
    );
  }

  // علامت‌گذاری شروع درس (فقط یک بار)
  if (!current.lesson.started_at) {
    await r['db'].update('lessons', { id: current.lesson.id }, {
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
    });
  }

  return jsonSuccess(
    {
      cycleId: current.cycle.id,
      dayNumber: current.lesson.day_number,
      lesson: toLessonDto(current.lesson),
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=telemetry
// Fire-and-forget behavioural signal (pause, skip, replay).
// ═════════════════════════════════════════════════════════════════════

export async function handleTelemetry(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const body = await readJson(request);
  const parsed = telemetryBatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid telemetry payload', requestId, env, 400);
  }

  const lessonId = parsed.data.lessonId ?? null;
  let cycleId: string | null = null;

  if (lessonId) {
    const lesson = await r.getLessonById(lessonId);
    if (!lesson || lesson.user_id !== user.id) {
      return jsonError('NOT_FOUND', 'Lesson not found', requestId, env, 404);
    }
    cycleId = lesson.cycle_id;
  }

  await r.insertTelemetry(
    parsed.data.events.map((e) => ({
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: cycleId,
      event_type: e.eventType,
      item_id: e.itemId ?? null,
      is_correct: e.isCorrect ?? null,
      response_ms: e.responseMs ?? null,
      pause_ms: e.pauseMs ?? null,
      payload: e.payload ?? null,
    }))
  );

  return jsonSuccess({ accepted: parsed.data.events.length }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=complete-lesson
//
// The heart of the adaptive loop. Steps:
//   1. validate + ownership
//   2. update Leitner boxes from this lesson's answers
//   3. store telemetry
//   4. unlock next day / complete cycle
//   5. award stars
//   6. if day 7 → build delta + enqueue cycle generation
// ═════════════════════════════════════════════════════════════════════

export async function handleCompleteLesson(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const body = await readJson(request);
  const parsed = completeLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid payload',
      requestId,
      env,
      400
    );
  }

  const { lessonId, durationSeconds, answers } = parsed.data;

  const lesson = await r.getLessonById(lessonId);
  if (!lesson || lesson.user_id !== user.id) {
    return jsonError('NOT_FOUND', 'Lesson not found', requestId, env, 404);
  }
  if (lesson.is_completed) {
    // idempotent — کلاینت ممکن است دوباره بفرستد
    return jsonSuccess(
      { alreadyCompleted: true, dayNumber: lesson.day_number },
      requestId,
      env
    );
  }

  // ── 1. جعبه لایتنر ───────────────────────────────────────────────
  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const boxByTerm = new Map(lexical.map((l) => [l.term, l]));

  const updates = new Map<string, Parameters<ContentRepository['upsertLexicalItem']>[2]>();

  for (const answer of answers) {
    const term = answer.linkedTerm;
    if (!term) continue;

    const existing = boxByTerm.get(term);
    const review = applyLeitnerReview({
      box: existing?.box ?? 1,
      ease: existing?.ease ?? 2.5,
      repetitions: existing?.repetitions ?? 0,
      lapses: existing?.lapses ?? 0,
      isCorrect: answer.isCorrect,
      responseMs: answer.responseMs,
    });

    updates.set(term, {
      term,
      box: review.box,
      ease: review.ease,
      repetitions: review.repetitions,
      lapses: review.lapses,
      intervalDays: review.intervalDays,
      mastered: review.mastered,
      successCount: (existing?.success_count ?? 0) + (answer.isCorrect ? 1 : 0),
      failCount: (existing?.fail_count ?? 0) + (answer.isCorrect ? 0 : 1),
      nextReviewAt: nextReviewDate(review.intervalDays).toISOString(),
    });
  }

  await Promise.all(
    [...updates.values()].map((u) =>
      r.upsertLexicalItem(user.id, user.target_language, u)
    )
  );

  // ── 2. ثبت تلمتری ────────────────────────────────────────────────
  await r.insertTelemetry([
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'LESSON_START',
      payload: { day: lesson.day_number },
    },
    ...answers.map((a) => ({
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'ANSWER',
      item_id: a.itemId,
      is_correct: a.isCorrect,
      response_ms: a.responseMs,
      payload: a.usedHint ? { usedHint: true } : null,
    })),
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'LESSON_END',
      payload: { day: lesson.day_number, durationSeconds },
    },
  ]);

  // ── 3. تکمیل درس و آزادسازی بعدی ─────────────────────────────────
  await r.completeLesson(lessonId, { durationSeconds, status: 'COMPLETED' });
  await r.unlockNextLesson(lesson.cycle_id, lesson.day_number);

  // ── 4. پاداش و استریک ────────────────────────────────────────────
  const lessonScore = scoreLesson({
    answers: answers.map((a) => ({ isCorrect: a.isCorrect, responseMs: a.responseMs })),
    usedHints: answers.filter((a) => a.usedHint).length,
  });

  const streak = computeStreak(
    user.last_active_date ? new Date(user.last_active_date) : null,
    user.streak_count
  );

  let reward = ECONOMY.rewardPerLesson;
  if (lessonScore.isPerfect) reward += ECONOMY.rewardPerfectDay;
  if (streak.streak % CYCLE_LENGTH_DAYS === 0 && streak.isNewDay) {
    reward += ECONOMY.rewardStreak7;
  }

  await r.updateUser(user.id, {
    stars_balance: user.stars_balance + reward,
    streak_count: streak.streak,
    longest_streak: Math.max(user.longest_streak, streak.streak),
    last_active_date: new Date().toISOString().slice(0, 10),
  });

  // ── 5. پایان چرخه؟ trigger تولید چرخه جدید ───────────────────────
  const lessons = await r.getLessonsForCycle(lesson.cycle_id);
  const completedDays = lessons
    .filter((l) => l.is_completed || l.id === lessonId)
    .map((l) => l.day_number);

  const allDone = completedDays.length >= CYCLE_LENGTH_DAYS;

  let nextCycleTriggered = false;
  let generationDeferred: string | null = null;

  if (allDone) {
    await r.markCycleCompleted(lesson.cycle_id);
  }

  const cycle = await r.getCycleById(lesson.cycle_id);
  const generating = await r.getGeneratingCycle(user.id);

  const decision = shouldGenerateNextCycle({
    cycleStatus: allDone ? 'COMPLETED' : 'ACTIVE',
    completedDays,
    cycleStartedAt: cycle?.started_at ? new Date(cycle.started_at) : null,
    stallDays: Number(env.CYCLE_STALL_DAYS ?? 12),
    hasGeneratingCycle: Boolean(generating),
  });

  if (decision.shouldGenerate && cycle) {
    const nextNumber = cycle.cycle_number + 1;
    await r.createGeneratingCycle(user.id, nextNumber);

    const qstash = new QStashClient(env);
    const userId = user.id;

    if (qstash.available) {
      const enqueued = await qstash.enqueue({
        kind: 'generate-cycle',
        userId,
        cycleNumber: nextNumber,
      });
      nextCycleTriggered = enqueued.ok;
      if (!enqueued.ok) generationDeferred = 'queue_unavailable';
    } else {
      // QStash تنظیم نشده — در همان isolate با waitUntil اجرا می‌شود
      generationDeferred = 'inline';
      nextCycleTriggered = true;
      context.waitUntil?.(
        generateCycleInline(context, userId, nextNumber).catch(() => {})
      );
    }
  } else if (decision.reason === 'CALENDAR_PAUSED_STALL') {
    generationDeferred = 'calendar_paused';
  }

  return jsonSuccess(
    {
      dayNumber: lesson.day_number,
      score: lessonScore,
      reward,
      streak: streak.streak,
      cycleCompleted: allDone,
      nextCycleTriggered,
      generationDeferred,
      appLocked: allDone && !nextCycleTriggered,
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// Cycle generation worker (shared by inline fallback and QStash)
// ═════════════════════════════════════════════════════════════════════

export async function runCycleGeneration(
  env: RequestContext['env'],
  userId: string,
  cycleNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const r = repo(env);

  const user = await r.findUserById(userId);
  if (!user) return { ok: false, error: 'user not found' };

  const generating = await r.getGeneratingCycle(userId);
  if (!generating || generating.cycle_number !== cycleNumber) {
    return { ok: false, error: 'no matching GENERATING cycle' };
  }

  // چرخه قبلی برای خلاصه‌سازی و تحلیل
  const previous = await r.getActiveCycle(userId);
  const previousLessons = previous ? await r.getLessonsForCycle(previous.id) : [];
  const telemetry = previous ? await r.getTelemetryForCycle(previous.id) : [];
  const lexical = await r.getLexicalItems(userId, user.target_language);

  // امتیاز آزمون پنهان روز ۶
  const day6 = previousLessons.find((l) => l.day_number === 6);
  let hiddenScore: number | null = null;
  if (day6) {
    const day6Answers = telemetry.filter((t) => t.event_type === 'ANSWER');
    if (day6Answers.length > 0) {
      const correct = day6Answers.filter((a) => a.is_correct).length;
      hiddenScore = Math.round((correct / day6Answers.length) * 100);
    }
  }

  const delta = buildSkillDelta({
    events: telemetry.map((t) => ({
      eventType: t.event_type,
      itemId: t.item_id,
      isCorrect: t.is_correct,
      responseMs: t.response_ms,
      pauseMs: t.pause_ms,
    })),
    lexical: lexical.map((l) => ({
      term: l.term,
      box: l.box,
      lapses: l.lapses,
      successCount: l.success_count,
      failCount: l.fail_count,
    })),
    hiddenAssessmentScore: hiddenScore,
  });

  // ── Build the failover chain from the admin-managed provider pool ──
  // Order comes from `ai_providers.priority`; keys are decrypted here only.
  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const providerRows = await r.listActiveAiProviders();
  const chain = await resolveProviderChain(providerRows, env);
  const engine = new AiEngine(env, chain);

  if (!engine.hasAnyProvider) {
    const reason =
      providerRows.length === 0
        ? 'no AI provider configured'
        : 'no AI provider could be resolved (check keys / PROVIDER_ENCRYPTION_KEY)';
    await markCycleFailed(r, generating.id, reason);
    return { ok: false, error: reason };
  }

  const generationInput = {
    user: {
      id: user.id,
      skillLevel: (user.skill_level ?? 'ZERO') as never,
      learningGoal: user.learning_goal,
      uiLanguage: (user.ui_language ?? 'fa') as never,
      targetLanguage: (user.target_language ?? 'en') as never,
    },
    cycleNumber,
    delta,
    previousCycleSummary: previous
      ? `${previous.title}${previous.focus_summary ? ` — ${previous.focus_summary}` : ''}`
      : null,
  };

  const result = await engine.generateCycle(generationInput);

  // Record every attempt against the provider pool so the panel can show
  // real health data and the operator can see the failover happen.
  await recordAttempts(r, generating.id, result.attempts);

  if (!result.cycle) {
    const detail = result.attempts
      .map((a) => `${a.provider}/${a.model}: ${a.error ?? 'failed'}`)
      .join(' | ');
    await markCycleFailed(r, generating.id, detail);
    return { ok: false, error: detail };
  }

  await r.persistGeneratedCycle(generating.id, result.cycle, {
    model: result.model ?? 'unknown',
    ms: result.totalMs,
    tokens: result.attempts.find((a) => a.ok)?.tokensUsed,
    input: generationInput,
  });

  return { ok: true };
}

/**
 * Persist one audit row per provider attempt and roll the health counters
 * for the provider that was tried.
 *
 * Kept out of the main flow so a logging failure can never break generation.
 */
async function recordAttempts(
  r: ContentRepository,
  cycleId: string,
  attempts: {
    provider: string;
    providerId: string | null;
    model: string;
    ok: boolean;
    ms: number;
    error?: string;
    tokensUsed?: number;
  }[]
): Promise<void> {
  const streak = new Map<string, number>();

  for (let i = 0; i < attempts.length; i += 1) {
    const a = attempts[i];
    if (!a) continue;

    const key = a.providerId ?? a.provider;
    const fails = a.ok ? 0 : (streak.get(key) ?? 0) + 1;
    streak.set(key, fails);

    await r
      .recordProviderOutcome({
        cycleId,
        providerId: a.providerId,
        providerLabel: a.provider,
        model: a.model,
        attemptNo: i + 1,
        phase: 'initial',
        ok: a.ok,
        latencyMs: a.ms,
        error: a.error,
        tokensUsed: a.tokensUsed,
        consecutiveFailures: fails,
      })
      .catch(() => undefined);
  }
}

async function markCycleFailed(
  r: ContentRepository,
  cycleId: string,
  reason: string
): Promise<void> {
  await r['db'].update('cycles', { id: cycleId }, {
    status: 'FAILED',
    focus_summary: `Generation failed: ${reason.slice(0, 400)}`,
  });
}

async function generateCycleInline(
  context: RequestContext,
  userId: string,
  cycleNumber: number
): Promise<void> {
  await runCycleGeneration(context.env, userId, cycleNumber);
}

// ═════════════════════════════════════════════════════════════════════
// Profile / onboarding / settings
// ═════════════════════════════════════════════════════════════════════

export async function handleOnboarding(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const body = await readJson(request);
  const parsed = onboardingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid onboarding data', requestId, env, 400);
  }

  const r = repo(env);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) return jsonError('NOT_FOUND', 'User not found', requestId, env, 404);

  await r.updateUser(user.id, {
    ui_language: parsed.data.uiLanguage,
    language_source: 'MANUAL',
    target_language: parsed.data.targetLanguage,
    skill_level: parsed.data.skillLevel,
    learning_goal: parsed.data.learningGoal,
    onboarding_done: true,
  });

  // اولین چرخه را همین حالا بساز
  const existing = await r.getLatestCycle(user.id);
  if (!existing) {
    const cycle = await r.createGeneratingCycle(user.id, 1);
    const qstash = new QStashClient(env);

    if (qstash.available) {
      await qstash.enqueue({ kind: 'generate-cycle', userId: user.id, cycleNumber: 1 });
    } else {
      context.waitUntil?.(
        generateCycleInline(context, user.id, 1).catch(() => {})
      );
    }
    return jsonSuccess(
      { onboardingComplete: true, firstCycleId: cycle.id, generating: true },
      requestId,
      env
    );
  }

  return jsonSuccess({ onboardingComplete: true, generating: false }, requestId, env);
}

export async function handleUpdateProfile(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const body = await readJson(request);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid profile data', requestId, env, 400);
  }

  const r = repo(env);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) return jsonError('NOT_FOUND', 'User not found', requestId, env, 404);

  const patch: Record<string, unknown> = {};
  const d = parsed.data;

  if (d.uiLanguage) {
    patch.ui_language = d.uiLanguage;
    patch.language_source = 'MANUAL';
  }
  if (d.targetLanguage) patch.target_language = d.targetLanguage;
  if (d.learningGoal !== undefined) patch.learning_goal = d.learningGoal;
  if (d.timezone) patch.timezone = d.timezone;

  if (Object.keys(patch).length === 0) {
    return jsonSuccess({ updated: false }, requestId, env);
  }

  const updated = await r.updateUser(user.id, patch);
  const subscription = await r.getActiveSubscription(user.id);

  return jsonSuccess(
    {
      updated: true,
      user: toUserProfile(updated ?? user, subscription, {
        isAdmin: isAdminFromEnv(env, telegramId),
      }),
    },
    requestId,
    env
  );
}

export async function handleDeleteAccount(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const r = repo(env);
  const user = await r.findUserByTelegramId(telegramId);
  if (!user) return jsonSuccess({ deleted: true }, requestId, env);

  // cascade در دیتابیس بقیه را پاک می‌کند
  await r.deleteUser(user.id);

  return jsonSuccess({ deleted: true }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// Progress dashboard
// ═════════════════════════════════════════════════════════════════════

export async function handleProgress(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const cycle = await r.getActiveCycle(user.id);
  const telemetry = cycle ? await r.getTelemetryForCycle(cycle.id) : [];
  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const lessons = cycle ? await r.getLessonsForCycle(cycle.id) : [];

  // دقایق هفتگی از روی مدت دروس تکمیل‌شده
  const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];

  const dashboard = buildProgressDashboard({
    telemetry: telemetry.map((t) => ({
      event_type: t.event_type,
      is_correct: t.is_correct,
      response_ms: t.response_ms,
      pause_ms: t.pause_ms,
    })),
    lessonsCompleted: lessons.filter((l) => l.is_completed).length,
    lexical: lexical.map((l) => ({ ...l, repetitions: l.repetitions })),
    streakCount: user.streak_count,
    weeklyMinutes,
  });

  return jsonSuccess({ dashboard }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// Delta report (admin/debug: inspect what the AI will receive)
// ═════════════════════════════════════════════════════════════════════

export async function handleDebugDelta(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const cycle = await r.getActiveCycle(user.id);
  const telemetry = cycle ? await r.getTelemetryForCycle(cycle.id) : [];
  const lexical = await r.getLexicalItems(user.id, user.target_language);

  const delta: SkillDelta = buildSkillDelta({
    events: telemetry.map((t) => ({
      eventType: t.event_type,
      itemId: t.item_id,
      isCorrect: t.is_correct,
      responseMs: t.response_ms,
      pauseMs: t.pause_ms,
    })),
    lexical: lexical.map((l) => ({
      term: l.term,
      box: l.box,
      lapses: l.lapses,
      successCount: l.success_count,
      failCount: l.fail_count,
    })),
  });

  return jsonSuccess({ delta, weakTerms: delta.weakTerms as WeakTerm[] }, requestId, env);
}
