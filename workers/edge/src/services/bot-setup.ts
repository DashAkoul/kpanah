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

const SETUP_CACHE_KEY = 'bot-ui:setup-done';
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
    ],
  });
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
