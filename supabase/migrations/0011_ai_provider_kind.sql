-- ═════════════════════════════════════════════════════════════════════
--  0011 · دسته‌بندی providerهای AI (متن / صوت / گفتار)
--
--  چرا: تا پیش از این همهٔ providerها فرض «تولید متن» بودند. وقتی TTS و
--  STT اضافه شدند، زنجیرهٔ failover برای تولید متن نباید مدل‌های صوتی را
--  امتحان کند (و برعکس). یک ستون `kind` این تفکیک را ممکن می‌کند.
--
--  مقدار پیش‌فرض 'TEXT' است تا ردیف‌های موجود بدون مهاجرت دستی کار کنند.
-- ═════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_providers'
      AND column_name = 'kind'
  ) THEN
    ALTER TABLE public.ai_providers
      ADD COLUMN kind text NOT NULL DEFAULT 'TEXT'
      CHECK (kind IN ('TEXT', 'TTS', 'STT'));

    COMMENT ON COLUMN public.ai_providers.kind IS
      'دستهٔ provider: TEXT (تولید متن) | TTS (متن به صوت) | STT (صوت به متن)';
  END IF;
END $$;

-- ایندکس روی (kind, priority) — چون زنجیره همیشه با همین دو فیلتر خوانده می‌شود
CREATE INDEX IF NOT EXISTS ai_providers_kind_priority_idx
  ON public.ai_providers (kind, priority)
  WHERE is_active = true;
