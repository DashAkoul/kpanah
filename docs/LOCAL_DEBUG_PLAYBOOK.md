# راهنمای گام‌به‌گام دیباگ محلی (Local Debug Playbook)

> هدف: اجرای کامل پروژه روی سیستم خودتان، پیدا کردن دقیق علت خطای
> «Temporary server issue. Try again shortly.»، رفع آن، و سپس ادامهٔ مراحل.
>
> این سند همهٔ دستورها و مراحل تست را دارد تا هر بار بتوانیم سریع دیباگ کنیم.

---

## ۰. خلاصهٔ وضعیت تا این لحظه

- ✅ **سرور (Worker) سالم است.** تست زنده روی production:
  `GET ?action=health` → `{"ok":true,...}`
- ✅ **مسیر ورود روی سرور درست کار می‌کند.** با `initData` امضاشدهٔ معتبر:
  `POST ?action=auth` → `{"ok":true, token:..., user:...}`
- ✅ **کل زنجیره روی سرور محلی هم پاس می‌شود** (۷/۷ تست).
- ❓ **تنها چیزی که هنوز ثابت نشده:** اینکه اپ واقعی در تلگرام باید
  همان `initData` را بفرستد. اگر مشکل باقی است، احتمالاً یا:
  1. اپ، `initData` را از تلگرام نمی‌گیرد (SDK لود نمی‌شود / دکمه اشتباه)،
  2. یا نسخهٔ قدیمی (کش) اجرا می‌شود،
  3. یا درخواست به آدرس اشتباه می‌رود.

ابزارهای این پوشه همان‌ها را قطعی مشخص می‌کنند.

---

## ۱. اجزای پروژه

| جزء | مسیر | نقش |
|---|---|---|
| Mini App (فرانت) | `apps/tma` | اپ React که در تلگرام باز می‌شود |
| Edge Worker (بک) | `workers/edge` | تنها سرور؛ همهٔ `/gate?action=...` |
| Shared | `packages/shared` | تایپ‌ها/اسکیمای مشترک |
| ابزار تست | `tools/` | اسکریپت‌های دیباگ (این نشست اضافه شد) |

---

## ۲. پیش‌نیاز یک‌بار

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
npm install          # فقط بار اول
```

فایل `.env` باید پر باشد (در ریشهٔ پروژه). اسکریپت `tools/` توکن ربات را
از همان‌جا یا از `workers/edge/.dev.vars` می‌خواند.

---

## ۳. اجرای محلی — دو ترمینال

### ترمینال ۱ — Worker محلی (بک‌اند)

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
npm run dev:edge
# یا: cd workers/edge && npx wrangler dev --port 8787
```

انتظار: پیام `⎔ Starting local server...` و بالا آمدن روی
`http://127.0.0.1:8787`.

> نکته: وایل `workers/edge/.dev.vars` (که خودمان ساختیم) تمام secretها را
> به ورکر محلی می‌دهد. این فایل در `.gitignore` است و commit نمی‌شود.

### ترمینال ۲ — Mini App (فرانت‌اند)

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
npm run dev:tma
# بالا می‌آید روی http://localhost:5173
```

> فایل `apps/tma/.env.local` اپ محلی را به Worker محلی وصل می‌کند
> (`VITE_API_BASE=http://127.0.0.1:8787`).

حالا مرورگر را روی `http://localhost:5173` باز کنید. چون در مرورگر عادی
هستید (نه تلگرام)، اپ در حالت preview با داده‌ی mock بالا می‌آید —
این طبیعی است و برای تست UI خوب است، ولی ورود واقعی را تست نمی‌کند.

---

## ۴. تست خودکار انتها-به-انتها (مهم‌ترین ابزار)

