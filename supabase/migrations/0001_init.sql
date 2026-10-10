-- ════════════════════════════════════════════════════════════════════
-- 0001_init.sql
-- Adaptive AI Language Tutor — Core Schema
-- Supabase / PostgreSQL 15+
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ────────────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────────────

do $$ begin
  create type plan_type as enum (
    'TRIAL', '2_WEEKS', '1_MONTH', '3_MONTHS', '6_MONTHS', '1_YEAR'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('ACTIVE', 'EXPIRED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_source as enum ('TELEGRAM_STARS', 'ADMIN_GIFT', 'TRIAL', 'ZARINPAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cycle_status as enum ('ACTIVE', 'COMPLETED', 'GENERATING', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lesson_status as enum ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type receipt_status as enum ('PENDING', 'AUTO_APPROVED', 'PENDING_MANUAL', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_level as enum ('ZERO', 'A1', 'A2', 'B1', 'B2', 'C1');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leader_action as enum ('GIFT', 'REVOKE', 'EXTEND', 'DOWNGRADE');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  telegram_id       bigint unique not null,
  username          text,
  first_name        text,
  last_name         text,
  photo_url         text,

  -- i18n: پیش‌فرض null یعنی «از زبان تلگرام استفاده کن»؛ پس از onboarding پر می‌شود
  ui_language       varchar(5),
  language_source   text default 'TELEGRAM',      -- TELEGRAM | MANUAL
  target_language   varchar(5) default 'en',

  skill_level       skill_level default 'ZERO',
  learning_goal     varchar(50),

  onboarding_done   boolean not null default false,
  timezone          text default 'Asia/Tehran',

  streak_count      int not null default 0,
  longest_streak    int not null default 0,
  stars_balance     int not null default 0,
  last_active_date  date,

  is_blocked        boolean not null default false,
  is_admin          boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_users_telegram_id on public.users (telegram_id);
create index if not exists idx_users_last_active on public.users (last_active_date desc);

-- ────────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  plan_type       plan_type not null,
  status          subscription_status not null default 'ACTIVE',
  source          subscription_source not null default 'TRIAL',

  starts_at       timestamptz not null default now(),
  expires_at      timestamptz not null,

  -- برای پیگیری پرداخت تلگرام استارز / اهدا
  payment_ref     text,                            -- telegram_payment_charge_id
  granted_by      uuid references public.users (id) on delete set null,
  grant_note      text,
  price_stars     int,
  price_irr       numeric(14, 0),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_subscription_period check (expires_at > starts_at)
);

create index if not exists idx_subs_user_active
  on public.subscriptions (user_id, status, expires_at desc);

-- ────────────────────────────────────────────────────────────────────
-- CYCLES  (چرخه ۷ روزه)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.cycles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  cycle_number      int not null,

  title             text not null,
  title_fa          text,
  focus_summary     text,

  status            cycle_status not null default 'GENERATING',

  -- متادیتای موتور تطبیقی
  generated_from    jsonb,          -- delta report ورودی AI
  generation_model  text,           -- gemini-2.5-flash | deepseek-chat | ...
  generation_ms     int,
  generation_tokens int,

  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),

  unique (user_id, cycle_number)
);

create index if not exists idx_cycles_user_status
  on public.cycles (user_id, status, cycle_number desc);

-- ────────────────────────────────────────────────────────────────────
-- LESSONS  (دروس روزانه ۱ تا ۷)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.lessons (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references public.cycles (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  day_number      int not null check (day_number between 1 and 7),

  title           text not null,
  title_fa        text,

  -- نوع روز: آموزشی | آزمون پنهان | تثبیت
  kind            text not null default 'TEACHING'
                  check (kind in ('TEACHING', 'HIDDEN_ASSESSMENT', 'CONSOLIDATION')),

  part_1_data     jsonb not null,
  part_2_data     jsonb not null,

  status          lesson_status not null default 'LOCKED',
  is_completed    boolean not null default false,

  started_at      timestamptz,
  completed_at    timestamptz,
  duration_seconds int,

  created_at      timestamptz not null default now(),

  unique (cycle_id, day_number)
);

create index if not exists idx_lessons_cycle on public.lessons (cycle_id, day_number);
create index if not exists idx_lessons_user_pending
  on public.lessons (user_id, is_completed, day_number);

-- ────────────────────────────────────────────────────────────────────
-- TELEMETRY  (موتور تحلیل رفتار)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.telemetry_events (
  id             bigserial primary key,
  user_id        uuid not null references public.users (id) on delete cascade,
  lesson_id      uuid references public.lessons (id) on delete cascade,
  cycle_id       uuid references public.cycles (id) on delete cascade,

  event_type     text not null
                 check (event_type in (
                   'ANSWER', 'PAUSE', 'SKIP', 'REPLAY', 'HINT_USED',
                   'LESSON_START', 'LESSON_END', 'SESSION_START', 'SESSION_END'
                 )),

  item_id        text,          -- شناسه آیتم درون درس (q101, term-3, ...)
  is_correct     boolean,
  response_ms    int,           -- زمان پاسخ
  pause_ms        int,           -- طولانی‌ترین مکث
  payload        jsonb,

  created_at     timestamptz not null default now()
);

create index if not exists idx_telemetry_user_created
  on public.telemetry_events (user_id, created_at desc);
create index if not exists idx_telemetry_lesson
  on public.telemetry_events (lesson_id, event_type);

-- ویو خلاصه برای گزارش Delta
create or replace view public.user_skill_summary as
select
  t.user_id,
  t.cycle_id,
  count(*) filter (where t.event_type = 'ANSWER')                            as total_answers,
  count(*) filter (where t.event_type = 'ANSWER' and t.is_correct)           as correct_answers,
  round(
    100.0 * count(*) filter (where t.event_type = 'ANSWER' and t.is_correct)
    / nullif(count(*) filter (where t.event_type = 'ANSWER'), 0)
  , 2)                                                                       as accuracy_pct,
  round(avg(t.response_ms) filter (where t.event_type = 'ANSWER'))          as avg_response_ms,
  max(t.pause_ms)                                                            as max_pause_ms
from public.telemetry_events t
group by t.user_id, t.cycle_id;

-- ────────────────────────────────────────────────────────────────────
-- LEXICAL BOXES  (جعبه لایتنر ۵ خانه‌ای)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.lexical_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,

  term            text not null,
  meaning_fa      text,
  example         text,
  target_language varchar(5) not null default 'en',

  -- جعبه لایتنر: ۱ = تازه، ۵ = تثبیت‌شده
  box             smallint not null default 1 check (box between 1 and 5),
  ease            real not null default 2.5,       -- SM-2 ease factor
  interval_days   int not null default 0,
  repetitions     int not null default 0,
  lapses          int not null default 0,

  success_count   int not null default 0,
  fail_count      int not null default 0,

  introduced_at   timestamptz not null default now(),
  last_reviewed_at timestamptz,
  next_review_at  timestamptz not null default now(),
  mastered        boolean not null default false,

  created_at      timestamptz not null default now(),

  unique (user_id, target_language, term)
);

create index if not exists idx_lexical_due
  on public.lexical_items (user_id, next_review_at)
  where mastered = false;

-- ────────────────────────────────────────────────────────────────────
-- PAYMENT RECEIPTS  (فاز ۲ — زرین‌پال / ربات رسید)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.payment_receipts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  plan_type           plan_type not null,

  receipt_image_url   text,
  extracted_ref_id    text,
  extracted_amount    numeric(14, 0),
  declared_amount     numeric(14, 0),

  status              receipt_status not null default 'PENDING',
  reviewed_by         uuid references public.users (id) on delete set null,
  review_note         text,
  ocr_confidence      real,

  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz
);

