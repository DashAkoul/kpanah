# قراردادهای API — دروازه رمزنگاری‌شده

> همه مسیرها از یک دروازه واحد عبور می‌کنند (مبهم‌سازی مسیر):
> `POST {API_BASE}/kpanah56/8fjg7rfb/v1/gate?action=<NAME>`

## قواعد عمومی

| مورد | مقدار |
|---|---|
| احراز هویت | `Authorization: Bearer <JWT>` — به‌جز action های عمومی |
| عمر JWT | ۱۵ دقیقه |
| پاسخ موفق | `{ "ok": true, "data": {...}, "requestId": "...", "ts": 1234567890 }` |
| پاسخ خطا | `{ "ok": false, "error": { "code": "...", "message": "...", "userMessageKey": "..." }, "requestId": "...", "ts": ... }` |
| محدودیت نرخ | ۶۰ درخواست در دقیقه / ۲۰۰۰ در روز برای هر کاربر |
| رمزنگاری payload | اختیاری — با هدر `X-Payload-Encrypted: 1` و `ENABLE_PAYLOAD_ENCRYPTION=true` |

## کدهای خطا

| کد | HTTP | معنا |
|---|---|---|
| `UNAUTHORIZED` | 401 | توکن نامعتبر یا غایب |
| `INVALID_INIT_DATA` | 401 | امضای HMAC تلگرام معتبر نیست |
| `TOKEN_EXPIRED` | 401 | JWT منقضی شده |
| `SUBSCRIPTION_REQUIRED` | 402 | تست رایگان تمام شده و اشتراکی نیست |
| `CYCLE_NOT_READY` | 409 | چرخه فعال وجود ندارد یا در حال تولید است |
| `LESSON_LOCKED` | 403 | درس هنوز آزاد نشده |
| `RATE_LIMITED` | 429 | عبور از محدودیت نرخ |
| `CONTENT_REJECTED` | 400 | ورودی توسط فیلتر محتوا رد شد |
| `VALIDATION_ERROR` | 400 | اسکیمای ورودی معتبر نیست |
| `AI_UNAVAILABLE` | 502 | همه ارائه‌دهنده‌های هوش مصنوعی شکست خوردند |
| `INTERNAL_ERROR` | 500 | خطای غیرمنتظره |

---

## ۱. احراز هویت

### `POST ?action=auth` — عمومی
بدنه رمزگشایی‌شده:

```json
{ "initData": "query_id=AAH...&user=%7B%22id%22%3A123456%7D&hash=abc123..." }
```

پاسخ `data`:

```json
{
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "uuid",
    "telegramId": 123456,
    "uiLanguage": "fa",
    "languageSource": "TELEGRAM",
    "targetLanguage": "en",
    "skillLevel": "ZERO",
    "learningGoal": null,
    "onboardingDone": false,
    "streakCount": 0,
    "starsBalance": 0,
    "isAdmin": false,
    "subscription": { "planType": "TRIAL", "daysRemaining": 6, "expiresAt": "...", "source": "TRIAL", "status": "ACTIVE", "startsAt": "..." },
    "hasAccess": true
  }
}
```

**نکته امنیتی:** `ui_language` از زبان تلگرام استخراج می‌شود. تا زمانی که `language_source = 'TELEGRAM'` باشد، هر ورود مجدد آن را به‌روز می‌کند؛ به‌محض انتخاب دستی، به `MANUAL` تغییر می‌کند و دیگر بازنویسی نمی‌شود.

---

## ۲. خانه و دروس

### `GET ?action=home`
همه چیز برای تب آموزش در یک رفت‌وبرگشت.

```json
{
  "user": { "...همان UserProfile..." },
  "cycle": {
    "id": "uuid",
    "cycleNumber": 2,
    "title": "Workplace negotiation",
    "titleFa": "مذاکره کاری",
    "focusSummary": "...",
    "status": "ACTIVE",
    "progress": { "completedDays": 2, "totalDays": 7, "currentDay": 3 },
    "days": [
      { "dayNumber": 1, "title": "...", "kind": "TEACHING", "status": "COMPLETED",
        "isCompleted": true, "isActive": false, "isLocked": false }
    ],
    "startedAt": "...", "completedAt": null
  },
  "lesson": {
    "id": "uuid",
    "cycleId": "uuid",
    "dayNumber": 3,
    "title": "Quoting a price",
    "titleFa": "اعلام قیمت",
    "kind": "TEACHING",
    "part1": { "type": "PATTERN_DRILL", "explanation": "...", "items": [...] },
    "part2": { "type": "REAL_APPLICATION", "scenario": "...", "questions": [...] },
    "status": "AVAILABLE",
    "isCompleted": false
  },
  "generating": false,
  "generationStatus": null
}
```

