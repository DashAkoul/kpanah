-- ═════════════════════════════════════════════════════════════════════
--  0010 · هدف آموزشی هر روز چرخه (مرحلهٔ ۸)
--
--  هر یک از ۷ روز یک پروفایل آموزشی مستقل دارد
--  (ORIENT → EXPAND → APPLY → INTEGRATE → FLUENCY → ASSESS → CONSOLIDATE).
--  ستون‌های `objective` هدف مخصوص همان روز را از مدل نگه می‌دارند تا
--  وقتی روز بعداً در پس‌زمینه (صف/کرون) تولید می‌شود، هدایت درست بگیری.
--
--  کد بدون این ستون‌ها هم کار می‌کند (fallback: dayProfile(dayNumber)).
-- ═════════════════════════════════════════════════════════════════════

alter table public.lessons
  add column if not exists objective text,
  add column if not exists objective_fa text;

comment on column public.lessons.objective is
  'هدف آموزشی روز (از outline چرخه) — برای تولید پس‌زمینهٔ همان روز';
comment on column public.lessons.objective_fa is
  'ترجمهٔ فارسی هدف آموزشی روز';
