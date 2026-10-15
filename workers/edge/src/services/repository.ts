import type {
  Cycle,
  CycleGenerationInput,
  CycleOutline,
  GeneratedCycle,
  GeneratedLesson,
  Lesson,
  LessonKind,
  Plan,
  PlanType,
  ProgressDashboard,
  SkillDelta,
  SubscriptionInfo,
  SubscriptionSource,
  UserProfile,
  AdminUserSummary,
  QualitativeSkill,
  TermCard,
} from '@kpanah/shared';
import {
  CYCLE_LENGTH_DAYS,
  PLAN_DURATION_DAYS,
  buildCycleDays,
  dayProfile,
  uiTitleOf,
  daysRemaining,
  evaluateAccess,
  lessonKindForDay,
  shouldGenerateNextCycle,
} from '@kpanah/shared';
import { SupabaseClient, SupabaseError } from './supabase';
import type { AiProviderRow } from './ai-engine';
import type { Env } from '../types';

/**
 * Data access layer. Every query the API needs lives here — routes stay
 * thin and the SQL shapes stay in one auditable place.
 */

// ── Row shapes (snake_case, as returned by PostgREST) ────────────────

export interface UserRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  ui_language: string | null;
  language_source: 'TELEGRAM' | 'MANUAL';
  target_language: string;
  skill_level: string;
  learning_goal: string | null;
  onboarding_done: boolean;
  timezone: string | null;
  streak_count: number;
  longest_streak: number;
  stars_balance: number;
  last_active_date: string | null;
  is_blocked: boolean;
  is_admin: boolean;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  source: SubscriptionSource;
  starts_at: string;
  expires_at: string;
  price_stars: number | null;
}

interface CycleRow {
  id: string;
  user_id: string;
  cycle_number: number;
  title: string;
  title_fa: string | null;
  focus_summary: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'GENERATING' | 'FAILED';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface LessonRow {
  id: string;
  cycle_id: string;
  user_id: string;
  day_number: number;
  title: string;
  title_fa: string | null;
  kind: LessonKind;
  /** هدف آموزشی روز (مرحلهٔ ۸) — migration 0010؛ در DB قدیمی ممکن است نباشد */
  objective?: string | null;
  objective_fa?: string | null;
  part_1_data: unknown;
  part_2_data: unknown;
  status: string;
  is_completed: boolean;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface PlanRow {
  id: string;
  plan_type: PlanType;
  title_fa: string;
  title_en: string;
  duration_days: number;
  price_irr: string | number;
  price_stars: number;
  discount_percent: number;
  badge: string | null;
  is_active: boolean;
  sort_order?: number;
}

/** ورودی ساخت/ویرایش پلن از پنل مدیر */
export interface PlanUpsertInput {
  id?: string;
  planType: string;
  titleFa: string;
  titleEn: string;
  durationDays: number;
  priceIrr: number;
  priceStars: number;
  discountPercent: number;
  badge?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface LexicalRow {
  term: string;
  box: number;
  ease: number;
  lapses: number;
  repetitions: number;
  success_count: number;
  fail_count: number;
  mastered: boolean;
}

// ═════════════════════════════════════════════════════════════════════
// Repository
// ═════════════════════════════════════════════════════════════════════

export class ContentRepository {
  constructor(
    private db: SupabaseClient,
    private env: Env
  ) {}

  // ── USERS ─────────────────────────────────────────────────────────

  async findUserByTelegramId(telegramId: number): Promise<UserRow | null> {
    try {
      const row = await this.db.select<UserRow>(
        'users',
        { telegram_id: `eq.${telegramId}`, select: '*' },
        { single: true }
      );
      return (row as UserRow | null) ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound) return null;
      throw err;
    }
  }

  async findUserById(id: string): Promise<UserRow | null> {
    try {
      const row = await this.db.select<UserRow>(
        'users',
        { id: `eq.${id}`, select: '*' },
        { single: true }
      );
      return (row as UserRow | null) ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound) return null;
      throw err;
    }
  }

  async upsertUser(input: {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    uiLanguage: string;
    languageSource: 'TELEGRAM' | 'MANUAL';
  }): Promise<UserRow> {
    // اول تلاش برای خواندن — تا بتوانیم فقط فیلدهای لازم را آپدیت کنیم
    const existing = await this.findUserByTelegramId(input.telegramId);

    if (existing) {
      const patch: Record<string, unknown> = {
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        username: input.username ?? null,
        photo_url: input.photoUrl ?? null,
      };
      // زبان را فقط اگر کاربر دستی انتخاب نکرده باشد از تلگرام می‌گیریم
      if (existing.language_source === 'TELEGRAM') {
        patch.ui_language = input.uiLanguage;
      }
      return (await this.db.update<UserRow>(
        'users',
        { id: existing.id },
        patch,
        { single: true }
      ))!;
    }

    const created = await this.db.insert<UserRow>('users', {
      telegram_id: input.telegramId,
      first_name: input.firstName,
      last_name: input.lastName ?? null,
      username: input.username ?? null,
      photo_url: input.photoUrl ?? null,
      ui_language: input.uiLanguage,
      language_source: input.languageSource,
      skill_level: 'ZERO',
      onboarding_done: false,
    });

    return created as UserRow;
  }

  async updateUser(
    userId: string,
    patch: Record<string, unknown>
  ): Promise<UserRow | null> {
    return this.db.update<UserRow>('users', { id: userId }, patch, { single: true });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete('users', { id: userId });
  }

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────

  async getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db.select<SubscriptionRow>('subscriptions', {
      user_id: `eq.${userId}`,
      status: 'eq.ACTIVE',
      expires_at: `gt.${new Date().toISOString()}`,
      order: 'expires_at.desc',
      limit: '1',
      select: '*',
    });
    return (rows as SubscriptionRow[])[0] ?? null;
  }

  async getLatestSubscription(userId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db.select<SubscriptionRow>('subscriptions', {
      user_id: `eq.${userId}`,
      order: 'created_at.desc',
      limit: '1',
      select: '*',
    });
    return (rows as SubscriptionRow[])[0] ?? null;
  }

  async createSubscription(input: {
    userId: string;
    planType: PlanType;
    source: SubscriptionSource;
    startsAt?: Date;
    expiresAt?: Date;
    grantedBy?: string | null;
    grantNote?: string | null;
    priceStars?: number | null;
    paymentRef?: string | null;
    /** اگر true باشد، به انتهای اشتراک فعال فعلی اضافه می‌شود */
    extend?: boolean;
  }): Promise<SubscriptionRow> {
    const now = new Date();
    let startsAt = input.startsAt ?? now;

    if (input.extend) {
      const active = await this.getActiveSubscription(input.userId);
      if (active && new Date(active.expires_at) > startsAt) {
        startsAt = new Date(active.expires_at);
      }
    }

    const expiresAt =
      input.expiresAt ??
      addDays(startsAt, PLAN_DURATION_DAYS[input.planType] ?? 30);

    const created = await this.db.insert<SubscriptionRow>('subscriptions', {
      user_id: input.userId,
      plan_type: input.planType,
      status: 'ACTIVE',
      source: input.source,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      granted_by: input.grantedBy ?? null,
      grant_note: input.grantNote ?? null,
      price_stars: input.priceStars ?? null,
      payment_ref: input.paymentRef ?? null,
    });

    return created as SubscriptionRow;
  }

  async expireSubscription(subscriptionId: string): Promise<void> {
    await this.db.update('subscriptions', { id: subscriptionId }, { status: 'EXPIRED' });
  }

  // ── کارهای زمان‌بندی‌شده (Cron) ───────────────────────────────────

