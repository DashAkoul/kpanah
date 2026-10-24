#!/usr/bin/env bash
# دود تست انتهابه‌انتها روی محیط زنده (چک‌لیست ۲۴).
# فقط نقاط عمومی/محافظت‌شده را بررسی می‌کند — بدون نیاز به initData.
set -u
API="${API:-https://api.infolange.kdns.fr/kpanah56/8fjg7rfb/v1/gate}"
APP="${APP:-https://app.infolange.kdns.fr}"
fail=0

check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; else echo "FAIL  $1 (expected $2, got $3)"; fail=1; fi
}

code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/")
check "frontend root" 200 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API?action=plans")
check "plans (public)" 200 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API?action=home")
check "home without auth" 401 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API?action=complete-lesson" -H 'Content-Type: application/json' -d '{}')
check "complete-lesson without auth" 401 "$code"

body=$(curl -s "$API?action=plans")
echo "$body" | grep -q '"ok":true' && echo "PASS  plans payload has ok:true" || { echo "FAIL  plans payload"; fail=1; }

echo "---"
[ "$fail" = "0" ] && echo "E2E SMOKE: OK" || echo "E2E SMOKE: FAILED"
exit "$fail"
