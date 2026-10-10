import type {
  Cycle,
  CycleGenerationInput,
  GeneratedCycle,
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
} from '@kpanah/shared';
import {
  CYCLE_LENGTH_DAYS,
  PLAN_DURATION_DAYS,
  buildCycleDays,
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
  async persistGeneratedCycle(
    cycleId: string,
    generated: GeneratedCycle,
    meta: { model: string; ms: number; tokens?: number; input: CycleGenerationInput }
  ): Promise<void> {
    await this.db.update('cycles', { id: cycleId }, {
      title: generated.title,
      title_fa: generated.titleFa,
      focus_summary: generated.focusSummary,
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
      generated_from: meta.input.delta as unknown as Record<string, unknown>,
      generation_model: meta.model,
      generation_ms: meta.ms,
      generation_tokens: meta.tokens ?? null,
    });

    const cycle = await this.getCycleById(cycleId);
    if (!cycle) throw new Error(`Cycle ${cycleId} vanished after update`);

    const rows = generated.lessons.map((lesson, index) => ({
      cycle_id: cycleId,
      user_id: cycle.user_id,
      day_number: lesson.dayNumber,
      title: lesson.title,
      title_fa: lesson.titleFa,
      kind: lesson.kind,
      part_1_data: lesson.part1 as unknown as Record<string, unknown>,
      part_2_data: lesson.part2 as unknown as Record<string, unknown>,
      status: lesson.dayNumber === 1 ? 'AVAILABLE' : 'LOCKED',
      is_completed: false,
      _order: index,
    }));

    await this.db.insert('lessons', rows.map(({ _order, ...r }) => r));
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

    return ((rows as PlanRow[]) ?? []).map((r) => {
      const priceIrr = Number(r.price_irr);
      const discount = r.discount_percent;
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
    });
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
      select: 'id,telegram_id,first_name,last_name,username,skill_level,streak_count,created_at',
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
    const rows = await this.db.insert<AiProviderRow>('ai_providers', {
      label: input.label,
      protocol: input.protocol,
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
    return (rows as AiProviderRow[])[0] ?? null;
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
}

// ═════════════════════════════════════════════════════════════════════
// Mappers: rows → API DTOs
// ═════════════════════════════════════════════════════════════════════

export function toUserProfile(
  user: UserRow,
  subscription: SubscriptionRow | null,
  opts: { isAdmin: boolean }
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
    skillLevel: user.skill_level as UserProfile['skillLevel'],
    learningGoal: user.learning_goal,
    onboardingDone: user.onboarding_done,
    streakCount: user.streak_count,
    longestStreak: user.longest_streak,
    starsBalance: user.stars_balance,
    isAdmin: opts.isAdmin,
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
  for (const l of lessons) titles[l.day_number] = l.title;

  const days = buildCycleDays({
    cycleStatus: cycle.status,
    completedDays,
    lessonTitles: titles,
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