  /** اشتراک‌های ACTIVE که مهلتشان گذشته — برای انقضای دسته‌ای */
  async listOverdueSubscriptions(limit = 200): Promise<{ id: string; user_id: string }[]> {
    try {
      const rows = await this.db.select<{ id: string; user_id: string }>('subscriptions', {
        select: 'id,user_id',
        status: 'eq.ACTIVE',
        expires_at: `lt.${new Date().toISOString()}`,
        limit: String(limit),
      });
      return asRows(rows);
    } catch {
      return [];
    }
  }

  /** انقضای دسته‌ای اشتراک‌ها */
  async expireSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.update('subscriptions', { id: `in.(${ids.join(',')})` }, {
      status: 'EXPIRED',
    });
  }

  /** چرخه‌های GENERATING که هنوز هیچ درسی ندارند (تولید نیمه‌کاره) */
  async listGeneratingCyclesWithoutLessons(
    limit = 5
  ): Promise<{ id: string; user_id: string; cycle_number: number }[]> {
    try {
      const cycles = await this.db.select<{ id: string; user_id: string; cycle_number: number }>(
        'cycles',
        { select: 'id,user_id,cycle_number', status: 'eq.GENERATING', limit: String(limit * 4) }
      );
      const rows = asRows(cycles);
      const out: { id: string; user_id: string; cycle_number: number }[] = [];
      for (const c of rows) {
        const lessons = await this.db.select<{ id: string }>('lessons', {
          select: 'id',
          cycle_id: `eq.${c.id}`,
          limit: '1',
        });
        if (asRows(lessons).length === 0) out.push(c);
        if (out.length >= limit) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  /**
   * درس‌هایی که محتوایشان خالی است (`part_1_data = {}`) — یعنی در تولید
   * ماژولار هنوز ساخته نشده‌اند. کرون این‌ها را از قبل می‌سازد تا کاربر
   * انتظار نکشد.
   */
  async listLessonsMissingContent(
    limit = 4
  ): Promise<
    { id: string; cycle_id: string; user_id: string; day_number: number; cycle_number: number }[]
  > {
    try {
      const rows = await this.db.select<{
        id: string;
        cycle_id: string;
        user_id: string;
        day_number: number;
      }>('lessons', {
        select: 'id,cycle_id,user_id,day_number',
        part_1_data: 'eq.{}',
        order: 'day_number.asc',
        limit: String(limit),
      });
      const out: {
        id: string;
        cycle_id: string;
        user_id: string;
        day_number: number;
        cycle_number: number;
      }[] = [];
      for (const l of asRows(rows)) {
        const cycle = await this.getCycleById(l.cycle_id);
        if (!cycle) continue;
        out.push({ ...l, cycle_number: cycle.cycle_number });
      }
      return out;
    } catch {
      return [];
    }
  }

  /** کاربران فعال برای یادآور روزانه (اشتراک/دورهٔ آزمایشی معتبر) */
  async listReminderTargets(
    limit = 500
  ): Promise<{ telegram_id: number; first_name: string | null; ui_language: string | null }[]> {
    try {
      const rows = await this.db.select<{
        telegram_id: number;
        first_name: string | null;
        ui_language: string | null;
      }>('users', {
        select: 'telegram_id,first_name,ui_language',
        is_blocked: 'eq.false',
        order: 'created_at.desc',
        limit: String(limit),
      });
      return asRows(rows);
    } catch {
      return [];
    }
  }

  // ── CYCLES ────────────────────────────────────────────────────────

  async getActiveCycle(userId: string): Promise<CycleRow | null> {
    const rows = await this.db.select<CycleRow>('cycles', {
      user_id: `eq.${userId}`,
      status: 'eq.ACTIVE',
      order: 'cycle_number.desc',
      limit: '1',
      select: '*',
    });
    return (rows as CycleRow[])[0] ?? null;
  }

  async getGeneratingCycle(userId: string): Promise<CycleRow | null> {
    const rows = await this.db.select<CycleRow>('cycles', {
      user_id: `eq.${userId}`,
      status: 'in.(GENERATING,FAILED)',
      order: 'cycle_number.desc',
      limit: '1',
      select: '*',
    });
    return (rows as CycleRow[])[0] ?? null;
  }

  /**
   * چرخه‌های FAILED که بیش از `minAgeMs` از شکست آن‌ها گذشته — برای تلاش
   * دوبارهٔ کرون. `updated_at` به‌عنوان زمان آخرین تغییر استفاده می‌شود تا
   * اگر همین حالا هم شکسته باشد، هر ۵ دقیقه دوباره امتحان نشود.
   */
  async listFailedCyclesForRetry(
    minAgeMs: number,
    limit = 1
  ): Promise<
    { id: string; user_id: string; cycle_number: number; focus_summary: string | null }[]
  > {
    const cutoff = new Date(Date.now() - minAgeMs).toISOString();
    try {
      const rows = await this.db.select<CycleRow>('cycles', {
        status: 'eq.FAILED',
        order: 'updated_at.asc',
        limit: String(limit),
        select: 'id,user_id,cycle_number,focus_summary,updated_at',
      });
      return (rows as unknown as Record<string, unknown>[])
        .filter((c) => String(c.updated_at ?? '') < cutoff)
        .slice(0, limit) as never;
    } catch {
      return [];
    }
  }

  async getLatestCycle(userId: string): Promise<CycleRow | null> {
    const rows = await this.db.select<CycleRow>('cycles', {
      user_id: `eq.${userId}`,
      order: 'cycle_number.desc',
      limit: '1',
      select: '*',
    });
    return (rows as CycleRow[])[0] ?? null;
  }

  async getCycleById(cycleId: string): Promise<CycleRow | null> {
    try {
      const row = await this.db.select<CycleRow>(
        'cycles',
        { id: `eq.${cycleId}`, select: '*' },
        { single: true }
      );
      return (row as CycleRow | null) ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound) return null;
      throw err;
    }
  }

  async createGeneratingCycle(
    userId: string,
    cycleNumber: number
  ): Promise<CycleRow> {
    const created = await this.db.insert<CycleRow>('cycles', {
      user_id: userId,
      cycle_number: cycleNumber,
      title: `Cycle ${cycleNumber}`,
      status: 'GENERATING',
    });
    return created as CycleRow;
  }

  /**
   * نوشتن چرخه تولیدشده + ۷ درس آن به‌صورت اتمی‌نما.
   * اگر درس‌ها fail شود، چرخه به FAILED می‌رود.
   */
  // ── تولید ماژولار ─────────────────────────────────────────────────
  // outline → روز ۱ → بقیه در پس‌زمینه

  /**
   * نوشتن «نقشهٔ» چرخه + ۷ ردیف درس خالی.
   *
   * محتوای part_1/part_2 عمداً `{}` است تا بعداً `fillLessonContent` پرشان
   * کند (ستون‌ها NOT NULL هستند). چرخه در وضعیت GENERATING می‌ماند تا روز ۱
   * آماده شود.
   */
  async persistCycleOutline(
    cycleId: string,
    outline: CycleOutline,
    meta: { model: string; ms: number; input: CycleGenerationInput }
  ): Promise<void> {
    await this.db.update('cycles', { id: cycleId }, {
      title: outline.title,
      title_fa: uiTitleOf(outline),
      focus_summary: outline.focusSummary,
      status: 'GENERATING',
      started_at: new Date().toISOString(),
      generated_from: meta.input.delta as unknown as Record<string, unknown>,
      generation_model: meta.model,
      generation_ms: meta.ms,
    });

    const cycle = await this.getCycleById(cycleId);
    if (!cycle) throw new Error(`Cycle ${cycleId} vanished after outline update`);

    const rows = outline.days.map((d) => ({
      cycle_id: cycleId,
      user_id: cycle.user_id,
      day_number: d.dayNumber,
      title: d.title,
      title_fa: uiTitleOf(d),
      kind: d.kind,
      // مرحلهٔ ۸ — هدف آموزشی روز (برای تولید پس‌زمینهٔ همان روز)
      objective: d.objective ?? dayProfile(d.dayNumber).objective,
      objective_fa: d.objectiveFa ?? dayProfile(d.dayNumber).objectiveFa,
      part_1_data: {} as Record<string, unknown>,
      part_2_data: {} as Record<string, unknown>,
      status: 'LOCKED',
      is_completed: false,
    }));

    // upsert تا اجرای دوباره (retry) خطای unique ندهد
    await this.db.insert('lessons', rows, { upsertOn: 'cycle_id,day_number' });
  }

  /** پر کردن محتوای یک روز (بعد از تولید) */
  async fillLessonContent(
    cycleId: string,
    dayNumber: number,
    lesson: GeneratedLesson,
    status: 'LOCKED' | 'AVAILABLE'
  ): Promise<void> {
    await this.db.update(
      'lessons',
      { cycle_id: `eq.${cycleId}`, day_number: `eq.${dayNumber}` },
      {
        title: lesson.title,
        title_fa: lesson.titleFa,
        kind: lesson.kind,
        part_1_data: lesson.part1 as unknown as Record<string, unknown>,
        part_2_data: lesson.part2 as unknown as Record<string, unknown>,
        status,
      }
    );
  }

  /** چرخه را فعال کن (بعد از آماده شدن روز ۱) */
  async activateCycle(cycleId: string): Promise<void> {
    await this.db.update('cycles', { id: cycleId }, { status: 'ACTIVE' });
  }

  /** چرخه را FAILED کن (وقتی هیچ روزی تولید نشد) */
  async failCycle(cycleId: string): Promise<void> {
    await this.db.update('cycles', { id: cycleId }, { status: 'FAILED' });
  }

  async getLessonByCycleDay(cycleId: string, dayNumber: number): Promise<LessonRow | null> {
    const rows = await this.db.select<LessonRow>('lessons', {
      cycle_id: `eq.${cycleId}`,
      day_number: `eq.${dayNumber}`,
      limit: '1',
      select: '*',
    });
    return (rows as LessonRow[])[0] ?? null;
  }

  // ── LESSONS ───────────────────────────────────────────────────────

  async getLessonsForCycle(cycleId: string): Promise<LessonRow[]> {
    const rows = await this.db.select<LessonRow>('lessons', {
      cycle_id: `eq.${cycleId}`,
      order: 'day_number.asc',
      select: '*',
    });
    return (rows as LessonRow[]) ?? [];
  }

  async getLessonById(lessonId: string): Promise<LessonRow | null> {
    try {
      const row = await this.db.select<LessonRow>(
        'lessons',
        { id: `eq.${lessonId}`, select: '*' },
        { single: true }
      );
      return (row as LessonRow | null) ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound) return null;
      throw err;
    }
  }

  /** درس جاری قابل انجام = اولین درس تکمیل‌نشده */
  async getCurrentLesson(userId: string): Promise<{ cycle: CycleRow; lesson: LessonRow } | null> {
    const cycle = await this.getActiveCycle(userId);
    if (!cycle) return null;

    const lessons = await this.getLessonsForCycle(cycle.id);
    const next = lessons.find((l) => !l.is_completed);
    if (!next) return null;

    return { cycle, lesson: next };
  }

  async completeLesson(
    lessonId: string,
    patch: { durationSeconds: number; status?: string }
  ): Promise<void> {
    await this.db.update('lessons', { id: lessonId }, {
      is_completed: true,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      duration_seconds: patch.durationSeconds,
    });
  }

  /** آزادسازی درس بعدی پس از تکمیل */
  async unlockNextLesson(cycleId: string, completedDay: number): Promise<void> {
    if (completedDay >= CYCLE_LENGTH_DAYS) return;
    const lessons = await this.getLessonsForCycle(cycleId);
    const next = lessons.find((l) => l.day_number === completedDay + 1);
    if (next && !next.is_completed) {
      await this.db.update('lessons', { id: next.id }, { status: 'AVAILABLE' });
    }
  }

  async markCycleCompleted(cycleId: string): Promise<void> {
    await this.db.update('cycles', { id: cycleId }, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });
  }

  // ── TELEMETRY ────────────────────────────────────────────────────

  async insertTelemetry(
    rows: Record<string, unknown>[]
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db.insert('telemetry_events', rows);
  }

  async getTelemetryForCycle(cycleId: string): Promise<{
    event_type: string;
    item_id: string | null;
    is_correct: boolean | null;
    response_ms: number | null;
    pause_ms: number | null;
  }[]> {
    const rows = await this.db.select<{
      event_type: string;
      item_id: string | null;
      is_correct: boolean | null;
      response_ms: number | null;
      pause_ms: number | null;
    }>('telemetry_events', {
      cycle_id: `eq.${cycleId}`,
      select: 'event_type,item_id,is_correct,response_ms,pause_ms',
      limit: '5000',
    });
    return (rows as never[]) ?? [];
  }

  // ── LEXICAL (Leitner) ────────────────────────────────────────────

  async getLexicalItems(userId: string, targetLanguage: string): Promise<LexicalRow[]> {
    const rows = await this.db.select<LexicalRow>('lexical_items', {
      user_id: `eq.${userId}`,
      target_language: `eq.${targetLanguage}`,
      select: 'term,box,ease,lapses,repetitions,success_count,fail_count,mastered',
      limit: '2000',
    });
    return (rows as LexicalRow[]) ?? [];
  }

  async upsertLexicalItem(
    userId: string,
    targetLanguage: string,
    item: {
      term: string;
      meaning?: string;
      example?: string;
      box: number;
      ease: number;
      repetitions: number;
      lapses: number;
      intervalDays: number;
      mastered: boolean;
      successCount: number;
      failCount: number;
      nextReviewAt: string;
    }
  ): Promise<void> {
    await this.db.insert(
      'lexical_items',
      {
        user_id: userId,
        target_language: targetLanguage,
        term: item.term,
        meaning_fa: item.meaning ?? null,
        example: item.example ?? null,
        box: item.box,
        ease: item.ease,
        repetitions: item.repetitions,
        lapses: item.lapses,
        interval_days: item.intervalDays,
        mastered: item.mastered,
        success_count: item.successCount,
        fail_count: item.failCount,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: item.nextReviewAt,
      },
      { upsertOn: 'user_id,target_language,term', returning: false }
    );
  }

  // ── PLANS ────────────────────────────────────────────────────────

  async getPlans(): Promise<Plan[]> {
    const rows = await this.db.select<PlanRow>('plans', {
      is_active: 'eq.true',
      order: 'sort_order.asc',
      select: '*',
    });

    return ((rows as PlanRow[]) ?? []).map(toPlanDto);
  }

  // ── CRUD پلن‌ها (پنل مدیر) ────────────────────────────────────────

  /** همهٔ پلن‌ها — شامل غیرفعال‌ها (فقط برای پنل مدیر) */
  async listAllPlans(): Promise<Plan[]> {
    const rows = await this.db.select<PlanRow>('plans', {
      order: 'sort_order.asc',
      select: '*',
    });
    return ((rows as PlanRow[]) ?? []).map(toPlanDto);
  }

  async createPlan(input: PlanUpsertInput): Promise<Plan> {
    const id = input.id?.trim() || input.planType.toLowerCase();
    const rows = await this.db.insert<PlanRow>('plans', {
      id,
      plan_type: input.planType,
      title_fa: input.titleFa,
      title_en: input.titleEn,
      duration_days: input.durationDays,
      price_irr: input.priceIrr,
      price_stars: input.priceStars,
      discount_percent: input.discountPercent,
      badge: input.badge ?? null,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 100,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error('createPlan returned no row');
    return toPlanDto(row);
  }

  async updatePlan(id: string, input: PlanUpsertInput): Promise<Plan> {
    const patch: Record<string, unknown> = {
      plan_type: input.planType,
      title_fa: input.titleFa,
      title_en: input.titleEn,
      duration_days: input.durationDays,
      price_irr: input.priceIrr,
      price_stars: input.priceStars,
      discount_percent: input.discountPercent,
      badge: input.badge ?? null,
    };
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    const row = await this.db.update<PlanRow>('plans', { id }, patch, { single: true });
    if (!row) throw new Error('updatePlan found no row');
    return toPlanDto(row);
  }

  async deletePlan(id: string): Promise<void> {
    await this.db.delete('plans', { id });
  }

  async getPlanById(planId: string): Promise<PlanRow | null> {
    try {
      const row = await this.db.select<PlanRow>(
        'plans',
        { id: `eq.${planId}`, select: '*' },
        { single: true }
      );
      return (row as PlanRow | null) ?? null;
    } catch (err) {
      if (err instanceof SupabaseError && err.isNotFound) return null;
      throw err;
    }
  }

  // ── STAR TRANSACTIONS ────────────────────────────────────────────

  async recordStarPayment(input: {
    userId: string;
    subscriptionId: string;
    telegramChargeId: string;
    providerChargeId?: string;
    amountStars: number;
    planType: PlanType;
    rawPayload: unknown;
  }): Promise<boolean> {
    try {
      await this.db.insert('star_transactions', {
        user_id: input.userId,
        subscription_id: input.subscriptionId,
        telegram_charge_id: input.telegramChargeId,
        provider_charge_id: input.providerChargeId ?? null,
        amount_stars: input.amountStars,
        plan_type: input.planType,
        currency: 'XTR',
        raw_payload: input.rawPayload as Record<string, unknown>,
      });
      return true;
    } catch (err) {
      // 23505 = unique violation → پرداخت تکراری (idempotent)
      if (err instanceof SupabaseError && err.isConflict) return false;
      throw err;
    }
  }

  async findStarTransactionByChargeId(chargeId: string): Promise<{ id: string } | null> {
    const rows = await this.db.select<{ id: string }>('star_transactions', {
      telegram_charge_id: `eq.${chargeId}`,
      select: 'id',
      limit: '1',
    });
    return (rows as { id: string }[])[0] ?? null;
  }

  // ── ADMIN ────────────────────────────────────────────────────────

  async listUsersForAdmin(limit: number, offset: number, search?: string): Promise<AdminUserSummary[]> {
    const query: Record<string, string> = {
      order: 'created_at.desc',
      limit: String(limit),
      offset: String(offset),
      select: 'id,telegram_id,first_name,last_name,username,ui_language,skill_level,streak_count,created_at',
    };
    if (search) {
      const term = search.replace(/[%,]/g, '');
      if (/^\d+$/.test(term)) {
        query.telegram_id = `eq.${term}`;
      } else {
        query.or = `(username.ilike.*${term}*,first_name.ilike.*${term}*)`;
      }
    }

    const rows = await this.db.select<UserRow>('users', query);
    const users = (rows as UserRow[]) ?? [];

    return Promise.all(
      users.map(async (u) => {
        const sub = await this.getActiveSubscription(u.id);
        const cycle = await this.getActiveCycle(u.id);
        return {
          id: u.id,
          telegramId: u.telegram_id,
          displayName: [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
          username: u.username,
          uiLanguage: u.ui_language ?? 'fa',
          skillLevel: u.skill_level as AdminUserSummary['skillLevel'],
          planType: sub?.plan_type ?? null,
          daysRemaining: sub ? daysRemaining(new Date(sub.expires_at)) : 0,
          streakCount: u.streak_count,
          cycleNumber: cycle?.cycle_number ?? null,
          createdAt: u.created_at,
        };
      })
    );
  }

  async logAdminGrant(input: {
    adminUserId: string;
    targetUserId: string;
    subscriptionId: string;
    action: 'GIFT' | 'REVOKE' | 'EXTEND' | 'DOWNGRADE';
    planType?: PlanType;
    daysDelta?: number;
    note?: string;
  }): Promise<void> {
    await this.db.insert('admin_grants', {
      admin_user_id: input.adminUserId,
      target_user_id: input.targetUserId,
      subscription_id: input.subscriptionId,
      action: input.action,
      plan_type: input.planType ?? null,
      days_delta: input.daysDelta ?? null,
      note: input.note ?? null,
    });
  }

  async adminStats(): Promise<{
    totalUsers: number;
    activeSubscriptions: number;
    trialsActive: number;
    receiptsPending: number;
  }> {
    const now = new Date().toISOString();
    const [totalUsers, activeSubscriptions, receiptsPending] = await Promise.all([
      this.db.count('users'),
      this.db.count('subscriptions', { status: 'eq.ACTIVE', expires_at: `gt.${now}` }),
      this.db.count('payment_receipts', { status: 'eq.PENDING' }),
    ]);

    return {
      totalUsers,
      activeSubscriptions,
      trialsActive: 0,
      receiptsPending,
    };
  }

  // ── SETTINGS ─────────────────────────────────────────────────────

  async getSetting<T>(key: string): Promise<T | null> {
    try {
      const row = await this.db.select<{ value: T }>(
        'app_settings',
        { key: `eq.${key}`, select: 'value' },
        { single: true }
      );
      return (row as { value: T } | null)?.value ?? null;
    } catch {
      return null;
    }
  }

  // ── AI PROVIDERS ─────────────────────────────────────────────────
  //
  // The admin panel owns this table. Ordering is applied in the engine
  // (see resolveProviderChain) so a single rule governs both the UI list
  // and the actual failover chain.

  /** Active providers, ordered. Used by the engine on every generation. */
  async listActiveAiProviders(): Promise<AiProviderRow[]> {
    try {
      const rows = await this.db.select<AiProviderRow>('ai_providers', {
        is_active: 'eq.true',
        select: '*',
        order: 'priority.asc,created_at.asc',
      });
      return rows as AiProviderRow[];
    } catch {
      return [];
    }
  }

  /** Every provider regardless of state, for the admin panel. */
  async listAllAiProviders(): Promise<AiProviderRow[]> {
    try {
      const rows = await this.db.select<AiProviderRow>('ai_providers', {
        select: '*',
        order: 'priority.asc,created_at.asc',
      });
      return rows as AiProviderRow[];
    } catch {
      return [];
    }
  }

  async createAiProvider(input: {
    label: string;
    protocol: string;
    /** دستهٔ provider: TEXT | TTS | STT (مِیگرشن ۰۰۱۱) */
    kind?: string;
    vendor: string;
    model: string;
    baseUrl: string | null;
    apiKeyEncrypted: string;
    keyHint: string;
    priority: number;
    isActive: boolean;
    temperature: number | null;
    maxOutputTokens: number | null;
    supportsJsonSchema: boolean;
    note: string | null;
  }): Promise<AiProviderRow | null> {
    // ⚠️ `db.insert` برای یک شیء، خودِ ردیف را برمی‌گرداند (نه آرایه).
    // قبلاً اینجا `[0]` هم می‌گرفتیم → همیشه undefined → null → خطای ۵۰۰
    // «Could not save provider» در حالی که ردیف در DB ساخته شده بود.
    const row = await this.db.insert<AiProviderRow>('ai_providers', {
      label: input.label,
      protocol: input.protocol,
      kind: input.kind ?? 'TEXT',
      vendor: input.vendor,
      model: input.model,
      base_url: input.baseUrl,
      api_key_encrypted: input.apiKeyEncrypted,
      key_hint: input.keyHint,
      priority: input.priority,
      is_active: input.isActive,
      temperature: input.temperature,
      max_output_tokens: input.maxOutputTokens,
      supports_json_schema: input.supportsJsonSchema,
      note: input.note,
    });
    return (row as AiProviderRow | null) ?? null;
  }

  /**
   * Partial update. `apiKeyEncrypted` is only present when the admin pasted a
   * new key — omitting it leaves the stored one untouched, which is what the
   * UI expects when you edit a label without re-entering the secret.
   */
  async updateAiProvider(
    id: string,
    patch: Record<string, unknown>
  ): Promise<AiProviderRow | null> {
    const row = await this.db.update<AiProviderRow>(
      'ai_providers',
      { id: `eq.${id}` },
      patch
    );
    return row ?? null;
  }

  async deleteAiProvider(id: string): Promise<void> {
    await this.db.delete('ai_providers', { id: `eq.${id}` });
  }

  async getAiProviderById(id: string): Promise<AiProviderRow | null> {
    try {
      const row = await this.db.select<AiProviderRow>(
        'ai_providers',
        { id: `eq.${id}`, select: '*' },
        { single: true }
      );
      return (row as AiProviderRow | null) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Record the outcome of one provider attempt and roll the health counters.
   *
   * A success clears the consecutive-failure streak (a provider that recovers
   * should stop looking "failing"); a failure increments it. The status band
   * is derived from that streak so the panel shows at-a-glance state without
   * the engine having to store a separate flag.
   */
  async recordProviderOutcome(input: {
    cycleId: string | null;
    providerId: string | null;
    providerLabel: string;
    model: string;
    attemptNo: number;
    phase: 'initial' | 'repair';
    ok: boolean;
    latencyMs: number;
    error?: string;
    tokensUsed?: number;
    consecutiveFailures?: number;
    totalSuccesses?: number;
    totalFailures?: number;
  }): Promise<void> {
    // Audit row — best effort, never blocks generation.
    try {
      await this.db.insert('ai_attempt_log', {
        cycle_id: input.cycleId,
        provider_id: input.providerId,
        provider_label: input.providerLabel,
        model: input.model,
        attempt_no: input.attemptNo,
        phase: input.phase,
        ok: input.ok,
        latency_ms: input.latencyMs,
        error: input.error ?? null,
        tokens_used: input.tokensUsed ?? null,
      });
    } catch {
      /* audit is advisory */
    }

    if (!input.providerId) return;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = input.ok
      ? {
          health_status: 'healthy',
          last_success_at: now,
          consecutive_failures: 0,
          total_successes: input.totalSuccesses ?? 0,
          avg_latency_ms: input.latencyMs,
        }
      : {
          last_failure_at: now,
          last_error: input.error ?? 'unknown error',
          consecutive_failures: input.consecutiveFailures ?? 0,
          total_failures: input.totalFailures ?? 0,
        };

    if (!input.ok) {
      const streak = input.consecutiveFailures ?? 0;
      patch.health_status = streak >= 5 ? 'failing' : streak >= 2 ? 'degraded' : 'unknown';
    }

    try {
      await this.db.update('ai_providers', { id: `eq.${input.providerId}` }, patch);
    } catch {
      /* health is advisory */
    }
  }

  /** Recent failover history for the admin panel. */
  async listAiAttempts(limit = 50): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.db.select<Record<string, unknown>>('ai_attempt_log', {
        select: '*',
        order: 'created_at.desc',
        limit: String(limit),
      });
      return rows as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // پشتیبانی (تیکت‌ها)
  // ───────────────────────────────────────────────────────────────────

  async createSupportTicket(input: {
    userId: string;
    telegramId: number;
    subject: string;
    category: string;
    body: string;
  }): Promise<Record<string, unknown>> {
    const ticket = await this.db.insert<Record<string, unknown>>('support_tickets', {
      user_id: input.userId,
      telegram_id: input.telegramId,
      subject: input.subject,
      category: input.category,
      status: 'OPEN',
      last_message: input.body.slice(0, 200),
      last_at: new Date().toISOString(),
      unread_for_user: false,
      unread_for_admin: true,
    });

    const row = Array.isArray(ticket) ? ticket[0] : ticket;
    const ticketId = (row as { id?: string })?.id;
    if (ticketId) {
      await this.db.insert('support_messages', {
        ticket_id: ticketId,
        author: 'USER',
        body: input.body,
      });
    }
    return (row as Record<string, unknown>) ?? {};
  }

  async listSupportTickets(userId: string): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.db.select<Record<string, unknown>>('support_tickets', {
        select: '*',
        user_id: `eq.${userId}`,
        order: 'last_at.desc',
        limit: '50',
      });
      return asRows(rows);
    } catch {
      return [];
    }
  }

  async getSupportThread(
    ticketId: string,
    userId: string
  ): Promise<{ ticket: Record<string, unknown>; messages: Record<string, unknown>[] } | null> {
    const ticketRows = asRows(
      await this.db.select<Record<string, unknown>>('support_tickets', {
        select: '*',
        id: `eq.${ticketId}`,
        user_id: `eq.${userId}`,
        limit: '1',
      })
    );
    const ticket = ticketRows[0];
    if (!ticket) return null;

    const messages = asRows(
      await this.db.select<Record<string, unknown>>('support_messages', {
        select: '*',
        ticket_id: `eq.${ticketId}`,
        order: 'created_at.asc',
        limit: '200',
      })
    );
    return { ticket, messages };
  }

  async addSupportMessage(input: {
    ticketId: string;
    userId: string;
    author: 'USER' | 'ADMIN';
    authorRole?: string | null;
    body: string;
  }): Promise<boolean> {
    // برای پیام کاربر، مالکیت تیکت بررسی می‌شود
    if (input.author === 'USER') {
      const owned = asRows(
        await this.db.select<Record<string, unknown>>('support_tickets', {
          select: 'id',
          id: `eq.${input.ticketId}`,
          user_id: `eq.${input.userId}`,
          limit: '1',
        })
      );
      if (!owned[0]) return false;
    }

    await this.db.insert('support_messages', {
      ticket_id: input.ticketId,
      author: input.author,
      author_role: input.authorRole ?? null,
      body: input.body,
    });

    await this.db.update(
      'support_tickets',
      { id: `eq.${input.ticketId}` },
      {
        last_message: input.body.slice(0, 200),
        last_at: new Date().toISOString(),
        status: input.author === 'ADMIN' ? 'ANSWERED' : 'OPEN',
        unread_for_user: input.author === 'ADMIN',
        unread_for_admin: input.author === 'USER',
      }
    );
    return true;
  }

  async closeSupportTicket(ticketId: string, userId: string): Promise<void> {
    await this.db.update(
      'support_tickets',
      { id: `eq.${ticketId}`, user_id: `eq.${userId}` },
      { status: 'CLOSED', updated_at: new Date().toISOString() }
    );
  }

  /** برای پنل ادمین — همهٔ تیکت‌ها با فیلتر اختیاری دسته/وضعیت */
  async listAllSupportTickets(filter?: {
    category?: string;
    status?: string;
  }): Promise<Record<string, unknown>[]> {
    try {
      const q: Record<string, string> = { select: '*', order: 'last_at.desc', limit: '100' };
      if (filter?.category) q.category = `eq.${filter.category}`;
      if (filter?.status) q.status = `eq.${filter.status}`;
      const rows = await this.db.select<Record<string, unknown>>('support_tickets', q);
      return asRows(rows);
    } catch {
      return [];
    }
  }

  async getSupportThreadAdmin(
    ticketId: string
  ): Promise<{ ticket: Record<string, unknown>; messages: Record<string, unknown>[] } | null> {
    const ticketRows = asRows(
      await this.db.select<Record<string, unknown>>('support_tickets', {
        select: '*',
        id: `eq.${ticketId}`,
        limit: '1',
      })
    );
    const ticket = ticketRows[0];
    if (!ticket) return null;
    const messages = asRows(
      await this.db.select<Record<string, unknown>>('support_messages', {
        select: '*',
        ticket_id: `eq.${ticketId}`,
        order: 'created_at.asc',
        limit: '200',
      })
    );
    return { ticket, messages };
  }

  // ───────────────────────────────────────────────────────────────────
  // کش محتوا (صرفه‌جویی توکن)
  // ───────────────────────────────────────────────────────────────────

  async getCachedContent(kind: string, cacheKey: string): Promise<unknown | null> {
    try {
      const rows = asRows(
        await this.db.select<Record<string, unknown>>('content_cache', {
          select: 'payload',
          kind: `eq.${kind}`,
          cache_key: `eq.${cacheKey}`,
          limit: '1',
        })
      );
      const row = rows[0];
      if (!row) return null;
      // شمارندهٔ استفاده را بی‌صدا بالا ببر
      this.db
        .update(
          'content_cache',
          { kind: `eq.${kind}`, cache_key: `eq.${cacheKey}` },
          { last_used_at: new Date().toISOString() }
        )
        .catch(() => {});
      return row.payload ?? null;
    } catch {
      return null;
    }
  }

  async putCachedContent(
    kind: string,
    cacheKey: string,
    language: string,
    payload: unknown
  ): Promise<void> {
    try {
      await this.db.insert('content_cache', {
        kind,
        cache_key: cacheKey,
        language,
        payload,
      });
    } catch {
      /* کش اختیاری است */
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // مدیریت نقش‌های ادمین (RBAC)
  // ───────────────────────────────────────────────────────────────────

  /** لیست ادمین‌ها (کسی که admin_role دارد) */
  async listAdmins(): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.db.select<Record<string, unknown>>('users', {
        select:
          'id,telegram_id,first_name,last_name,username,admin_role,admin_title,ui_language,created_at',
        admin_role: 'not.is.null',
        order: 'created_at.desc',
        limit: '100',
      });
      return asRows(rows);
    } catch {
      // اگر ستون admin_title هنوز نیست (مهاجرت 0009 اجرا نشده) بدون آن بخوان
      try {
        const rows = await this.db.select<Record<string, unknown>>('users', {
          select:
            'id,telegram_id,first_name,last_name,username,admin_role,ui_language,created_at',
          admin_role: 'not.is.null',
          order: 'created_at.desc',
          limit: '100',
        });
        return asRows(rows);
      } catch {
        return [];
      }
    }
  }

  /** اطلاعات چند کاربر با آیدی تلگرام (برای نمایش ادمین‌های env) */
  async findUsersByTelegramIds(ids: number[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];
    try {
      const rows = await this.db.select<Record<string, unknown>>('users', {
        select:
          'id,telegram_id,first_name,last_name,username,admin_role,admin_title,ui_language,created_at',
        telegram_id: `in.(${ids.join(',')})`,
        limit: String(ids.length),
      });
      return asRows(rows);
    } catch {
      try {
        const rows = await this.db.select<Record<string, unknown>>('users', {
          select:
            'id,telegram_id,first_name,last_name,username,admin_role,ui_language,created_at',
          telegram_id: `in.(${ids.join(',')})`,
          limit: String(ids.length),
        });
        return asRows(rows);
      } catch {
        return [];
      }
    }
  }

  /**
   * تعیین نقش (و لقب) ادمین برای یک کاربر (role = null → حذف نقش).
   * اگر کاربر در دیتابیس نباشد `false` برمی‌گرداند تا UI پیام روشن بدهد.
   */
  async setAdminRole(
    telegramId: number,
    role: string | null,
    title?: string | null
  ): Promise<boolean> {
    const found = asRows(
      await this.db.select<{ id: string }>('users', {
        select: 'id',
        telegram_id: `eq.${telegramId}`,
        limit: '1',
      })
    );
    if (found.length === 0) return false;

    const patch: Record<string, unknown> = { admin_role: role, is_admin: role !== null };
    if (title !== undefined) patch.admin_title = title;

    try {
      await this.db.update('users', { telegram_id: `eq.${telegramId}` }, patch);
    } catch {
      // اگر ستون admin_title وجود ندارد (مهاجرت 0009) بدون آن ذخیره کن
      delete patch.admin_title;
      await this.db.update('users', { telegram_id: `eq.${telegramId}` }, patch);
    }
    return true;
  }

  // ───────────────────────────────────────────────────────────────────
  // پیام‌های مدیر به کاربران
  // ───────────────────────────────────────────────────────────────────

  /**
   * ساخت یک پیام (برای یک کاربر یا همگانی).
   *
   * ستون‌های `sender_*` در مهاجرت 0008 اضافه می‌شوند. اگر آن مهاجرت هنوز
   * اجرا نشده باشد، درج با این ستون‌ها خطا می‌دهد؛ برای اینکه «ارسال پیام»
   * از کار نیفتد، بی‌صدا بدون آن‌ها دوباره تلاش می‌کنیم.
   */
  async createAdminMessage(input: {
    userId: string | null;
    telegramId: number | null;
    title?: string | null;
    body: string;
    kind?: string;
    senderTelegramId?: number | null;
    senderName?: string | null;
    sentViaBot?: boolean;
  }): Promise<Record<string, unknown>> {
    const base = {
      user_id: input.userId,
      telegram_id: input.telegramId,
      title: input.title ?? null,
      body: input.body,
      kind: input.kind ?? 'INFO',
    };

    try {
      const row = await this.db.insert<Record<string, unknown>>('admin_messages', {
        ...base,
        sender_telegram_id: input.senderTelegramId ?? null,
        sender_name: input.senderName ?? null,
        sent_via_bot: input.sentViaBot ?? false,
      });
      return (Array.isArray(row) ? row[0] : row) as Record<string, unknown>;
    } catch {
      // ستون‌های فرستنده وجود ندارند (مهاجرت 0008 اجرا نشده) → بدون آن‌ها
      const row = await this.db.insert<Record<string, unknown>>('admin_messages', base);
      return (Array.isArray(row) ? row[0] : row) as Record<string, unknown>;
    }
  }

  /**
   * همهٔ پیام‌های یک کاربر (خوانده و خوانده‌نشده).
   * `read_at === null` یعنی خوانده‌نشده — بنر ورودی همان‌ها را نشان می‌دهد.
   */
  async listUserMessages(userId: string): Promise<Record<string, unknown>[]> {
    const where = { user_id: `eq.${userId}`, order: 'created_at.desc', limit: '100' };
    try {
      const rows = await this.db.select<Record<string, unknown>>('admin_messages', {
        select: 'id,title,body,kind,read_at,created_at,sender_name',
        ...where,
      });
      return asRows(rows);
    } catch {
      // بدون ستون‌های مهاجرت 0008
      try {
        const rows = await this.db.select<Record<string, unknown>>('admin_messages', {
          select: 'id,title,body,kind,read_at,created_at',
          ...where,
        });
        return asRows(rows);
      } catch {
        return [];
      }
    }
  }

  /** تاریخچهٔ همهٔ پیام‌های ارسالی (پنل مدیر) */
  async listAllAdminMessages(limit = 100): Promise<Record<string, unknown>[]> {
    try {
      const rows = await this.db.select<Record<string, unknown>>('admin_messages', {
        select:
          'id,user_id,telegram_id,title,body,kind,read_at,created_at,sender_telegram_id,sender_name,sent_via_bot',
        order: 'created_at.desc',
        limit: String(limit),
      });
      return asRows(rows);
    } catch {
      try {
        const rows = await this.db.select<Record<string, unknown>>('admin_messages', {
          select: 'id,user_id,telegram_id,title,body,kind,read_at,created_at',
          order: 'created_at.desc',
          limit: String(limit),
        });
        return asRows(rows);
      } catch {
        return [];
      }
    }
  }

  /** علامت‌گذاری پیام‌ها به‌عنوان خوانده‌شده */
  async markMessagesRead(userId: string, ids?: string[]): Promise<void> {
    const filter: Record<string, string> = { user_id: `eq.${userId}`, read_at: 'is.null' };
    if (ids?.length) filter.id = `in.(${ids.join(',')})`;
    try {
      await this.db.update('admin_messages', filter, {
        read_at: new Date().toISOString(),
      });
    } catch {
      /* غیرحیاتی */
    }
  }

  /** همهٔ کاربرانی که می‌توان به آن‌ها پیام همگانی فرستاد */
  // ───────────────────────────────────────────────────────────────────
  // Media files (R2) — مِیگرشن ۰۰۱۲
  // ───────────────────────────────────────────────────────────────────

  /** یافتن فایل با کلید معنوی (جلوگیری از تولید دوبارهٔ صوت) */
  async findMediaByOwnerKey(
    kind: string,
    ownerKey: string
  ): Promise<{
    id: string;
    storage_key: string;
    mime_type: string;
    byte_size: number;
    duration_ms: number | null;
  } | null> {
    try {
      const rows = asRows(
        await this.db.select<Record<string, unknown>>('media_files', {
          kind: `eq.${kind}`,
          owner_key: `eq.${ownerKey}`,
          select: 'id,storage_key,mime_type,byte_size,duration_ms',
          limit: '1',
        })
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        storage_key: String(row.storage_key),
        mime_type: String(row.mime_type ?? 'audio/mpeg'),
        byte_size: Number(row.byte_size ?? 0),
        duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
      };
    } catch {
      // جدول media_files وجود ندارد (مهاجرت اجرا نشده) → انگار چیزی نیست
      return null;
    }
  }

  /** ثبت/به‌روزرسانی ردیف فایل رسانه */
  async upsertMediaFile(input: {
    kind: string;
    storageKey: string;
    ownerKey: string;
    language: string;
    voice: string;
    mimeType: string;
    byteSize: number;
    source: string;
  }): Promise<void> {
    await this.db.insert(
      'media_files',
      {
        kind: input.kind,
        storage_key: input.storageKey,
        owner_key: input.ownerKey,
        language: input.language,
        voice: input.voice,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        source: input.source,
      },
      { upsertOn: 'kind,owner_key' }
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Term cards — مِیگرشن ۰۰۱۳ (صرفه‌جویی توکن + ثبات محتوا)
  // ───────────────────────────────────────────────────────────────────

  /** کارت‌های واژه‌های موجود برای یک زبان — قبل از تولید AI چک می‌شود */
  async findTermCards(
    language: string,
    uiLanguage: string,
    terms: string[]
  ): Promise<Record<string, TermCard>> {
    if (terms.length === 0) return {};
    try {
      // نام‌های کوچک برای تطبیق
      const lowered = terms.map((t) => t.trim().toLowerCase());
      const rows = asRows(
        await this.db.select<Record<string, unknown>>('term_cards', {
          language: `eq.${language}`,
          ui_language: `eq.${uiLanguage}`,
          select: 'term,meaning,pronunciation,example,example_translation,audio_key',
          limit: String(lowered.length * 4),
        })
      );
      const wanted = new Set(lowered);
      const out: Record<string, TermCard> = {};
      for (const r of rows) {
        const term = String(r.term ?? '').trim().toLowerCase();
        if (!wanted.has(term)) continue;
        out[term] = {
          term: String(r.term ?? ''),
          meaning: String(r.meaning ?? ''),
          pronunciation: r.pronunciation ? String(r.pronunciation) : undefined,
          example: r.example ? String(r.example) : undefined,
          exampleTranslation: r.example_translation
            ? String(r.example_translation)
            : undefined,
          audioKey: r.audio_key ? String(r.audio_key) : undefined,
        };
      }
      return out;
    } catch {
      return {};
    }
  }

  /** ذخیرهٔ کارت‌های واژه (اگر کلمه در DB نبود، AI ساخته و اینجا ذخیره می‌شود) */
  async saveTermCards(language: string, uiLanguage: string, cards: TermCard[]): Promise<void> {
    if (cards.length === 0) return;
    const rows = cards.map((c) => ({
      term: c.term,
      language,
      ui_language: uiLanguage,
      meaning: c.meaning,
      pronunciation: c.pronunciation ?? null,
      example: c.example ?? null,
      example_translation: c.exampleTranslation ?? null,
      audio_key: c.audioKey ?? null,
    }));
    try {
      await this.db.insert('term_cards', rows, { upsertOn: 'language,term,ui_language' });
    } catch {
      // اگر مهاجرت اجرا نشده باشد، بی‌صدا رد شو
    }
  }

  /** افزایش شمارندهٔ استفادهٔ کارت‌ها (وقتی در یک درس به کار رفتند) */
  async bumpTermCardUse(language: string, uiLanguage: string, terms: string[]): Promise<void> {
    if (terms.length === 0) return;
    const lowered = terms.map((t) => t.trim().toLowerCase());
    for (const term of lowered) {
      this.db
        .rpc('bump_term_card_use', {
          p_language: language,
          p_ui_language: uiLanguage,
          p_terms: [term],
        })
        .catch(() => {});
    }
  }

  /** آمار کش — چند بار در ماه از کش خوانده شده (معیار صرفه‌جویی توکن) */
  async getCacheStats(): Promise<{ entries: number; totalHits: number }> {
    try {
      const rows = asRows(
        await this.db.select<Record<string, unknown>>('content_cache', {
          select: 'hits',
          limit: '5000',
        })
      );
      const totalHits = rows.reduce((sum, r) => sum + Number(r.hits ?? 0), 0);
      return { entries: rows.length, totalHits };
    } catch {
      return { entries: 0, totalHits: 0 };
    }
  }

  async listAllTelegramIds(): Promise<{ id: string; telegram_id: number; ui_language: string }[]> {
    try {
      const rows = await this.db.select<{ id: string; telegram_id: number; ui_language: string }>(
        'users',
        { select: 'id,telegram_id,ui_language', limit: '5000' }
      );
      return asRows(rows);
    } catch {
      return [];
    }
  }
}

/** نرمال‌سازی خروجی Supabase (که می‌تواند T، T[] یا null باشد) */
function asRows<T>(v: T[] | T | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

// ═════════════════════════════════════════════════════════════════════
// Mappers: rows → API DTOs
// ═════════════════════════════════════════════════════════════════════

/** نگاشت ردیف پلن به DTO با محاسبهٔ قیمت نهایی (تخفیف‌خورده) */
export function toPlanDto(r: PlanRow): Plan {
  const priceIrr = Number(r.price_irr);
  const discount = r.discount_percent ?? 0;
  return {
    id: r.id,
    planType: r.plan_type,
    titleFa: r.title_fa,
    titleEn: r.title_en,
    durationDays: r.duration_days,
    priceIrr,
    priceStars: r.price_stars,
    discountPercent: discount,
    finalPriceIrr: Math.round(priceIrr * (1 - discount / 100)),
    finalPriceStars: Math.round(r.price_stars * (1 - discount / 100)),
    badge: r.badge,
    isActive: r.is_active,
  };
}

export function toUserProfile(
  user: UserRow,
  subscription: SubscriptionRow | null,
  opts: { isAdmin: boolean; adminRole?: string | null }
): UserProfile {
  const subInfo: SubscriptionInfo | null = subscription
    ? {
        planType: subscription.plan_type,
        status: subscription.status,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at,
        daysRemaining: daysRemaining(new Date(subscription.expires_at)),
        source: subscription.source,
      }
    : null;

  const access = evaluateAccess({
    hasActiveSubscription: Boolean(subscription),
    trialStartedAt: new Date(user.created_at),
  });

  return {
    id: user.id,
    telegramId: user.telegram_id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url,
    uiLanguage: (user.ui_language ?? 'fa') as UserProfile['uiLanguage'],
    languageSource: user.language_source,
    targetLanguage: user.target_language as UserProfile['targetLanguage'],
    // گویش و بودجهٔ روزانه — ممکن است ستون‌ها هنوز نباشند (اختیاری)
    dialect: (user as { dialect?: string | null }).dialect ?? null,
    dailyMinutes: (user as { daily_minutes?: number | null }).daily_minutes ?? null,
    skillLevel: user.skill_level as UserProfile['skillLevel'],
    learningGoal: user.learning_goal,
    onboardingDone: user.onboarding_done,
    streakCount: user.streak_count,
    longestStreak: user.longest_streak,
    starsBalance: user.stars_balance,
    isAdmin: opts.isAdmin,
    // نقش از env (SUPER_ADMIN) اولویت دارد؛ وگرنه نقش ذخیره‌شده در DB
    adminRole:
      opts.adminRole ?? (user as { admin_role?: string | null }).admin_role ?? null,
    createdAt: user.created_at,
    subscription: subInfo,
    hasAccess: access.hasAccess,
  };
}

export function toCycleDto(
  cycle: CycleRow,
  lessons: LessonRow[]
): Cycle {
  const completedDays = lessons.filter((l) => l.is_completed).map((l) => l.day_number);
  const titles: Record<number, string> = {};
  const objectives: Record<number, string> = {};
  const objectivesFa: Record<number, string> = {};
  for (const l of lessons) {
    titles[l.day_number] = l.title;
    const obj = l.objective ?? dayProfile(l.day_number).objective;
    if (obj) objectives[l.day_number] = obj;
    const objFa = l.objective_fa ?? dayProfile(l.day_number).objectiveFa;
    if (objFa) objectivesFa[l.day_number] = objFa;
  }

  const days = buildCycleDays({
    cycleStatus: cycle.status,
    completedDays,
    lessonTitles: titles,
    objectives,
    objectivesFa,
  });

  const currentDay = days.find((d) => d.isActive)?.dayNumber ?? null;

  return {
    id: cycle.id,
    cycleNumber: cycle.cycle_number,
    title: cycle.title,
    titleFa: cycle.title_fa,
    focusSummary: cycle.focus_summary,
    status: cycle.status,
    progress: {
      completedDays: completedDays.length,
      totalDays: CYCLE_LENGTH_DAYS,
      currentDay,
    },
    days,
    startedAt: cycle.started_at,
    completedAt: cycle.completed_at,
  };
}

export function toLessonDto(row: LessonRow): Lesson {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    dayNumber: row.day_number,
    title: row.title,
    titleFa: row.title_fa,
    kind: row.kind,
    part1: row.part_1_data as Lesson['part1'],
    part2: row.part_2_data as Lesson['part2'],
    status: row.status as Lesson['status'],
    isCompleted: row.is_completed,
    durationSeconds: row.duration_seconds,
  };
}

// ═════════════════════════════════════════════════════════════════════
// Progress dashboard
// ═════════════════════════════════════════════════════════════════════

export function buildProgressDashboard(input: {
  telemetry: { event_type: string; is_correct: boolean | null; response_ms: number | null; pause_ms: number | null }[];
  lessonsCompleted: number;
  lexical: LexicalRow[];
  streakCount: number;
  weeklyMinutes: number[];
}): ProgressDashboard {
  const answers = input.telemetry.filter((t) => t.event_type === 'ANSWER');
  const correct = answers.filter((a) => a.is_correct === true).length;
  const accuracyPct = answers.length
    ? Math.round((correct / answers.length) * 1000) / 10
    : 0;

  const pauses = input.telemetry
    .filter((t) => t.event_type === 'PAUSE' || t.event_type === 'ANSWER')
    .map((t) => t.pause_ms ?? 0);
  const totalPauseMs = pauses.reduce((a, b) => a + b, 0);

  const masteredWords = input.lexical.filter((l) => l.mastered).length;
  const learningWords = input.lexical.filter((l) => !l.mastered).length;

  return {
    accuracyPct,
    lessonsCompleted: input.lessonsCompleted,
    totalMinutes: Math.round(totalPauseMs / 60_000),
    masteredWords,
    learningWords,
    streakCount: input.streakCount,
    qualitativeSkills: buildQualitativeSkills({
      lessonsCompleted: input.lessonsCompleted,
      masteredWords,
      accuracyPct,
    }),
    weeklyActivity: input.weeklyMinutes.map((minutes, i) => ({
      day: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'][i] ?? `d${i}`,
      minutes,
      completed: minutes > 0,
    })),
    skillBreakdown: buildSkillBreakdown(input.lexical, accuracyPct),
  };
}

/**
 * «الان می‌تونی در هتل صحبت کنی» — پیام‌های کیفی ملموس به‌جای امتیاز خشک.
 */
function buildQualitativeSkills(input: {
  lessonsCompleted: number;
  masteredWords: number;
  accuracyPct: number;
}): QualitativeSkill[] {
  const { lessonsCompleted, masteredWords, accuracyPct } = input;

  const defs: (QualitativeSkill & { condition: boolean })[] = [
    {
      key: 'greetings', icon: '👋',
      labelFa: 'سلام و احوال‌پرسی و معرفی خودت',
      labelEn: 'Greetings and introducing yourself',
      unlocked: lessonsCompleted >= 7, condition: lessonsCompleted >= 7,
    },
    {
      key: 'hotel', icon: '🏨',
      labelFa: 'رزرو هتل و صحبت در پذیرش',
      labelEn: 'Hotel booking and check-in',
      unlocked: lessonsCompleted >= 14, condition: lessonsCompleted >= 14,
    },
    {
      key: 'directions', icon: '🗺️',
      labelFa: 'پرسیدن آدرس و مسیر',
      labelEn: 'Asking for directions',
      unlocked: lessonsCompleted >= 21, condition: lessonsCompleted >= 21,
    },
    {
      key: 'negotiation', icon: '💼',
      labelFa: 'مذاکره و اعلام قیمت در جلسات کاری',
      labelEn: 'Negotiating and quoting in meetings',
      unlocked: lessonsCompleted >= 28 && accuracyPct >= 70,
      condition: lessonsCompleted >= 28 && accuracyPct >= 70,
    },
    {
      key: 'fluency', icon: '🚀',
      labelFa: 'مکالمه روان بدون مکث طولانی',
      labelEn: 'Fluent conversation without long pauses',
      unlocked: accuracyPct >= 85 && masteredWords >= 60,
      condition: accuracyPct >= 85 && masteredWords >= 60,
    },
  ];

  return defs.map(({ condition, ...skill }) => ({ ...skill, unlocked: condition }));
  }

function buildSkillBreakdown(lexical: LexicalRow[], accuracyPct: number): { area: string; score: number }[] {
  const byBox = [1, 2, 3, 4, 5].map(
    (box) => lexical.filter((l) => l.box === box).length
  );
  const total = lexical.length || 1;

  const vocabulary = lexical.length
    ? Math.round(((byBox[3]! + byBox[4]!) / total) * 100)
    : 0;

  return [
    { area: 'vocabulary', score: vocabulary },
    { area: 'accuracy', score: Math.round(accuracyPct) },
    { area: 'retention', score: Math.round((lexical.filter((l) => l.repetitions > 1).length / total) * 100) },
    { area: 'consistency', score: Math.min(100, Math.round((byBox[4]! / total) * 200)) },
  ];
}

// ── helpers ──────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export { shouldGenerateNextCycle, lessonKindForDay };
