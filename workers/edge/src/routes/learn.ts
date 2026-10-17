import {
  completeLessonSchema,
  onboardingRequestSchema,
  telemetryBatchSchema,
  updateProfileSchema,
  reviewSubmitSchema,
  applyLeitnerReview,
  buildSkillDelta,
  computeStreak,
  nextReviewDate,
  scoreLesson,
  shouldGenerateNextCycle,
  CYCLE_LENGTH_DAYS,
  ECONOMY,
  dayProfile,
} from '@kpanah/shared';
import type {
  SkillDelta,
  WeakTerm,
  TermCard,
  PatternDrillItem,
  LessonSkeleton,
  CycleGenerationInput,
  CycleOutline,
  OutlineDay,
  GeneratedLesson,
} from '@kpanah/shared';
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
import type { AiEngine } from '../services/ai-engine';
import { hasMediaStorage } from '../services/media';
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
  let activeCycle = await r.getActiveCycle(user.id);
  let generatingCycle = activeCycle ? null : await r.getGeneratingCycle(user.id);

  // ── خودترمیمی چرخهٔ گیرکرده ────────────────────────────────────────
  //
  // ⚠️ باگ رفع‌شده: اگر تولید روز ۱ یک‌بار شکست بخورد و بعد کرون/صف روزها
  // را پر کند، چرخه در وضعیت GENERATING می‌ماند ولی محتوای روز ۱ موجود است.
  // در این حالت `generating` تا ابد true بود و کاربر فقط اسپینر می‌دید.
  // حالا اگر روز ۱ محتوا دارد، همین‌جا چرخه را ACTIVE می‌کنیم.
  if (!activeCycle && generatingCycle && generatingCycle.status === 'GENERATING') {
    try {
      const genLessons = await r.getLessonsForCycle(generatingCycle.id);
      const day1 = genLessons.find((l) => l.day_number === 1);
      const day1Ready =
        day1?.part_1_data && Object.keys(day1.part_1_data as object).length > 0;
      if (day1Ready) {
        await r.activateCycleWithFirstLesson(generatingCycle.id);
        activeCycle = { ...generatingCycle, status: 'ACTIVE' };
        generatingCycle = null;
        console.log(`[home] activated stuck cycle ${activeCycle.id}`);
      }
    } catch (err) {
      console.warn(
        `[home] self-heal failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (!activeCycle) {
    // ⚠️ چرا `generating` فقط برای GENERATING است: قبلاً هر چرخهٔ
    // GENERATING/FAILED باعث `generating: true` می‌شد و کاربر برای چرخهٔ
    //_FAILED_ تا ابد اسپینر می‌دید. حالا FAILED هم چرخه را با دلیل خطا
    // برمی‌گرداند تا UI پیام روشن بدهد.
    const isGenerating = generatingCycle?.status === 'GENERATING';
    const genLessons = generatingCycle
      ? await r.getLessonsForCycle(generatingCycle.id)
      : [];

    // ⚠️ باگ رفع‌شده: اگر چرخه‌ای COMPLETED شده و هنوز چرخهٔ جدیدی
    // GENERATING نشده، `cycle: null` برمی‌گشت و UI به‌جای صفحهٔ «قفل»،
    // خطای شبکه نشان می‌داد. حالا آخرین چرخه (حتی COMPLETED) را
    // برمی‌گردانیم تا `CycleCompleteState` رندر شود.
    if (!generatingCycle) {
      const latest = await r.getLatestCycle(user.id);
      if (latest) {
        const latestLessons = await r.getLessonsForCycle(latest.id);
        return jsonSuccess(
          {
            user: profile,
            cycle: toCycleDto(latest, latestLessons),
            lesson: null,
            generating: false,
            generationStatus: null,
            generationError: null,
          },
          requestId,
          env
        );
      }
    }

    return jsonSuccess(
      {
        user: profile,
        cycle: generatingCycle
          ? toCycleDto(generatingCycle, genLessons)
          : null,
        lesson: null,
        generating: isGenerating,
        generationStatus: generatingCycle?.status ?? null,
        generationError:
          generatingCycle?.status === 'FAILED'
            ? generatingCycle.focus_summary ?? 'generation failed'
            : null,
      },
      requestId,
      env
    );
  }

  const lessons = await r.getLessonsForCycle(activeCycle.id);
  const cycleDto = toCycleDto(activeCycle, lessons);

  // در تولید ماژولار، ردیف درس ممکن است ساخته شده باشد ولی محتوایش هنوز
  // نرسیده باشد (`{}`). در آن حالت درس آماده نیست → وضعیت «در حال تولید»
  // نشان داده می‌شود تا UI درس خالی/خراب رندر نکند.
  let current = lessons.find((l) => !l.is_completed);
  let currentReady = current && lessonContentReady(current.part_1_data);

  // اگر محتوای روز جاری هنوز ساخته نشده (تولید ماژولار)، همین حالا و در همین
  // درخواست بسازش. این «تولید تنبل» تضمین می‌کند کاربر هیچ‌وقت درس خالی نبیند
  // و به waitUntil (که Cloudflare لغو می‌کند) وابسته نباشیم.
  //
  // ⚠️ وقتی Queue فعال است، روزهای ۲..۷ را consumer می‌سازد. اگر اینجا هم
  // بسازیم، دو فراخوانی AI موازی (و اتلاف سهمیه) داریم. پس inline فقط برای
  // روز ۱ (که هرگز به صف نمی‌رود) یا وقتی صف تنظیم نشده اجرا می‌شود.
  const useQueue = Boolean(env.GENERATION_QUEUE);
  const inlineAllowed = !useQueue || current?.day_number === 1;
  if (current && !currentReady && inlineAllowed) {
    const gen = await runLessonGeneration(
      env,
      user.id,
      activeCycle.id,
      activeCycle.cycle_number,
      current.day_number
    );
    if (gen.ok) {
      const refreshed = await r.getLessonsForCycle(activeCycle.id);
      const fresh = refreshed.find((l) => l.id === current!.id);
      if (fresh) {
        current = fresh;
        currentReady = lessonContentReady(fresh.part_1_data);
      }
    }
  }

  return jsonSuccess(
    {
      user: profile,
      cycle: cycleDto,
      lesson: currentReady ? toLessonDto(current!) : null,
      generating: Boolean(current) && !currentReady,
      generationStatus: Boolean(current) && !currentReady ? 'GENERATING' : null,
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
    // idempotent — کلاینت ممکن است دوباره بفرستد.
    // ⚠️ شکل پاسخ باید کامل باشد وگرنه صفحهٔ نتیجه با فیلدهای خالی می‌شکند
    // (قبلاً فقط alreadyCompleted/dayNumber برمی‌گشت).
    return jsonSuccess(
      {
        alreadyCompleted: true,
        dayNumber: lesson.day_number,
        score: { score: 0, accuracy: 0, speedBonus: 0, isPerfect: false },
        reward: 0,
        streak: user.streak_count,
        cycleCompleted: false,
        nextCycleTriggered: false,
        appLocked: false,
      },
      requestId,
      env
    );
  }

  // ── 1. جعبه لایتنر ───────────────────────────────────────────────
  //
  // ⚠️ هر یک از این مراحل **best-effort** است: ثبت آمار یا به‌روزرسانی
  // لایتنر نباید هرگز جلوی «تکمیل درس» را بگیرد. قبلاً هر خطای دیتابیس در
  // این بخش، کل درخواست را ۵۰۰ می‌کرد و کاربر فقط می‌دید دکمهٔ «انجام شد»
  // هیچ کاری نمی‌کند (در DB هم صفر telemetry ثبت شده بود).
  let lexical: Awaited<ReturnType<ContentRepository['getLexicalItems']>> = [];
  try {
    lexical = await r.getLexicalItems(user.id, user.target_language);
  } catch (err) {
    console.warn(`[complete] lexical read failed: ${err instanceof Error ? err.message : String(err)}`);
  }
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
      r.upsertLexicalItem(user.id, user.target_language, u).catch((err) => {
        console.warn(
          `[complete] leitner upsert failed for "${u.term}": ${err instanceof Error ? err.message : String(err)}`
        );
      })
    )
  );

  // ── 2. ثبت تلمتری ────────────────────────────────────────────────
  const telemetryRows = [
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
  ];

  try {
    await r.insertTelemetry(telemetryRows);
  } catch (err) {
    console.warn(`[complete] telemetry insert failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. تکمیل درس و آزادسازی بعدی ─────────────────────────────────
  await r.completeLesson(lessonId, { durationSeconds, status: 'COMPLETED' });
  await r.unlockNextLesson(lesson.cycle_id, lesson.day_number);

  // ── 3.5 پیش‌بارگذاری روز بعد (کاربر هرگز منتظر تولید نماند) ───────
  await prefetchNextLesson(context, user.id, lesson.cycle_id, lesson.day_number);

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

  const cycle = await r.getCycleById(lesson.cycle_id);
  const generating = await r.getGeneratingCycle(user.id);

  /**
   * ⚠️ باگ رفع‌شده: `shouldGenerateNextCycle` را **قبل** از
   * `markCycleCompleted` صدا می‌زنیم. قبلاً اول وضعیت را `COMPLETED`
   * می‌کردیم و بعد `shouldGenerateNextCycle` را با `cycleStatus: 'COMPLETED'`
   * صدا می‌زدیم — اما آن تابع فقط وقتی `true` برمی‌گرداند که
   * `cycleStatus === 'ACTIVE'` باشد (شرط `allComplete` فقط در شاخهٔ ACTIVE
   * چک می‌شود). نتیجه: هیچ‌وقت چرخهٔ جدیدی ساخته نمی‌شد و کاربر برای
   * همیشه در حالت «قفل» می‌ماند.
   */
  const decision = shouldGenerateNextCycle({
    cycleStatus: 'ACTIVE',
    completedDays,
    cycleStartedAt: cycle?.started_at ? new Date(cycle.started_at) : null,
    stallDays: Number(env.CYCLE_STALL_DAYS ?? 12),
    hasGeneratingCycle: Boolean(generating),
  });

  if (allDone && decision.shouldGenerate && cycle) {
    const nextNumber = cycle.cycle_number + 1;
    await r.createGeneratingCycle(user.id, nextNumber);

    // اولویت: Queue/Workflow (مسدودکننده نیست) → fallback inline
    const via = await scheduleCycleGeneration(context, user.id, nextNumber);
    nextCycleTriggered = true;
    generationDeferred = via.via;
  } else if (allDone && decision.reason === 'CALENDAR_PAUSED_STALL') {
    generationDeferred = 'calendar_paused';
  }

  if (allDone) {
    await r.markCycleCompleted(lesson.cycle_id);
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
// POST /gate?action=retry-cycle
// ═════════════════════════════════════════════════════════════════════

/**
 * تلاش مجدد برای چرخه‌ای که تولیدش شکست خورده.
 *
 * ⚠️ باگ رفع‌شده: دکمهٔ «تلاش مجدد» در UI فقط `refetch` می‌زد — یعنی
 * همان وضعیت FAILED را دوباره می‌خواند و **هیچ اتفاقی نمی‌افتاد**، بدون
 * هیچ فیدبکی. کاربر فکر می‌کرد دکمه خراب است.
 *
 * حالا واقعاً: وضعیت را به GENERATING برمی‌گرداند و تولید را زمان‌بندی
 * می‌کند (همان مسیر Workflow → Queue → inline).
 */
export async function handleRetryCycle(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const cycle = await r.getLatestCycle(user.id);
  if (!cycle) {
    return jsonError('NOT_FOUND', 'no cycle to retry', requestId, env, 404);
  }

  // اگر چرخه سالم است، دوباره تولید نکن (idempotent + محافظ هزینهٔ AI)
  if (cycle.status === 'GENERATING') {
    // ⚠️ باگ رفع‌شده: قبلاً هر چرخهٔ GENERATING «در جریان» تلقی می‌شد و
    // دکمهٔ تلاش مجدد فقط toast «همین حالا در جریان است» می‌داد — حتی وقتی
    // تولید ساعاتی پیش مرده بود و هیچ‌وقت تمام نمی‌شد. حالا دو حالت:
    //   ۱. روز ۱ محتوا دارد → چرخه فقط فعال نشده؛ فعالش کن (بدون AI)
    //   ۲. خیلی وقت است GENERATING مانده → از نو تولید کن
    const lessons = await r.getLessonsForCycle(cycle.id);
    const day1 = lessons.find((l) => l.day_number === 1);
    const day1Ready =
      day1?.part_1_data && Object.keys(day1.part_1_data as object).length > 0;

    if (day1Ready) {
      await r.activateCycleWithFirstLesson(cycle.id);
      return jsonSuccess({ ok: true, via: 'none', recovered: 'activated' }, requestId, env);
    }

    const startedAt = cycle.started_at ?? cycle.created_at;
    const ageMs = startedAt ? Date.now() - new Date(startedAt).getTime() : Infinity;
    // آستانه: ۳ دقیقه. تولید عادی روز ۱ معمولاً زیر ۱ دقیقه است.
    if (ageMs > 3 * 60_000) {
      await r.resetCycleForRetry(cycle.id);
      const via = await scheduleCycleGeneration(context, user.id, cycle.cycle_number);
      return jsonSuccess({ ok: true, via: via.via, recovered: 'regenerated' }, requestId, env);
    }

    return jsonSuccess(
      { ok: true, via: 'none', alreadyGenerating: true },
      requestId,
      env
    );
  }
  if (cycle.status === 'ACTIVE') {
    return jsonSuccess({ ok: true, via: 'none', alreadyActive: true }, requestId, env);
  }

  await r.resetCycleForRetry(cycle.id);
  const via = await scheduleCycleGeneration(context, user.id, cycle.cycle_number);

  return jsonSuccess({ ok: true, via: via.via }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// GET  /gate?action=due-reviews   → واژه‌های سررسیده برای مرور آزاد
// POST /gate?action=review-submit → ثبت نتیجهٔ مرور (لایتنر + تلمتری)
// ═════════════════════════════════════════════════════════════════════

/** حداکثر تعداد واژه در یک جلسهٔ مرور (بیشتر = خستگی) */
const REVIEW_SESSION_MAX = 12;

/**
 * «مرور آزاد» — حلقه‌ای که قبلاً بسته نبود.
 *
 * واژه‌هایی که `next_review_at` آن‌ها گذشته ولی درس امروز به آن‌ها
 * نمی‌پردازد، اینجا مستقل مرور می‌شوند. بدون این، فاصلهٔ لایتنر فقط
 * به شانسِ ظاهر شدن واژه در درس بعدی وابسته بود.
 */
export async function handleDueReviews(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const due = await r.listDueLexicalItems(user.id, user.target_language, 60);
  if (due.length === 0) {
    return jsonSuccess({ items: [], count: 0, totalDue: 0 }, requestId, env);
  }

  const slice = due.slice(0, REVIEW_SESSION_MAX);
  const cards = await r
    .findTermCards(
      user.target_language,
      user.ui_language,
      slice.map((d) => d.term)
    )
    .catch(() => ({}) as Record<string, TermCard>);

  const items = slice
    .map((d) => {
      const card = cards[d.term.trim().toLowerCase()];
      return {
        term: d.term,
        meaning: card?.meaning ?? '',
        example: card?.example ?? '',
        exampleTranslation: card?.exampleTranslation,
        pronunciation: card?.pronunciation,
        box: d.box,
      };
    })
    // بدون معنی، سؤال «معنی کدام است؟» قابل ساخت نیست
    .filter((i) => i.meaning.length > 0);

  return jsonSuccess(
    { items, count: items.length, totalDue: due.length },
    requestId,
    env
  );
}

/**
 * ثبت نتیجهٔ مرور آزاد.
 *
 * ⚠️ مثل `complete-lesson`، همهٔ عوارض جانبی best-effort هستند: خطای
 * تلمتری نباید مرور را از کار بیندازد.
 */
export async function handleReviewSubmit(
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
  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid review payload',
      requestId,
      env,
      400
    );
  }

  let lexical: Awaited<ReturnType<ContentRepository['getLexicalItems']>> = [];
  try {
    lexical = await r.getLexicalItems(user.id, user.target_language);
  } catch (err) {
    console.warn(`[review] lexical read failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const byTerm = new Map(lexical.map((l) => [l.term, l]));

  const updates = new Map<string, Parameters<ContentRepository['upsertLexicalItem']>[2]>();
  for (const answer of parsed.data.answers) {
    const existing = byTerm.get(answer.term);
    const review = applyLeitnerReview({
      box: existing?.box ?? 1,
      ease: existing?.ease ?? 2.5,
      repetitions: existing?.repetitions ?? 0,
      lapses: existing?.lapses ?? 0,
      isCorrect: answer.isCorrect,
      responseMs: answer.responseMs,
    });

    updates.set(answer.term, {
      term: answer.term,
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
      r.upsertLexicalItem(user.id, user.target_language, u).catch((err) => {
        console.warn(
          `[review] upsert failed for "${u.term}": ${err instanceof Error ? err.message : String(err)}`
        );
      })
    )
  );

  try {
    await r.insertTelemetry([
      ...parsed.data.answers.map((a) => ({
        user_id: user.id,
        lesson_id: null,
        cycle_id: null,
        event_type: 'ANSWER',
        item_id: `review:${a.term}`.slice(0, 60),
        is_correct: a.isCorrect,
        response_ms: a.responseMs,
        payload: { source: 'free-review' },
      })),
      {
        user_id: user.id,
        lesson_id: null,
        cycle_id: null,
        event_type: 'SESSION_END',
        payload: { source: 'free-review', answered: parsed.data.answers.length },
      },
    ]);
  } catch (err) {
    console.warn(`[review] telemetry failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return jsonSuccess(
    { ok: true, updated: updates.size },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// Cycle generation worker (shared by inline fallback and QStash)
// ═════════════════════════════════════════════════════════════════════

/**
 * پیش‌بارگذاری روز بعد پس از تکمیل یک روز.
 *
 * ⚠️ چرا: پیش از این تولید روز بعد فقط **تنبل** و لحظهٔ باز کردن آن روز
 * انجام می‌شد → کاربر واقعاً منتظر می‌ماند. با پیش‌بارگذاری، تا وقتی
 * کاربر روز بعد را باز کند، محتوا آماده است.
 *
 * ترتیب اولویت:
 *  ۱. صف بومی (`GENERATION_QUEUE`) — زمان مستقل، مطمئن‌ترین.
 *  ۲. `waitUntil` — بهترین تلاش. Cloudflare کارهای طولانی را لغو می‌کند
 *     ولی این فقط **یک** درس است (~۱۰-۲۰s) و اگر لغو شود، مسیر تنبل و
 *     کرون جبران می‌کنند.
 */
async function prefetchNextLesson(
  context: RequestContext,
  userId: string,
  cycleId: string,
  completedDay: number
): Promise<void> {
  if (completedDay >= CYCLE_LENGTH_DAYS) return; // روز ۷ = پایان چرخه

  const nextDay = completedDay + 1;
  const r = repo(context.env);
  const cycle = await r.getCycleById(cycleId);
  if (!cycle) return;

  const queue = context.env.GENERATION_QUEUE;
  if (queue) {
    await queue
      .send({
        kind: 'generate-lesson',
        userId,
        cycleId,
        cycleNumber: cycle.cycle_number,
        dayNumber: nextDay,
      })
      .catch(() => undefined);
    return;
  }

  if (!context.waitUntil) return;
  context.waitUntil(
    runLessonGeneration(context.env, userId, cycleId, cycle.cycle_number, nextDay).catch(
      () => undefined
    )
  );
}

/**
 * قفل کوتاه‌مدت تولید برای یک روز مشخص (کلید: `<cycleId>:<day>`).
 *
 * ⚠️ چرا لازم است: کرونِ هر ۵ دقیقه، consumer صف، و تولید تنبل در `home`
 * می‌توانند همزمان همان روز را بسازند. `ensureLessonContent` کش را چک
 * می‌کند ولی پنجرهٔ همزمانی (دو فراخوانی AI موازی پیش از نوشتن کش)
 * باقی می‌ماند → توکن دوباره خرج می‌شود.
 *
 * ⚠️ KV برای این کار «کافی» است نه «کامل»: KV در نهایت سازگار است، پس
 * ممکن است دو isolate همزمان قفل بگیرند. هدف **کاهش** تولید تکراری است،
 * نه انحصار مطلق — به همین دلیل روی خطا اجازه می‌دهد (`true`).
 */
async function acquireGenerationLock(
  env: RequestContext['env'],
  key: string,
  ttlSeconds = 180
): Promise<boolean> {
  const kv = env.CACHE_KV;
  if (!kv) return true; // بدون KV، رفتار قبلی حفظ می‌شود
  const full = `genlock:${key}`;
  try {
    if (await kv.get(full)) return false;
    await kv.put(full, String(Date.now()), { expirationTtl: ttlSeconds });
    return true;
  } catch {
    return true;
  }
}

/**
 * سقف مصرف توکن AI هر کاربر در ۲۴ ساعت.
 *
 * ⚠️ چرا لازم است: `enforceRateLimit` فقط **تعداد درخواست** را می‌شمارد، نه
 * هزینه. یک حلقهٔ باگ‌دار (یا کرون + lazy + صف که روی هم بیفتند) می‌تواند
 * در چند ساعت کل سهمیهٔ کلید را بسوزاند بدون آنکه سقف درخواست رد شود.
 *
 * ⚠️ در خطای سنجش، اجازه می‌دهد (`ok: true`): محافظ است، نه شرط درستی.
 */
async function checkTokenBudget(
  env: RequestContext['env'],
  r: ContentRepository,
  userId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const budget = Number(env.AI_TOKEN_BUDGET_PER_DAY ?? 300_000);
  if (!Number.isFinite(budget) || budget <= 0) return { ok: true };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const used = await r.sumTokensForUserSince(userId, since);
  if (used < budget) return { ok: true };

  return {
    ok: false,
    reason: `daily AI token budget exhausted (${used}/${budget})`,
  };
}

export async function runCycleGeneration(
  env: RequestContext['env'],
  userId: string,
  cycleNumber: number,
  opts: { firstOnly?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  const r = repo(env);

  const user = await r.findUserById(userId);
  if (!user) return { ok: false, error: 'user not found' };

  const generating = await r.getGeneratingCycle(userId);
  if (!generating || generating.cycle_number !== cycleNumber) {
    return { ok: false, error: 'no matching GENERATING cycle' };
  }

  // ── Build the failover chain from the admin-managed provider pool ──
  // Order comes from `ai_providers.priority`; keys are decrypted here only.
  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const providerRows = await r.listActiveAiProviders();
  // ⚠️ فقط providerهای TEXT (مِیگرشن ۰۰۱۱): مدل صوتی نباید در مسیر تولید
  // محتوا امتحان شود و برعکس.
  const chain = await resolveProviderChain(providerRows, env, 'TEXT');
  const engine = new AiEngine(env, chain, 'TEXT');

  if (!engine.hasAnyProvider) {
    const reason =
      providerRows.length === 0
        ? 'no AI provider configured'
        : 'no AI provider could be resolved (check keys / PROVIDER_ENCRYPTION_KEY)';
    await markCycleFailed(r, generating.id, reason);
    return { ok: false, error: reason };
  }

  // ── سقف هزینه: قبل از هر فراخوانی AI ────────────────────────────
  const budget = await checkTokenBudget(env, r, userId);
  if (!budget.ok) {
    await markCycleFailed(r, generating.id, budget.reason);
    return { ok: false, error: budget.reason };
  }

  const generationInput = await buildGenerationInput(r, user, cycleNumber);
  if (!generationInput) {
    await markCycleFailed(r, generating.id, 'could not build generation input');
    return { ok: false, error: 'could not build generation input' };
  }

  // ── تولید ماژولار: نقشه → روز ۱ → بقیه در پس‌زمینه ─────────────
  // ⚠️ مسیر legacy «کل چرخهٔ ۷ درسی در یک پاسخ» **حذف شد**: با سقف واقعی
  // providerها (۸۱۹۲ توکن) پاسخ همیشه بریده می‌شد و schema validation
  // می‌شکست — یعنی هرگز موفق نمی‌شد و فقط سهمیهٔ AI را دو برابر می‌سوزاند.
  let mod = await runModularGeneration(env, r, engine, generating.id, generationInput, {
    firstOnly: opts.firstOnly,
  });

  // ── تلاش دوم (فقط در پس‌زمینه) ─────────────────────────────────
  // ارزان‌تر از برگشتن به مسیر legacy؛ شاید مشکل گذرا بوده باشد.
  if (!mod.ok && !opts.firstOnly) {
    console.warn(`[modular] retry once: ${mod.error}`);
    await new Promise((res) => setTimeout(res, 2_000));
    mod = await runModularGeneration(env, r, engine, generating.id, generationInput, {
      firstOnly: opts.firstOnly,
    });
  }

  if (mod.ok) return { ok: true };

  await markCycleFailed(r, generating.id, mod.error ?? 'modular generation failed');
  return { ok: false, error: mod.error ?? 'modular generation failed' };
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
    phase: 'initial' | 'repair';
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
        phase: a.phase,
        ok: a.ok,
        latencyMs: a.ms,
        error: a.error,
        tokensUsed: a.tokensUsed,
        consecutiveFailures: fails,
      })
      .catch(() => undefined);
  }
}

// ═════════════════════════════════════════════════════════════════════
// تولید ماژولار — outline → روز ۱ → بقیه در پس‌زمینه
// ═════════════════════════════════════════════════════════════════════

/**
 * ساخت ورودی موتور AI از داده‌های کاربر (delta + خلاصهٔ چرخهٔ قبل).
 * هم مسیر تولید کامل و هم job پس‌زمینهٔ تک‌درس از همین استفاده می‌کنند.
 */
async function buildGenerationInput(
  r: ContentRepository,
  user: UserRow,
  cycleNumber: number
): Promise<CycleGenerationInput | null> {
  const previous = await r.getActiveCycle(user.id);
  const previousLessons = previous ? await r.getLessonsForCycle(previous.id) : [];
  const telemetry = previous ? await r.getTelemetryForCycle(previous.id) : [];
  const lexical = await r.getLexicalItems(user.id, user.target_language);

  // ⚠️ باگ رفع‌شده: پیش از این فقط «وجود» درس روز ۶ چک می‌شد و فیلتر روی
  // **کل چرخه** اعمال می‌شد — یعنی «امتیاز آزمون پنهان» در واقع میانگین دقت
  // هر ۷ روز بود و به AI سیگنال غلط می‌داد. حالا فقط پاسخ‌های همان درس.
  const day6 = previousLessons.find((l) => l.day_number === 6);
  let hiddenScore: number | null = null;
  if (day6) {
    const day6Answers = telemetry.filter(
      (t) => t.event_type === 'ANSWER' && t.lesson_id === day6.id
    );
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

  return {
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
}

/** کلید کش برای بازاستفادهٔ محتوای تولیدشده بین کاربران هم‌سطح */
/**
 * نسخهٔ «شکل» محتوای کش‌شده.
 *
 * ⚠️ هر بار که قوس آموزشی ۷ روز تغییر کند (مثلاً مرحلهٔ ۸: پروفایل مجزای
 * هر روز)، این عدد را بالا ببرید. وگرنه outline قدیمی از کش خوانده می‌شود
 * و بهینه‌سازی جدید هرگز به کاربر نمی‌رسد.
 */
const CACHE_CONTENT_VERSION = 3;

/**
 * نسخهٔ «شکل» محتوای **درس** (جدا از outline).
 *
 * ⚠️ چرا دو شمارنده: outline و درس مستقل تکامل می‌یابند. تغییر پرامپت درس
 * نباید outlineهای سالم را باطل کند (و برعکس) — هر باطل‌سازی یعنی تولید
 * دوباره و هزینهٔ AI.
 * ⚠️ پیش از این کلید کش درس **هیچ نسخه‌ای نداشت** → با بالا بردن
 * `CACHE_CONTENT_VERSION` فقط outline باطل می‌شد و درس‌های کهنه می‌ماندند
 * (outline جدید + درس قدیمی = ناسازگاری). حالا هر دو نسخه دارند.
 * مقدار ۲ = پس از حذف فیلدهای بلااستفادهٔ اسکیمای درس.
 */
const LESSON_CONTENT_VERSION = 4;

function cacheKeyFor(
  input: CycleGenerationInput,
  part: string,
  variant: number
): string {
  const goal = input.user.learningGoal ?? 'any';
  return `${input.user.targetLanguage}:${input.user.skillLevel}:${goal}:${part}:v${variant}`;
}

/** کلید کش outline — با نسخهٔ محتوا تا بهینه‌سازی‌های جدید اعمال شوند */
function outlineCacheKeyFor(
  input: CycleGenerationInput,
  variant: number
): string {
  return `${cacheKeyFor(input, 'outline', variant)}:c${CACHE_CONTENT_VERSION}`;
}

/**
 * تولید ماژولار.
 *
 * ۱. «نقشهٔ» چرخه (ارزان) — از کش اگر موجود باشد
 * ۲. محتوای روز ۱ → ذخیره و فعال‌سازی چرخه (کاربر فوراً درس می‌خواند)
 * ۳. روزهای ۲..۷ در پس‌زمینه (job جدا برای هر روز)
 */
async function runModularGeneration(
  env: RequestContext['env'],
  r: ContentRepository,
  engine: AiEngine,
  cycleId: string,
  input: CycleGenerationInput,
  opts: { firstOnly?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  // واریانت چرخه: ۳ نسخه در گردش تا هم صرفه‌جویی کنیم هم درس‌ها یکسان نشوند
  const variant = ((input.cycleNumber - 1) % 3) + 1;

  // ── ۱. نقشهٔ چرخه ────────────────────────────────────────────────
  const outlineKey = outlineCacheKeyFor(input, variant);
  let outline = (await r.getCachedContent('CYCLE_OUTLINE', outlineKey)) as CycleOutline | null;
  let outlineModel = 'cache';
  let outlineMs = 0;

  if (!outline) {
    const res = await engine.generateOutline(input);
    await recordAttempts(r, cycleId, res.attempts);
    if (!res.outline) {
      return { ok: false, error: 'outline generation failed' };
    }
    outline = res.outline;
    outlineModel = res.model;
    outlineMs = res.totalMs;
    await r.putCachedContent('CYCLE_OUTLINE', outlineKey, input.user.targetLanguage, outline);
  }

  await r.persistCycleOutline(cycleId, outline, {
    model: outlineModel,
    ms: outlineMs,
    input,
  });

  // ── ۲. روز ۱ ─────────────────────────────────────────────────────
  const day1 = outline.days[0]!;
  const lesson1 = await ensureLessonContent(
    r, engine, cycleId, input, day1, outline, variant, {
    personalize: personalizedCache(env),
    twoStage: twoStageEnabled(env),
  });
  if (!lesson1) {
    return { ok: false, error: 'day-1 generation failed' };
  }

  await r.fillLessonContent(cycleId, 1, stampContentVersion(lesson1), 'AVAILABLE');
  await r.activateCycle(cycleId);

  // ── ۳. بقیه در پس‌زمینه ──────────────────────────────────────────
  //
  // ⚠️ نکتهٔ مهم (تجربهٔ عملی): Cloudflare وظایف `waitUntil` را پس از
  // پایان درخواست لغو می‌کند («waitUntil() tasks did not complete within the
  // allowed time ... and have been cancelled»). پس تولید طولانیِ AI را
  // نمی‌توان به waitUntil سپرد.
  //
  // راه‌حل: روز ۱ همین‌جا (در خود درخواست) ساخته می‌شود و بقیهٔ روزها
  // «تنبل» (lazy) وقتی کاربر به آن روز رسید تولید می‌شوند — در `home` و
  // `get-today-lesson`. اگر Cloudflare Queues فعال باشد، از صف بومی
  // استفاده می‌کنیم که تخصیص زمان مستقل دارد.
  if (opts.firstOnly) return { ok: true };

  const remaining = outline.days.slice(1);

  // صف بومی Cloudflare (اگر binding تنظیم شده باشد)
  const queue = (env as { GENERATION_QUEUE?: { send: (m: unknown) => Promise<void> } })
    .GENERATION_QUEUE;
  if (queue) {
    for (const day of remaining) {
      await queue
        .send({
          kind: 'generate-lesson',
          userId: input.user.id,
          cycleId,
          cycleNumber: input.cycleNumber,
          dayNumber: day.dayNumber,
        })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  // QStash فقط اگر صریحاً روشن شده باشد
  const qstash = new QStashClient(env);
  if (String(env.USE_QSTASH ?? 'false') === 'true' && qstash.available) {
    for (const day of remaining) {
      await qstash
        .enqueue({
          kind: 'generate-lesson',
          userId: input.user.id,
          cycleId,
          cycleNumber: input.cycleNumber,
          dayNumber: day.dayNumber,
        })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  // بدون صف: تا سقف بودجهٔ زمانی چند روز را همین‌جا بساز؛ بقیه در
  // درخواست‌های بعدی کاربر (lazy) پر می‌شوند.
  const budgetMs = Number(env.BACKGROUND_BUDGET_MS ?? 20_000);
  const t0 = Date.now();
  for (const day of remaining) {
    if (Date.now() - t0 > budgetMs) break;
    await generateLessonJob(env, r, engine, input, outline, cycleId, day, variant).catch(
      () => undefined
    );
  }

  return { ok: true };
}

/**
 * آیا تولید دو مرحله‌ای (اسکلت → جزئیات) روشن است؟
 * `TWO_STAGE_LESSON=false` به مسیر تک‌فراخوانی برمی‌گرداند.
 */
function twoStageEnabled(env: RequestContext['env']): boolean {
  return String(env.TWO_STAGE_LESSON ?? 'true') !== 'false';
}

/**
 * آیا شخصی‌سازی کش روشن است؟ `PERSONALIZED_CACHE=false` خاموشش می‌کند.
 * پیش‌فرض روشن است چون شخصی‌سازی واقعی وعدهٔ اصلی محصول است.
 */
function personalizedCache(env: RequestContext['env']): boolean {
  return String(env.PERSONALIZED_CACHE ?? 'true') !== 'false';
}

/** هش کوتاه و پایدار (FNV-1a) — فقط برای ساخت اثر انگشت کلید کش */
function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * اثر انگشت «نقاط ضعف» کاربر برای کلید کش درس.
 *
 * ⚠️ مشکلی که حل می‌کند: کلید کش هیچ نشانی از نقاط ضعف کاربر نداشت، پس
 * درسی که حول واژه‌های ضعیف کاربر A ساخته شده بود **بی‌کم‌وکاست** به کاربر
 * B هم داده می‌شد. یعنی کش داشتیم ولی «شخصی‌سازی» اسمی بود.
 *
 * ⚠️ اثر انگشت **درشت** است (۶ واژهٔ اول، مرتب‌شده و کوچک‌شده):
 *   • مرتب‌سازی → ترتیب تصادفی لیست دو کلید متفاوت نمی‌سازد
 *   • فقط ۶ واژه → کاربران با پروفایل مشابه محتوا را به اشتراک می‌گذارند
 *     (نرخ اصابت کش کاملاً از بین نمی‌رود)
 * ⚠️ روی روزهای **تمام‌جدید** (`newItemRatio === 1`) اعمال نمی‌شود چون
 * آنجا مروری در کار نیست و شخصی‌سازی بی‌معناست — کش مشترک می‌ماند.
 */
function weaknessFingerprint(input: CycleGenerationInput, enabled: boolean): string {
  if (!enabled) return 'w0';
  const weak = input.delta.weakTerms
    .slice(0, 6)
    .map((w) => w.term.trim().toLowerCase())
    .sort()
    .join('|');
  return weak ? `w${shortHash(weak)}` : 'w0';
}

/**
 * هم‌ترازی جزئیات واژه‌های یک درس با کش سطح واژه (`term_cards`).
 *
 * ⚠️ مشکلی که حل می‌کند: پیش از این هر درس معنا/مثال خودش را از صفر
 * می‌ساخت، پس یک واژه در سه درس سه ترجمه و سه مثال متفاوت می‌گرفت —
 * برای یادگیرنده گیج‌کننده و برخلاف «ثبات» بود.
 *
 * ⚠️ این کار روی **خروجی** انجام می‌شود، نه با افزودن چیز به پرامپت →
 * **صفر توکن اضافه**. کارتِ موجود مرجع است؛ کارتِ تازه ذخیره می‌شود تا
 * درس‌های بعدی همان را بگیرند («نخستین نوشته برنده است»).
 */
/** نسخهٔ محتوا را داخل part1 می‌چسباند تا محتوای قدیمی قابل تشخیص باشد */
function stampContentVersion(lesson: GeneratedLesson): GeneratedLesson {
  return {
    ...lesson,
    part1: {
      ...lesson.part1,
      _cv: LESSON_CONTENT_VERSION,
    } as GeneratedLesson['part1'],
  };
}

/** آیا محتوای این ردیف درس با نسخهٔ فعلی هم‌خوان است؟ */
function lessonContentReady(part1: unknown): boolean {
  if (!part1 || typeof part1 !== 'object') return false;
  const obj = part1 as Record<string, unknown>;
  return Object.keys(obj).length > 0 && obj._cv === LESSON_CONTENT_VERSION;
}

/**
 * هش ساده (FNV-1a) — برای شافل قطعی.
 * ⚠️ چرا قطعی: گزینه‌ها در کش و در رندر بعدی باید همان ترتیب باشند، وگرنه
 * correctIndex ذخیره‌شده با گزینه‌های جدید نمی‌خواند.
 */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stableShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  let h = hashString(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * نرمال‌سازی گزینه‌های بخش ۱.
 *
 * ⚠️ چرا در سرور: مدل ممکن است گزینهٔ «درست» را با فیلد `meaning`/`example`
 * یکی نکند (مثلاً بازنویسی کند) → کاربر جواب درست را می‌زند ولی سیستم
 * غلط می‌شمارد. اینجا گزینهٔ درست **همیشه** با مقدار نهایی معنی/مثال
 * جایگزین و دوباره شافل می‌شود تا ایندکس همیشه معتبر باشد.
 */
function normalizeDrillChoices(lesson: GeneratedLesson): GeneratedLesson {
  const items = (lesson.part1?.items ?? []).map((item) => {
    const next: typeof item = { ...item, speakText: item.term };

    const buildChoice = (
      correct: string,
      choice: { options: string[]; correctIndex: number } | undefined,
      seed: string,
      requireTerm?: string
    ): { options: string[]; correctIndex: number } | undefined => {
      if (!choice) return undefined;
      const idx = choice.correctIndex;
      const wrong = choice.options
        .filter((o, i) => i !== idx && o.trim() && o.trim() !== correct.trim())
        .map((o) => o.trim());
      const unique = Array.from(new Set(wrong));
      if (unique.length < 2) return undefined; // گزینهٔ کافی نیست → UI ساده

      // ⚠️ سؤال «کدام جمله واژه را درست به کار برده؟» فقط وقتی معنا دارد که
      // **همهٔ** گزینه‌ها همان واژه را داشته باشند؛ وگرنه کاربر با شمارش
      // کلمه جواب را پیدا می‌کند (باگ گزارش‌شده).
      if (requireTerm) {
        const needle = requireTerm.trim().toLowerCase();
        const all = [correct, unique[0]!, unique[1]!];
        if (!all.every((o) => o.toLowerCase().includes(needle))) return undefined;
      }

      const shuffled = stableShuffle([correct, unique[0]!, unique[1]!], seed);
      return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
    };

    const meaningOptions = buildChoice(item.meaning, item.meaningOptions, `${item.term}:m`);
    const exampleOptions = buildChoice(
      item.example,
      item.exampleOptions,
      `${item.term}:e`,
      item.term
    );
    if (meaningOptions) next.meaningOptions = meaningOptions;
    else delete next.meaningOptions;
    if (exampleOptions) next.exampleOptions = exampleOptions;
    else delete next.exampleOptions;

    if (next.substitution) {
      const slots = next.substitution.slots;
      const ci = next.substitution.correctIndex;
      if (ci === undefined || ci < 0 || ci >= slots.length) {
        next.substitution = { ...next.substitution, correctIndex: 0 };
      }
    }

    return next;
  });

  return { ...lesson, part1: { ...lesson.part1, items } };
}

async function alignTermCards(
  r: ContentRepository,
  input: CycleGenerationInput,
  lesson: GeneratedLesson
): Promise<GeneratedLesson> {
  const items = lesson.part1?.items ?? [];
  if (items.length === 0) return lesson;

  const language = input.user.targetLanguage;
  const uiLanguage = input.user.uiLanguage;

  let known: Record<string, TermCard> = {};
  try {
    known = await r.findTermCards(language, uiLanguage, items.map((i) => i.term));
  } catch {
    return lesson; // کش اختیاری است — خطا نباید تولید را بشکند
  }

  const alignedItems = items.map((item) => {
    const card = known[item.term.trim().toLowerCase()];
    if (!card) return item;
    return {
      ...item,
      meaning: card.meaning || item.meaning,
      pronunciation: card.pronunciation ?? item.pronunciation,
      example: card.example ?? item.example,
      exampleTranslation: card.exampleTranslation ?? item.exampleTranslation,
    };
  });

  const freshCards: TermCard[] = alignedItems
    .filter((item) => !known[item.term.trim().toLowerCase()])
    .map((item) => ({
      term: item.term,
      meaning: item.meaning,
      pronunciation: item.pronunciation,
      example: item.example,
      exampleTranslation: item.exampleTranslation,
    }));

  await r.saveTermCards(language, uiLanguage, freshCards).catch(() => undefined);
  await r
    .bumpTermCardUse(language, uiLanguage, alignedItems.map((i) => i.term))
    .catch(() => undefined);

  // بعد از هم‌ترازی، گزینه‌ها را با مقادیر نهایی هم‌سو کن
  return normalizeDrillChoices({ ...lesson, part1: { ...lesson.part1, items: alignedItems } });
}

/**
 * واژه‌های «شناخته‌شده» برای مرحلهٔ A.
 *
 * ⚠️ فقط واژه‌های ضعیف کاربر بررسی می‌شوند (نه کل جدول): همان‌هایی که
 * احتمال دارد در درس مروری ظاهر شوند. فهرست کوچک = پرامپت کوچک‌تر.
 */
async function knownTermsForUser(
  r: ContentRepository,
  input: CycleGenerationInput
): Promise<string[]> {
  const weak = input.delta.weakTerms.slice(0, 20).map((w) => w.term);
  if (weak.length === 0) return [];
  try {
    const cards = await r.findTermCards(
      input.user.targetLanguage,
      input.user.uiLanguage,
      weak
    );
    return Object.values(cards).map((card) => card.term);
  } catch {
    return [];
  }
}

/**
 * مرحلهٔ B — پر کردن جزئیات «اسکلت» از کش سطح واژه.
 *
 * @returns درس کامل، یا `null` اگر واژه‌ای بدون کارت ماند.
 *
 * ⚠️ `null` یعنی **fallback**: به‌جای نشان‌دادن درسی با فیلدهای خالی،
 * مسیر کامل (تک‌فراخوانی) اجرا می‌شود. این تنها محافظِ درستی است —
 * مدل ممکن است قاعدهٔ «هر واژه باید کارت داشته باشد» را نقض کند.
 */
async function hydrateSkeleton(
  r: ContentRepository,
  input: CycleGenerationInput,
  skeleton: LessonSkeleton
): Promise<GeneratedLesson | null> {
  const language = input.user.targetLanguage;
  const uiLanguage = input.user.uiLanguage;

  // کارت‌های تازه را **اول** ذخیره کن تا در همان نقشه حاضر باشند
  if (skeleton.newCards?.length) {
    await r
      .saveTermCards(
        language,
        uiLanguage,
        skeleton.newCards.map((card) => ({
          term: card.term,
          meaning: card.meaning,
          pronunciation: card.pronunciation,
          example: card.example,
          exampleTranslation: card.exampleTranslation,
        }))
      )
      .catch(() => undefined);
  }

  const cards = await r.findTermCards(
    language,
    uiLanguage,
    skeleton.part1.items.map((item) => item.term)
  );

  const allCards = Object.values(cards);

  const items: PatternDrillItem[] = [];
  for (const item of skeleton.part1.items) {
    const card = cards[item.term.trim().toLowerCase()];
    if (!card?.meaning || !card.example) return null; // → fallback
    // گزینه‌های انحرافی از **واژه‌های دیگر همین درس** ساخته می‌شوند:
    // صفر توکن اضافه، و از نظر آموزشی نزدیک‌ترین گزینه‌های ممکن.
    const others = allCards.filter(
      (c) => c.term.trim().toLowerCase() !== item.term.trim().toLowerCase()
    );
    const otherMeanings = others.map((c) => c.meaning).filter(Boolean).slice(0, 2);
    const otherExamples = others
      .map((c) => c.example)
      .filter((e): e is string => Boolean(e))
      .slice(0, 2);
    items.push({
      term: item.term,
      meaning: card.meaning,
      pronunciation: card.pronunciation,
      example: card.example,
      exampleTranslation: card.exampleTranslation,
      // ⚠️ دکمهٔ «گوش کن» باید خودِ واژه را بخواند، نه مثال را
      speakText: item.term,
      substitution: item.substitution,
      meaningOptions:
        otherMeanings.length >= 2
          ? {
              options: [card.meaning, otherMeanings[0]!, otherMeanings[1]!],
              correctIndex: 0,
            }
          : undefined,
      exampleOptions:
        otherExamples.length >= 2
          ? {
              options: [card.example, otherExamples[0]!, otherExamples[1]!],
              correctIndex: 0,
            }
          : undefined,
    });
  }

  if (items.length === 0) return null;

  return normalizeDrillChoices({
    dayNumber: skeleton.dayNumber,
    title: skeleton.title,
    titleUi: skeleton.titleUi,
    kind: skeleton.kind,
    part1: { type: 'PATTERN_DRILL', items },
    part2: skeleton.part2,
  });
}

/** تولید (یا خواندن از کش) محتوای یک روز */
async function ensureLessonContent(
  r: ContentRepository,
  engine: AiEngine,
  cycleId: string,
  input: CycleGenerationInput,
  day: OutlineDay,
  outline: CycleOutline,
  variant: number,
  /**
   * آیا نقاط ضعف کاربر در کلید کش اثر بگذارند؟ با `PERSONALIZED_CACHE=false`
   * خاموش می‌شود — چون شخصی‌سازی واقعی نرخ اصابت کش را کم و هزینه را زیاد
   * می‌کند؛ این کلید فرار برای وقتی است که هزینه اولویت داشته باشد.
   */
  options: {
    /** آیا نقاط ضعف کاربر در کلید کش اثر بگذارند؟ (`PERSONALIZED_CACHE`) */
    personalize: boolean;
    /** آیا مسیر دو مرحله‌ای (اسکلت → جزئیات) فعال است؟ (`TWO_STAGE_LESSON`) */
    twoStage: boolean;
  }
): Promise<GeneratedLesson | null> {
  // ⚠️ روزهای مرورمحور اثر انگشت نقاط ضعف می‌گیرند تا محتوا واقعاً حول
  // واژه‌های ضعیف همین کاربر ساخته شود؛ روزهای تمام‌جدید مشترک می‌مانند.
  const personalize = options.personalize && dayProfile(day.dayNumber).newItemRatio < 1;
  const fingerprint = personalize ? weaknessFingerprint(input, true) : 'w0';
  const key = `${cacheKeyFor(input, `d${day.dayNumber}:${day.kind}`, variant)}:${fingerprint}:c${LESSON_CONTENT_VERSION}`;

  const cached = (await r.getCachedContent('LESSON', key)) as GeneratedLesson | null;
  if (cached) {
    // حتی برای کش‌شده هم کارت‌ها را تازه نگه دار (ممکن است واژه‌ای تازه
    // به کش اضافه شده باشد و باید با آن هم‌تراز شود).
    return alignTermCards(r, input, cached);
  }

  // ── مسیر دو مرحله‌ای (ارزان‌تر) ──────────────────────────────────
  // ⚠️ فقط روی روزهای مرورم‌حور و نه CONSOLIDATION:
  //   • روزهای تمام‌جدید همهٔ واژه‌ها تازه‌اند، پس صرفه‌جویی صفر است
  //   • روز ۷ عمداً مثال‌های **تازه** برای واژه‌های ضعیف می‌خواهد، پس
  //     مثالِ ثابتِ کارت به کار نمی‌آید
  const twoStageDay =
    options.twoStage &&
    day.kind !== 'CONSOLIDATION' &&
    dayProfile(day.dayNumber).newItemRatio < 1;

  if (twoStageDay) {
    const knownTerms = await knownTermsForUser(r, input);
    const sk = await engine.generateLessonSkeleton(input, day, outline, knownTerms);
    await recordAttempts(r, cycleId, sk.attempts);

    if (sk.skeleton) {
      const hydrated = await hydrateSkeleton(r, input, sk.skeleton);
      if (hydrated) {
        await r.putCachedContent('LESSON', key, input.user.targetLanguage, hydrated);
        return hydrated;
      }
      // ⚠️ واژه‌ای بدون کارت ماند → به مسیر کامل برمی‌گردیم تا کاربر
      // درسی با فیلدهای خالی نبیند (یک فراخوانی اضافه، ولی نادر).
      console.warn(
        `[two-stage] hydration failed for day ${day.dayNumber} → falling back to full generation`
      );
    }
  }

  const res = await engine.generateLesson(input, day, outline);
  await recordAttempts(r, cycleId, res.attempts);
  if (!res.lesson) return null;

  // هم‌ترازی با کش سطح واژه قبل از ذخیره → محتوای کش‌شده هم ثابت است
  const aligned = await alignTermCards(r, input, res.lesson);
  await r.putCachedContent('LESSON', key, input.user.targetLanguage, aligned);
  return aligned;
}

/** تولید و ذخیرهٔ یک روز مشخص (استفاده در job پس‌زمینه) */
async function generateLessonJob(
  env: RequestContext['env'],
  r: ContentRepository,
  engine: AiEngine,
  input: CycleGenerationInput,
  outline: CycleOutline,
  cycleId: string,
  day: OutlineDay,
  variant: number
): Promise<boolean> {
  // ⚠️ اگر isolate دیگری همین حالا مشغول همین روز است، دوباره AI نزن.
  // `true` برمی‌گردانیم چون کار در حال انجام است، نه شکست‌خورده — وگرنه
  // صف/کرون بی‌دلیل retry می‌کند.
  if (!(await acquireGenerationLock(env, `${cycleId}:${day.dayNumber}`))) {
    return true;
  }

  const lesson = await ensureLessonContent(
    r, engine, cycleId, input, day, outline, variant, {
    personalize: personalizedCache(env),
    twoStage: twoStageEnabled(env),
  });
  if (!lesson) return false;
  // روزهای بعدی LOCKED می‌مانند؛ منطق باز شدن روزها جداست
  await r.fillLessonContent(cycleId, day.dayNumber, stampContentVersion(lesson), 'LOCKED');
  void env;
  return true;
}

/**
 * job پس‌زمینه برای یک روز — از صف صدا زده می‌شود.
 * outline از ردیف‌های ذخیره‌شدهٔ همان چرخه بازسازی می‌شود.
 */
export async function runLessonGeneration(
  env: RequestContext['env'],
  userId: string,
  cycleId: string,
  cycleNumber: number,
  dayNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const r = repo(env);

  const user = await r.findUserById(userId);
  if (!user) return { ok: false, error: 'user not found' };

  const cycle = await r.getCycleById(cycleId);
  if (!cycle) return { ok: false, error: 'cycle not found' };

  const lessons = await r.getLessonsForCycle(cycleId);
  if (lessons.length === 0) return { ok: false, error: 'cycle has no lesson rows' };

  // اگر همین حالا پر شده، دوباره تولید نکن (idempotent)
  const target = lessons.find((l) => l.day_number === dayNumber);
  if (!target) return { ok: false, error: 'day not found in cycle' };
  // ⚠️ فقط محتوای هم‌نسخه «آماده» حساب می‌شود؛ محتوای قدیمی بازتولید می‌شود
  // تا کاربر بعد از تغییر اسکیما (گزینه‌های معنی/مثال) محتوای کهنه نبیند.
  if (lessonContentReady(target.part_1_data)) return { ok: true };

  // ⚠️ ستون DB هنوز `title_fa` naam دارد ولی معنایش «زبان رابط کاربر»
  // است (یافتهٔ ۶ بازبینی). اینجا به `titleUi` نگاشت می‌شود تا با نام
  // جدیدی که به AI می‌فرستیم یکی باشد.
  const outline: CycleOutline = {
    title: cycle.title,
    titleUi: cycle.title_fa ?? cycle.title,
    focusSummary: cycle.focus_summary ?? '',
    days: lessons
      .map((l) => ({
        dayNumber: l.day_number,
        title: l.title,
        titleUi: l.title_fa ?? l.title,
        kind: l.kind,
        // مرحلهٔ ۸ — اگر ستون objective در DB باشد همان را بگیر، وگرنه
        // از پروفایل ثابت روز استفاده کن (dayProfile خودش fallback دارد).
        objective: l.objective ?? undefined,
        objectiveFa: l.objective_fa ?? undefined,
      }))
      .sort((a, b) => a.dayNumber - b.dayNumber),
  };

  const day = outline.days.find((d) => d.dayNumber === dayNumber);
  if (!day) return { ok: false, error: 'day not in outline' };

  // ── سقف هزینه: قبل از هر فراخوانی AI ────────────────────────────
  const budget = await checkTokenBudget(env, r, userId);
  if (!budget.ok) return { ok: false, error: budget.reason };

  const input = await buildGenerationInput(r, user, cycleNumber);
  if (!input) return { ok: false, error: 'could not build generation input' };

  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const providerRows = await r.listActiveAiProviders();
  // ⚠️ فقط providerهای TEXT (مِیگرشن ۰۰۱۱): مدل صوتی نباید در مسیر تولید
  // محتوا امتحان شود و برعکس.
  const chain = await resolveProviderChain(providerRows, env, 'TEXT');
  const engine = new AiEngine(env, chain, 'TEXT');
  if (!engine.hasAnyProvider) return { ok: false, error: 'no AI provider available' };

  const variant = ((cycleNumber - 1) % 3) + 1;
  const ok = await generateLessonJob(env, r, engine, input, outline, cycleId, day, variant);
  if (!ok) return { ok: false, error: `day ${dayNumber} generation failed` };

  // ⚠️ اگر چرخه هنوز GENERATING است ولی روز ۱ حالا محتوا دارد، فعالش کن.
  // این «ترمیم» جلوگیری می‌کند از حالتی که همهٔ روزها پر شده‌اند ولی چرخه
  // هرگز ACTIVE نشده و کاربر برای همیشه اسپینر می‌بیند.
  try {
    const fresh = await r.getCycleById(cycleId);
    if (fresh?.status === 'GENERATING') {
      const all = await r.getLessonsForCycle(cycleId);
      const d1 = all.find((l) => l.day_number === 1);
      const d1Ready = d1?.part_1_data && Object.keys(d1.part_1_data as object).length > 0;
      if (d1Ready) {
        await r.activateCycleWithFirstLesson(cycleId);
        console.log(`[gen] activated cycle ${cycleId} after filling day ${dayNumber}`);
      }
    }
  } catch (err) {
    console.warn(
      `[gen] activation check failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { ok: true };
}

async function markCycleFailed(  r: ContentRepository,
  cycleId: string,
  reason: string
): Promise<void> {
  await r['db'].update('cycles', { id: cycleId }, {
    status: 'FAILED',
    focus_summary: `Generation failed: ${reason.slice(0, 400)}`,
    // زمان شکست — مبنای فاصله‌گذاری retry کرون (۳۰ دقیقه)
    completed_at: new Date().toISOString(),
  });
}

/**
 * ⚠️ نکتهٔ حیاتی دربارهٔ پس‌زمینه:
 *
 * Cloudflare وظایف `waitUntil` را پس از پایان درخواست لغو می‌کند
 * («waitUntil() tasks did not complete within the allowed time … and have been
 * cancelled»). پس تولید طولانیِ AI را نمی‌توان به آن سپرد. به همین دلیل:
 *
 *   • «نقشهٔ» چرخه + محتوای روز ۱ در خودِ درخواست ساخته می‌شود.
 *   • روزهای بعدی «تنبل» (lazy) وقتی کاربر به آن روز می‌رسد ساخته می‌شوند
 *     (در `home` / `get-today-lesson`) — همیشه با بودجهٔ کامل یک درخواست.
 *   • اگر Cloudflare Queues (binding: GENERATION_QUEUE) فعال باشد، روزهای
 *     بعدی به صف سپرده می‌شوند که زمان مستقل دارد.
 */
async function generateCycleInline(
  context: RequestContext,
  userId: string,
  cycleNumber: number,
  opts: { firstOnly?: boolean } = {}
): Promise<void> {
  await runCycleGeneration(context.env, userId, cycleNumber, opts);
}

/**
 * زمان‌بندی تولید چرخه — سه مسیر به ترتیب اولویت:
 *
 *  ۱. **Queue** (`GENERATION_QUEUE`): پیام به صف می‌رود و consumer جداگانه
 *     آن را اجرا می‌کند. درخواست کاربر مسدود نمی‌شود. رایگان (۱۰k/day).
 *  ۲. **Workflow** (`CYCLE_WORKFLOW`): instance durable ساخته می‌شود؛
 *     هر روز retry مستقل دارد و اگر Worker کرش کند از همان‌جا ادامه
 *     می‌یابد. رایگان.
 *  ۳. **inline**: در همان درخواست با `firstOnly: true` (نقشه + روز ۱).
 *
 * `firstOnly` در حالت صف/ورک‌فلو معنای «فقط لایهٔ ساده در درخواست» را
 * ندارد — کل کار پس‌زمینه است.
 */
/**
 * زمان‌بندی تولید چرخه — سه مسیر به ترتیب اولویت:
 *
 *  ۱. **Workflow** (`CYCLE_WORKFLOW`): رایگان و پایدار. هر روز یک `step.do`
 *     مستقل با retry خودش؛ اگر روز ۵ شکست بخورد فقط همان گام دوباره اجرا
 *     می‌شود، نه کل چرخه. 🔴 اولویت اول از این روست.
 *  ۲. **Queue** (`GENERATION_QUEUE`): ساده‌تر و سبک‌تر. وقتی Workflow
 *     binding نشده باشد. retry با DLQ دارد ولی «هر روز» جدا نیست.
 *  ۳. **inline**: فقط outline + روز ۱ در همان درخواست. آخرین راه‌حل —
 *     بقیهٔ روزها بعداً با lazy generation یا کرون پر می‌شوند.
 *
 * ⚠️ روز ۱ همیشه در Workers ساخته می‌شود (نه Workflow) تا کاربر چند
 * ثانیه‌ای درس داشته باشد؛ Workflow فقط روزهای ۲..۷ را اداره می‌کند.
 */
async function scheduleCycleGeneration(
  context: RequestContext,
  userId: string,
  cycleNumber: number,
  opts: { withAudio?: boolean } = {}
): Promise<{ via: 'queue' | 'workflow' | 'inline' }> {
  const env = context.env;

  // ۱) Workflow — پایدارترین گزینه
  if (env.CYCLE_WORKFLOW) {
    try {
      await env.CYCLE_WORKFLOW.create({
        userId,
        cycleNumber,
        firstOnly: false,
        withAudio: Boolean(opts.withAudio && hasMediaStorage(env)),
      });
      return { via: 'workflow' };
    } catch (err) {
      console.warn(
        `[schedule] workflow create failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ۲) Queue
  if (env.GENERATION_QUEUE) {
    try {
      await env.GENERATION_QUEUE.send({
        kind: 'generate-cycle',
        userId,
        cycleNumber,
      });
      return { via: 'queue' };
    } catch (err) {
      console.warn(
        `[schedule] queue send failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ۳) inline
  await generateCycleInline(context, userId, cycleNumber, { firstOnly: true });
  return { via: 'inline' };
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

    // اولویت: Queue/Workflow (مسدودکننده نیست) → fallback inline
    const via = await scheduleCycleGeneration(context, user.id, 1);
    return jsonSuccess(
      {
        onboardingComplete: true,
        firstCycleId: cycle.id,
        generating: true,
        generationVia: via.via,
      },
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
