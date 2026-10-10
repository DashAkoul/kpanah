import type {
  Cycle,
  Lesson,
  Plan,
  ProgressDashboard,
  UserProfile,
} from '@kpanah/shared';

/**
 * Preview-mode fixtures.
 *
 * Used ONLY when the app runs outside Telegram (VITE_ENABLE_MOCK or dev
 * server) so the whole UI — including the lesson player and the 7-day
 * roadmap — can be exercised without a bot, database or AI key.
 */

export const MOCK_USER: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  telegramId: 123456789,
  firstName: 'کاربر',
  lastName: 'نمونه',
  username: 'preview_user',
  photoUrl: null,
  uiLanguage: 'fa',
  languageSource: 'TELEGRAM',
  targetLanguage: 'en',
  skillLevel: 'A2',
  learningGoal: 'BUSINESS',
  onboardingDone: true,
  streakCount: 5,
  longestStreak: 11,
  starsBalance: 150,
  isAdmin: true,
  createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  subscription: {
    planType: 'TRIAL',
    status: 'ACTIVE',
    startsAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    daysRemaining: 6,
    source: 'TRIAL',
  },
  hasAccess: true,
};

export const MOCK_CYCLE: Cycle = {
  id: 'cyc_9910',
  cycleNumber: 2,
  title: 'Workplace conversations & negotiation',
  titleFa: 'الگوی مکالمات کاری و مذاکره',
  focusSummary:
    'در این چرخه روی الگوهای مطرح‌کردن قیمت، درخواست تخفیف و بستن قرارداد در جلسات کاری تمرکز می‌کنیم.',
  status: 'ACTIVE',
  progress: { completedDays: 2, totalDays: 7, currentDay: 3 },
  days: [
    { dayNumber: 1, title: 'Opening a business call', kind: 'TEACHING', status: 'COMPLETED', isCompleted: true, isActive: false, isLocked: false },
    { dayNumber: 2, title: 'Introducing your proposal', kind: 'TEACHING', status: 'COMPLETED', isCompleted: true, isActive: false, isLocked: false },
    { dayNumber: 3, title: 'Quoting a price', kind: 'TEACHING', status: 'AVAILABLE', isCompleted: false, isActive: true, isLocked: false },
    { dayNumber: 4, title: 'Handling objections', kind: 'TEACHING', status: 'LOCKED', isCompleted: false, isActive: false, isLocked: true },
    { dayNumber: 5, title: 'Closing the deal', kind: 'TEACHING', status: 'LOCKED', isCompleted: false, isActive: false, isLocked: true },
    { dayNumber: 6, title: 'Partner meeting', kind: 'HIDDEN_ASSESSMENT', status: 'LOCKED', isCompleted: false, isActive: false, isLocked: true },
    { dayNumber: 7, title: 'Review & consolidate', kind: 'CONSOLIDATION', status: 'LOCKED', isCompleted: false, isActive: false, isLocked: true },
  ],
  startedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  completedAt: null,
};

