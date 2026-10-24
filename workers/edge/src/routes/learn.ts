import {
  completeLessonSchema,
  onboardingRequestSchema,
  telemetryBatchSchema,
  updateProfileSchema,
  reviewSubmitSchema,
  calibrationSubmitSchema,
  freeWriteSubmitSchema,
  roleplayTurnRequestSchema,
  roleplayFinishRequestSchema,
  applyLeitnerReview,
  buildSkillDelta,
  computeStreak,
  computeStreakLocal,
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
  StoryPart,
  ApplicationQuestion,
  LearningMap,
} from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { errorTypeFor, skillFor } from '../services/error-taxonomy';
import {
  appendDecision,
  buildLearningMap,
  reviseLearningMap,
  currentStage,
  evaluateStage,
  MIN_EVIDENCE_ANSWERS,
  validateLessonAgainstMap,
} from '../services/learning-map';
import {
  coinDiscountFor,
  DEFAULT_COIN_DISCOUNT,
  type CoinDiscountConfig,
} from './store';
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

  // ── ترجیحات کاربر (دقایق روزانه) روی پروفایل ──────────────────────
  const prefs = await r.getUserPrefs(user.id);
  if (prefs.dailyMinutes) profile.dailyMinutes = prefs.dailyMinutes;
  if (prefs.dialect) profile.dialect = prefs.dialect;
  profile.reminderOn = prefs.reminderOn;
  profile.reminderTime = prefs.reminderTime;

  /**
   * ── قاعدهٔ «یک درس در روز» ────────────────────────────────────────
   *
   * ⚠️ ملاک، **تکمیل درس قبلی** است؛ اما درس بعدی فقط در نیمه‌شبِ
   * **منطقهٔ زمانی خود کاربر** باز می‌شود (نه بلافاصله و نه به وقت سرور).
   * اگر کاربر درس را چند روز طول داده باشد، باز هم همان لحظهٔ تکمیل مبنا
   * است و نیمه‌شب بعدی باز می‌شود.
   */
  const tz = ((user as { timezone?: string | null }).timezone ?? 'UTC') || 'UTC';
  const nextIncomplete = lessons.find((l) => !l.is_completed);
  if (nextIncomplete && nextIncomplete.day_number > 1) {
    const prev = lessons.find((l) => l.day_number === nextIncomplete.day_number - 1);
    const completedAt = prev?.completed_at;
    if (prev?.is_completed && completedAt) {
      const unlockAt = nextLocalMidnightMs(completedAt, tz);
      if (Date.now() < unlockAt) {
        return jsonSuccess(
          {
            user: profile,
            cycle: cycleDto,
            lesson: null,
            generating: false,
            generationStatus: null,
            nextUnlockAt: new Date(unlockAt).toISOString(),
          },
          requestId,
          env
        );
      }
    }
  }

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

  // ⚠️ اگر محتوا آماده نیست و تولید inline مجاز نیست (روز ۲..۷ با صف)،
  // باید **به صف** سپرده شود؛ وگرنه صفحه تا ابد «در حال آماده‌سازی» می‌ماند.
  if (current && !currentReady && !inlineAllowed && env.GENERATION_QUEUE) {
    void env.GENERATION_QUEUE.send({
      kind: 'generate-lesson',
      userId: user.id,
      cycleId: activeCycle.id,
      cycleNumber: activeCycle.cycle_number,
      dayNumber: current.day_number,
    }).catch(() => undefined);
  }
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

  // بخش‌های تکمیل‌شدهٔ درس جاری — سمت سرور (مستقل از دستگاه)
  const partsDone =
    current && currentReady ? await r.getLessonParts(user.id, current.id) : 0;

  const economy = await r.getEconomySettings();

  // ── نقشهٔ ثابت ────────────────────────────────────────────────────
  const map = await ensureLearningMap(r, user);
  const stage = currentStage(map);

  return jsonSuccess(
    {
      user: profile,
      map: {
        version: map.version,
        outcome: map.outcome,
        currentStage: stage.titleUi,
        objective: stage.objectiveUi,
        stageIndex: stage.order,
        totalStages: map.stages.length,
        criteria: stage.criteria,
        calibrated: Boolean(map.calibration),
      },
      cycle: cycleDto,
      lesson: currentReady ? toLessonDto(current!) : null,
      partsDone,
      coinDiscount:
        economy.coinDiscount && typeof economy.coinDiscount === 'object'
          ? economy.coinDiscount
          : null,
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
  // هدف و مرحلهٔ جاری — برای ردیابی «این پاسخ به کدام هدف مربوط بود»
  let lessonObjective: string | null = lesson.objective ?? null;
  let lessonStage: string | null = null;
  try {
    const currentMap = await r.getLearningMap(user.id);
    lessonStage = currentMap?.currentStageId ?? null;
  } catch {
    /* best-effort */
  }

  const telemetryRows = [
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'LESSON_START',
      payload: { day: lesson.day_number, objective: lessonObjective, stage: lessonStage },
    },
    ...answers.map((a) => ({
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'ANSWER',
      item_id: a.itemId,
      is_correct: a.isCorrect,
      response_ms: a.responseMs,
      payload: {
        ...(a.usedHint ? { usedHint: true } : {}),
        errorType: errorTypeFor(a.itemId, a.isCorrect, Boolean(a.usedHint)),
        objective: lessonObjective,
        stage: lessonStage,
        day: lesson.day_number,
      },
    })),
    {
      user_id: user.id,
      lesson_id: lessonId,
      cycle_id: lesson.cycle_id,
      event_type: 'LESSON_END',
      payload: {
        day: lesson.day_number,
        durationSeconds,
        objective: lessonObjective,
        stage: lessonStage,
      },
    },
  ];

  /**
   * ⚠️ idempotency: اگر همین درس قبلاً LESSON_END ثبت کرده، تلمتری را
   * دوباره ننویس (دو درخواست هم‌زمان می‌توانند هر دو `is_completed=false`
   * ببینند و دقت کاربر را خراب کنند).
   */
  try {
    const alreadyLogged = await r.hasLessonEndTelemetry(lessonId);
    if (!alreadyLogged) await r.insertTelemetry(telemetryRows);
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

  /**
   * ⚠️ استریک باید بر اساس **تاریخ محلی کاربر** حساب شود. با UTC، درس
   * خواندن بعد از نیمه‌شب محلی (قبل از ۰۳:۳۰ تهران) دو روز را یکی می‌کرد.
   */
  const userTz = ((user as { timezone?: string | null }).timezone ?? 'UTC') || 'UTC';
  const todayLocal = localDateString(userTz);
  const streak = computeStreakLocal(
    user.last_active_date ? String(user.last_active_date).slice(0, 10) : null,
    user.streak_count,
    todayLocal
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
    last_active_date: todayLocal,
  });

  // ── 5. پایان چرخه؟ trigger تولید چرخه جدید ───────────────────────
  //
  // ⚠️ اینجا شواهد **ثبت‌شده** (تلمتری چرخه + وضعیت لایتنر) با معیارهای
  // **از پیش تعیین‌شدهٔ** مرحله مقایسه می‌شوند؛ تصمیم تسلط دستی نیست.
  const lessons = await r.getLessonsForCycle(lesson.cycle_id);
  const completedDays = lessons
    .filter((l) => l.is_completed || l.id === lessonId)
    .map((l) => l.day_number);

  const allDone = completedDays.length >= CYCLE_LENGTH_DAYS;

  /**
   * تسلط تفکیک‌شده به مهارت — هر درس، شمارندهٔ مهارت خودش را به‌روز می‌کند.
   * ⚠️ جمع‌زدن «تشخیص» و «تولید» در یک عدد، تصویر غلط می‌دهد (۱۱.۶).
   */
  try {
    const skillMap = await ensureLearningMap(r, user);
    const skillMastery = { ...(skillMap.skillMastery ?? {}) };
    for (const a of answers) {
      const skill = skillFor(a.itemId);
      if (!skill) continue;
      const cur = skillMastery[skill] ?? { correct: 0, total: 0 };
      skillMastery[skill] = {
        correct: cur.correct + (a.isCorrect ? 1 : 0),
        total: cur.total + 1,
      };
    }
    await r.saveLearningMap(user.id, {
      ...skillMap,
      skillMastery,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }

  /**
   * پایان چرخه ⇒ ارزیابی مرحلهٔ نقشه با شواهد **ثبت‌شده**.
   * ⚠️ تصمیم بر اساس معیارهای از پیش تعیین‌شدهٔ مرحله است، نه برداشت مدل.
   */
  if (allDone) {
    try {
      let map = await ensureLearningMap(r, user);
      const cycleTelemetry = await r.getTelemetryForCycle(lesson.cycle_id);
      const cycleAnswers = cycleTelemetry.filter((t) => t.event_type === 'ANSWER');
      const accuracyPct = cycleAnswers.length
        ? Math.round(
            (100 * cycleAnswers.filter((a) => a.is_correct).length) / cycleAnswers.length
          )
        : 0;

      const lex = await r.getLexicalItems(user.id, user.target_language);
      const masteredTerms = lex.filter((l) => l.mastered).length;
      const weakTerms = lex.filter((l) => l.box <= 2 || l.lapses > 0).length;
      const stage = currentStage(map);

      /**
       * ⚠️ قاعدهٔ «اطلاعات کافی نیست»: با کمتر از ۱۰ پاسخ، شواهد برای تأیید
       * تسلط کافی نیست و مرحله **ارتقا نمی‌یابد** (حتی اگر دقت ۱۰۰٪ باشد).
       */
      if (cycleAnswers.length < MIN_EVIDENCE_ANSWERS) {
        map = appendDecision(map, {
          scope: 'STAGE',
          ruleId: 'INSUFFICIENT_EVIDENCE_V1',
          inputs: {
            answers: cycleAnswers.length,
            required: MIN_EVIDENCE_ANSWERS,
            stage: stage.id,
          },
          output: 'NO_ADVANCE',
          reason: `فقط ${cycleAnswers.length} پاسخ ثبت شده؛ حداقل ${MIN_EVIDENCE_ANSWERS} لازم است`,
          confidence: 0.2,
        });
      } else {
        const evaluated = evaluateStage(map, { accuracyPct, masteredTerms, weakTerms });
        map = appendDecision(evaluated.map, {
          scope: 'STAGE',
          ruleId: 'STAGE_CRITERIA_V1',
          inputs: {
            stage: stage.id,
            accuracyPct,
            masteredTerms,
            weakTerms,
            minAccuracy: stage.criteria.minAccuracy,
            minMasteredTerms: stage.criteria.minMasteredTerms,
            maxWeakTerms: stage.criteria.maxWeakTerms,
          },
          output: evaluated.advanced ? 'STAGE_ADVANCED' : 'STAY_IN_STAGE',
          reason: evaluated.reason,
          confidence: 0.9,
        });
      }

      await r.saveLearningMap(user.id, map);
    } catch {
      /* best-effort: خطای نقشه نباید تکمیل درس را بشکند */
    }
  }

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
// GET /gate?action=admin-map  (فقط مدیر) — بازرسی نقشهٔ خودِ مدیر
// ═════════════════════════════════════════════════════════════════════

/**
 * ⚠️ برای ممیزی: نسخهٔ نقشه، وضعیت مراحل، نقض‌ها و تصمیم‌ها.
 * فعلاً نقشهٔ **خودِ مدیر** را برمی‌گرداند (پنل ادمین تک‌کاربره).
 */
export async function handleAdminMap(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  if (!isAdminFromEnv(env, telegramId) && !user.is_admin) {
    return jsonError('UNAUTHORIZED', 'admin only', requestId, env, 403);
  }

  const map = await ensureLearningMap(r, user);
  return jsonSuccess(
    {
      id: map.id,
      version: map.version,
      rulesVersion: map.rulesVersion ?? null,
      goal: map.goal,
      outcome: map.outcome,
      currentStageId: map.currentStageId,
      stages: map.stages.map((st) => ({
        id: st.id,
        order: st.order,
        title: st.titleUi,
        status: st.status,
        criteria: st.criteria,
        prerequisites: st.prerequisites,
      })),
      calibration: map.calibration ?? null,
      skillMastery: map.skillMastery ?? {},
      violations: map.violations.slice(-20),
      decisions: (map.decisions ?? []).slice(-20),
      history: map.history.slice(-10),
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// نقش‌آفرینی — گفت‌وگوی آزاد متنی (۳ نوبت + بازخورد پایانی)
// ═════════════════════════════════════════════════════════════════════

/** ساخت موتور متن (تکرار در سه اکشن نقش‌آفرینی) */
async function textEngine(env: RequestContext['env'], r: ContentRepository) {
  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const rows = await r.listActiveAiProviders();
  const chain = await resolveProviderChain(rows, env, 'TEXT');
  const engine = new AiEngine(env, chain, 'TEXT');
  return engine.hasAnyProvider ? engine : null;
}

export async function handleRoleplayStart(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const input = await buildGenerationInput(r, user, 1);
  if (!input) return jsonError('INTERNAL_ERROR', 'could not build input', requestId, env, 500);

  const engine = await textEngine(env, r);
  if (!engine) return jsonError('INTERNAL_ERROR', 'no AI provider', requestId, env, 502);

  const res = await engine.startRoleplay(input);
  if (!res.start) return jsonError('INTERNAL_ERROR', 'roleplay start failed', requestId, env, 502);
  return jsonSuccess(res.start, requestId, env);
}

export async function handleRoleplayTurn(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const parsed = roleplayTurnRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'invalid roleplay payload', requestId, env, 400);
  }

  const engine = await textEngine(env, r);
  if (!engine) return jsonError('INTERNAL_ERROR', 'no AI provider', requestId, env, 502);

  const res = await engine.roleplayReply({
    targetLanguage: user.target_language,
    uiLanguage: user.ui_language ?? 'fa',
    level: String(user.skill_level ?? 'A1'),
    ...parsed.data,
  });

  if (!res.reply) return jsonError('INTERNAL_ERROR', 'roleplay reply failed', requestId, env, 502);
  return jsonSuccess({ reply: res.reply }, requestId, env);
}

export async function handleRoleplayFinish(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const parsed = roleplayFinishRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'invalid roleplay payload', requestId, env, 400);
  }

  const engine = await textEngine(env, r);
  if (!engine) return jsonError('INTERNAL_ERROR', 'no AI provider', requestId, env, 502);

  const res = await engine.evaluateRoleplay({
    targetLanguage: user.target_language,
    uiLanguage: user.ui_language ?? 'fa',
    level: String(user.skill_level ?? 'A1'),
    scenario: parsed.data.scenario,
    goal: parsed.data.goal,
    userRole: parsed.data.userRole,
    aiRole: parsed.data.aiRole,
    transcript: parsed.data.transcript,
  });

  if (!res.result) {
    return jsonError('INTERNAL_ERROR', 'roleplay evaluation failed', requestId, env, 502);
  }

  // شاهد یادگیری: یک رویداد برای کل نقش‌آفرینی
  try {
    await r.insertTelemetry([
      {
        user_id: user.id,
        lesson_id: parsed.data.lessonId ?? null,
        cycle_id: null,
        event_type: 'ANSWER',
        item_id: 'roleplay',
        is_correct: res.result.verdict === 'PASS',
        response_ms: null,
        payload: {
          mode: 'ROLEPLAY',
          verdict: res.result.verdict,
          score: res.result.score,
          turns: parsed.data.transcript.filter((t) => t.role === 'user').length,
        },
      },
    ]);
  } catch {
    /* best-effort */
  }

  return jsonSuccess(res.result, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// مرور تأخیری — سنجش ماندگاری (۲ تا ۷ روز بعد)
// ═════════════════════════════════════════════════════════════════════

/**
 * ⚠️ چرا لازم است: مرور لایتنر «فاصلهٔ برنامه‌ریزی‌شده» را می‌سنجد، ولی
 * ماندگاری واقعی یعنی «بعد از چند روز، بدون زمینهٔ درس، یادت مانده؟»
 */
export async function handleDelayedCheck(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const lesson = await r.getOlderCompletedLesson(user.id, 2);
  if (!lesson) return jsonSuccess({ items: [] }, requestId, env);

  const items = ((lesson.part_1_data as { items?: { term: string; meaning: string }[] }).items ?? [])
    .filter((i) => i.term && i.meaning)
    .slice(0, 2);

  if (items.length === 0) return jsonSuccess({ items: [] }, requestId, env);

  const pool = ((lesson.part_1_data as { items?: { meaning: string }[] }).items ?? [])
    .map((i) => i.meaning)
    .filter(Boolean);

  const questions = items.map((item, idx) => {
    const distractors = pool.filter((m) => m !== item.meaning).slice(0, 2);
    while (distractors.length < 2) distractors.push(`—${distractors.length + 1}`);
    const options = [item.meaning, ...distractors];
    // چیدمان قطعی تا رفرش، ترتیب را عوض نکند
    const shift = (item.term.length + idx) % 3;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    return {
      term: item.term,
      options: rotated,
      correctIndex: rotated.indexOf(item.meaning),
      fromDay: lesson.day_number,
    };
  });

  return jsonSuccess({ items: questions, fromLessonId: lesson.id }, requestId, env);
}

/** POST /gate?action=delayed-submit */
export async function handleDelayedSubmit(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const body = (await readJson(request)) as {
    answers?: { term?: string; isCorrect?: boolean; lessonId?: string }[];
  };
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 5) : [];
  if (answers.length === 0) {
    return jsonError('VALIDATION_ERROR', 'answers required', requestId, env, 400);
  }

  try {
    await r.insertTelemetry(
      answers.map((a) => ({
        user_id: user.id,
        lesson_id: a.lessonId ?? null,
        cycle_id: null,
        event_type: 'ANSWER',
        item_id: `delayed-${String(a.term ?? 'x')}`.slice(0, 60),
        is_correct: Boolean(a.isCorrect),
        response_ms: null,
        payload: { mode: 'DELAYED_RECALL' },
      }))
    );
  } catch {
    /* best-effort */
  }

  return jsonSuccess({ recorded: answers.length }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=evaluate-free-write → ارزیابی پاسخ آزاد (نوشتاری)
// ═════════════════════════════════════════════════════════════════════

/**
 * ⚠️ تنها نقطه‌ای که ارزیابی با مدل انجام می‌شود.
 * برای مهارِ هزینه: ورودی حداکثر ۴۰۰ کاراکتر و خروجی ساختاریافته است.
 */
export async function handleEvaluateFreeWrite(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const parsed = freeWriteSubmitSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'invalid free-write payload', requestId, env, 400);
  }

  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const providerRows = await r.listActiveAiProviders();
  const chain = await resolveProviderChain(providerRows, env, 'TEXT');
  const engine = new AiEngine(env, chain, 'TEXT');
  if (!engine.hasAnyProvider) {
    return jsonError('INTERNAL_ERROR', 'no AI provider', requestId, env, 502);
  }

  const res = await engine.evaluateFreeWrite({
    targetLanguage: user.target_language,
    uiLanguage: user.ui_language ?? 'fa',
    term: parsed.data.term,
    prompt: parsed.data.prompt,
    answer: parsed.data.answer,
    level: String(user.skill_level ?? 'A1'),
  });

  if (!res.result) {
    return jsonError('INTERNAL_ERROR', 'evaluation failed', requestId, env, 502);
  }

  // ثبت شاهد یادگیری: پاسخ آزاد با حالت مشخص در تلمتری
  try {
    await r.insertTelemetry([
      {
        user_id: user.id,
        lesson_id: parsed.data.lessonId ?? null,
        cycle_id: null,
        event_type: 'ANSWER',
        item_id: `write:${parsed.data.term}`.slice(0, 60),
        is_correct: res.result.verdict === 'CORRECT',
        response_ms: null,
        payload: {
          mode: 'FREE_TEXT',
          verdict: res.result.verdict,
          score: res.result.score,
          answer: parsed.data.answer.slice(0, 300),
        },
      },
    ]);
  } catch {
    /* تلمتری best-effort */
  }

  return jsonSuccess(res.result, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// آزمون کالیبراسیون — سطح برآوردی مستقل از خوداظهاری
// ═════════════════════════════════════════════════════════════════════

const LEVEL_RANK: Record<string, number> = {
  ZERO: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

function levelFromScore(scorePct: number): string {
  if (scorePct < 40) return 'A0';
  if (scorePct < 60) return 'A1';
  if (scorePct < 75) return 'A2';
  if (scorePct < 90) return 'B1';
  return 'B2';
}

/** GET/POST /gate?action=calibration-test */
export async function handleCalibrationTest(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const map = await ensureLearningMap(r, user);
  if (map.calibration) {
    return jsonSuccess({ alreadyCalibrated: true, calibration: map.calibration }, requestId, env);
  }

  /**
   * کش مشترک آزمون: برای هر (زبان هدف، زبان رابط) فقط **یک بار** ساخته
   * می‌شود. ⚠️ نسخه در کلید هست تا تغییر اسکیما کش قدیمی را باطل کند.
   */
  const reqBody = (await (async () => {
    try {
      return (await request.clone().json()) as { stage?: string };
    } catch {
      return {} as { stage?: string };
    }
  })());
  const hard = reqBody.stage === 'hard';

  const cacheKey = hard
    ? `calib:hard:${user.target_language}:${user.ui_language ?? 'fa'}:v1`
    : `calib:${user.target_language}:${user.ui_language ?? 'fa'}:v2`;
  const cached = (await r.getCachedContent('LESSON', cacheKey)) as
    | { items?: { kind: 'MEANING' | 'LISTENING'; term: string; options: string[]; correctIndex: number }[] }
    | null;

  if (cached?.items?.length) {
    return jsonSuccess({ alreadyCalibrated: false, items: cached.items }, requestId, env);
  }

  const input = await buildGenerationInput(r, user, 1);
  if (!input) {
    return jsonError('INTERNAL_ERROR', 'could not build input', requestId, env, 500);
  }

  const { AiEngine, resolveProviderChain } = await import('../services/ai-engine');
  const providerRows = await r.listActiveAiProviders();
  const chain = await resolveProviderChain(providerRows, env, 'TEXT');
  const engine = new AiEngine(env, chain, 'TEXT');
  if (!engine.hasAnyProvider) {
    return jsonError('INTERNAL_ERROR', 'no AI provider', requestId, env, 502);
  }

  const res = await engine.generateCalibration(input, hard ? 'hard' : 'standard');
  if (!res.test?.items?.length) {
    return jsonError('INTERNAL_ERROR', 'calibration generation failed', requestId, env, 502);
  }

  const items = res.test.items.map((it) => ({
    kind: it.kind,
    term: it.term,
    options: it.options,
    correctIndex: it.correctIndex,
  }));

  await r.putCachedContent('LESSON', cacheKey, user.target_language, { items });

  return jsonSuccess({ alreadyCalibrated: false, items }, requestId, env);
}

/** POST /gate?action=calibration-submit */
export async function handleCalibrationSubmit(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const rawBody = await readJson(request);
  const parsed = calibrationSubmitSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'invalid calibration payload', requestId, env, 400);
  }
  /** مرحلهٔ سخت (tie-breaker) — برای کالیبراسیون تطبیقی دو مرحله‌ای */
  const isHard = (rawBody as { hard?: boolean }).hard === true;

  const answers = parsed.data.answers;
  const correct = answers.filter((a) => a.isCorrect).length;
  const scorePct = Math.round((correct / answers.length) * 100);

  // تفکیک مهارت: تشخیص واژه از شنیدن جدا سنجیده می‌شود
  const bySkill: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    const key = a.kind ?? 'MEANING';
    const cur = bySkill[key] ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    bySkill[key] = cur;
  }
  const estimated = isHard
    ? scorePct >= 50
      ? 'B2'
      : 'B1'
    : levelFromScore(scorePct);
  const selfReported = String(user.skill_level ?? 'ZERO');
  const selfRank = LEVEL_RANK[selfReported] ?? 0;
  const estRank = LEVEL_RANK[estimated] ?? 1;
  const mismatch = Math.abs(estRank - selfRank) >= 2;

  let map = await ensureLearningMap(r, user);

  map = {
    ...map,
    calibration: {
      takenAt: new Date().toISOString(),
      scorePct,
      answers: answers.length,
      selfReported,
      estimated,
      mismatch,
      confidence: isHard ? 0.85 : answers.length >= 10 ? 0.8 : 0.5,
      bySkill,
      ...(isHard ? { hardScore: scorePct } : {}),
    } as typeof map.calibration,
    updatedAt: new Date().toISOString(),
  };

  /**
   * ⚠️ جبران پیش‌نیاز با شواهد: اگر نتیجهٔ آزمون خیلی بالا باشد، مرحلهٔ ۱
   * (و برای امتیاز بالاتر، مرحلهٔ ۲) با **شاهد کالیبراسیون** تأیید می‌شود.
   * این تنها راه مجاز «پرش از مرحله» است و در history ثبت می‌شود.
   */
  const skipTo = scorePct >= 90 ? 3 : scorePct >= 80 ? 2 : 1;
  if (skipTo > 1) {
    const nowIso = new Date().toISOString();
    map = {
      ...map,
      currentStageId: map.stages[skipTo - 1]?.id ?? map.currentStageId,
      stages: map.stages.map((st) =>
        st.order < skipTo
          ? { ...st, status: 'MASTERED' as const, masteredAt: nowIso }
          : st.order === skipTo
            ? { ...st, status: 'IN_PROGRESS' as const }
            : st
      ),
      history: [
        ...map.history,
        {
          at: nowIso,
          kind: 'STAGE_MASTERED' as const,
          from: map.stages[0]?.id ?? null,
          to: map.stages[skipTo - 1]?.id ?? null,
          reason: `کالیبراسیون ${scorePct}٪ (${estimated}) — ${skipTo - 1} مرحله با شاهد آزمون تأیید شد`,
        },
      ],
    };

    map = appendDecision(map, {
      scope: 'STAGE',
      ruleId: 'CALIBRATION_SKIP_V1',
      inputs: {
        scorePct,
        answers: answers.length,
        estimated,
        selfReported,
        skippedStages: skipTo - 1,
      },
      output: `START_AT_STAGE_${skipTo}`,
      reason: `آزمون کالیبراسیون ${scorePct}٪ داد؛ شروع از مرحلهٔ ${skipTo} با شاهد آزمون`,
      confidence: answers.length >= 10 ? 0.8 : 0.5,
    });
  } else {
    map = appendDecision(map, {
      scope: 'STAGE',
      ruleId: 'CALIBRATION_BASELINE_V1',
      inputs: { scorePct, answers: answers.length, estimated, selfReported },
      output: 'START_AT_STAGE_1',
      reason: `آزمون کالیبراسیون ${scorePct}٪ داد؛ شروع از مرحلهٔ ۱`,
      confidence: answers.length >= 10 ? 0.8 : 0.5,
    });
  }

  await r.saveLearningMap(user.id, map);

  return jsonSuccess(
    {
      estimated,
      scorePct,
      mismatch,
      selfReported,
      stage: map.currentStageId,
      bySkill: map.calibration?.bySkill ?? {},
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=preview-discount → درصد تخفیف سکه‌ها برای یک پلن
// ═════════════════════════════════════════════════════════════════════

/**
 * ⚠️ نرخ تبدیل سکه→درصد **به کلاینت فرستاده نمی‌شود**؛ فقط نتیجهٔ نهایی
 * (درصد و مبلغ) برمی‌گردد تا کاربر نتواند نرخ را مهندسی معکوس کند.
 */
export async function handlePreviewDiscount(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const body = (await readJson(request)) as { planId?: string };
  const planId = typeof body.planId === 'string' ? body.planId : '';
  const plan = planId ? await r.getPlanById(planId) : null;
  if (!plan) return jsonError('NOT_FOUND', 'Plan not found', requestId, env, 404);

  const economy = await r.getEconomySettings();
  const rawCfg = (economy.coinDiscount ?? {}) as Partial<CoinDiscountConfig>;
  const cfg: CoinDiscountConfig = {
    coinsPerStep: Number(rawCfg.coinsPerStep) || DEFAULT_COIN_DISCOUNT.coinsPerStep,
    percentPerStep: Number(rawCfg.percentPerStep) || DEFAULT_COIN_DISCOUNT.percentPerStep,
  };

  const plans = await r.getPlans();
  const monthly = plans.find((pl) => pl.planType === '1_MONTH') ?? plan;
  // ⚠️ Plan (camelCase) و PlanRow (snake_case) هر دو در گردش‌اند
  const irrOf = (p: unknown) => {
    const o = p as { price_irr?: number; priceIrr?: number; discount_percent?: number; discountPercent?: number };
    return {
      irr: Number(o.price_irr ?? o.priceIrr ?? 0),
      disc: Number(o.discount_percent ?? o.discountPercent ?? 0),
    };
  };
  const m = irrOf(monthly);
  const pl = irrOf(plan);
  const monthlyFinalIrr = Math.round(m.irr * (1 - m.disc / 100));
  const planFinalIrr = Math.round(pl.irr * (1 - pl.disc / 100));

  const d = coinDiscountFor(
    user.stars_balance ?? 0,
    planFinalIrr,
    monthlyFinalIrr,
    cfg
  );

  return jsonSuccess(
    {
      percent: d.percent,
      irr: d.irr,
      finalStars: Math.max(
        1,
        Math.ceil(
          Number((plan as unknown as { price_stars?: number; finalPriceStars?: number }).price_stars ??
            (plan as unknown as { finalPriceStars?: number }).finalPriceStars ?? 0) *
            (1 - pl.disc / 100) *
            (1 - d.percent / 100)
        )
      ),
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=set-coin-rate  (فقط مدیر)
// ═════════════════════════════════════════════════════════════════════

/**
 * مدیر تعیین می‌کند هر «سکه» چه ارزشی دارد (ریال). این مقدار پایهٔ آیندهٔ
 * تبدیل سکه به استارز/TON است و فعلاً فقط نمایش داده می‌شود.
 */
export async function handleSetCoinRate(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId, telegramId } = context;
  if (!telegramId) return jsonError('UNAUTHORIZED', 'No identity', requestId, env, 401);

  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const admin = isAdminFromEnv(env, telegramId) || Boolean(user.is_admin);
  if (!admin) return jsonError('UNAUTHORIZED', 'admin only', requestId, env, 403);

  const body = (await readJson(request)) as {
    coinsPerStep?: unknown;
    percentPerStep?: unknown;
  };

  // پیکربندی تخفیف: هر `coinsPerStep` سکه = `percentPerStep`٪ روی پلن یک‌ماهه
  const step = Number(body.coinsPerStep);
  const pct = Number(body.percentPerStep);
  if (Number.isFinite(step) && Number.isFinite(pct) && step > 0 && pct > 0 && pct <= 100) {
    await r.setCoinDiscountConfig(Math.round(step), Math.round(pct));
  }

  const economy = await r.getEconomySettings();
  return jsonSuccess({ economy }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=mark-part  → ثبت تکمیل یک بخش از درس
// ═════════════════════════════════════════════════════════════════════

/**
 * ⚠️ قبلاً «کدام بخش تمام شده» فقط در localStorage بود؛ با تغییر دستگاه
 * از بین می‌رفت. حالا سمت سرور ذخیره می‌شود.
 */
export async function handleMarkPart(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const resolved = await requireUser(context);
  if ('error' in resolved) {
    return jsonError('NOT_FOUND', resolved.error, requestId, env, 404);
  }
  const { user, repo: r } = resolved;

  const body = (await readJson(request)) as { lessonId?: string; part?: number };
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
  const part = Number(body.part);
  if (!lessonId || ![1, 2, 3].includes(part)) {
    return jsonError('VALIDATION_ERROR', 'lessonId and part (1..3) are required', requestId, env, 400);
  }

  const lesson = await r.getLessonById(lessonId);
  if (!lesson || lesson.user_id !== user.id) {
    return jsonError('NOT_FOUND', 'Lesson not found', requestId, env, 404);
  }

  await r.markLessonPart(user.id, lessonId, part as 1 | 2 | 3);
  const partsDone = await r.getLessonParts(user.id, lessonId);

  return jsonSuccess({ partsDone }, requestId, env);
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

  const prefs = await r.getUserPrefs(user.id);

  // مرحلهٔ جاری نقشه — مرجع تولید محتوا
  const mapForGeneration = currentStage(await ensureLearningMap(r, user));

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
      dailyMinutes: prefs.dailyMinutes,
      stage: (() => {
        const mapStage = mapForGeneration;
        return mapStage
          ? {
              id: mapStage.id,
              title: mapStage.titleUi,
              objective: mapStage.objectiveUi,
              skills: mapStage.skills,
              minAccuracy: mapStage.criteria.minAccuracy,
            }
          : null;
      })(),
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
export const LESSON_CONTENT_VERSION = 10;

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
/**
 * آفست منطقهٔ زمانی در یک لحظهٔ مشخص (میلی‌ثانیه).
 * ⚠️ از Intl استفاده می‌کنیم چون Worker دسترسی به کتابخانهٔ tz ندارد.
 */
function tzOffsetMs(timeZone: string, at: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(at).map((x) => [x.type, x.value])
    ) as Record<string, string>;
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return asUtc - at.getTime();
  } catch {
    return 0;
  }
}

/** نیمه‌شبِ محلیِ روز بعد از `iso` — به وقت UTC */
function nextLocalMidnightMs(iso: string, timeZone: string): number {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return Date.now();

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(base).map((x) => [x.type, x.value])
  ) as Record<string, string>;

  // نیمه‌شب روز بعد به وقت محلی
  let guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1);
  // دو بار تنظیم تا DST هم درست بماند
  guess -= tzOffsetMs(timeZone, new Date(guess));
  guess -= tzOffsetMs(timeZone, new Date(guess)) - tzOffsetMs(timeZone, new Date(guess + 3_600_000));
  return guess;
}

/** تاریخ محلی کاربر به شکل YYYY-MM-DD */
function localDateString(timeZone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** روز هفتهٔ محلی (۰=شنبه … ۶=جمعه) */
function localWeekdayIndex(iso: string, timeZone: string): number {
  try {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(
      new Date(iso)
    );
    const map: Record<string, number> = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };
    return map[wd] ?? 0;
  } catch {
    return 0;
  }
}

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

      /**
       * ⚠️ باگ رفع‌شده: مدل اغلب `base` را از **خودِ جملهٔ مثال** می‌سازد
       * (مثال: «My phone number is 0912…» → «My ___ is 0912…»). نتیجه:
       * «الگو» عملاً همان مثالی است که کاربر لحظهٔ قبل دیده — هیچ تمرینی
       * نیست. اگر جملهٔ کامل‌شده با مثال یکی باشد، الگو را حذف می‌کنیم.
       */
      const normalize = (v: string) =>
        v
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const hasBlank = /_{2,}/.test(next.substitution.base);
      const filled = next.substitution.base.replace(/_{2,}/, slots[next.substitution.correctIndex ?? 0] ?? '');

      if (!hasBlank || normalize(filled) === normalize(next.example)) {
        delete next.substitution;
      }
    }

    return next;
  });

  return { ...lesson, part1: { ...lesson.part1, items } };
}

/**
 * نقشهٔ یادگیری کاربر را برمی‌گرداند و اگر نبود می‌سازد.
 * ⚠️ نقشه **قطعی** است؛ فقط یک بار ساخته می‌شود و بعد فقط وضعیت مراحل عوض می‌شود.
 */
async function ensureLearningMap(
  r: ContentRepository,
  user: {
    id: string;
    learning_goal: string | null;
    target_language: string;
    ui_language: string | null;
  }
): Promise<LearningMap> {
  const existing = await r.getLearningMap(user.id);
  if (existing?.stages?.length) return existing;

  const map = buildLearningMap({
    id: `map-${user.id.slice(0, 8)}`,
    goal: user.learning_goal,
    targetLanguage: user.target_language,
    uiLanguage: user.ui_language ?? 'fa',
  });
  await r.saveLearningMap(user.id, map);
  return map;
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
  let aligned = await alignTermCards(r, input, res.lesson);

  /**
   * ⚠️ اعتبارسنجی **فعال** نسبت به نقشه: هر سؤالی که به واژه‌ای بیرون از
   * بخش ۱ ارجاع دهد حذف می‌شود (نه فقط ثبت). این جلوی «محتوا خارج از نقشه»
   * را می‌گیرد بدون اینکه کاربر بدون درس بماند.
   */
  const lessonTerms = new Set(
    (aligned.part1?.items ?? []).map((i) => i.term.trim().toLowerCase())
  );
  const questions = aligned.part2?.questions ?? [];
  const keptQuestions = questions.filter((q) => {
    const linked = q.linkedTerm?.trim().toLowerCase();
    return !linked || lessonTerms.has(linked);
  });
  if (keptQuestions.length !== questions.length) {
    aligned = {
      ...aligned,
      part2: { ...aligned.part2, questions: keptQuestions },
    };
  }

  /**
   * ⚠️ نسخهٔ محلی بخش ۳ (چسباندن جمله‌های مثال) **غیرفعال شد**: جملات
   * به هم ربط نداشتند و تجربهٔ بدی می‌دادند. تا وقتی فراخوانی اختصاصی
   * داستان اضافه نشود، اگر مدل `part3` نداد، بخش ۳ نمایش داده نمی‌شود.
   */
  /**
   * اعتبارسنجی نسبت به نقشه — **قبل از انتشار**.
   * ⚠️ فعلاً non-blocking است: نقض ثبت می‌شود تا اندازه‌گیری شود، ولی درس
   * حذف نمی‌شود (جلوگیری از خالی ماندن برنامه). پس از تثبیت، به block تبدیل
   * می‌شود.
   */
  /**
   * تشخیص تکرار (۲۰.۵): اگر واژه‌های این درس با درس قبلی همان چرخه
   * بیش از ۷۰٪ هم‌پوشانی داشته باشد، به‌عنوان نقض ثبت می‌شود.
   */
  const duplicateViolation = await (async () => {
    try {
      const siblings = await r.getLessonsForCycle(cycleId);
      const prev = siblings
        .filter((l) => l.day_number < day.dayNumber && l.part_1_data)
        .sort((a, b) => b.day_number - a.day_number)[0];
      if (!prev) return null;

      const prevTerms = new Set(
        ((prev.part_1_data as { items?: { term: string }[] }).items ?? []).map((i) =>
          i.term.trim().toLowerCase()
        )
      );
      const nowTerms = (aligned.part1?.items ?? []).map((i) => i.term.trim().toLowerCase());
      if (prevTerms.size === 0 || nowTerms.length === 0) return null;

      const overlap = nowTerms.filter((t) => prevTerms.has(t)).length / nowTerms.length;
      if (overlap < 0.7) return null;

      return {
        at: new Date().toISOString(),
        cycleId,
        rule: 'DUPLICATE_CONTENT',
        detail: `${Math.round(overlap * 100)}٪ واژه‌های روز ${day.dayNumber} با روز ${prev.day_number} یکسان است`,
      };
    } catch {
      return null;
    }
  })();

  const mapForCheck = await r.getLearningMap(input.user.id);
  if (mapForCheck) {
    const check = validateLessonAgainstMap(aligned, mapForCheck, cycleId);
    const allViolations = duplicateViolation
      ? [...check.violations, duplicateViolation]
      : check.violations;
    if (allViolations.length > 0) {
      await r.saveLearningMap(input.user.id, {
        ...mapForCheck,
        violations: [...mapForCheck.violations, ...allViolations].slice(-50),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * بخش ۳ همیشه باید باشد: اگر مدل در پاسخ اصلی `part3` نداد، یک فراخوانی
   * کوچک **فقط برای داستان** انجام می‌شود (با واژه‌های همان درس).
   * ⚠️ اگر این هم شکست بخورد، درس بدون بخش ۳ منتشر می‌شود (block نمی‌کنیم).
   */
  if (!aligned.part3) {
    try {
      const storyRes = await engine.generateStory(input, day, aligned);
      if (storyRes.story?.lines?.length) {
        aligned = { ...aligned, part3: storyRes.story };
      }
    } catch {
      /* بخش ۳ اختیاری است */
    }
  }

  // ثبت تصمیم «محتوای این روز بر چه مبنایی ساخته شد»
  if (mapForCheck) {
    const prof = dayProfile(day.dayNumber);
    await r.saveLearningMap(
      input.user.id,
      appendDecision(mapForCheck, {
        scope: 'CONTENT',
        ruleId: 'DAY_PROFILE_V1',
        inputs: {
          day: day.dayNumber,
          phase: prof.phase,
          itemsMax: prof.items.max,
          part2Max: prof.part2.max,
          newItemRatio: prof.newItemRatio,
          stage: mapForCheck.currentStageId,
        },
        output: 'LESSON_GENERATED',
        reason: `روز ${day.dayNumber} با پروفایل ${prof.phase} و مرحلهٔ ${mapForCheck.currentStageId}`,
        confidence: 1,
      })
    );
  }

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

  // دقایق روزانه و گویش — در app_settings (جدول users این ستون‌ها را ندارد)
  await r.saveUserPrefs(user.id, {
    dailyMinutes: parsed.data.dailyMinutes ?? null,
    dialect: parsed.data.dialect ?? null,
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

  // دقایق روزانه و گویش ستون DB ندارند → در app_settings ذخیره می‌شوند
  const prefs: {
    dailyMinutes?: number | null;
    dialect?: string | null;
    reminderOn?: boolean | null;
    reminderTime?: string | null;
  } = {};
  if (d.dailyMinutes !== undefined) prefs.dailyMinutes = d.dailyMinutes;
  if (d.dialect !== undefined) prefs.dialect = d.dialect;
  if (d.reminderOn !== undefined) prefs.reminderOn = d.reminderOn;
  if (d.reminderTime !== undefined) prefs.reminderTime = d.reminderTime;
  if (Object.keys(prefs).length > 0) {
    await r.saveUserPrefs(user.id, prefs);
  }

  if (Object.keys(patch).length === 0 && Object.keys(prefs).length === 0) {
    return jsonSuccess({ updated: false }, requestId, env);
  }

  const updated = Object.keys(patch).length
    ? ((await r.updateUser(user.id, patch)) ?? user)
    : user;
  const subscription = await r.getActiveSubscription(user.id);
  const effective = await r.getUserPrefs(user.id);

  const profile = toUserProfile(updated, subscription, {
    isAdmin: isAdminFromEnv(env, telegramId),
  });
  profile.dailyMinutes = effective.dailyMinutes;
  profile.dialect = effective.dialect;
  profile.reminderOn = effective.reminderOn;
  profile.reminderTime = effective.reminderTime;

  /**
   * ⚠️ تغییر هدف ⇒ بازنگری رسمی نقشه.
   * بدون این، کاربر هدفش را عوض می‌کرد ولی مسیر قبلی سر جایش می‌ماند
   * (مرحلهٔ پایانی برای هدف قدیمی بود).
   */
  const goalChanged =
    d.learningGoal !== undefined && d.learningGoal !== user.learning_goal;
  if (goalChanged) {
    try {
      const existingMap = await r.getLearningMap(user.id);
      if (existingMap) {
        await r.saveLearningMap(
          user.id,
          reviseLearningMap(existingMap, {
            goal: d.learningGoal ?? 'DAILY',
            targetLanguage: String(updated.target_language ?? user.target_language),
            uiLanguage: String(updated.ui_language ?? user.ui_language ?? 'fa'),
            reason: 'کاربر هدف یادگیری را تغییر داد',
          })
        );
      }
    } catch {
      /* بازنگری نقشه best-effort است */
    }
  }

  return jsonSuccess({ updated: true, user: profile }, requestId, env);
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

  const lexical = await r.getLexicalItems(user.id, user.target_language);
  const completed = await r.listCompletedLessons(user.id);

  /**
   * ⚠️ باگ رفع‌شده: قبلاً تلمتری فقط از **چرخهٔ فعال** خوانده می‌شد و
   * `weeklyMinutes` هم همیشه صفر بود؛ نتیجه: «دقت ۰٪» و نمودار هفتگی خالی
   * حتی بعد از چند درس. حالا از کل ۳۰ روز و از روی `duration_seconds`
   * دروس تکمیل‌شده محاسبه می‌شود.
   */
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const telemetry = await r.getTelemetryForUserSince(user.id, since);

  const tz = ((user as { timezone?: string | null }).timezone ?? 'UTC') || 'UTC';
  const weekAgo = Date.now() - 7 * 86_400_000;
  const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
  for (const l of completed) {
    if (!l.completed_at) continue;
    const at = new Date(l.completed_at).getTime();
    if (!Number.isFinite(at) || at < weekAgo) continue;
    const idx = localWeekdayIndex(l.completed_at, tz);
    weeklyMinutes[idx] = (weeklyMinutes[idx] ?? 0) + Math.round((l.duration_seconds ?? 0) / 60);
  }

  const totalMinutes = Math.round(
    completed.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0) / 60
  );

  const dashboard = buildProgressDashboard({
    telemetry: telemetry.map((t) => ({
      event_type: t.event_type,
      is_correct: t.is_correct,
      response_ms: t.response_ms,
      pause_ms: t.pause_ms,
    })),
    lessonsCompleted: completed.length,
    lexical: lexical.map((l) => ({ ...l, repetitions: l.repetitions })),
    streakCount: user.streak_count,
    weeklyMinutes,
    totalMinutes,
  });

  // ── لیست واژه‌ها برای پاپ‌آپ پروفایل ────────────────────────────────
  const toEntry = (l: (typeof lexical)[number]) => ({
    term: l.term,
    meaning: l.meaning_fa ?? '',
    box: l.box,
    lapses: l.lapses,
    nextReviewAt: l.next_review_at ?? null,
  });
  dashboard.wordLists = {
    mastered: lexical.filter((l) => l.mastered).map(toEntry).slice(0, 200),
    learning: lexical.filter((l) => !l.mastered).map(toEntry).slice(0, 200),
  };

  // ── پیشرفت توانایی‌ها (چند درس از آستانه) ──────────────────────────
  const masteredCount = lexical.filter((l) => l.mastered).length;
  /**
   * ── پروفایل خطا و شاخص‌های کیفیت ─────────────────────────────────
   * ⚠️ همه از تلمتری ثبت‌شده محاسبه می‌شوند، نه از حدس.
   */
  const wrong = telemetry.filter((e) => e.event_type === 'ANSWER' && e.is_correct === false);
  const errorCounts = new Map<string, number>();
  for (const e of wrong) {
    const type = String((e.payload as { errorType?: unknown } | null)?.errorType ?? 'OTHER');
    errorCounts.set(type, (errorCounts.get(type) ?? 0) + 1);
  }
  dashboard.errorProfile = [...errorCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const correctAnswers = telemetry.filter(
    (e) => e.event_type === 'ANSWER' && e.is_correct === true
  );
  const helpedCorrect = correctAnswers.filter(
    (e) => (e.payload as { usedHint?: unknown } | null)?.usedHint === true
  ).length;
  dashboard.helpRatePct = correctAnswers.length
    ? Math.round((helpedCorrect / correctAnswers.length) * 100)
    : null;

  const delayed = telemetry.filter(
    (e) => e.event_type === 'ANSWER' && String(e.item_id ?? '').startsWith('delayed-')
  );
  dashboard.delayedRecallPct = delayed.length
    ? Math.round((delayed.filter((e) => e.is_correct).length / delayed.length) * 100)
    : null;

  /**
   * انتقال یادگیری: موفقیت در نقش‌آفرینی — یعنی «آموخته را در موقعیت
   * تازه به کار بردی»، نه تکرار مثال درس (مورد ۱۱.۴ / ۲۵.۳).
   */
  const transfer = telemetry.filter(
    (e) => e.event_type === 'ANSWER' && e.item_id === 'roleplay'
  );
  dashboard.transferPct = transfer.length
    ? Math.round((transfer.filter((e) => e.is_correct).length / transfer.length) * 100)
    : null;

  // تسلط تفکیشده به مهارت (از نقشه)
  try {
    const m = await r.getLearningMap(user.id);
    const sm = m?.skillMastery ?? {};
    dashboard.skillMastery = Object.entries(sm)
      .filter(([, v]) => v.total > 0)
      .map(([skill, v]) => ({
        skill,
        pct: Math.round((v.correct / v.total) * 100),
        total: v.total,
      }))
      .sort((a, b) => a.skill.localeCompare(b.skill));
  } catch {
    dashboard.skillMastery = [];
  }

  dashboard.skillProgress = [
    { key: 'greetings', current: completed.length, target: 7 },
    { key: 'hotel', current: completed.length, target: 14 },
    { key: 'directions', current: completed.length, target: 21 },
    { key: 'business', current: completed.length, target: 28 },
    { key: 'fluent', current: masteredCount, target: 60 },
  ];

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

  const debugMap = await r.getLearningMap(user.id);

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

  return jsonSuccess(
    {
      delta,
      weakTerms: delta.weakTerms as WeakTerm[],
      map: debugMap
        ? {
            version: debugMap.version,
            rulesVersion: debugMap.rulesVersion ?? null,
            currentStage: debugMap.currentStageId,
            stages: debugMap.stages.map((st) => ({
              id: st.id,
              status: st.status,
              criteria: st.criteria,
            })),
            violations: debugMap.violations.slice(-20),
          }
        : null,
      decisions: (debugMap?.decisions ?? []).slice(-30),
    },
    requestId,
    env
  );
}
