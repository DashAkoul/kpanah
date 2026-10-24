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

// ═════════════════════════════════════════════════════════════════════
// پروفایل آموزشی هر روز (مرحلهٔ ۸ — «بهینه‌سازی‌ها ۱ تا ۷»)
//
// چرا: قبلاً هر ۵ روز آموزشی یکسان تولید می‌شد (همان تعداد آیتم، همان
// ترکیب بازخوانی) — یعنی چرخه هیچ پیشرفتی نداشت و فقط ۷ بار محتوای مشابه
// پشت سر هم نشان می‌داد. این پروفایل‌ها یک قوس یادگیری واقعی می‌سازند:
//   شناخت → گسترش → کاربرد → ترکیب → روانی → سنجش پنهان → تثبیت
//
// `newItemRatio` نسبت محتوای تازه به بازخوانی است (۰..۱). روزهای آخر
// عمداً تا ۸۰٪ بازخوانی دارند چون مرور فاصله‌دار مؤثرتر از محتوای تازه است.
// ═════════════════════════════════════════════════════════════════════

export interface DayProfile {
  /** برچسب کوتاه مرحله (برای UI و پرامپت) */
  phase: string;
  objective: string;
  objectiveFa: string;
  /** تعداد آیتم drill بخش اول (min..max) */
  items: { min: number; max: number };
  /** تعداد سوال بخش دوم (min..max) */
  part2: { min: number; max: number };
  /** نسبت آیتم‌های کاملاً تازه (بقیه بازخوانی روزهای قبلی) */
  newItemRatio: number;
  /** تمرکز اصلی روز — به مدل هدایت می‌کند */
  emphasis: string;
}

export const DAY_PROFILES: Record<number, DayProfile> = {
  1: {
    phase: 'ORIENT',
    objective: 'Introduce the core set; recognition and pronunciation only',
    objectiveFa: 'آشنایی با هستهٔ واژگان — فقط تشخیص و تلفظ',
    items: { min: 3, max: 5 },
    part2: { min: 2, max: 3 },
    newItemRatio: 1,
    emphasis:
      'Slow first contact. Clear pronunciation, one meaning per item, and simple examples. Do not introduce patterns or rules yet.',
  },
  2: {
    phase: 'EXPAND',
    objective: 'Expand the core set with related items and substitution drills',
    objectiveFa: 'گسترش هسته با آیتم‌های مرتبط و تمرین جایگزینی',
    items: { min: 5, max: 6 },
    part2: { min: 3, max: 4 },
    newItemRatio: 1,
    emphasis:
      'Add new but related items. The substitution drill is mandatory — the learner should see the slot swap work. Reference day 1 items only to link them.',
  },
  3: {
    phase: 'APPLY',
    objective: 'Use days 1-2 in one concrete real-world scenario',
    objectiveFa: 'کاربرد روزهای ۱ و ۲ در یک موقعیت واقعی',
    items: { min: 3, max: 4 },
    part2: { min: 4, max: 6 },
    newItemRatio: 0.5,
    emphasis:
      'A single realistic scenario (e.g. ordering, asking directions, buying a ticket) that spans several part-2 questions. Reuse prior items; add only what the scenario needs.',
  },
  4: {
    phase: 'INTEGRATE',
    objective: 'Combine prior items with a few new ones in longer exchanges',
    objectiveFa: 'ترکیب آیتم‌های قبلی با چند مورد تازه در مکالمهٔ بلندتر',
    items: { min: 4, max: 5 },
    part2: { min: 3, max: 5 },
    newItemRatio: 0.4,
    emphasis:
      'Half review, half new. Questions should chain: the answer of one feeds the next. Introduce multi-turn exchanges.',
  },
  5: {
    phase: 'FLUENCY',
    objective: 'Fluency over accuracy — recognise everything quickly',
    objectiveFa: 'روانی، نه دقت — تشخیص سریع همهٔ آیتم‌ها',
    items: { min: 4, max: 6 },
    part2: { min: 4, max: 5 },
    newItemRatio: 0.25,
    emphasis:
      'Speed: the learner should recognise items with less thinking time. Mostly prior items in new combinations. Only one or two genuinely new items.',
  },
  6: {
    phase: 'ASSESS',
    objective: 'Hidden assessment of retention across the whole cycle',
    objectiveFa: 'سنجش پنهان یادگیری در کل چرخه',
    items: { min: 4, max: 6 },
    part2: { min: 4, max: 6 },
    newItemRatio: 0.1,
    emphasis:
      'Must look like a normal teaching day. Never mention test, exam, score or assessment. Cover items from days 1-5 evenly; difficulty should reveal gaps, not punish.',
  },
  7: {
    phase: 'CONSOLIDATE',
    objective: 'Rebuild weak terms with completely new examples',
    objectiveFa: 'ترمیم نقاط ضعف با مثال‌های کاملاً تازه',
    items: { min: 3, max: 6 },
    part2: { min: 2, max: 4 },
    newItemRatio: 0,
    emphasis:
      'ONLY the learner\'s weak terms. Every example sentence must be brand new — repeating an old example teaches nothing. Swap the context (person, place, object) to force real recall.',
  },
};