اگر `cycle` برابر `null` و `generating` برابر `true` باشد، UI صفحه «در حال آماده‌سازی» را نشان می‌دهد.

### `GET ?action=get-today-lesson`
درس جاری (اولین درس تکمیل‌نشده). در اولین فراخوانی، `status` را به `IN_PROGRESS` و `started_at` را ثبت می‌کند.

```json
{
  "cycleId": "uuid",
  "dayNumber": 3,
  "lesson": { "...همان شکل درس..." }
}
```

خطاها: `SUBSCRIPTION_REQUIRED` (402)، `CYCLE_NOT_READY` (409).

---

## ۳. تلمتری و تکمیل درس

### `POST ?action=telemetry`
رویدادهای رفتارِ کاربر (مکث، رد کردن، تکرار). بدون پاسخ معنادار — فقط پذیرش.

```json
{
  "lessonId": "uuid",           // اختیاری
  "events": [
    { "eventType": "PAUSE", "itemId": "q101", "pauseMs": 4200 },
    { "eventType": "REPLAY", "itemId": "term-3" }
  ]
}
```

`eventType` ∈ `ANSWER | PAUSE | SKIP | REPLAY | HINT_USED | LESSON_START | LESSON_END | SESSION_START | SESSION_END`

پاسخ: `{ "accepted": 2 }`

### `POST ?action=complete-lesson`
**قلب موتور تطبیقی.** این endpoint:

1. جعبه‌های لایتنر را از پاسخ‌های درس به‌روز می‌کند
2. تلمتری را ثبت می‌کند
3. درس بعدی را آزاد می‌کند (یا چرخه را تمام می‌کند)
4. پاداش استارز و استریک را محاسبه می‌کند
5. **اگر روز ۷ بود:** گزارش Delta می‌سازد و تولید چرخه بعدی را در صف می‌گذارد

ورودی:

```json
{
  "lessonId": "uuid",
  "durationSeconds": 340,
  "answers": [
    { "itemId": "term-0", "isCorrect": true, "responseMs": 3200, "linkedTerm": "Offer a discount" },
    { "itemId": "q101", "isCorrect": false, "responseMs": 7800, "linkedTerm": "Is there any flexibility", "usedHint": true }
  ]
}
```

پاسخ:

```json
{
  "dayNumber": 3,
  "score": { "score": 82, "accuracy": 78, "speedBonus": 60, "isPerfect": false },
  "reward": 10,
  "streak": 6,
  "cycleCompleted": false,
  "nextCycleTriggered": false,
  "generationDeferred": null,
  "appLocked": false
}
```

مقادیر `generationDeferred`:

| مقدار | معنا |
|---|---|
| `null` | نیازی به تولید نبود، یا QStash با موفقیت صف‌بندی کرد |
| `"inline"` | QStash تنظیم نشده؛ تولید در همان isolate اجرا می‌شود |
| `"queue_unavailable"` | صف‌بندی شکست خورد (خطای ارسال به QStash) |
| `"calendar_paused"` | **قاعده توقف تقویم**: کاربر بیش از ۱۲ روز در چرخه مانده و روز ۷ را تمام نکرده → هیچ فراخوانی AI انجام نشد |

> **نکته پیاده‌سازی idempotency:** اگر درسی قبلاً تکمیل شده باشد، پاسخ `{ "alreadyCompleted": true }` برمی‌گردد و هیچ پاداشی دوباره داده نمی‌شود.

---

## ۴. پروفایل و تنظیمات

### `POST ?action=onboarding`
اولین چرخه را می‌سازد.

```json
{ "uiLanguage": "fa", "targetLanguage": "en", "skillLevel": "A2", "learningGoal": "BUSINESS" }
```

پاسخ: `{ "onboardingComplete": true, "firstCycleId": "uuid", "generating": true }`

### `POST ?action=update-profile`
```json
{ "uiLanguage": "en", "targetLanguage": "de", "learningGoal": "TRAVEL", "timezone": "Asia/Tehran" }
```
همه فیلدها اختیاری. هر بار که `uiLanguage` فرستاده شود، `language_source` به `MANUAL` تغییر می‌کند.

