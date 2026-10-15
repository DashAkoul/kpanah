-- ═══════════════════════════════════════════════════════════════════════
--  0006_admin_messages.sql
--
--  پیام‌های مدیر به کاربران:
--    • مدیر می‌تواند به یک کاربر یا همه پیام بفرستد
--    • پیام در ورود به اپ به کاربر نشان داده می‌شود (خوانده‌نشده)
--    • همان پیام از طریق ربات تلگرام هم ارسال می‌شود
--    • مدیر زبان رابط کاربر را می‌بیند تا پیام را به همان زبان بنویسد
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- اگر NULL باشد → پیام همگانی (به همهٔ کاربران)
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  telegram_id   bigint,
  title         text,
  body          text NOT NULL,
  -- لحن/نوع پیام (برای رنگ و آیکن در اپ)
  kind          text NOT NULL DEFAULT 'INFO'
                CHECK (kind IN ('INFO', 'PROMO', 'UPDATE', 'WARNING')),
  -- آیا از طریق ربات هم فرستاده شده
  sent_via_bot  boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_messages_user_idx
  ON admin_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_messages_unread_idx
  ON admin_messages(user_id, read_at);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_messages IS
  'پیام‌های مدیر به کاربران — در اپ و در ربات نمایش داده می‌شوند.';
