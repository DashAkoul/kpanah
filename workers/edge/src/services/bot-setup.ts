import type { Env } from '../types';
import type { InlineKeyboard } from '../routes/telegram-bot';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  ظاهر ربات — دکمهٔ منو و لیست دستورها
 *
 *  چرا: بدون این دو فراخوانی، کاربر باید دکمهٔ شیشه‌ای («باز کردن») را
 *  در پیام /start پیدا کند و هیچ راهی ندارد اپ را از کنار کادر تایپ
 *  باز کند. `setChatMenuButton` همان دکمهٔ گوشهٔ چت را وصل می‌کند و
 *  `setMyCommands` لیست دستورها را در منو نشان می‌دهد.
 *
 *  ⚠️ هر دو idempotent هستند ولی روی **هر** وبهوک صدا زدنشان اتلاف
 *  سهمیهٔ تلگرام است (لیمیت ~۳۰ پیام/ثانیه، و این‌ها محدودیت جدا have).
 *  پس با یک کلید KV نتیجه را ۲۴ ساعت نگه می‌داریم.
 * ═════════════════════════════════════════════════════════════════════
 */

/**
 * ⚠️ نسخه‌دار است: با تغییر لیست دستورها یا کیبورد، نسخه را بالا ببر
 * وگرنه کش ۲۴ ساعته مانع اعمال تغییر می‌شود و کاربر همچنان لیست قدیمی
 * را می‌بیند. v2 = افزودن دستور /menu.
 */
const SETUP_CACHE_KEY = 'bot-ui:setup-done:v2';
const SETUP_TTL_SECONDS = 86_400; // ۲۴ ساعت

/** فراخوانی خام API تلگرام */
async function callTelegram(
  env: Env,
  method: string,
  payload: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'no bot token' };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * دکمهٔ منو (کنار کادر تایپ) → باز کردن مینی‌اپ.
 *
 * `menu_button` با `web_app` باعث می‌شود کاربر از هر صفحهٔ چت بتواند اپ
 * را باز کند. اگر مینی‌اپ ثبت نشده باشد، متن ساده نشان می‌دهیم.
 *
 * ⚠️ نکتهٔ عملی: متن انگلیسی («Open app») روی این ربات اعمال نشد و
 * تلگرام همچنان متن فارسی قبلی را نگه داشت (متن در سمت کاربر کش می‌شود).
 * پس فارسی می‌فرستیم — هم با کاربران ایرانی هم‌خوان است و هم واقعاً
 * ذخیره می‌شود.
 */
export async function setChatMenuButton(env: Env): Promise<{ ok: boolean; error?: string }> {
  const url = env.MINI_APP_URL ?? '';
  return callTelegram(env, 'setChatMenuButton', {
    menu_button: url
      ? { type: 'web_app', text: 'آموزش زبان', web_app: { url } }
      : { type: 'commands' },
  });
}

/**
 * لیست دستورها — در منو و کیبورد «/» نمایش داده می‌شود.
 *
 * زبان پیش‌فرض انگلیسی است (تاریخ/زبان ربات). فارسی‌زبانان هم با «/»
 * همان لیست را می‌بینند؛ توضیح هر دستور کافی است.
 */
export async function setBotCommands(env: Env): Promise<{ ok: boolean; error?: string }> {
  return callTelegram(env, 'setMyCommands', {
    commands: [
      { command: 'start', description: '🏁 Start / restart' },
      { command: 'app', description: '🎓 Open the language app' },
      { command: 'lesson', description: '📘 Today’s lesson' },
      { command: 'progress', description: '📊 My progress & streak' },
      { command: 'store', description: '⭐ Plans & premium' },
      { command: 'help', description: '❓ Help & support' },
      { command: 'menu', description: '⌨️ Show the button keyboard' },
    ],
  });
}

// ═════════════════════════════════════════════════════════════════════
//  کیبورد ثابت پایین صفحه (ReplyKeyboardMarkup)
//
//  ⚠️ چرا جدا از کیبورد inline: دکمه‌های inline داخل **پیام** زندگی
//  می‌کنند و با اسکرول یا پیام بعدی از دسترس خارج می‌شوند. کیبورد ثابت
//  همیشه بالای کادر تایپ می‌ماند (`is_persistent`) و کاربر بدون حفظ‌کردن
//  هیچ دستوری می‌تواند کارهای اصلی را انجام دهد.
//
//  ⚠️ دکمه‌های غیر-`web_app` در کیبورد ثابت، **متن برچسب** را به‌عنوان
//  پیام می‌فرستند (نه callback). پس وبهوک باید همان برچسب را به دستور
//  نگاشت کند — `replyLabelToCommand` همین کار را می‌کند.
// ═════════════════════════════════════════════════════════════════════

