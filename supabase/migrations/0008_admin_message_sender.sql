-- ═══════════════════════════════════════════════════════════════════════
--  0008_admin_message_sender.sql
--
--  افزودن «فرستندهٔ» پیام به جدول admin_messages تا در پنل مدیر بتوان
--  تاریخچهٔ کامل پیام‌های ارسالی را همراه با نام ادمین فرستنده دید.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.admin_messages
  add column if not exists sender_telegram_id bigint;

alter table public.admin_messages
  add column if not exists sender_name text;

-- فهرست تاریخچه (پنل مدیر: جدیدترین‌ها)
create index if not exists admin_messages_created_idx
  on public.admin_messages (created_at desc);