با روشن بودن Worker محلی (ترمینال ۱)، در ترمینال سوم:

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
node tools/e2e-local.mjs
```

این اسکریپت ۵ مرحله را تست می‌کند و ✅/✗ می‌دهد:

1. Worker محلی بالاست؟ (`?action=health`)
2. initData امضاشده ساخته می‌شود؟
3. ورود کار می‌کند؟ (`POST ?action=auth`)
4. توکن برگشتی معتبر است؟ (`?action=me`)
5. لیست پلن‌ها می‌آید؟ (`?action=plans`)

خروجی مورد انتظار الان:

```
✅ health → 200
✅ initData ساخته شد
✅ ورود موفق — توکن صادر شد
✅ me → 200 (JWT معتبر است)
✅ plans → 200
نتیجه:  ✅ 7 موفق | ✗ 0 ناموفق
```

اگر اینجا همه سبز بود، یعنی **کد سرور و منطق ورود سالم است** و مشکل در
سمت تحویل به کلاینت (تلگرام) است → برو به بخش ۶.

---

## ۵. تست با initData دستی (شبیه‌سازی دقیق تلگرام)

### ۵.۱ ساخت initData معتبر

```bash
# کاربر پیش‌فرض
node tools/sign-initdata.mjs

# کاربر دلخواه
node tools/sign-initdata.mjs --id 123456789 --name Ali --username ali
```

### ۵.۲ ارسال دستی به سرور محلی

```bash
INITDATA=$(node tools/sign-initdata.mjs --id 123456789)
BODY=$(node -e "process.stdout.write(JSON.stringify({initData:process.argv[1]}))" "$INITDATA")
curl -s -X POST "http://127.0.0.1:8787/kpanah56/8fjg7rfb/v1/gate?action=auth" \
  -H "Content-Type: application/json" --data-binary "$BODY"
```

### ۵.۳ همان تست روی سرور production

```bash
curl -s -X POST "https://kpanah-lang-edge.language-app-backend.workers.dev/kpanah56/8fjg7rfb/v1/gate?action=auth" \
  -H "Content-Type: application/json" --data-binary "$BODY"
```

اگر هر دو `{"ok":true,...}` دادند → سرور قطعاً سالم است.

---

## ۶. تست داخل تلگرام واقعی (کلیدِ پیدا کردن مشکل)

چون devtools روی موبایل سخت است، یک **صفحهٔ عیب‌یابی** ساختیم که داخل
خود مینی‌اپ باز می‌شود و همه‌چیز را نشان می‌دهد:

```
https://kpanah-lang.pages.dev/debug.html
```

### چطور بازش کنیم؟

**راه الف — از داخل خود اپ (ساده‌ترین):**
دکمهٔ «🎓 Open the app» ربات را بزنید، بعد آدرس را دستی عوض کنید به
`.../debug.html`. در تلگرام دسکتاپ راحت‌تر است.

**راه ب — از BotFather:** اگر URL مینی‌اپ را موقتاً به `/debug.html`
تغییر دهید (بعداً برگردانید).

### صفحهٔ عیب‌یابی چه می‌گوید

- **بخش ۱:** آیا SDK تلگرام لود شده؟ `platform` چیست؟ `initData` چند
  کاراکتر است؟ (اگر ۰ = تلگرام initData نداده → مشکل همان‌جاست)
- **بخش ۲:** دکمهٔ «تست ورود» — با یک کلیک همان `POST ?action=auth` را
  با initData واقعی می‌زند و نتیجه (✅/✗ + کد خطا) را نشان می‌دهد.
- **بخش ۳:** initData خام — دقیقاً همان رشته‌ای که تلگرام فرستاده.
- **بخش ۴:** لاگ کامل درخواست‌های API.
- **دکمهٔ «کپی گزارش»:** کل اطلاعات را JSON کپی می‌کند تا برایم بفرستید.

### تفسیر نتیجه

| آنچه در بخش ۲ می‌بینید | معنا | اقدام |
|---|---|---|
| ✅ موفق | ورود کار می‌کند | اپ اصلی هم باید کار کند؛ برو کش را پاک کن (بخش ۷) |
| ✗ `INVALID_INIT_DATA` | initData ای که تلگرام داده معتبر نیست | بخش ۸ (BotFather) |
| ✗ `INTERNAL_ERROR` / پاسخ HTML | درخواست به جای اشتباه رفته | بخش ۹ (آدرس API) |
| بخش ۱: initData خالی (۰) | تلگرام SDK/دکمه مشکل دارد | بخش ۸ |
| SDK لود نشده | اسکریپت `telegram-web-app.js` بلاک شده | بخش ۸ |

---

## ۷. پاک‌کردن کش تلگرام (اگر اپ قدیمی اجرا می‌شود)

تلگرام پوستهٔ اپ را کش می‌کند. بعد از هر دیپلوی:

1. اپ را کامل ببندید (منوی ⋮ → Close).
2. در **تنظیمات تلگرام → Data and Storage → Storage Usage** حافظهٔ کش
   را برای این ربات پاک کنید (یا Force Close و باز کردن مجدد تلگرام).
3. دوباره از دکمهٔ داخل ربات بازش کنید.

`index.html` روی `no-cache` است، پس با باز شدن تازه، بیلد جدید می‌آید.

---

## ۸. تنظیمات BotFather (علت رایج خالی بودن initData)

در @BotFather:

1. `/mybots` → ربات خودتان → **Bot Settings** → **Menu Button**
   - نوع: **Web App** (نه «Simple»)، و URL = `https://kpanah-lang.pages.dev`