/** برچسب دکمه‌های کیبورد ثابت — تنها منبع حقیقت برای متن و تطبیق */
export const REPLY_LABELS = {
  openApp: '🎓 باز کردن اپلیکیشن',
  lesson: '📘 درس امروز',
  progress: '📊 پیشرفت من',
  store: '⭐ پلن‌ها',
  help: '❓ راهنما',
} as const;

export interface ReplyKeyboard {
  keyboard: { text: string; web_app?: { url: string } }[][];
  resize_keyboard: boolean;
  is_persistent: boolean;
  input_field_placeholder?: string;
}

/** کیبورد ثابت — دکمهٔ اپ در ردیف اول (تنها دکمهٔ web_app) */
export function buildReplyKeyboard(env: Env): ReplyKeyboard {
  const url = env.MINI_APP_URL ?? '';
  const openApp: { text: string; web_app?: { url: string } } = url
    ? { text: REPLY_LABELS.openApp, web_app: { url } }
    : { text: REPLY_LABELS.openApp };

  return {
    keyboard: [
      [openApp],
      [{ text: REPLY_LABELS.lesson }, { text: REPLY_LABELS.progress }],
      [{ text: REPLY_LABELS.store }, { text: REPLY_LABELS.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'یک گزینه را انتخاب کن یا / را بزن…',
  };
}

/** نگاشت برچسب کیبورد ثابت → دستور. اگر برچسب ناشناخته بود `null`. */
export function replyLabelToCommand(text: string): string | null {
  const map: Record<string, string> = {
    [REPLY_LABELS.lesson]: '/lesson',
    [REPLY_LABELS.progress]: '/progress',
    [REPLY_LABELS.store]: '/store',
    [REPLY_LABELS.help]: '/help',
  };
  return map[text.trim()] ?? null;
}

/**
 * تنظیم ظاهر ربات — حداکثر ۲۴ ساعت یک بار (KV).
 * اگر KV در دسترس نباشد، در همان فراخوانی یک بار اجرا می‌شود.
 */
export async function ensureBotUi(env: Env): Promise<void> {
  const kv = env.CACHE_KV;

  if (kv) {
    try {
      const done = await kv.get(SETUP_CACHE_KEY);
      if (done) return;
    } catch {
      // KV خطا داد → همان حالا اجرا کن (بدون کش)
    }
  }

  const [menu, commands] = await Promise.allSettled([
    setChatMenuButton(env),
    setBotCommands(env),
  ]);

  for (const r of [menu, commands]) {
    if (r.status === 'rejected') {
      console.warn('[bot-ui] setup failed:', r.reason);
    } else if (!r.value.ok) {
      console.warn(`[bot-ui] setup failed: ${r.value.error}`);
    }
  }

  if (kv) {
    // TTL حداقل ۶۰ ثانیه (وگرنه KV خطای 400 می‌دهد)
    kv.put(SETUP_CACHE_KEY, '1', { expirationTtl: SETUP_TTL_SECONDS }).catch(() => {});
  }
}

// ═════════════════════════════════════════════════════════════════════
//  کیبورد غنی‌تر برای /start
// ═════════════════════════════════════════════════════════════════════

/**
 * کیبورد خوش‌آمد: دکمهٔ اصلی اپ + میان‌برهای مفید.
 *
 * ⚠️ دکمهٔ `web_app` باید در **ردیف اول** باشد — تلگرام روی موبایل فقط
 * یک ردیف از دکمه‌های web_app را کامل نشان می‌دهد.
 * ⚠️ دکمه‌های callback_data حداکثر ۶۴ بایت.
 */
export function buildWelcomeKeyboard(env: Env, startParam?: string): InlineKeyboard {
  const base = env.MINI_APP_URL ?? '';
  const params = new URLSearchParams();
  if (startParam) params.set('startapp', startParam);
  const qs = params.toString();
  const url = qs ? `${base}?${qs}` : base;

  if (!base) return { inline_keyboard: [] };

  return {
    inline_keyboard: [
      [{ text: '🎓 باز کردن اپلیکیشن', web_app: { url } }],
      [
        { text: '📊 پیشرفت من', callback_data: 'my_progress' },
        { text: '⭐ پلن‌ها', callback_data: 'open_store' },
      ],
      [{ text: '❓ راهنما', callback_data: 'help' }],
    ],
  };
}
