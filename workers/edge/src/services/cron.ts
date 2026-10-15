import type { Env } from '../types';
import { ContentRepository } from './repository';
import { SupabaseClient } from './supabase';
import { runCycleGeneration, runLessonGeneration } from '../routes/learn';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  کارهای زمان‌بندی‌شده (Cloudflare Cron Triggers)
 *
 *  سه کرون در `wrangler.toml` تعریف شده بود ولی **هیچ handler ای وجود نداشت**
 *  — یعنی تریگرها فعال بودند و هیچ کاری نمی‌کردند. این فایل همان handler است.
 *
 *  چرا Cron و نه Queues: Cloudflare Queues/Workflows فقط روی پلن پولی فعال
 *  است («The specified queue settings are invalid»). Cron روی پلن رایگان
 *  کار می‌کند و برای این حجم کافی است. اگر روزی پلن ارتقا یافت،
 *  `GENERATION_QUEUE` را در wrangler.toml اضافه کنید؛ کد خودکار از صف
 *  استفاده می‌کند و این کرون نقش «تور اطمینان» را بازی می‌کند.
 * ═════════════════════════════════════════════════════════════════════
 */

function repo(env: Env): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

// ═════════════════════════════════════════════════════════════════════
// ۱. ساعتی — انقضای اشتراک‌ها  (cron: 0 * * * *)
// ═════════════════════════════════════════════════════════════════════

export async function runHourlyMaintenance(
  env: Env
): Promise<{ expired: number; prunedCache: number }> {
  const r = repo(env);
  const overdue = await r.listOverdueSubscriptions(200);
  if (overdue.length > 0) {
    await r.expireSubscriptions(overdue.map((s) => s.id));
  }

  // ── پاکسازی کش کهنه ──────────────────────────────────────────────
  // ⚠️ محافظه‌کارانه: فقط ردیف‌هایی که ۱۸۰ روز دست‌نخورده مانده‌اند و
  // کمتر از ۲ بار استفاده شده‌اند. هر حذف = تولید دوباره = هزینهٔ AI،
  // پس این کار فقط «آشغال» را می‌برد، نه محتوای مفید.
  const prunedCache = await r.pruneContentCache(180, 2);

  return { expired: overdue.length, prunedCache };
}

// ═════════════════════════════════════════════════════════════════════
// ۲. هر ۵ دقیقه — تولید پس‌زمینهٔ دروس  (cron: */5 * * * *)
//
//    جایگزین رایگان و قابل‌اعتماد صف:
//      الف) چرخه‌های نیمه‌کاره (GENERATING بدون درس) را کامل کن
//      ب) درس‌های خالی را از قبل بساز تا کاربر انتظار نکشد
//
//    هر اجرا تعداد محدودی کار انجام می‌دهد تا سهمیهٔ زمان کرون رعایت شود.
// ═════════════════════════════════════════════════════════════════════

export async function runBackgroundGeneration(
  env: Env,
  opts: { maxCycles?: number; maxLessons?: number; budgetMs?: number } = {}
): Promise<{ cycles: number; lessons: number; failed: number; retried: number }> {
  const maxCycles = opts.maxCycles ?? 1;
  const maxLessons = opts.maxLessons ?? 2;
  const budgetMs = opts.budgetMs ?? 60_000;
  const t0 = Date.now();

  const r = repo(env);
  let cycles = 0;
  let lessons = 0;
  let failed = 0;
  let retried = 0;

  // ── الف) چرخه‌های نیمه‌کاره ───────────────────────────────────────
  const stuck = await r.listGeneratingCyclesWithoutLessons(maxCycles);
  for (const c of stuck) {
    if (Date.now() - t0 > budgetMs) break;
    const res = await runCycleGeneration(env, c.user_id, c.cycle_number, { firstOnly: true });
    if (res.ok) cycles += 1;
    else failed += 1;
  }

  // ── ب) درس‌های خالی ──────────────────────────────────────────────
  const missing = await r.listLessonsMissingContent(maxLessons);
  for (const l of missing) {
    if (Date.now() - t0 > budgetMs) break;
    const res = await runLessonGeneration(
      env,
      l.user_id,
      l.cycle_id,
      l.cycle_number,
      l.day_number
    );
    if (res.ok) lessons += 1;
    else failed += 1;
  }

  // ── ج) چرخه‌های FAILED قدیمی (تلاش دوباره با فاصله) ────────────────
  // ⚠️ فقط چرخه‌هایی که بیش از ۳۰ دقیقه پیش شکسته‌اند. اگر سهمیهٔ AI
  // تمام باشد، تلاش سریع دوباره هم دقیقاً همان خطا را می‌دهد و فقط
  // سهمیه را می‌سوزاند. با این فاصله، AI وقتی واقعاً برگشته تلاش می‌شود.
  const staleMinutes = 30;
  const failedCycles = await r.listFailedCyclesForRetry(
    staleMinutes * 60_000,
    maxCycles
  );
  for (const c of failedCycles) {
    if (Date.now() - t0 > budgetMs) break;
    const res = await runCycleGeneration(env, c.user_id, c.cycle_number, { firstOnly: true });
    if (res.ok) retried += 1;
    else failed += 1;
  }

  return { cycles, lessons, failed, retried };
}

// ═════════════════════════════════════════════════════════════════════
// ۳. روزانه ۹ صبح — یادآور درس  (cron: 0 9 * * *)
// ═════════════════════════════════════════════════════════════════════

const NUDGE: Record<string, string> = {
  fa: 'سلام {name} 👋\nوقتشه چند دقیقه زبان تمرین کنی.\nدرس امروزت آماده است 🚀',
  en: 'Hi {name} 👋\nTime for a few minutes of language practice.\nToday’s lesson is ready 🚀',
  ar: 'مرحباً {name} 👋\nحان وقت التمرين لبضع دقائق.\nدرس اليوم جاهز 🚀',
  tr: 'Merhaba {name} 👋\nBirkaç dakika pratik yapma zamanı.\nBugünkü dersin hazır 🚀',
  ru: 'Привет, {name} 👋\nПора немного позаниматься.\nУрок на сегодня готов 🚀',
};

export async function runDailyNudges(env: Env, limit = 300): Promise<{ sent: number }> {
  if (!env.TELEGRAM_BOT_TOKEN) return { sent: 0 };

  const r = repo(env);
  const users = await r.listReminderTargets(limit);
  let sent = 0;

  for (const u of users) {
    const lang = u.ui_language ?? 'fa';
    const template = NUDGE[lang] ?? NUDGE.en!;
    const text = template.replace('{name}', u.first_name ?? '');
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: u.telegram_id, text }),
        }
      );
      if (res.ok) sent += 1;
    } catch {
      /* کاربر ربات را بلاک کرده یا شبکه خطا داد — ادامه بده */
    }
  }

  return { sent };
}
