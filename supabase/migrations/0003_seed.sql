-- ════════════════════════════════════════════════════════════════════
-- 0003_seed.sql
-- داده اولیه: پلن‌ها، اطلاعات بانکی، کاربر ادمین نمونه
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- PLANS  (منبع واحد قیمت‌گذاری — هم برای ربات ادمین و هم فروشگاه TMA)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.plans (
  id               text primary key,           -- '2_weeks', '1_month', ...
  plan_type        plan_type not null unique,
  title_fa         text not null,
  title_en         text not null,
  duration_days    int not null,
  price_irr        numeric(14, 0) not null,
  price_stars      int not null,
  discount_percent int not null default 0,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  badge            text,                        -- 'POPULAR' | 'BEST_VALUE' | null
  created_at       timestamptz not null default now()
);

insert into public.plans
  (id, plan_type, title_fa, title_en, duration_days, price_irr, price_stars, discount_percent, sort_order, badge)
values
  ('2_weeks',  '2_WEEKS',  '۲ هفته‌ای', '2 Weeks',  14,  400000,  100,  20, 1, null),
  ('1_month',  '1_MONTH',  '۱ ماهه',    '1 Month',  30,  750000,  175,  20, 2, 'POPULAR'),
  ('3_months', '3_MONTHS', '۳ ماهه',    '3 Months', 90, 1800000,  400,  20, 3, null),
  ('6_months', '6_MONTHS', '۶ ماهه',    '6 Months', 180, 3200000, 700,  20, 4, null),
  ('1_year',   '1_YEAR',   '۱ ساله',    '1 Year',   365, 5500000, 1150, 20, 5, 'BEST_VALUE')
on conflict (id) do update set
  price_irr        = excluded.price_irr,
  price_stars      = excluded.price_stars,
  discount_percent = excluded.discount_percent,
  badge            = excluded.badge;

alter table public.plans enable row level security;

drop policy if exists plans_read_all on public.plans;
create policy plans_read_all on public.plans
  for select using (true);                     -- قیمت‌ها عمومی‌اند

drop policy if exists plans_write_service on public.plans;
create policy plans_write_service on public.plans
  for all using (public.is_service_role()) with check (public.is_service_role());

-- ────────────────────────────────────────────────────────────────────
-- APP SETTINGS  (key-value برای اطلاعات بانکی و پیکربندی زنده)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  (
    'bank_info',
    '{"cardNumber":"6037-9970-0000-0000","owner":"مدیریت سیستم آموزش زبان","bankName":"بانک ملی ایران"}'::jsonb,
    'اطلاعات کارت برای پرداخت دستی (فاز ۲)'
  ),
  (
    'economy',
    '{"rewardPerLesson":10,"rewardPerfectDay":25,"rewardStreak7":100,"cycleLengthDays":7,"freeTrialDays":7,"cycleStallDays":12,"boxes":5}'::jsonb,
    'پارامترهای اقتصادی و موتور تطبیقی'
  ),
  (
    'features',
    '{"telegramStars":true,"zarinpal":false,"adminBotReceipt":false,"payloadEncryption":false}'::jsonb,
    'سوییچ‌های فعال/غیرفعال قابلیت‌ها'
  ),
  (
    'telegram',
    '{"botUsername":"","miniAppUrl":""}'::jsonb,
    'اطلاعات ربات'
  )
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists settings_read_service on public.app_settings;
create policy settings_read_service on public.app_settings
  for select using (public.is_service_role());

drop policy if exists settings_write_service on public.app_settings;
create policy settings_write_service on public.app_settings
  for all using (public.is_service_role()) with check (public.is_service_role());
