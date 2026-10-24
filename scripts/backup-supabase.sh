#!/usr/bin/env bash
# پشتیبان‌گیری مستقل از پایگاه داده (چک‌لیست ۲۱.۷).
#
# ⚠️ چرا لازم است: پشتیبان Supabase در همان حساب است؛ اگر حساب مشکل پیدا کند،
# پشتیبان هم از دست می‌رود. این اسکریپت یک نسخهٔ مستقل می‌سازد.
#
# استفاده:
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
#   ./scripts/backup-supabase.sh
#
# پیشنهاد: یک بار در هفته (Task Scheduler / cron).
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  echo "مقدار را از Supabase → Project Settings → Database → Connection string بگیر." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump پیدا نشد. PostgreSQL client tools را نصب کن." >&2
  exit 1
fi

mkdir -p backups
stamp=$(date +%Y%m%d-%H%M)
out="backups/kpanah-${stamp}.sql.gz"

echo "→ dumping to ${out} ..."
pg_dump --no-owner --no-privileges --clean --if-exists "$SUPABASE_DB_URL" | gzip -9 > "$out"

size=$(wc -c < "$out")
if [ "$size" -lt 10000 ]; then
  echo "ERROR: dump خیلی کوچک است (${size} bytes) — احتمالاً اتصال برقرار نشده." >&2
  rm -f "$out"
  exit 1
fi

echo "✓ OK: ${out} ($(( size / 1024 )) KB)"
echo "  یادآوری: نسخهٔ خارج از این ماشین هم نگه دار (مثلاً B2 یا فضای ابری)."
