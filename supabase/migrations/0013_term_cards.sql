-- ═════════════════════════════════════════════════════════════════════
--  0013 · کارت واژه (صرفه‌جویی توکن + ثبات محتوا) + آمار کش
--
--  بخش ۴ از بهینه‌سازی‌ها: به‌جای اینکه هر بار کل درس تولید شود، هر واژه
--  یک «کارت» مستقل دارد (معنا، تلفظ، مثال، صوت). درس جدید کارت‌های موجود
--  را برداشته و فقط صحنه/دیالوگ را تولید می‌کند.
--
--  مزایا:
--    • یک واژه همیشه یک ترجمه و یک مثال دارد (ثبات یادگیری)
--    • تولید صوت هر واژه فقط یک بار برای همهٔ کاربران
--    • توکن کمتر، چون جزئیات واژه از دیتابیس می‌آید نه از AI
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.term_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- واژه در زبان هدف (با حروف کوچک و بدون فاصلهٔ اضافه، برای تطبیق)
  term          text NOT NULL,
  language      text NOT NULL,

  -- زبان رابط کاربری که کارت برایش ساخته شده (معنا به این زبان است)
  ui_language   text NOT NULL,

  meaning       text NOT NULL,
  pronunciation text,
  example       text,
  example_translation text,

  -- کلید فایل صوت در media_files (اگر تولید شده باشد)
  audio_key     text,

  -- چند بار این کارت در درس‌ها استفاده شده — برای تصمیم «چه کارت‌هایی
  -- ارزش تازه‌کردن دارند»
  use_count     integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- یک واژه در یک زبان برای یک زبان رابط فقط یک بار ساخته شود
CREATE UNIQUE INDEX IF NOT EXISTS term_cards_unique
  ON public.term_cards (language, lower(btrim(term)), ui_language);

-- جستجوی سریع کارت‌های یک زبان
CREATE INDEX IF NOT EXISTS term_cards_language_idx
  ON public.term_cards (language, ui_language);

-- ─────────────────────────────────────────────────────────────────────
--  آمار کش محتوا — برای اینکه بتوانیم اثربخشی کش را اندازه بگیریم و
--  محتوای کهنه را تازه کنیم.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_cache
  ADD COLUMN IF NOT EXISTS hits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ستون created_at قبلاً ممکن است وجود نداشته باشد؛ با DEFAULT امن است.
COMMENT ON COLUMN public.content_cache.hits IS
  'چند بار از این کش خوانده شده — معیار صرفه‌جویی توکن';
COMMENT ON COLUMN public.content_cache.created_at IS
  'زمان ساخت — برای تازه‌کردن محتوای کهنه';

/** پیدا کردن کارت‌های واژه برای یک زبان (ورودی درس: لیست واژه‌ها) */
CREATE OR REPLACE FUNCTION public.find_term_cards(
  p_language text,
  p_ui_language text,
  p_terms text[]
)
RETURNS TABLE (
  term text,
  meaning text,
  pronunciation text,
  example text,
  example_translation text,
  audio_key text
)
LANGUAGE sql STABLE AS $$
  SELECT t.term, t.meaning, t.pronunciation, t.example, t.example_translation, t.audio_key
  FROM public.term_cards t
  WHERE t.language = p_language
    AND t.ui_language = p_ui_language
    AND lower(btrim(t.term)) IN (SELECT lower(btrim(x)) FROM unnest(p_terms) AS x);
$$;

/** افزایش شمارندهٔ استفادهٔ کارت‌ها (وقتی در یک درس به کار رفتند) */
CREATE OR REPLACE FUNCTION public.bump_term_card_use(
  p_language text,
  p_ui_language text,
  p_terms text[]
)
RETURNS void
LANGUAGE sql AS $$
  UPDATE public.term_cards t
  SET use_count = t.use_count + 1
  WHERE t.language = p_language
    AND t.ui_language = p_ui_language
    AND lower(btrim(t.term)) IN (SELECT lower(btrim(x)) FROM unnest(p_terms) AS x);
$$;
