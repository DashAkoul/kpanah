/**
 * Domain types shared between the TMA frontend and the Edge Worker.
 * All identifiers are English; user-facing strings live in locales/.
 */

// ─────────────────────────────────────────────────────────────────────
// Enums (mirror SQL enums)
// ─────────────────────────────────────────────────────────────────────

export type PlanType =
  | 'TRIAL'
  | '2_WEEKS'
  | '1_MONTH'
  | '3_MONTHS'
  | '6_MONTHS'
  | '1_YEAR';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type SubscriptionSource =
  | 'TELEGRAM_STARS'
  | 'ADMIN_GIFT'
  | 'TRIAL'
  | 'ZARINPAL';

export type CycleStatus = 'ACTIVE' | 'COMPLETED' | 'GENERATING' | 'FAILED';

export type LessonStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

export type LessonKind = 'TEACHING' | 'HIDDEN_ASSESSMENT' | 'CONSOLIDATION';

export type SkillLevel = 'ZERO' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type SupportedUiLanguage = 'fa' | 'en' | 'ar' | 'tr' | 'ru';

export type SupportedTargetLanguage = 'en' | 'de' | 'fr' | 'es' | 'tr' | 'ar';

export type AdminAction = 'GIFT' | 'REVOKE' | 'EXTEND' | 'DOWNGRADE';

export type TelemetryEventType =
  | 'ANSWER'
  | 'PAUSE'
  | 'SKIP'
  | 'REPLAY'
  | 'HINT_USED'
  | 'LESSON_START'
  | 'LESSON_END'
  | 'SESSION_START'
  | 'SESSION_END';

// ─────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface SubscriptionInfo {
  planType: PlanType;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string;
  daysRemaining: number;
  source: SubscriptionSource;
}

export interface UserProfile {
  id: string;
  telegramId: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  uiLanguage: SupportedUiLanguage;
  languageSource: 'TELEGRAM' | 'MANUAL';
  targetLanguage: SupportedTargetLanguage;
  skillLevel: SkillLevel;
  learningGoal: string | null;
  onboardingDone: boolean;
  streakCount: number;
  longestStreak: number;
  starsBalance: number;
  isAdmin: boolean;
  createdAt: string;
  subscription: SubscriptionInfo | null;
  /** دسترسی کامل به بخش آموزشی */
  hasAccess: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Lesson content (the JSONB shapes written by the AI engine)
// ─────────────────────────────────────────────────────────────────────

export interface PatternDrillItem {
  term: string;
  meaning: string;
  pronunciation?: string;
  example: string;
  exampleTranslation?: string;
  /** الگوی جایگزینی: جمله پایه + اسلات‌های قابل تعویض */
  substitution?: {
    base: string;
    slots: string[];
  };
  /** خانه لایتنر فعلی این واژه برای کاربر (۱ تا ۵) */
  box?: LeitnerBox;
}

/** شماره خانه جعبه لایتنر */
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface PatternDrillPart {
  type: 'PATTERN_DRILL';
  explanation: string;
  pattern?: string;
  patternTranslation?: string;
  items: PatternDrillItem[];
  microExercises?: MicroExercise[];
}

export interface MicroExercise {
  id: string;
  kind: 'FILL_BLANK' | 'REORDER' | 'MATCH' | 'CHOOSE';
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
}

export interface ApplicationQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  /** برچسب واژه مرتبط برای ثبت در لایتنر */
  linkedTerm?: string;
}