/** پروفایل یک روز با fallback امن (برای چرخه‌های قدیمی/کش‌شده) */
export function dayProfile(dayNumber: number): DayProfile {
  return DAY_PROFILES[dayNumber] ?? DAY_PROFILES[1]!;
}

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
  // اشتراک ۲ هفته‌ای: بدون تخفیف — هدفش فقط «شروع ارزان» برای ترغیب کاربر است
  {
    id: '2_weeks', planType: '2_WEEKS', titleFa: '۲ هفته‌ای', titleEn: '2 Weeks',
    durationDays: 14, priceIrr: 400_000, priceStars: 100, discountPercent: 0, badge: null,
  },
  {
    id: '1_month', planType: '1_MONTH', titleFa: '۱ ماهه', titleEn: '1 Month',
    durationDays: 30, priceIrr: 750_000, priceStars: 175, discountPercent: 5, badge: 'POPULAR',
  },
  {
    id: '3_months', planType: '3_MONTHS', titleFa: '۳ ماهه', titleEn: '3 Months',
    durationDays: 90, priceIrr: 1_800_000, priceStars: 400, discountPercent: 12, badge: null,
  },
  {
    id: '6_months', planType: '6_MONTHS', titleFa: '۶ ماهه', titleEn: '6 Months',
    durationDays: 180, priceIrr: 3_200_000, priceStars: 700, discountPercent: 18, badge: null,
  },
  {
    id: '1_year', planType: '1_YEAR', titleFa: '۱ ساله', titleEn: '1 Year',
    durationDays: 365, priceIrr: 5_500_000, priceStars: 1_150, discountPercent: 25, badge: 'BEST_VALUE',
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
export const RTL_LANGUAGES: readonly string[] = ['fa', 'ar', 'he', 'ur', 'ps'];

export interface DialectOption {
  code: string;
  nativeName: string;
  labelEn: string;
}

export interface LanguageOption {
  code: string;
  /** نام زبان به خودِ آن زبان — به‌عنوان تیتر نمایش داده می‌شود */
  nativeName: string;
  labelEn: string;
  flag: string;
  /** گویش‌های اصلی (برای زبان‌هایی مثل انگلیسی و اسپانیایی) */
  dialects?: DialectOption[];
  /** آیا رابط کاربری به این زبان ترجمه شده است */
  uiTranslated?: boolean;
}

/**
 * کاتالوگ زبان‌های زندهٔ دنیا — منبع واحد برای منوی کشویی (با جست‌وجو)
 * و انتخاب گویش. تیتر هر ردیف «نام بومی» زبان است و زیرش نام انگلیسی.
 */
export const LANGUAGE_CATALOG: readonly LanguageOption[] = [
  { code: 'fa', nativeName: 'فارسی', labelEn: 'Persian', flag: '🇮🇷', uiTranslated: true },
  {
    code: 'en', nativeName: 'English', labelEn: 'English', flag: '🇬🇧', uiTranslated: true,
    dialects: [
      { code: 'en-US', nativeName: 'American', labelEn: 'American' },
      { code: 'en-GB', nativeName: 'British', labelEn: 'British' },
      { code: 'en-AU', nativeName: 'Australian', labelEn: 'Australian' },
      { code: 'en-CA', nativeName: 'Canadian', labelEn: 'Canadian' },
    ],
  },
  { code: 'ar', nativeName: 'العربية', labelEn: 'Arabic', flag: '🇸🇦', uiTranslated: true },
  { code: 'tr', nativeName: 'Türkçe', labelEn: 'Turkish', flag: '🇹🇷', uiTranslated: true },
  { code: 'ru', nativeName: 'Русский', labelEn: 'Russian', flag: '🇷🇺', uiTranslated: true },
  { code: 'de', nativeName: 'Deutsch', labelEn: 'German', flag: '🇩🇪' },
  { code: 'fr', nativeName: 'Français', labelEn: 'French', flag: '🇫🇷' },
  {
    code: 'es', nativeName: 'Español', labelEn: 'Spanish', flag: '🇪🇸',
    dialects: [
      { code: 'es-ES', nativeName: 'Español (España)', labelEn: 'European' },
      { code: 'es-MX', nativeName: 'Español (Latinoamérica)', labelEn: 'Latin American' },
    ],
  },
  {
    code: 'pt', nativeName: 'Português', labelEn: 'Portuguese', flag: '🇵🇹',
    dialects: [
      { code: 'pt-PT', nativeName: 'Português (Portugal)', labelEn: 'European' },
      { code: 'pt-BR', nativeName: 'Português (Brasil)', labelEn: 'Brazilian' },
    ],
  },
  { code: 'it', nativeName: 'Italiano', labelEn: 'Italian', flag: '🇮🇹' },
  { code: 'nl', nativeName: 'Nederlands', labelEn: 'Dutch', flag: '🇳🇱' },
  { code: 'sv', nativeName: 'Svenska', labelEn: 'Swedish', flag: '🇸🇪' },
  { code: 'no', nativeName: 'Norsk', labelEn: 'Norwegian', flag: '🇳🇴' },
  { code: 'da', nativeName: 'Dansk', labelEn: 'Danish', flag: '🇩🇰' },
  { code: 'fi', nativeName: 'Suomi', labelEn: 'Finnish', flag: '🇫🇮' },
  { code: 'is', nativeName: 'Íslenska', labelEn: 'Icelandic', flag: '🇮🇸' },
  { code: 'pl', nativeName: 'Polski', labelEn: 'Polish', flag: '🇵🇱' },
  { code: 'cs', nativeName: 'Čeština', labelEn: 'Czech', flag: '🇨🇿' },
  { code: 'sk', nativeName: 'Slovenčina', labelEn: 'Slovak', flag: '🇸🇰' },
  { code: 'hu', nativeName: 'Magyar', labelEn: 'Hungarian', flag: '🇭🇺' },
  { code: 'ro', nativeName: 'Română', labelEn: 'Romanian', flag: '🇷🇴' },
  { code: 'bg', nativeName: 'Български', labelEn: 'Bulgarian', flag: '🇧🇬' },
  { code: 'el', nativeName: 'Ελληνικά', labelEn: 'Greek', flag: '🇬🇷' },
  { code: 'uk', nativeName: 'Українська', labelEn: 'Ukrainian', flag: '🇺🇦' },
  { code: 'sr', nativeName: 'Српски', labelEn: 'Serbian', flag: '🇷🇸' },
  { code: 'hr', nativeName: 'Hrvatski', labelEn: 'Croatian', flag: '🇭🇷' },
  { code: 'sl', nativeName: 'Slovenščina', labelEn: 'Slovenian', flag: '🇸🇮' },
  { code: 'lt', nativeName: 'Lietuvių', labelEn: 'Lithuanian', flag: '🇱🇹' },
  { code: 'lv', nativeName: 'Latviešu', labelEn: 'Latvian', flag: '🇱🇻' },
  { code: 'et', nativeName: 'Eesti', labelEn: 'Estonian', flag: '🇪🇪' },
  { code: 'hy', nativeName: 'Հայերեն', labelEn: 'Armenian', flag: '🇦🇲' },
  { code: 'ka', nativeName: 'ქართული', labelEn: 'Georgian', flag: '🇬🇪' },
  { code: 'az', nativeName: 'Azərbaycan', labelEn: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'kk', nativeName: 'Қазақша', labelEn: 'Kazakh', flag: '🇰🇿' },
  { code: 'uz', nativeName: 'Oʻzbek', labelEn: 'Uzbek', flag: '🇺🇿' },
  { code: 'ky', nativeName: 'Кыргызча', labelEn: 'Kyrgyz', flag: '🇰🇬' },
  { code: 'tg', nativeName: 'Тоҷикӣ', labelEn: 'Tajik', flag: '🇹🇯' },
  { code: 'ku', nativeName: 'Kurdî', labelEn: 'Kurdish', flag: '🏴' },
  { code: 'ps', nativeName: 'پښتو', labelEn: 'Pashto', flag: '🇦🇫' },
  { code: 'ur', nativeName: 'اردو', labelEn: 'Urdu', flag: '🇵🇰' },
  { code: 'hi', nativeName: 'हिन्दी', labelEn: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', nativeName: 'বাংলা', labelEn: 'Bengali', flag: '🇧🇩' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', labelEn: 'Punjabi', flag: '🇮🇳' },
  { code: 'gu', nativeName: 'ગુજરાતી', labelEn: 'Gujarati', flag: '🇮🇳' },
  { code: 'mr', nativeName: 'मराठी', labelEn: 'Marathi', flag: '🇮🇳' },
  { code: 'ta', nativeName: 'தமிழ்', labelEn: 'Tamil', flag: '🇮🇳' },
  { code: 'te', nativeName: 'తెలుగు', labelEn: 'Telugu', flag: '🇮🇳' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', labelEn: 'Kannada', flag: '🇮🇳' },
  { code: 'ml', nativeName: 'മലയാളം', labelEn: 'Malayalam', flag: '🇮🇳' },
  { code: 'si', nativeName: 'සිංහල', labelEn: 'Sinhala', flag: '🇱🇰' },
  { code: 'ne', nativeName: 'नेपाली', labelEn: 'Nepali', flag: '🇳🇵' },
  {
    code: 'zh', nativeName: '中文', labelEn: 'Chinese', flag: '🇨🇳',
    dialects: [
      { code: 'zh-CN', nativeName: '简体中文', labelEn: 'Simplified' },
      { code: 'zh-TW', nativeName: '繁體中文', labelEn: 'Traditional' },
    ],
  },
  { code: 'ja', nativeName: '日本語', labelEn: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', nativeName: '한국어', labelEn: 'Korean', flag: '🇰🇷' },
  { code: 'mn', nativeName: 'Монгол', labelEn: 'Mongolian', flag: '🇲🇳' },
  { code: 'th', nativeName: 'ไทย', labelEn: 'Thai', flag: '🇹🇭' },
  { code: 'lo', nativeName: 'ລາວ', labelEn: 'Lao', flag: '🇱🇦' },
  { code: 'km', nativeName: 'ខ្មែរ', labelEn: 'Khmer', flag: '🇰🇭' },
  { code: 'my', nativeName: 'မြန်မာ', labelEn: 'Burmese', flag: '🇲🇲' },
  { code: 'vi', nativeName: 'Tiếng Việt', labelEn: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id', nativeName: 'Bahasa Indonesia', labelEn: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', nativeName: 'Bahasa Melayu', labelEn: 'Malay', flag: '🇲🇾' },
  { code: 'tl', nativeName: 'Filipino', labelEn: 'Filipino', flag: '🇵🇭' },
  { code: 'jv', nativeName: 'Basa Jawa', labelEn: 'Javanese', flag: '🇮🇩' },
  { code: 'he', nativeName: 'עברית', labelEn: 'Hebrew', flag: '🇮🇱' },
  { code: 'am', nativeName: 'አማርኛ', labelEn: 'Amharic', flag: '🇪🇹' },
  { code: 'sw', nativeName: 'Kiswahili', labelEn: 'Swahili', flag: '🇰🇪' },
  { code: 'ha', nativeName: 'Hausa', labelEn: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', nativeName: 'Yorùbá', labelEn: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', nativeName: 'Igbo', labelEn: 'Igbo', flag: '🇳🇬' },
  { code: 'zu', nativeName: 'isiZulu', labelEn: 'Zulu', flag: '🇿🇦' },
  { code: 'af', nativeName: 'Afrikaans', labelEn: 'Afrikaans', flag: '🇿🇦' },
  { code: 'so', nativeName: 'Soomaali', labelEn: 'Somali', flag: '🇸🇴' },
  { code: 'sq', nativeName: 'Shqip', labelEn: 'Albanian', flag: '🇦🇱' },
  { code: 'bs', nativeName: 'Bosanski', labelEn: 'Bosnian', flag: '🇧🇦' },
  { code: 'mk', nativeName: 'Македонски', labelEn: 'Macedonian', flag: '🇲🇰' },
  { code: 'be', nativeName: 'Беларуская', labelEn: 'Belarusian', flag: '🇧🇾' },
  { code: 'mt', nativeName: 'Malti', labelEn: 'Maltese', flag: '🇲🇹' },
  { code: 'ga', nativeName: 'Gaeilge', labelEn: 'Irish', flag: '🇮🇪' },
  { code: 'cy', nativeName: 'Cymraeg', labelEn: 'Welsh', flag: '🏴' },
  { code: 'eu', nativeName: 'Euskara', labelEn: 'Basque', flag: '🏴' },
  { code: 'ca', nativeName: 'Català', labelEn: 'Catalan', flag: '🏴' },
  { code: 'gl', nativeName: 'Galego', labelEn: 'Galician', flag: '🏴' },
  { code: 'la', nativeName: 'Latina', labelEn: 'Latin', flag: '🏛️' },
] as const;

/** زبان‌هایی که رابط کاربری به آن‌ها ترجمه شده است */
export const UI_LANGUAGES = LANGUAGE_CATALOG.filter((l) => l.uiTranslated);

/** همهٔ زبان‌های قابل یادگیری */
export const TARGET_LANGUAGES = LANGUAGE_CATALOG;

/** برای z.enum — باید tuple از literal باشد */
export const UI_LANGUAGE_CODES = [
  'fa', 'en', 'ar', 'tr', 'ru',
  'de', 'fr', 'es', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'is',
  'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'uk', 'sr', 'hr', 'sl',
  'lt', 'lv', 'et', 'hy', 'ka', 'az', 'kk', 'uz', 'ky', 'tg', 'ku', 'ps',
  'ur', 'hi', 'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'si', 'ne',
  'zh', 'ja', 'ko', 'mn', 'th', 'lo', 'km', 'my', 'vi', 'id', 'ms', 'tl', 'jv',
  'he', 'am', 'sw', 'ha', 'yo', 'ig', 'zu', 'af', 'so', 'sq', 'bs', 'mk',
  'be', 'mt', 'ga', 'cy', 'eu', 'ca', 'gl', 'la',
] as const;

export const TARGET_LANGUAGE_CODES = [
  'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
  'ar', 'tr', 'fa', 'hi', 'ur', 'id', 'ms', 'nl', 'pl', 'sv',
  'no', 'da', 'fi', 'is', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'uk',
  'sr', 'hr', 'sl', 'lt', 'lv', 'et', 'hy', 'ka', 'az', 'kk', 'uz', 'ky', 'tg',
  'ku', 'ps', 'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'si', 'ne',
  'mn', 'th', 'lo', 'km', 'my', 'vi', 'tl', 'jv',
  'he', 'am', 'sw', 'ha', 'yo', 'ig', 'zu', 'af', 'so', 'sq', 'bs', 'mk',
  'be', 'mt', 'ga', 'cy', 'eu', 'ca', 'gl', 'la',
] as const;

/** پیدا کردن یک زبان بر اساس کد (با تحمل کد گویش مثل en-US) */
export function findLanguage(code: string | null | undefined): LanguageOption | undefined {
  if (!code) return undefined;
  const base = code.split('-')[0];
  return LANGUAGE_CATALOG.find((l) => l.code === code || l.code === base);
}

/** گویش‌های یک زبان (اگر داشته باشد) */
export function dialectsFor(code: string | null | undefined): DialectOption[] {
  return findLanguage(code)?.dialects ?? [];
}

export const SKILL_LEVELS: { code: SkillLevel; labelFa: string; labelEn: string; hintFa: string }[] = [
  { code: 'ZERO', labelFa: 'از صفر', labelEn: 'From zero', hintFa: 'هیچ آشنایی ندارم' },
  { code: 'A1', labelFa: 'مبتدی', labelEn: 'Beginner', hintFa: 'کلمات ساده می‌دانم' },
  { code: 'A2', labelFa: 'پایه', labelEn: 'Elementary', hintFa: 'جملات ساده می‌سازم' },
  { code: 'B1', labelFa: 'متوسط', labelEn: 'Intermediate', hintFa: 'می‌توانم مکالمه کنم' },
  { code: 'B2', labelFa: 'متوسط بالا', labelEn: 'Upper-Int.', hintFa: 'روان صحبت می‌کنم' },
  { code: 'C1', labelFa: 'پیشرفته', labelEn: 'Advanced', hintFa: 'تسلط حرفه‌ای دارم' },
];

/**
 * نسخهٔ **قواعد آموزشی** سیستم (چک‌لیست ۱.۵).
 *
 * ⚠️ هر تغییر در آستانه‌ها، فواصل لایتنر یا معیارهای مرحله باید این عدد را
 * بالا ببرد؛ در غیر این صورت نمی‌توان گفت رفتار سیستم با کدام نسخه ساخته
 * شده است.
 */
export const SYSTEM_RULES_VERSION = 1;

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
  /**
   * ⚠️ ۱۵ دقیقه برای یک درس کافی نبود: کاربر مبتدی ممکن است ۲۰+ دقیقه در
   * درس بماند؛ توکن وسط درس منقضی می‌شد و `complete-lesson` با 401
   * **بی‌صدا** شکست می‌خورد (دکمهٔ «انجام شد» هیچ کاری نمی‌کرد).
   * ۲ ساعت امن است و کلاینت هم روی 401 یک‌بار re-auth می‌کند.
   */
  jwtTtlSeconds: 2 * 60 * 60,
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
    // ⚠️ gemini-2.5-flash بازنشسته شده («no longer available to new users»).
    model: 'gemini-3.8-flash',
    baseUrl: null,
    supportsJsonSchema: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'پیشنهادی — سریع و ارزان، از اسکیمای JSON پشتیبانی می‌کند. برای دیدن فهرست مدل‌های موجود، دکمهٔ «تست و دریافت مدل‌ها» را بزن.',
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