export const MOCK_LESSON: Lesson = {
  id: 'lsn_0003',
  cycleId: 'cyc_9910',
  dayNumber: 3,
  title: 'Quoting a price in a business meeting',
  titleFa: 'مذاکره و اعلام قیمت در جلسات کاری',
  kind: 'TEACHING',
  status: 'AVAILABLE',
  isCompleted: false,
  durationSeconds: null,
  part1: {
    type: 'PATTERN_DRILL',
    explanation:
      'در این بخش یاد می‌گیری چطور قیمت را مطرح کنی و درباره انعطاف‌پذیری مذاکره کنی. به جای حفظ کردن فرمول گرامری، الگو را با جایگزین کردن کلمات تمرین می‌کنیم.',
    pattern: 'Is there any flexibility in the ___?',
    patternTranslation: 'آیا در ___ انعطاف‌پذیری وجود دارد؟',
    items: [
      {
        term: 'Offer a discount',
        meaning: 'پیشنهاد تخفیف دادن',
        pronunciation: 'ˈɒfə ə ˈdɪskaʊnt',
        example: 'We can offer a discount for bulk orders.',
        exampleTranslation: 'برای سفارش‌های عمده می‌توانیم تخفیف بدهیم.',
        substitution: {
          base: 'We can offer a discount for ___ orders.',
          slots: ['bulk', 'recurring', 'annual', 'long-term'],
        },
        box: 2,
      },
      {
        term: 'Is there any flexibility',
        meaning: 'آیا انعطافی وجود دارد؟',
        pronunciation: 'ɪz ðeər ˈeni ˌfleksəˈbɪləti',
        example: 'Is there any flexibility in the price?',
        exampleTranslation: 'آیا در قیمت انعطافی وجود دارد؟',
        substitution: {
          base: 'Is there any flexibility in the ___?',
          slots: ['price', 'payment terms', 'delivery schedule', 'contract length'],
        },
        box: 1,
      },
      {
        term: 'Work within our budget',
        meaning: 'در محدوده بودجه ما بودن',
        pronunciation: 'wɜːk wɪˈðɪn aʊə ˈbʌdʒɪt',
        example: 'Could we work something within our budget?',
        exampleTranslation: 'می‌توانیم چیزی در محدوده بودجه‌مان ترتیب دهیم؟',
        substitution: {
          base: 'Could we work something within ___?',
          slots: ['our budget', 'that range', 'this quarter', 'the agreed terms'],
        },
        box: 3,
      },
      {
        term: 'Meet you halfway',
        meaning: 'به توافق میانه رسیدن',
        pronunciation: 'miːt juː ˈhɑːfweɪ',
        example: 'If we could meet halfway, I think we have a deal.',
        exampleTranslation: 'اگر بتوانیم به میانه راه برسیم، فکر می‌کنم به توافق می‌رسیم.',
        substitution: {
          base: 'If we could meet halfway on ___, I think we have a deal.',
          slots: ['the price', 'the timeline', 'the volume', 'the terms'],
        },
        box: 1,
      },
    ],
    microExercises: [
      {
        id: 'm301',
        kind: 'CHOOSE',
        prompt: 'کدام عبارت مؤدبانه‌تر برای درخواست تخفیف است؟',
        options: ['Give me a lower price.', 'Is there any flexibility in the price?'],
        correctIndex: 1,
        explanation:
          'عبارت دوم با سؤال و به‌صورت غیرمستقیم مطرح می‌شود و فضای مذاکره را حفظ می‌کند.',
      },
      {
        id: 'm302',
        kind: 'FILL_BLANK',
        prompt: 'We can offer a discount for ___ orders.',
        answer: 'bulk',
        explanation: '«bulk orders» یعنی سفارش‌های عمده.',
      },
    ],
  },
  part2: {
    type: 'REAL_APPLICATION',
    scenario:
      'در یک جلسه کاری، مشتری می‌گوید بودجه‌اش محدود است. تو باید بدون از دست دادن قرارداد، قیمت را مطرح کنی.',
    scenarioTranslation:
      'In a business meeting, the client says their budget is limited. You need to quote a price without losing the deal.',
    dialogue: [
      { speaker: 'Client', text: 'Honestly, this is above what we planned.', translation: 'راستش، این بالاتر از چیزی است که برنامه‌ریزی کرده بودیم.' },
      { speaker: 'You', text: 'I understand. Is there any flexibility in your timeline?', translation: 'می‌فهمم. آیا در زمان‌بندی شما انعطافی وجود دارد؟' },
      { speaker: 'Client', text: 'We could push the start to next quarter.', translation: 'می‌توانیم شروع را به فصل بعد موکول کنیم.' },
      { speaker: 'You', text: 'Then if we meet halfway, I think we have a deal.', translation: 'پس اگر به میانه راه برسیم، فکر می‌کنم به توافق می‌رسیم.' },
    ],
    questions: [
      {
        id: 'q101',
        prompt: 'کدام عبارت برای درخواست تخفیف مناسب‌تر است؟',
        options: ['Give me lower price', 'Is there any flexibility in the price?'],
        correctIndex: 1,
        explanation: 'عبارت دوم حرفه‌ای‌تر است و فضای مذاکره را باز نگه می‌دارد.',
        linkedTerm: 'Is there any flexibility',
      },
      {
        id: 'q102',
        prompt: 'مشتری می‌گوید بودجه محدود دارد. بهترین واکنش چیست؟',
        options: [
          'That is our final price.',
          'Could we work something within your budget?',
          'You should increase your budget.',
        ],
        correctIndex: 1,
        explanation: 'پیشنهاد راه‌حل جایگزین، مذاکره را به جلو می‌برد.',
        linkedTerm: 'Work within our budget',
      },
      {
        id: 'q103',
        prompt: '«meet halfway» در مذاکره یعنی چه؟',
        options: [
          'پذیرفتن کامل شرایط طرف مقابل',
          'رسیدن به یک توافق میانه',
          'لغو قرارداد',
        ],
        correctIndex: 1,
        explanation: 'یعنی هر دو طرف کمی از موضع خود عقب‌نشینی کنند.',
        linkedTerm: 'Meet you halfway',
      },
    ],
  },
};