export interface RealApplicationPart {
  type: 'REAL_APPLICATION';
  scenario: string;
  scenarioTranslation?: string;
  dialogue?: DialogueLine[];
  questions: ApplicationQuestion[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  translation?: string;
}

export type Part1Data = PatternDrillPart;
export type Part2Data = RealApplicationPart;

export interface Lesson {
  id: string;
  cycleId: string;
  dayNumber: number;
  title: string;
  titleFa: string | null;
  kind: LessonKind;
  part1: Part1Data;
  part2: Part2Data;
  status: LessonStatus;
  isCompleted: boolean;
  durationSeconds: number | null;
}

export interface Cycle {
  id: string;
  cycleNumber: number;
  title: string;
  titleFa: string | null;
  focusSummary: string | null;
  status: CycleStatus;
  progress: {
    completedDays: number;
    totalDays: number;
    currentDay: number | null;
  };
  days: CycleDay[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface CycleDay {
  dayNumber: number;
  title: string;
  kind: LessonKind;
  status: LessonStatus;
  isCompleted: boolean;
  isActive: boolean;
  isLocked: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Adaptive engine: delta report fed back into the AI
// ─────────────────────────────────────────────────────────────────────

export interface SkillDelta {
  /** دقت کلی پاسخ‌دهی ۰..۱۰۰ */
  accuracyPct: number;
  averageResponseMs: number;
  maxPauseMs: number;
  totalAnswers: number;

  /** واژه‌هایی که باید تقویت شوند (box <= 2 یا lapses بالا) */
  weakTerms: WeakTerm[];
  /** واژه‌هایی که تثبیت شده‌اند (box = 5) */
  masteredTerms: string[];

  /** قوی‌ترین و ضعیف‌ترین حوزه‌ها بر اساس برچسب سؤال */
  strongestAreas: string[];
  weakestAreas: string[];

  /** سرعت یادگیری تخمینی: answers در دقیقه */
  paceAnswersPerMinute: number;

  /** اگر روز ۶ آزمون پنهان بوده، امتیاز آن */
  hiddenAssessmentScore: number | null;
}

export interface WeakTerm {
  term: string;
  box: number;
  lapses: number;
  failRate: number;
}

export interface CycleGenerationInput {
  user: {
    id: string;
    skillLevel: SkillLevel;
    learningGoal: string | null;
    uiLanguage: SupportedUiLanguage;
    targetLanguage: SupportedTargetLanguage;
  };
  cycleNumber: number;
  delta: SkillDelta;
  /** خلاصه چرخه قبل تا AI تکرار نکند */
  previousCycleSummary: string | null;
}

export interface GeneratedCycle {
  title: string;
  titleFa: string;
  focusSummary: string;
  lessons: GeneratedLesson[];
}

export interface GeneratedLesson {
  dayNumber: number;
  title: string;
  titleFa: string;
  kind: LessonKind;
  part1: Part1Data;
  part2: Part2Data;
}

// ─────────────────────────────────────────────────────────────────────
// Store / payments
// ─────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  planType: PlanType;
  titleFa: string;
  titleEn: string;
  durationDays: number;
  priceIrr: number;
  priceStars: number;
  discountPercent: number;
  finalPriceIrr: number;
  finalPriceStars: number;
  badge: string | null;
  isActive: boolean;
}

export interface StarInvoice {
  invoiceLink: string;
  planId: string;
  amountStars: number;
}

// ─────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  skillLevel: SkillLevel;
  planType: PlanType | null;
  daysRemaining: number;
  streakCount: number;
  cycleNumber: number | null;
  createdAt: string;
}

export interface GiftSubscriptionRequest {
  telegramId: number;
  planType: PlanType;
  note?: string;
  /** اگر true باشد، به اشتراک فعال اضافه می‌شود؛ وگرنه جایگزین */
  extend: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// AI provider pool (admin-managed)
//
// Ordering is the failover order: the engine walks providers by ascending
// `priority`, so the panel presents them as a numbered chain.
// ─────────────────────────────────────────────────────────────────────

/** Wire protocol family — determines how the Worker builds the request. */
export type AiProtocol = 'gemini' | 'openai_compatible' | 'anthropic';

/** Vendor presets offered in the panel; `custom` means hand-fill everything. */
export type AiVendorPreset =
  | 'gemini'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'together'
  | 'custom';

export type AiHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'failing';

export interface AiProvider {
  id: string;
  label: string;
  protocol: AiProtocol;
  vendor: string;
  model: string;
  baseUrl: string | null;
  /** آخرین چهار کاراکتر کلید — هرگز خود کلید فرستاده نمی‌شود */
  keyHint: string;
  /** true یعنی کلید از secret محیط خوانده می‌شود، نه از دیتابیس */
  fromEnv: boolean;
  priority: number;
  isActive: boolean;
  temperature: number | null;
  maxOutputTokens: number | null;
  supportsJsonSchema: boolean;
  healthStatus: AiHealthStatus;
  lastError: string | null;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  note: string | null;
  /** false یعنی کلید قابل رمزگشایی نیست و موتور از این provider رد می‌شود */
  usable: boolean;
}

export interface AiAttemptLogEntry {
  id: number;
  cycle_id: string | null;
  provider_label: string | null;
  model: string | null;
  attempt_no: number;
  phase: 'initial' | 'repair';
  ok: boolean;
  latency_ms: number | null;
  error: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface AiProviderListResponse {
  providers: AiProvider[];
  attempts: AiAttemptLogEntry[];
  /** ترتیب واقعی که موتور امتحان می‌کند */
  chain: { id: string; label: string; model: string }[];
  /** false یعنی PROVIDER_ENCRYPTION_KEY روی Worker تنظیم نشده */
  encryptionReady: boolean;
}

export interface CreateAiProviderInput {
  label: string;
  protocol: AiProtocol;
  vendor: string;
  model: string;
  baseUrl?: string | null;
  apiKey: string;
  priority?: number;
  isActive?: boolean;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  supportsJsonSchema?: boolean;
  note?: string | null;
}

/** همه فیلدها اختیاری‌اند؛ نبودِ `apiKey` یعنی کلید فعلی حفظ شود */
export type UpdateAiProviderInput = Partial<Omit<CreateAiProviderInput, 'apiKey'>> & {
  apiKey?: string;
};

export interface AiProviderTestResult {
  ok: boolean;
  ms: number;
  error?: string;
  sample?: string;
}

/**
 * Preset defaults shown when an admin picks a vendor.
 *
 * `baseUrl: null` means the Worker's built-in endpoint is correct, so the
 * panel leaves the field empty rather than asking the operator to type a URL
 * they would only get wrong.
 */
export interface AiVendorPresetInfo {
  id: AiVendorPreset;
  label: string;
  protocol: AiProtocol;
  vendor: string;
  model: string;
  baseUrl: string | null;
  supportsJsonSchema: boolean;
  keyUrl: string;
  note: string;
}

// ─────────────────────────────────────────────────────────────────────
// API envelope
// ─────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
  ts: number;
}

export interface ApiError {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** پیام قابل نمایش به کاربر (محلی‌سازی‌شده توسط فرانت‌اند) */
    userMessageKey?: string;
  };
  requestId: string;
  ts: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_INIT_DATA'
  | 'TOKEN_EXPIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'CYCLE_NOT_READY'
  | 'LESSON_LOCKED'
  | 'LESSON_ALREADY_COMPLETED'
  | 'APP_LOCKED'
  | 'RATE_LIMITED'
  | 'CONTENT_REJECTED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'AI_UNAVAILABLE';

export interface ProgressDashboard {
  accuracyPct: number;
  lessonsCompleted: number;
  totalMinutes: number;
  masteredWords: number;
  learningWords: number;
  streakCount: number;
  /** جملات کیفی مثل «الان می‌تونی در هتل صحبت کنی» */
  qualitativeSkills: QualitativeSkill[];
  weeklyActivity: { day: string; minutes: number; completed: boolean }[];
  skillBreakdown: { area: string; score: number }[];
}

export interface QualitativeSkill {
  key: string;
  labelFa: string;
  labelEn: string;
  unlocked: boolean;
  icon: string;
}
