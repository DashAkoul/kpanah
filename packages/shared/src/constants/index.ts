import type {
  PlanType,
  SkillLevel,
  SupportedUiLanguage,
  SupportedTargetLanguage,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────
// Cycle / engine rules
// ─────────────────────────────────────────────────────────────────────

export const CYCLE_LENGTH_DAYS = 7;
export const FREE_TRIAL_DAYS = 7;
/** اگر چرخه بیش از این تعداد روز باز بماند، AI فراخوانی نمی‌شود */
export const CYCLE_STALL_DAYS = 12;
export const LEITNER_BOXES = 5;

/** روزهای چرخه و نوع محتوا */
export const CYCLE_SCHEDULE = {
  1: 'TEACHING',
  2: 'TEACHING',
  3: 'TEACHING',
  4: 'TEACHING',
  5: 'TEACHING',
  6: 'HIDDEN_ASSESSMENT',
  7: 'CONSOLIDATION',
} as const;

/** فواصل مرور لایتنر بر حسب روز */
export const LEITNER_INTERVALS_DAYS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 21,
};

// ─────────────────────────────────────────────────────────────────────
// Economy
// ─────────────────────────────────────────────────────────────────────

export const ECONOMY = {
  rewardPerLesson: 10,
  rewardPerfectDay: 25,
  rewardStreak7: 100,
  penaltyNone: 0,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Plans (mirror of DB seed — used for validation & fallback)
// ─────────────────────────────────────────────────────────────────────

export interface PlanDefinition {
  id: string;
  planType: PlanType;
  titleFa: string;
  titleEn: string;
  durationDays: number;
  priceIrr: number;
  priceStars: number;
  discountPercent: number;
  badge: string | null;
}

export const PLAN_DEFINITIONS: readonly PlanDefinition[] = [
  {
    id: '2_weeks', planType: '2_WEEKS', titleFa: '۲ هفته‌ای', titleEn: '2 Weeks',
    durationDays: 14, priceIrr: 400_000, priceStars: 100, discountPercent: 20, badge: null,
  },
  {
    id: '1_month', planType: '1_MONTH', titleFa: '۱ ماهه', titleEn: '1 Month',
    durationDays: 30, priceIrr: 750_000, priceStars: 175, discountPercent: 20, badge: 'POPULAR',
  },
  {
    id: '3_months', planType: '3_MONTHS', titleFa: '۳ ماهه', titleEn: '3 Months',
    durationDays: 90, priceIrr: 1_800_000, priceStars: 400, discountPercent: 20, badge: null,
  },
  {
    id: '6_months', planType: '6_MONTHS', titleFa: '۶ ماهه', titleEn: '6 Months',
    durationDays: 180, priceIrr: 3_200_000, priceStars: 700, discountPercent: 20, badge: null,
  },
  {
    id: '1_year', planType: '1_YEAR', titleFa: '۱ ساله', titleEn: '1 Year',
    durationDays: 365, priceIrr: 5_500_000, priceStars: 1_150, discountPercent: 20, badge: 'BEST_VALUE',
  },
] as const;

export const PLAN_DURATION_DAYS: Record<PlanType, number> = {
  TRIAL: FREE_TRIAL_DAYS,
  '2_WEEKS': 14,
  '1_MONTH': 30,
  '3_MONTHS': 90,
  '6_MONTHS': 180,
  '1_YEAR': 365,
};

// ─────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_UI_LANGUAGE: SupportedUiLanguage = 'fa';
export const DEFAULT_TARGET_LANGUAGE: SupportedTargetLanguage = 'en';
export const RTL_LANGUAGES: readonly SupportedUiLanguage[] = ['fa', 'ar'];

export const UI_LANGUAGES: { code: SupportedUiLanguage; labelFa: string; labelEn: string; flag: string }[] = [
  { code: 'fa', labelFa: 'فارسی', labelEn: 'Persian', flag: '🇮🇷' },
  { code: 'en', labelFa: 'انگلیسی', labelEn: 'English', flag: '🇬🇧' },
  { code: 'ar', labelFa: 'عربی', labelEn: 'Arabic', flag: '🇸🇦' },
  { code: 'tr', labelFa: 'ترکی', labelEn: 'Turkish', flag: '🇹🇷' },
  { code: 'ru', labelFa: 'روسی', labelEn: 'Russian', flag: '🇷🇺' },
];

export const TARGET_LANGUAGES: { code: SupportedTargetLanguage; labelFa: string; labelEn: string; flag: string }[] = [
  { code: 'en', labelFa: 'انگلیسی', labelEn: 'English', flag: '🇬🇧' },
  { code: 'de', labelFa: 'آلمانی', labelEn: 'German', flag: '🇩🇪' },
  { code: 'fr', labelFa: 'فرانسوی', labelEn: 'French', flag: '🇫🇷' },
  { code: 'es', labelFa: 'اسپانیایی', labelEn: 'Spanish', flag: '🇪🇸' },
  { code: 'tr', labelFa: 'ترکی', labelEn: 'Turkish', flag: '🇹🇷' },
  { code: 'ar', labelFa: 'عربی', labelEn: 'Arabic', flag: '🇸🇦' },
];

export const SKILL_LEVELS: { code: SkillLevel; labelFa: string; labelEn: string; hintFa: string }[] = [
  { code: 'ZERO', labelFa: 'از صفر', labelEn: 'From zero', hintFa: 'هیچ آشنایی ندارم' },
  { code: 'A1', labelFa: 'مبتدی', labelEn: 'Beginner', hintFa: 'کلمات ساده می‌دانم' },
  { code: 'A2', labelFa: 'پایه', labelEn: 'Elementary', hintFa: 'جملات ساده می‌سازم' },
  { code: 'B1', labelFa: 'متوسط', labelEn: 'Intermediate', hintFa: 'می‌توانم مکالمه کنم' },
  { code: 'B2', labelFa: 'متوسط بالا', labelEn: 'Upper-Int.', hintFa: 'روان صحبت می‌کنم' },
  { code: 'C1', labelFa: 'پیشرفته', labelEn: 'Advanced', hintFa: 'تسلط حرفه‌ای دارم' },
];

export const LEARNING_GOALS: { code: string; labelFa: string; labelEn: string; icon: string }[] = [
  { code: 'TRAVEL', labelFa: 'سفر و گردشگری', labelEn: 'Travel', icon: '✈️' },
  { code: 'BUSINESS', labelFa: 'کار و مذاکره', labelEn: 'Business', icon: '💼' },
  { code: 'EXAM', labelFa: 'آزمون (IELTS/TOEFL)', labelEn: 'Exam prep', icon: '📝' },
  { code: 'DAILY', labelFa: 'مکالمه روزمره', labelEn: 'Daily conversation', icon: '💬' },
  { code: 'MIGRATION', labelFa: 'مهاجرت و زندگی', labelEn: 'Migration', icon: '🌍' },
  { code: 'ACADEMIC', labelFa: 'تحصیل دانشگاهی', labelEn: 'Academic', icon: '🎓' },
];

/** نگاشت زبان تلگرام به زبان رابط */
export function languageFromTelegramCode(code: string | undefined): SupportedUiLanguage {
  if (!code) return DEFAULT_UI_LANGUAGE;
  const base = code.split('-')[0]?.toLowerCase() ?? '';
  const supported: SupportedUiLanguage[] = ['fa', 'en', 'ar', 'tr', 'ru'];
  return (supported as string[]).includes(base)
    ? (base as SupportedUiLanguage)
    : DEFAULT_UI_LANGUAGE;
}

// ─────────────────────────────────────────────────────────────────────
// Security
// ─────────────────────────────────────────────────────────────────────

export const SECURITY = {
  jwtTtlSeconds: 15 * 60,
  initDataMaxAgeSeconds: 24 * 60 * 60,
  rateLimitPerMinute: 60,
  rateLimitPerDay: 2000,
  maxPromptLength: 1000,
} as const;

/** الگوهای پرخطر در ورودی کاربر — جلوگیری از Prompt Injection */
export const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|prompts?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules)/i,
  /act\s+as\s+(a\s+)?(developer|admin|root|system)/i,
  /<\s*\|?\s*(im_start|system|assistant)\s*\|?\s*>/i,
  /\[\s*(system|INST)\s*\]/i,
  /###\s*(system|instruction)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /pretend\s+(to\s+be|you\s+are)/i,
];