export const MOCK_PLANS: Plan[] = [
  { id: '2_weeks', planType: '2_WEEKS', titleFa: '۲ هفته‌ای', titleEn: '2 Weeks', durationDays: 14, priceIrr: 400_000, priceStars: 100, discountPercent: 20, finalPriceIrr: 320_000, finalPriceStars: 80, badge: null, isActive: true },
  { id: '1_month', planType: '1_MONTH', titleFa: '۱ ماهه', titleEn: '1 Month', durationDays: 30, priceIrr: 750_000, priceStars: 175, discountPercent: 20, finalPriceIrr: 600_000, finalPriceStars: 140, badge: 'POPULAR', isActive: true },
  { id: '3_months', planType: '3_MONTHS', titleFa: '۳ ماهه', titleEn: '3 Months', durationDays: 90, priceIrr: 1_800_000, priceStars: 400, discountPercent: 20, finalPriceIrr: 1_440_000, finalPriceStars: 320, badge: null, isActive: true },
  { id: '6_months', planType: '6_MONTHS', titleFa: '۶ ماهه', titleEn: '6 Months', durationDays: 180, priceIrr: 3_200_000, priceStars: 700, discountPercent: 20, finalPriceIrr: 2_560_000, finalPriceStars: 560, badge: null, isActive: true },
  { id: '1_year', planType: '1_YEAR', titleFa: '۱ ساله', titleEn: '1 Year', durationDays: 365, priceIrr: 5_500_000, priceStars: 1_150, discountPercent: 20, finalPriceIrr: 4_400_000, finalPriceStars: 920, badge: 'BEST_VALUE', isActive: true },
];

export const MOCK_DASHBOARD: ProgressDashboard = {
  accuracyPct: 78.5,
  lessonsCompleted: 12,
  totalMinutes: 96,
  masteredWords: 34,
  learningWords: 58,
  streakCount: 5,
  qualitativeSkills: [
    { key: 'greetings', labelFa: 'سلام و احوال‌پرسی و معرفی خودت', labelEn: 'Greetings and introducing yourself', unlocked: true, icon: '👋' },
    { key: 'hotel', labelFa: 'رزرو هتل و صحبت در پذیرش', labelEn: 'Hotel booking and check-in', unlocked: true, icon: '🏨' },
    { key: 'directions', labelFa: 'پرسیدن آدرس و مسیر', labelEn: 'Asking for directions', unlocked: false, icon: '🗺️' },
    { key: 'negotiation', labelFa: 'مذاکره و اعلام قیمت در جلسات کاری', labelEn: 'Negotiating and quoting in meetings', unlocked: false, icon: '💼' },
    { key: 'fluency', labelFa: 'مکالمه روان بدون مکث طولانی', labelEn: 'Fluent conversation without long pauses', unlocked: false, icon: '🚀' },
  ],
  weeklyActivity: [
    { day: 'sat', minutes: 18, completed: true },
    { day: 'sun', minutes: 24, completed: true },
    { day: 'mon', minutes: 12, completed: true },
    { day: 'tue', minutes: 0, completed: false },
    { day: 'wed', minutes: 21, completed: true },
    { day: 'thu', minutes: 15, completed: true },
    { day: 'fri', minutes: 6, completed: false },
  ],
  skillBreakdown: [
    { area: 'vocabulary', score: 68 },
    { area: 'accuracy', score: 79 },
    { area: 'retention', score: 54 },
    { area: 'consistency', score: 82 },
  ],
};