### `POST ?action=delete-account`
تمام داده‌ها را با cascade حذف می‌کند. پاسخ: `{ "deleted": true }`

### `GET ?action=progress`
داشبورد با `accuracyPct`، `masteredWords`، `qualitativeSkills` (مثل «الان می‌تونی در هتل صحبت کنی») و نمودار فعالیت هفتگی.

---

## ۵. فروشگاه و پرداخت

### `GET ?action=plans` — عمومی
```json
{
  "plans": [
    { "id": "1_month", "planType": "1_MONTH", "titleFa": "۱ ماهه", "durationDays": 30,
      "priceIrr": 750000, "priceStars": 175, "discountPercent": 20,
      "finalPriceIrr": 600000, "finalPriceStars": 140, "badge": "POPULAR", "isActive": true }
  ],
  "paymentMethods": { "telegramStars": true, "zarinpal": false, "adminReceipt": false },
  "starsOnly": true
}
```

### `POST ?action=create-invoice`
```json
{ "planId": "1_month" }
```
پاسخ: `{ "invoiceLink": "https://t.me/$...", "planId": "1_month", "amountStars": 140, "planTitle": "۱ ماهه" }`

سپس کلاینت `openInvoice(invoiceLink)` را صدا می‌زند. تلگرام بعد از پرداخت، `successful_payment` را به وب‌هوک ربات می‌فرستد و اشتراک آنجا شارژ می‌شود.

**اعتبارسنجی سمت سرور:** در `fulfilStarPayment` مبلغ پرداخت‌شده با قیمت پلن مقایسه می‌شود. پرداخت کمتر از مبلغ مورد انتظار رد می‌شود. همچنین `telegram_payment_charge_id` یکتاست، پس تکرار update باعث شارژ دوباره نمی‌شود.

---

## ۶. ادمین

مسیرها نیاز به `TELEGRAM_ADMIN_IDS` دارند (با کاما جدا). در غیر این صورت ۴۰۳.

### `GET ?action=admin-users&limit=25&offset=0&q=علی`
جستجو با `q`: اگر عددی باشد روی `telegram_id`، وگرنه روی `username` و `first_name`.

### `GET ?action=admin-user-detail&telegramId=123456`
اطلاعات کامل: کاربر، اشتراک، چرخه، آمار واژگان در ۵ جعبه.

### `POST ?action=admin-gift` ★
هدیه دستی اشتراک — قابلیت کلیدی فاز اول.

```json
{
  "telegramId": 123456789,
  "planType": "3_MONTHS",
  "extend": true,
  "note": "هدیه تبلیغاتی"
}
```

- `extend: true` → از **انتهای اشتراک فعال فعلی** محاسبه می‌شود (جمع می‌شود)
- `extend: false` → اشتراک جدید جایگزین می‌شود

پاسخ:
```json
{
  "granted": true,
  "target": { "telegramId": 123456789, "name": "علی رضایی" },
  "subscription": { "id": "uuid", "planType": "3_MONTHS", "startsAt": "...", "expiresAt": "...", "source": "ADMIN_GIFT" },
  "replacedActive": false
}
```

هر اهدا در جدول `admin_grants` با شناسه ادمین ثبت می‌شود (audit trail). کاربر هم از طریق ربات مطلع می‌شود.

### `POST ?action=admin-revoke`
```json
{ "telegramId": 123456789 }
```

### `GET ?action=admin-stats`
`{ "stats": { "totalUsers": 120, "activeSubscriptions": 45, ... }, "plans": [...] }`

### `GET ?action=admin-ai-providers`
لیست کامل موتورهای هوش مصنوعی + ترتیب واقعی failover + لاگ تلاش‌های اخیر.

```json
{
  "providers": [
    {
      "id": "uuid",
      "label": "Gemini Flash (اصلی)",
      "protocol": "gemini",
      "vendor": "gemini",
      "model": "gemini-2.5-flash",
      "baseUrl": null,
      "keyHint": "••••4Xk2",
      "fromEnv": false,
      "priority": 1,
      "isActive": true,
      "temperature": 0.8,
      "maxOutputTokens": 32768,
      "supportsJsonSchema": true,
      "healthStatus": "healthy",
      "lastError": null,
      "consecutiveFailures": 0,
      "totalSuccesses": 42,
      "totalFailures": 1,
      "lastSuccessAt": "2026-10-11T00:00:00Z",
      "lastFailureAt": null,
      "note": null,
      "usable": true
    }
  ],
  "attempts": [
    { "id": 1, "provider_label": "DeepSeek", "model": "deepseek-chat",
      "attempt_no": 1, "phase": "initial", "ok": false,
      "latency_ms": 8420, "error": "503 Service Unavailable", "created_at": "..." }
  ],
  "chain": [{ "id": "uuid", "label": "Gemini Flash (اصلی)", "model": "gemini-2.5-flash" }],
  "encryptionReady": true
}
```

