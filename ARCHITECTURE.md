# معماری نهایی و تصمیمات قفل‌شده (Locked Decisions)

> این سند مکمل «سند جامع معماری فنی» است و ابهامات را قطعی می‌کند.

## ۱. تصمیمات تاییدشده توسط کارفرما

| موضوع | تصمیم قفل‌شده |
|---|---|
| محدوده فاز اول | کل MVP قابل اجرا (Frontend + Edge Worker + Supabase + Admin + AI Engine با mock) |
| امنیت | HMAC validation روی `initData` + TLS 1.3 + JWT کوتاه‌عمر. رمزنگاری payload به‌عنوان لایه دوم اختیاری |
| پرداخت | فقط **Telegram Stars** در نسخه اول. زرین‌پال و rبات رسید در فاز بعد (کد به‌صورت interface آماده است) |
| هدیه اشتراک | پنل ادمین باید امکان **اهدای دستی اشتراک** متناسب با هر ۵ پلن را داشته باشد |
| i18n | چندزبانه. پیش‌فرض = زبان تلگرام کاربر + امکان انتخاب دستی در اولین ورود |

## ۲. تحلیل امنیتی صادقانه (مهم)

سند اولیه «رمزنگاری دوسویه E2E» را الزام کرده بود. در یک Telegram Mini App این الزام **از نظر امنیتی توهم‌آور** است:

- کلید رمزنگاری باید داخل باندل فرانت‌اند باشد، پس هر کاربری که DevTools باز کند به آن دسترسی دارد.
- هیچ محرمانگی‌ای اضافه نمی‌شود؛ فقط پیچیدگی و ریسک خطای پیاده‌سازی اضافه می‌گردد.

**راه‌حل پذیرفته‌شده:**
1. اعتبارسنجی واقعی: امضای `initData` با HMAC-SHA256 و کلید ربات (این واقعاً امن است).
2. TLS 1.3 برای کل مسیر.
3. توکن JWT با عمر کوتاه (۱۵ دقیقه) + refresh.
4. Route Obfuscation + Rate limiting + فیلترینگ prompt injection.
5. لایه رمزنگاری payload به‌صورت **اختیاری و غیرفعال** (`ENABLE_PAYLOAD_ENCRYPTION=false`) نوشته شده تا اگر خواستید فعال کنید.

## ۳. ساختار Monorepo

```
kpanah-lang-platform/
├── apps/
│   └── tma/                    # Telegram Mini App (React + TS + Vite)
├── workers/
│   └── edge/                   # Cloudflare Worker (API Gateway + Webhooks)
│       └── src/
│           ├── middleware/     # HMAC auth, rate limit, content filter
│           ├── routes/         # auth, lesson, telemetry, store, admin, bot
│           ├── services/       # ai engine, supabase client, qstash client
│           └── lib/            # crypto, jwt, response helpers
├── packages/
│   └── shared/                 # Types, Zod schemas, lesson engine, constants
├── supabase/
│   └── migrations/             # SQL schema + RLS
└── docs/                       # API contracts, deployment
```

## ۴. جریان داده (Data Flow)

```
Telegram Client
   │  initData (signed) + JWT
   ▼
TMA (React SPA, Vercel/CF Pages)
   │  POST /kpanah56/8fjg7rfb/v1/gate?action=...
   ▼
Cloudflare Worker (Edge Gateway)
   ├─ 1. Rate limit (KV / Durable Object)
   ├─ 2. Content filter (prompt injection guard)
   ├─ 3. JWT verify  (or initData HMAC on /auth)
   ├─ 4. Route dispatch
   ▼
   ├──> Supabase Postgres (via service role)   → lesson / user / subscription
   ├──> Upstash QStash  (async)                → cycle generation
   └──> Multi-AI Engine                        → Gemini 2.5 Flash → fallback DeepSeek/Claude
```

## ۵. منطق Delta Patching و توقف تقویم

- **Trigger:** پس از `POST complete-lesson` برای `day_number = 7`.
- **محاسبه Delta:** تحلیل `telemetry` (خطاها، مکث‌ها، امتیاز روز ۶).
- **قاعده توقف تقویم:** اگر چرخه فعال کاربر بیش از **۱۲ روز** در حالت ACTIVE مانده باشد و روز ۷ تمام نشده باشد، هیچ job جدیدی به AI فرستاده نمی‌شود (`shouldGenerateNextCycle()` در `packages/shared/src/engine`).
- **جعبه لایتنر ۵ خانه‌ای:** داخل `part_1_data` و `part_2_data` تزریق می‌شود (`lexical_boxes` table نرخ عبور/سقوط واژه را نگه می‌دارد).

## ۶. تفاوت‌های عمدی با سند اولیه

| سند اولیه | پیاده‌سازی |
|---|---|
| n8n برای orchestration | حذف شد. منطق در Edge Worker + QStash |
| زرین‌پال + ربات رسید در MVP | به فاز ۲ موکول شد، interface آماده |
| E2E اجباری | اختیاری و غیرفعال |
| `skill_level` بدون مقداردهی | onboarding اجباری در اولین ورود |
