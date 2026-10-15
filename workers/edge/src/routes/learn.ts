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
import type {
  SkillDelta,
  WeakTerm,
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
  const activeCycle = await r.getActiveCycle(user.id);
  const generatingCycle = activeCycle ? null : await r.getGeneratingCycle(user.id);

  if (!activeCycle) {
    // ⚠️ چرا `generating` فقط برای GENERATING است: قبلاً هر چرخهٔ
    // GENERATING/FAILED باعث `generating: true` می‌شد و کاربر برای چرخهٔ
    //_FAILED_ تا ابد اسپینر می‌دید. حالا FAILED هم چرخه را با دلیل خطا
    // برمی‌گرداند تا UI پیام روشن بدهد.
    const isGenerating = generatingCycle?.status === 'GENERATING';
    const genLessons = generatingCycle
      ? await r.getLessonsForCycle(generatingCycle.id)
      : [];

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
  let currentReady =
    current && current.part_1_data && Object.keys(current.part_1_data as object).length > 0;

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
        currentReady =
          fresh.part_1_data && Object.keys(fresh.part_1_data as object).length > 0;
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

    // اولویت: Queue/Workflow (مسدودکننده نیست) → fallback inline
    const via = await scheduleCycleGeneration(context, user.id, nextNumber);
    nextCycleTriggered = true;
    generationDeferred = via.via;
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
const LESSON_CONTENT_VERSION = 2;

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
  const lesson1 = await ensureLessonContent(r, engine, cycleId, input, day1, outline, variant);
  if (!lesson1) {
    return { ok: false, error: 'day-1 generation failed' };
  }

  await r.fillLessonContent(cycleId, 1, lesson1, 'AVAILABLE');
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

/** تولید (یا خواندن از کش) محتوای یک روز */
async function ensureLessonContent(
  r: ContentRepository,
  engine: AiEngine,
  cycleId: string,
  input: CycleGenerationInput,
  day: OutlineDay,
  outline: CycleOutline,
  variant: number
): Promise<GeneratedLesson | null> {
  const key = `${cacheKeyFor(input, `d${day.dayNumber}:${day.kind}`, variant)}:c${LESSON_CONTENT_VERSION}`;
  const cached = (await r.getCachedContent('LESSON', key)) as GeneratedLesson | null;
  if (cached) return cached;

  const res = await engine.generateLesson(input, day, outline);
  await recordAttempts(r, cycleId, res.attempts);
  if (!res.lesson) return null;

  await r.putCachedContent('LESSON', key, input.user.targetLanguage, res.lesson);
  return res.lesson;
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

  const lesson = await ensureLessonContent(r, engine, cycleId, input, day, outline, variant);
  if (!lesson) return false;
  // روزهای بعدی LOCKED می‌مانند؛ منطق باز شدن روزها جداست
  await r.fillLessonContent(cycleId, day.dayNumber, lesson, 'LOCKED');
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
  const hasContent =
    target.part_1_data && Object.keys(target.part_1_data as object).length > 0;
  if (hasContent) return { ok: true };

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
  return ok ? { ok: true } : { ok: false, error: `day ${dayNumber} generation failed` };
}

async function markCycleFailed(  r: ContentRepository,
  cycleId: string,
  reason: string
): Promise<void> {
  await r['db'].update('cycles', { id: cycleId }, {
    status: 'FAILED',
    focus_summary: `Generation failed: ${reason.slice(0, 400)}`,
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
