/**
 * محدودیت نرخ سبک برای اکشن‌های AI — **در حافظهٔ هر isolate**.
 *
 * ⚠️ چرا لازم است: بودجهٔ روزانهٔ توکن جلوی هزینهٔ کلان را می‌گیرد، ولی
 * کاربر می‌تواند در ۱۰ ثانیه ده‌ها درخواست بفرستد و isolate را اشغال کند
 * (چک‌لیست ۲۳.۵).
 *
 * ⚠️ محدودیت: بین isolateها مشترک نیست. برای سقف دقیق باید از KV/Durable
 * Object استفاده شود؛ این لایه «محافظ اول» است.
 */
const buckets = new Map<string, number[]>();

export function throttleAi(
  userId: string,
  action: string,
  limitPerMinute: number,
  now = Date.now()
): { ok: boolean; retryAfterSec: number } {
  const key = `${userId}:${action}`;
  const windowStart = now - 60_000;
  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (hits.length >= limitPerMinute) {
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000)) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // پاک‌سازی تنبل: جلوگیری از رشد بی‌پایان
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= windowStart)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfterSec: 0 };
}
