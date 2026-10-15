-- ═════════════════════════════════════════════════════════════════════
-- 0007 — CRUD اشتراک‌ها از پنل مدیر (SUPER_ADMIN / FINANCE)
--
-- برای اینکه مدیر بتواند «اشتراک جدید» با plan_type دلخواه تعریف کند،
-- ستون plan_type از enum به text تبدیل می‌شود در همهٔ جداول مرتبط.
-- مقادیر موجود دست‌نخورده باقی می‌مانند (فقط نوع ستون عوض می‌شود).
--
-- اگر این مهاجرت را اجرا نکنید، ساختِ پلن با plan_type جدید با خطای
-- «invalid input value for enum plan_type» شکست می‌خورد.
-- ═════════════════════════════════════════════════════════════════════

alter table public.plans             alter column plan_type type text using plan_type::text;
alter table public.subscriptions     alter column plan_type type text using plan_type::text;
alter table public.payment_receipts  alter column plan_type type text using plan_type::text;
alter table public.admin_grants      alter column plan_type type text using plan_type::text;
alter table public.star_transactions alter column plan_type type text using plan_type::text;

-- مرتب‌سازی پلن‌ها در پنل مدیر
create index if not exists idx_plans_sort on public.plans (sort_order asc);

-- updated_at برای ردیابی ویرایش‌ها (اختیاری، اگر ستون نبود اضافه می‌شود)
do $$ begin
  alter table public.plans add column if not exists updated_at timestamptz not null default now();
exception when others then null; end $$;
