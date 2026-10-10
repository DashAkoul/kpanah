#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# set-secrets.sh — ثبت تمام secret های Worker روی Cloudflare
#
# این اسکریپت مقادیر را از فایل `.env` (در ریشه پروژه) می‌خواند و هرکدام
# را با `wrangler secret put` ثبت می‌کند.
#
# استفاده:
#   cp .env.example .env      # مقادیر را پر کنید
#   bash scripts/set-secrets.sh
#
# مقادیر خالی رد می‌شوند، پس می‌توانید فقط بخشی را تنظیم کنید.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
WRANGLER_CONFIG="$ROOT/workers/edge/wrangler.toml"

# secret هایی که به Worker تعلق دارند (بقیه برای فرانت‌اند یا ابزار محلی‌اند)
SECRETS=(
  TELEGRAM_BOT_TOKEN
  TELEGRAM_ADMIN_BOT_TOKEN
  TELEGRAM_ADMIN_IDS
  TELEGRAM_WEBHOOK_SECRET
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  JWT_SECRET
  PROVIDER_ENCRYPTION_KEY
  GEMINI_API_KEY
  DEEPSEEK_API_KEY
  ANTHROPIC_API_KEY
  QSTASH_TOKEN
  QSTASH_CURRENT_SIGNING_KEY
  QSTASH_NEXT_SIGNING_KEY
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ فایل .env پیدا نشد: $ENV_FILE"
  echo "  ابتدا اجرا کنید:  cp .env.example .env"
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  ثبت secret ها روی Cloudflare Worker"
echo "═══════════════════════════════════════════════════════"
echo ""

set_ok=0
set_skipped=0
set_failed=0

for name in "${SECRETS[@]}"; do
  # مقدار را از .env بخوانید، بدون expand کردن $ و بدون به‌اشتراک‌گذاشتن در لاگ
  value=""
  if grep -q "^${name}=" "$ENV_FILE" 2>/dev/null; then
    value="$(grep "^${name}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | sed 's/^["'"'"']//; s/["'"'"']$//')"
  fi

  if [[ -z "$value" ]]; then
    echo "⏭  $name — خالی، رد شد"
    set_skipped=$((set_skipped + 1))
    continue
  fi

  # فقط طول را نشان بده، هرگز خود مقدار
  len=${#value}
  if printf '%s' "$value" | npx wrangler secret put "$name" \
       -c "$WRANGLER_CONFIG" >/dev/null 2>&1; then
    echo "✓ $name  (${len} کاراکتر)"
    set_ok=$((set_ok + 1))
  else
    echo "✗ $name — ثبت نشد"
    set_failed=$((set_failed + 1))
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ثبت‌شده: $set_ok   |   رد‌شده: $set_skipped   |   خطا: $set_failed"
echo "═══════════════════════════════════════════════════════"

if [[ $set_ok -gt 0 ]]; then
  echo ""
  echo "مرحله بعد:"
  echo "  npx wrangler deploy -c workers/edge/wrangler.toml"
fi

if [[ $set_failed -gt 0 ]]; then
  exit 1
fi