2. **Bot Settings → Configure Mini App** → دامنه ثبت شده باشد:
   `kpanah-lang.pages.dev`
3. مطمئن شوید اپ از **دکمهٔ Web App خود ربات** باز می‌شود، نه لینک دستی
   در مرورگر (لینک دستی initData ندارد).

> نشانهٔ کلاسیک: pageهای `/debug.html` می‌گویند `initData = 0 کاراکتر`
> و `platform = unknown` → یعنی از مسیر Web App باز نشده.

---

## ۹. بررسی آدرس API (اگر پاسخ HTML/404 می‌آید)

اپ باید به **ورکر** وصل شود، نه به دامنهٔ Pages. اگر `VITE_API_BASE`
ست نشود، اپ درخواست نسبی می‌زند → 404 HTML → خطای مبهم server_error.

- در صفحهٔ عیب‌یابی، ردیف `window.__KPANAH_API_BASE__` را ببینید.
  باید `https://kpanah-lang-edge...workers.dev` باشد.
- اگر خالی بود، بیلد را با env صریح انجام دهید:

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
npm run build:shared
VITE_API_BASE="https://kpanah-lang-edge.language-app-backend.workers.dev" npm run build:tma
cd apps/tma && npx wrangler pages deploy dist --project-name=kpanah-lang
```

---

## ۱۰. تست‌های خودکار پروژه

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"

npm run typecheck -w @kpanah/tma      # تایپ‌چک فرانت
npm run typecheck -w @kpanah/edge     # تایپ‌چک بک
npm run test    -w @kpanah/edge       # ۴۴ تست ورکر
```

---

## ۱۱. نقشهٔ عیب‌یابی سریع (Quick Triage)

```
خطا دیدم
  │
  ├─ صفحهٔ /debug.html را باز کن
  │
  ├─ بخش ۱: initData خالی؟
  │     └─ بله → از دکمهٔ Web App ربات باز کن (بخش ۸)
  │
  ├─ دکمهٔ «تست ورود»:
  │     ├─ ✅ → کش را پاک کن (بخش ۷)
  │     ├─ ✗ INVALID_INIT_DATA → BotFather (بخش ۸)
  │     └─ ✗ HTML/404 → آدرس API (بخش ۹)
  │
  └─ هنوز شک داری؟
        → node tools/e2e-local.mjs   (سرور سالم است؟)
```

---

## ۱۲. فایل‌های اضافه‌شده در این نشست

| فایل | کار |
|---|---|
| `tools/sign-initdata.mjs` | ساخت initData امضاشده برای تست |
| `tools/e2e-local.mjs` | تست خودکار کل زنجیرهٔ ورود |
| `apps/tma/public/debug.html` | صفحهٔ عیب‌یابی داخل مینی‌اپ |
| `apps/tma/.env.local` | اتصال اپ محلی به ورکر محلی (gitignored) |
| `workers/edge/.dev.vars` | secretهای ورکر محلی (gitignored) |
| تغییر در `apps/tma/src/lib/api.ts` | لاگ‌گیری ساختاریافته (`VITE_DEBUG_API`) |
