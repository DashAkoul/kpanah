#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  deploy-frontend-worker.sh — انتشار Mini App روی Cloudflare Worker
#
#  چرا Worker و نه Pages؟ چون Custom Domain روی Worker خودش رکورد DNS را
#  می‌سازد (روی Pages وقتی از API ساخته شود، این‌طور نیست).
#
#  ⚠️ نکته مهم: Wrangler برای آپلود assets فایل‌های gitignore‌شده را
#  نادیده می‌گیرد. پوشهٔ `dist/` در .gitignore است، پس بیلد را به
#  `workers/app/public/` (که ignore نشده) کپی می‌کنیم.
#
#  استفاده:
#    bash scripts/deploy-frontend-worker.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="${API_BASE:-https://api.infolange.kdns.fr}"
cd "$ROOT"

echo "═══════════════════════════════════════════════════════"
echo "  انتشار فرانت روی Cloudflare Worker"
echo "  API: $API_BASE"
echo "═══════════════════════════════════════════════════════"

echo "▶ ۱/۳  بیلد shared و TMA …"
npm run build:shared >/dev/null
VITE_API_BASE="$API_BASE" npm run build:tma >/dev/null
echo "   ✓ بیلد شد"

echo "▶ ۲/۳  کپی بیلد به workers/app/public (غیر-gitignore) …"
rm -rf workers/app/public
cp -r apps/tma/dist workers/app/public
echo "   ✓ $(find workers/app/public -type f | wc -l) فایل کپی شد"

echo "▶ ۳/۳  دیپلوی …"
cd workers/app
npx wrangler deploy

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ منتشر شد"
echo "     https://infolange.kdns.fr/"
echo "═══════════════════════════════════════════════════════"
