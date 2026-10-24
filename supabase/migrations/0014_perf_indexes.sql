-- ─────────────────────────────────────────────────────────────────────
-- 0014 — ایندکس‌های عملکردی
--
-- ⚠️ چرا: هیچ ایندکس صریحی برای کوئری‌های پرتکرار نداشتیم. با رشد
-- telemetry_events (هر پاسخ یک ردیف) و lessons، این کوئری‌ها به‌تدریج
-- کند می‌شوند. همه با `if not exists` هستند ⇒ اجرای دوباره بی‌خطر است.
--
-- اگر یکی از دستورها خطای «column does not exist» داد، آن بلوک را رد کن
-- (یعنی آن ستون در اسکیمای تو نام دیگری دارد) و بقیه را اجرا کن.
-- ─────────────────────────────────────────────────────────────────────

-- تلمتری: پرتکرارترین کوئری (آمار کاربر در بازهٔ زمانی)
create index if not exists idx_telemetry_user_created
  on public.telemetry_events (user_id, created_at desc);

create index if not exists idx_telemetry_lesson
  on public.telemetry_events (lesson_id);

-- درس‌ها: یافتن روز جاری چرخه و درس‌های ناتمام
create index if not exists idx_lessons_cycle_day
  on public.lessons (cycle_id, day_number);

create index if not exists idx_lessons_user_completed
  on public.lessons (user_id, is_completed);

-- واژگان: خواندن جعبه‌ها و مرورهای سررسید
create index if not exists idx_lexical_user_lang
  on public.lexical_items (user_id, language);

create index if not exists idx_lexical_next_review
  on public.lexical_items (user_id, next_review_at);

-- چرخهٔ فعال
create index if not exists idx_cycles_user_status
  on public.cycles (user_id, status);

-- لاگ AI: محاسبهٔ بودجهٔ توکن (بازهٔ ۲۴ ساعته) و نگهداری ۱۸۰ روزه
create index if not exists idx_ai_attempt_created
  on public.ai_attempt_log (created_at desc);

create index if not exists idx_ai_attempt_cycle
  on public.ai_attempt_log (cycle_id);

-- اشتراک فعال
create index if not exists idx_subs_user_status
  on public.subscriptions (user_id, status);

-- کش محتوا: جست‌وجوی کلید (اگر unique از قبل هست، این no-op است)
create index if not exists idx_content_cache_kind_key
  on public.content_cache (kind, cache_key);