> **کلید API هرگز برگردانده نمی‌شود.** فقط `keyHint` (چهار کاراکتر آخر) برای شناسایی.
> `usable: false` یعنی کلید قابل رمزگشایی نیست و موتور از این provider رد می‌شود.

### `POST ?action=admin-ai-provider-create`
```json
{
  "label": "DeepSeek (جایگزین)",
  "protocol": "openai_compatible",
  "vendor": "deepseek",
  "model": "deepseek-chat",
  "baseUrl": null,
  "apiKey": "sk-...",
  "priority": 2,
  "isActive": true,
  "temperature": 0.8,
  "maxOutputTokens": 8192,
  "supportsJsonSchema": false,
  "note": null
}
```
- `priority` پیش‌فرض ۱۰۰ · `isActive` پیش‌فرض `true`
- برای `openai_compatible` غیر از deepseek، فیلد `baseUrl` **الزامی** است.

### `POST ?action=admin-ai-provider-update&id=<uuid>`
همه فیلدها اختیاری‌اند. **نبودِ `apiKey` یعنی کلید فعلی حفظ شود** (برای ویرایش نام بدون وارد کردن مجدد کلید).

### `POST ?action=admin-ai-provider-delete&id=<uuid>`

### `POST ?action=admin-ai-provider-reorder`
```json
{ "order": ["uuid-1", "uuid-2", "uuid-3"] }
```
اولویت‌ها به‌صورت ۱..n بازنویسی می‌شوند. ترتیب آرایه = ترتیب واقعی failover.

### `POST ?action=admin-ai-provider-test&id=<uuid>`
یک فراخوانی واقعی و ارزان انجام می‌دهد تا کلید پیش از اعتماد تست شود.
```json
{ "ok": true, "ms": 640, "sample": "OK" }
```

---

## ۷. وب‌هوک‌ها و مسیرهای داخلی

| مسیر | محافظت |
|---|---|
| `POST /telegram/webhook` | هدر `X-Telegram-Bot-Api-Secret-Token` |
| `POST /telegram/admin-webhook` | شناسه ادمین در بدنه چک می‌شود |
| `POST /internal/queue?internal=generate-cycle` | امضای QStash (`Upstash-Signature`) با SHA-256 |

### دستورات ربات کاربر
`/start` · `/app` · `/store` · `/buy` · `/help`

### دستورات ربات ادمین
```
/gift <telegram_id> <plan> [روزهای اضافه]
/user <telegram_id>
/revoke <telegram_id>
/stats
/plans
/help
```
پلن‌های معتبر: `TRIAL` · `2_WEEKS` · `1_MONTH` · `3_MONTHS` · `6_MONTHS` · `1_YEAR`
(نام‌های کوتاه هم پذیرفته می‌شود: `2W`, `1M`, `3M`, `6M`, `1Y`)

---

## ۸. لایه رمزنگاری payload (اختیاری)

وقتی `ENABLE_PAYLOAD_ENCRYPTION=true` باشد، بدنه پاسخ رمز می‌شود:

```json
{ "alg": "A256GCM", "iv": "base64...", "ct": "base64..." }
```

و هدر `X-Payload-Encrypted: 1` تنظیم می‌شود. کلید از `PAYLOAD_ENCRYPTION_KEY` مشتق می‌شود.

> ⚠️ **هشدار صادقانه:** در یک Telegram Mini App کلید باید داخل باندل جاوااسکریپت باشد، پس هر کاربری با DevTools به آن دسترسی دارد. این لایه فقط در برابر شنود ساده محافظت می‌کند — **محرمانگی واقعی اضافه نمی‌کند**. پیش‌فرض آن `false` است.
>
> اگر به محرمانگی واقعی نیاز دارید، مسیر درست `initData HMAC` + `TLS` است که پیاده‌سازی شده، یا در فاز ۲ برای اپ نیتیو با کلید در Secure Enclave.
