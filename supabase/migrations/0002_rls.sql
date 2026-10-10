-- ════════════════════════════════════════════════════════════════════
-- 0002_rls.sql
-- Row Level Security
--
-- معماری: تمام دسترسی از Edge Worker با SERVICE_ROLE انجام می‌شود.
-- RLS به‌عنوان لایه دفاعی دوم (defense in depth) تنظیم می‌شود تا اگر
-- anon key لو رفت، کاربر نتواند داده دیگران را بخواند.
-- ════════════════════════════════════════════════════════════════════

alter table public.users              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.cycles             enable row level security;
alter table public.lessons            enable row level security;
alter table public.telemetry_events   enable row level security;
alter table public.lexical_items      enable row level security;
alter table public.payment_receipts   enable row level security;
alter table public.admin_grants       enable row level security;
alter table public.star_transactions  enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- helper: telegram_id جاری از JWT claim
-- Edge Worker توکن JWT را با claim  `sub` = telegram_id امضا می‌کند.
-- ────────────────────────────────────────────────────────────────────

create or replace function public.current_telegram_id()
returns bigint
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_id',
      ''
    ),
    ''
  )::bigint;
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''
  ) in ('service_role', 'supabase_admin');
$$;

-- ────────────────────────────────────────────────────────────────────
-- USERS: هر کاربر فقط رکورد خودش
-- ────────────────────────────────────────────────────────────────────

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (
    public.is_service_role() or telegram_id = public.current_telegram_id()
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (
    public.is_service_role() or telegram_id = public.current_telegram_id()
  )
  with check (
    -- کاربر نمی‌تواند پرچم‌های مدیریتی یا موجودی استارز را دست بزند
    public.is_service_role()
    or (
      telegram_id = public.current_telegram_id()
      and is_admin = (select u.is_admin from public.users u where u.id = users.id)
      and is_blocked = (select u.is_blocked from public.users u where u.id = users.id)
      and stars_balance = (select u.stars_balance from public.users u where u.id = users.id)
    )
  );

-- insert فقط توسط سرویس (ثبت‌نام در Worker انجام می‌شود)
drop policy if exists users_insert_service on public.users;
create policy users_insert_service on public.users
  for insert with check (public.is_service_role());

drop policy if exists users_delete_self on public.users;
create policy users_delete_self on public.users
  for delete using (
    public.is_service_role() or telegram_id = public.current_telegram_id()
  );

-- ────────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS: فقط خواندن خودِ کاربر. نوشتن فقط سرویس.
-- ────────────────────────────────────────────────────────────────────

drop policy if exists subs_select_self on public.subscriptions;
create policy subs_select_self on public.subscriptions
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists subs_write_service on public.subscriptions;
create policy subs_write_service on public.subscriptions
  for all using (public.is_service_role()) with check (public.is_service_role());

-- ────────────────────────────────────────────────────────────────────
-- CYCLES / LESSONS / TELEMETRY / LEXICAL: خواندن self، نوشتن سرویس
-- ────────────────────────────────────────────────────────────────────

drop policy if exists cycles_select_self on public.cycles;
create policy cycles_select_self on public.cycles
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists cycles_write_service on public.cycles;
create policy cycles_write_service on public.cycles
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists lessons_select_self on public.lessons;
create policy lessons_select_self on public.lessons
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists lessons_write_service on public.lessons;
create policy lessons_write_service on public.lessons
  for all using (public.is_service_role()) with check (public.is_service_role());

-- telemetry: کاربر می‌تواند رویداد خودش را ثبت کند (append-only، بدون read)
drop policy if exists telemetry_insert_self on public.telemetry_events;
create policy telemetry_insert_self on public.telemetry_events
  for insert with check (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists telemetry_select_service on public.telemetry_events;
create policy telemetry_select_service on public.telemetry_events
  for select using (public.is_service_role());

drop policy if exists lexical_select_self on public.lexical_items;
create policy lexical_select_self on public.lexical_items
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists lexical_write_service on public.lexical_items;
create policy lexical_write_service on public.lexical_items
  for all using (public.is_service_role()) with check (public.is_service_role());

-- ────────────────────────────────────────────────────────────────────
-- PAYMENTS / GRANTS / STARS: فقط سرویس (حساس)
-- ────────────────────────────────────────────────────────────────────

drop policy if exists receipts_select_self on public.payment_receipts;
create policy receipts_select_self on public.payment_receipts
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists receipts_write_service on public.payment_receipts;
create policy receipts_write_service on public.payment_receipts
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists grants_service_only on public.admin_grants;
create policy grants_service_only on public.admin_grants
  for all using (public.is_service_role()) with check (public.is_service_role());

drop policy if exists stars_tx_select_self on public.star_transactions;
create policy stars_tx_select_self on public.star_transactions
  for select using (
    public.is_service_role()
    or user_id in (select id from public.users where telegram_id = public.current_telegram_id())
  );

drop policy if exists stars_tx_write_service on public.star_transactions;
create policy stars_tx_write_service on public.star_transactions
  for all using (public.is_service_role()) with check (public.is_service_role());

-- ────────────────────────────────────────────────────────────────────
-- STORAGE: باکت فیش‌های پرداخت (فاز ۲)
-- ────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists receipts_upload_own on storage.objects;
create policy receipts_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_telegram_id()::text
  );

drop policy if exists receipts_read_own on storage.objects;
create policy receipts_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_telegram_id()::text
  );
