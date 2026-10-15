-- ═════════════════════════════════════════════════════════════════════
--  0012 · جدول فایل‌های رسانه (R2)
--
--  فایل‌های باینری (صوت تلفظ، صوت دیالوگ) در R2 نگه داشته می‌شوند و فقط
--  کلید و متادیتا در دیتابیس می‌ماند. این جدول مرجع مشترک است تا هر نوع
--  رسانه (فعلاً فقط صوت) از یک جای یکسان مدیریت و حذف/بازیابی شود.
--
--  کلید یکتای منطقی: (kind, owner_key) تا یک واژه دو بار تولید نشود.
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.media_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- نوع رسانه: 'AUDIO' (فعلاً). بعداً 'IMAGE' هم می‌تواند اضافه شود.
  kind          text NOT NULL DEFAULT 'AUDIO'
                CHECK (kind IN ('AUDIO', 'IMAGE')),

  -- کلید آبجکت در R2 — همان چیزی که در URL به کاربر داده می‌شود.
  storage_key   text NOT NULL UNIQUE,

  -- کلید معنایی برای پیدا کردن تکراری‌ها و جلوگیری از تولید دوباره.
  -- مثال: 'tts:en:hello' یا 'tts:en:hello:female'
  owner_key     text NOT NULL,

  language      text,
  voice         text,
  mime_type     text NOT NULL DEFAULT 'audio/mpeg',
  byte_size     integer NOT NULL DEFAULT 0,
  duration_ms   integer,

  -- اگر صوت از سرویس آنلاین آمده باشد، اینجا ثبت می‌شود (برای عیب‌یابی)
  source        text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- پیدا کردن سریع تکراری‌ها
CREATE UNIQUE INDEX IF NOT EXISTS media_files_owner_kind_key
  ON public.media_files (kind, owner_key);

-- پاکسازی بر اساس زبان
CREATE INDEX IF NOT EXISTS media_files_language_idx
  ON public.media_files (language);

-- ─────────────────────────────────────────────────────────────────────
--  توابع کمکی
-- ─────────────────────────────────────────────────────────────────────

/** یافتن فایل با کلید معنایی (برای اجتناب از تولید دوبارهٔ صوت) */
CREATE OR REPLACE FUNCTION public.find_media_by_owner(
  p_kind text,
  p_owner_key text
)
RETURNS TABLE (
  id uuid,
  storage_key text,
  mime_type text,
  byte_size integer,
  duration_ms integer
)
LANGUAGE sql STABLE AS $$
  SELECT m.id, m.storage_key, m.mime_type, m.byte_size, m.duration_ms
  FROM public.media_files m
  WHERE m.kind = p_kind AND m.owner_key = p_owner_key
  LIMIT 1;
$$;
