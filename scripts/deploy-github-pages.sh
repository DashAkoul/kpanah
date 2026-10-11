#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  deploy-github-pages.sh — انتشار فرانت‌اند (Mini App) روی GitHub Pages
#
#  چرا؟ Cloudflare Pages در ایران فیلتر است. GitHub Pages معمولاً باز است.
#
#  این اسکریپت:
#    1. shared را می‌سازد و TMA را با base=/<repo>/ می‌سازد
#    2. dist را در یک شاخهٔ مستقل (gh-pages) آماده می‌کند
#    3. .nojekyll و 404.html را (برای SPA) اضافه می‌کند
#    4. با gh CLI در ریپوی مشخص push می‌کند
#
#  استفاده:
#    REPO=DashAkoul/kpanah bash scripts/deploy-github-pages.sh
#
#  پیش‌نیاز: gh لاگین باشد (gh auth status)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${REPO:-DashAkoul/kpanah}"
BRANCH="${BRANCH:-gh-pages}"
# نام ریپو = بخش آخر REPO (برای base path)
REPO_NAME="${REPO##*/}"
BASE_PATH="/${REPO_NAME}/"
API_BASE="${API_BASE:-https://kpanah-lang-edge.language-app-backend.workers.dev}"

echo "═══════════════════════════════════════════════════════"
echo "  انتشار روی GitHub Pages"
echo "  repo:  $REPO"
echo "  base:  $BASE_PATH"
echo "  API:   $API_BASE"
echo "═══════════════════════════════════════════════════════"

cd "$ROOT"

# ── ۱. بیلد ─────────────────────────────────────────────────────────
echo ""
echo "▶ ۱/۴  بیلد shared و TMA …"
npm run build:shared >/dev/null
# MSYS_NO_PATHCONV جلوگیری از تبدیل '/kpanah/' به مسیر ویندوز
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" \
  VITE_API_BASE="$API_BASE" VITE_BASE_PATH="$BASE_PATH" \
  npm run build:tma >/dev/null
echo "   ✓ بیلد انجام شد"

DIST="$ROOT/apps/tma/dist"

# ── ۲. آماده‌سازی برای GitHub Pages ────────────────────────────────
echo "▶ ۲/۴  آماده‌سازی فایل‌های GitHub Pages …"
# .nojekyll — وگرنه Pages پوشه‌های شروع‌شونده با _ را نادیده می‌گیرد
touch "$DIST/.nojekyll"
# 404.html = همان index (برای مسیرهای ناشناخته، اپ بالا بیاید)
cp "$DIST/index.html" "$DIST/404.html"
# فایل‌های مخصوص Cloudflare را حذف کن (روی GitHub بی‌اثرند)
rm -f "$DIST/_redirects" "$DIST/_headers"
echo "   ✓ .nojekyll + 404.html اضافه شد؛ _redirects/_headers حذف شد"

# ── ۳. ساخت شاخهٔ gh-pages در یک پوشهٔ موقت ────────────────────────
echo "▶ ۳/۴  ساخت شاخهٔ $BRANCH …"
WORK="$(mktemp -d)"
cp -r "$DIST"/. "$WORK"/
cd "$WORK"
git init -q
git checkout -q -b "$BRANCH"
git add -A
git -c user.email="deploy@local" -c user.name="deploy" \
    commit -q -m "Deploy Mini App to GitHub Pages ($(date -u +%Y-%m-%dT%H:%MZ))"

# ── ۴. push ─────────────────────────────────────────────────────────
echo "▶ ۴/۴  push به $REPO ($BRANCH) …"
GH="/c/Program Files/GitHub CLI/gh.exe"
if [ -x "$GH" ]; then GH_BIN="$GH"; else GH_BIN="gh"; fi

# از gh برای گرفتن remote معتبر استفاده می‌کنیم (توکن خودش را دارد)
if "$GH_BIN" repo view "$REPO" >/dev/null 2>&1; then
  echo "   (ریپو موجود است)"
else
  echo "   (ریپو ساخته می‌شود)"
  "$GH_BIN" repo create "$REPO" --public -d "Kpanah Mini App (frontend)"
fi

# توکن gh را برای push غیرتعاملی استفاده می‌کنیم
GH_TOKEN_VAL="$("$GH_BIN" auth token 2>/dev/null)"
if [ -z "$GH_TOKEN_VAL" ]; then
  echo "✗ توکن gh در دسترس نیست. ابتدا اجرا کنید: gh auth login"
  exit 1
fi
git remote add origin "https://x-access-token:${GH_TOKEN_VAL}@github.com/${REPO}.git"
git push -f origin "$BRANCH"

# ── فعال‌سازی GitHub Pages (اگر فعال نباشد) ────────────────────────
echo ""
echo "▶ فعال‌سازی GitHub Pages …"
if "$GH_BIN" api "repos/${REPO}/pages" >/dev/null 2>&1; then
  echo "   ✓ Pages از قبل فعال است"
else
  "$GH_BIN" api -X POST "repos/${REPO}/pages" \
    -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null 2>&1 \
    && echo "   ✓ Pages فعال شد" \
    || echo "   ! فعال‌سازی خودکار نشد — دستی از Settings → Pages انجام دهید"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ انتشار کامل شد"
echo "  لینک Mini App:"
echo "     https://${REPO%%/*}.github.io/${REPO_NAME}/"
echo "═══════════════════════════════════════════════════════"