create index if not exists idx_receipts_status
  on public.payment_receipts (status, created_at desc);

-- ────────────────────────────────────────────────────────────────────
-- ADMIN GRANTS  (لاگ اهدای دستی اشتراک — audit trail)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.admin_grants (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references public.users (id) on delete restrict,
  target_user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,

  action         leader_action not null,
  plan_type      plan_type,
  days_delta     int,
  note           text,

  created_at     timestamptz not null default now()
);

create index if not exists idx_admin_grants_target
  on public.admin_grants (target_user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────
-- STAR TRANSACTIONS  (Telegram Stars ledger)
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.star_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  subscription_id    uuid references public.subscriptions (id) on delete set null,

  telegram_charge_id text unique,          -- idempotency
  provider_charge_id text,
  amount_stars       int not null check (amount_stars > 0),
  plan_type          plan_type not null,
  currency           text not null default 'XTR',
  is_refunded        boolean not null default false,

  raw_payload        jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists idx_star_tx_user on public.star_transactions (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────
-- TRIGGER: updated_at
-- ────────────────────────────────────────────────────────────────────

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['users', 'subscriptions']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I
       for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- FUNCTION: اشتراک فعال کاربر
-- ────────────────────────────────────────────────────────────────────

create or replace function public.get_active_subscription(p_user_id uuid)
returns public.subscriptions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.status = 'ACTIVE'
    and s.expires_at > now()
  order by s.expires_at desc
  limit 1;
$$;

-- ────────────────────────────────────────────────────────────────────
-- FUNCTION: انقضای خودکار اشتراک‌ها (cron)
-- ────────────────────────────────────────────────────────────────────

create or replace function public.expire_stale_subscriptions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare affected int;
begin
  update public.subscriptions
     set status = 'EXPIRED'
   where status = 'ACTIVE'
     and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.expire_stale_subscriptions() is
  'برای pg_cron: select cron.schedule(''expire-subs'', ''0 * * * *'', ''select public.expire_stale_subscriptions()'');';