export const DEFAULT_GATE_PATH = '/kpanah56/8fjg7rfb/v1/gate';

// ─────────────────────────────────────────────────────────────────────
// AI provider presets
//
// Each preset fills the panel's form with a working starting point so the
// operator only has to paste a key. `baseUrl: null` means the Worker's
// built-in endpoint is correct — the field stays empty on purpose.
//
// `supportsJsonSchema` marks providers that accept a real JSON schema
// (only Gemini, as of now). For the rest the engine still validates the
// response against Zod, it just cannot constrain the model beforehand.
// ─────────────────────────────────────────────────────────────────────

export const AI_VENDOR_PRESETS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'gemini',
    vendor: 'gemini',
    model: 'gemini-2.5-flash',
    baseUrl: null,
    supportsJsonSchema: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'پیشنهادی — سریع و ارزان، از اسکیمای JSON پشتیبانی می‌کند.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai_compatible',
    vendor: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: null,
    supportsJsonSchema: false,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'جایگزین خوب — کیفیت بالا با هزینه کم.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    vendor: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    baseUrl: null,
    supportsJsonSchema: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'کیفیت استدلال بالا؛ مناسب به‌عنوان جایگزین نهایی.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai_compatible',
    vendor: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    supportsJsonSchema: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'نیازمند وارد کردن baseUrl.',
  },
  {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai_compatible',
    vendor: 'groq',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsJsonSchema: false,
    keyUrl: 'https://console.groq.com/keys',
    note: 'بسیار سریع و سخاوتمند در پلن رایگان.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai_compatible',
    vendor: 'openrouter',
    model: 'google/gemini-2.0-flash-exp:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    supportsJsonSchema: false,
    keyUrl: 'https://openrouter.ai/keys',
    note: 'دسترسی به چندین مدل با یک کلید.',
  },
  {
    id: 'together',
    label: 'Together AI',
    protocol: 'openai_compatible',
    vendor: 'together',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    supportsJsonSchema: false,
    keyUrl: 'https://api.together.ai/settings/api-keys',
    note: 'مدل‌های open-source میزبانی‌شده.',
  },
  {
    id: 'custom',
    label: 'سفارشی (سازگار با OpenAI)',
    protocol: 'openai_compatible',
    vendor: 'custom',
    model: '',
    baseUrl: '',
    supportsJsonSchema: false,
    keyUrl: '',
    note: 'هر سرویسی که با استاندارد OpenAI سازگار باشد.',
  },
] as const;

/** برچسب‌های قابل‌نمایش برای وضعیت سلامت provider */
export const AI_HEALTH_LABELS = {
  unknown: 'نامشخص',
  healthy: 'سالم',
  degraded: 'ناپایدار',
  failing: 'خراب',
} as const;
