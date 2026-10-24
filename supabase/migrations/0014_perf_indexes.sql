-- ─────────────────────────────────────────────────────────────────────
-- 0014 — ایندکس‌های عملکردی (نسخهٔ اصلاح‌شده پس از بازبینی)
--
-- ⚠️ درس مهم: نسخهٔ اول این فایل فرض کرده بود هیچ ایندکسی وجود ندارد،
-- ولی `0001_init.sql`، `0004_ai_providers.sql` و `0005_...` از قبل اکثر
-- آن‌ها را ساخته بودند. نتیجه: ۵ ایندکس تکراری روی ستون‌های یکسان.
-- این نسخه فقط چیزهایی را می‌سازد که **واقعاً** کم بود و بقیه را پاک می‌کند.
--
-- قبلاً موجود بود (دوباره ساخته نمی‌شود):
--   idx_users_telegram_id · idx_users_last_active · idx_subs_user_active
--   idx_cycles_user_status · idx_lessons_cycle · idx_lessons_user_pending
--   idx_telemetry_user_created · idx_telemetry_lesson · idx_lexical_due
--   idx_receipts_status · idx_admin_grants_target · idx_star_tx_user
--   ai_attempt_log_created_idx · ai_attempt_log_cycle_idx
--   content_cache_lookup_idx · support_tickets_* · plans_sort
-- ─────────────────────────────────────────────────────────────────────

-- ── ۱) سه ایندکسی که واقعاً کم بود ───────────────────────────────────

-- واژگان بر اساس زبان هدف (کوئری اصلی getLexicalItems)
create index if not exists idx_lexical_user_lang
  on public.lexical_items (user_id, target_language);

-- مرورهای سررسید **بدون** فیلتر mastered
-- ⚠️ idx_lexical_due یک ایندکس partial است (`where mastered = false`) و
-- کوئری ما فیلتر mastered ندارد، پس آن ایندکس پوشش نمی‌دهد.
create index if not exists idx_lexical_next_review
  on public.lexical_items (user_id, next_review_at);

-- جست‌وجوی کش با (kind, cache_key) بدون language
-- ⚠️ content_cache_lookup_idx به شکل (kind, language, cache_key) است و
-- برای کوئری ما (که language ندارد) قابل استفادهٔ کامل نیست.
create index if not exists idx_content_cache_kind_key
  on public.content_cache (kind, cache_key);

-- ── ۲) حذف تکراری‌های نسخهٔ اول (ستون‌هایشان قبلاً ایندکس داشت) ─────
drop index if exists public.idx_lessons_cycle_day;      -- = idx_lessons_cycle
drop index if exists public.idx_lessons_user_completed; -- = prefix of idx_lessons_user_pending
drop index if exists public.idx_ai_attempt_created;     -- = ai_attempt_log_created_idx
drop index if exists public.idx_ai_attempt_cycle;       -- = ai_attempt_log_cycle_idx
drop index if exists public.idx_subs_user_status;       -- = prefix of idx_subs_user_active