export const MOCK_ADMIN_USERS = [
  { id: 'u1', telegramId: 123456789, displayName: 'کاربر نمونه', username: 'preview_user', skillLevel: 'A2' as const, planType: '1_MONTH' as const, daysRemaining: 24, streakCount: 5, cycleNumber: 2, createdAt: new Date().toISOString() },
  { id: 'u2', telegramId: 987654321, displayName: 'علی رضایی', username: 'ali_r', skillLevel: 'B1' as const, planType: 'TRIAL' as const, daysRemaining: 4, streakCount: 12, cycleNumber: 3, createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  { id: 'u3', telegramId: 555666777, displayName: 'مریم احمدی', username: null, skillLevel: 'ZERO' as const, planType: null, daysRemaining: 0, streakCount: 1, cycleNumber: 1, createdAt: new Date(Date.now() - 1 * 86_400_000).toISOString() },
];

/**
 * AI provider pool preview.
 *
 * Mirrors exactly what the API returns: three providers in failover order,
 * one of them degraded, and key hints instead of keys. Useful for working on
 * the panel without a live backend.
 */
export const MOCK_AI_PROVIDERS = {
  providers: [
    {
      id: 'p1', label: 'Gemini Flash (اصلی)', protocol: 'gemini' as const, vendor: 'gemini',
      model: 'gemini-2.5-flash', baseUrl: null, keyHint: '••••4Xk2', fromEnv: false,
      priority: 1, isActive: true, temperature: 0.8, maxOutputTokens: 32768,
      supportsJsonSchema: true, healthStatus: 'healthy' as const, lastError: null,
      consecutiveFailures: 0, totalSuccesses: 42, totalFailures: 1,
      lastSuccessAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      lastFailureAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      note: 'provider اصلی تولید چرخه', usable: true,
    },
    {
      id: 'p2', label: 'DeepSeek (جایگزین اول)', protocol: 'openai_compatible' as const, vendor: 'deepseek',
      model: 'deepseek-chat', baseUrl: null, keyHint: '••••9ab7', fromEnv: false,
      priority: 2, isActive: true, temperature: 0.8, maxOutputTokens: 8192,
      supportsJsonSchema: false, healthStatus: 'degraded' as const,
      lastError: '503 Service Unavailable', consecutiveFailures: 2,
      totalSuccesses: 18, totalFailures: 3,
      lastSuccessAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      lastFailureAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      note: null, usable: true,
    },
    {
      id: 'p3', label: 'Claude Sonnet (جایگزین دوم)', protocol: 'anthropic' as const, vendor: 'anthropic',
      model: 'claude-3-5-sonnet-latest', baseUrl: null, keyHint: 'env', fromEnv: true,
      priority: 3, isActive: true, temperature: 0.8, maxOutputTokens: 8192,
      supportsJsonSchema: false, healthStatus: 'healthy' as const, lastError: null,
      consecutiveFailures: 0, totalSuccesses: 5, totalFailures: 0,
      lastSuccessAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
      lastFailureAt: null, note: 'کلید از secret محیط خوانده می‌شود', usable: true,
    },
  ],
  attempts: [
    { id: 1, cycle_id: 'c-2', provider_label: 'DeepSeek (جایگزین اول)', model: 'deepseek-chat', attempt_no: 1, phase: 'initial' as const, ok: false, latency_ms: 8420, error: '503 Service Unavailable', tokens_used: null, created_at: new Date(Date.now() - 20 * 60_000).toISOString() },
    { id: 2, cycle_id: 'c-2', provider_label: 'Claude Sonnet (جایگزین دوم)', model: 'claude-3-5-sonnet-latest', attempt_no: 2, phase: 'initial' as const, ok: true, latency_ms: 14200, error: null, tokens_used: 4210, created_at: new Date(Date.now() - 19 * 60_000).toISOString() },
  ],
  chain: [
    { id: 'p1', label: 'Gemini Flash (اصلی)', model: 'gemini-2.5-flash' },
    { id: 'p2', label: 'DeepSeek (جایگزین اول)', model: 'deepseek-chat' },
    { id: 'p3', label: 'Claude Sonnet (جایگزین دوم)', model: 'claude-3-5-sonnet-latest' },
  ],
  encryptionReady: true,
};
