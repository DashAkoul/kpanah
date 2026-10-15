-- ═══════════════════════════════════════════════════════════════════════
--  0005_support_admin_content.sql
--
--  این مهاجرت سه قابلیت را اضافه می‌کند:
--    ۱. سیستم تیکت پشتیبانی  (support_tickets + support_messages)
--    ۲. نقش‌های ادمین محدود   (admin_role روی users)
--    ۳. کش محتوای تولیدشده   (content_cache) — صرفه‌جویی توکن
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- ۱. نقش‌های ادمین
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM (
    'SUPER_ADMIN',   -- دسترسی کامل
    'SUPPORT',       -- تیکت‌ها + دیدن پرداخت‌ها
    'MARKETING',     -- آمار کاربران/رشد (بدون داده حساس)
    'FINANCE'        -- پرداخت‌ها/استارز
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_role admin_role NULL;

COMMENT ON COLUMN users.admin_role IS
  'اگر پر باشد، کاربر یک ادمین با دامنهٔ دسترسی محدود است. is_admin برای SUPER_ADMIN هم true می‌شود.';

-- ─────────────────────────────────────────────────────────────────────
-- ۲. تیکت پشتیبانی
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('OPEN', 'PENDING', 'ANSWERED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM (
    'GENERAL',    -- عمومی
    'BILLING',    -- پرداخت/اشتراک
    'TECHNICAL',  -- مشکل فنی
    'CONTENT',    -- محتوای درسی
    'REPORT'      -- گزارش تخلف/محتوای نامناسب
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_id   bigint NOT NULL,
  subject       text NOT NULL,
  category      ticket_category NOT NULL DEFAULT 'GENERAL',
  status        ticket_status   NOT NULL DEFAULT 'OPEN',
  -- آخرین پیام برای نمایش سریع در لیست (denormalized)
  last_message  text,
  last_at       timestamptz NOT NULL DEFAULT now(),
  -- ادمینی که در حال بررسی است
  assigned_role admin_role NULL,
  unread_for_user    boolean NOT NULL DEFAULT false,
  unread_for_admin   boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx    ON support_tickets(user_id, last_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx  ON support_tickets(status, last_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_cat_idx     ON support_tickets(category, last_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  -- از طرف کاربر یا ادمین
  author      text NOT NULL CHECK (author IN ('USER', 'ADMIN')),
  author_role admin_role NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx
  ON support_messages(ticket_id, created_at ASC);

-- ─────────────────────────────────────────────────────────────────────
-- ۳. کش محتوای تولیدشده
--
-- هر «تکه» محتوای تولیدشده با یک هش محتوا ذخیره می‌شود؛ اگر کاربر
-- دیگری همان تکه را لازم داشت، از DB خوانده می‌شود و توکن مصرف نمی‌شود.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- نوع تکه: WORD / PATTERN / EXERCISE / DIALOGUE / PLACEMENT_Q
  kind          text NOT NULL,
  -- کلید یکتای محتوا (هش از زبان+هدف+سطح+موضوع)
  cache_key     text NOT NULL,
  language      text NOT NULL,
  payload       jsonb NOT NULL,
  hits          integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, cache_key)
);

CREATE INDEX IF NOT EXISTS content_cache_lookup_idx
  ON content_cache(kind, language, cache_key);

COMMENT ON TABLE content_cache IS
  'کش محتوای آموزشی تولیدشده با AI — جلوگیری از تولید تکراری و کاهش هزینهٔ توکن.';

-- ─────────────────────────────────────────────────────────────────────
-- ۴. دسترسی RLS
--    همهٔ این جداول فقط با service-role (Worker) خوانده/نوشته می‌شوند،
--    پس RLS فعال می‌شود بدون policy برای anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cache    ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- ۵. به‌روزرسانی تخفیف اشتراک‌ها (طبق درخواست کاربر)
-- ─────────────────────────────────────────────────────────────────────
UPDATE plans SET discount_percent = 0  WHERE plan_type = '2_WEEKS';
UPDATE plans SET discount_percent = 5  WHERE plan_type = '1_MONTH';
UPDATE plans SET discount_percent = 12 WHERE plan_type = '3_MONTHS';
UPDATE plans SET discount_percent = 18 WHERE plan_type = '6_MONTHS';
UPDATE plans SET discount_percent = 25 WHERE plan_type = '1_YEAR';
