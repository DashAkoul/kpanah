# 🚀 گزارش دیپلوی — Kpanah Lang

> وضعیت: **زنده در production** · تاریخ: ۲۰۲۶-۱۰-۱۱
> حساب Cloudflare: `akouldash@outlook.com`

---

## ۱. آدرس‌های production

| سرویس | آدرس |
|---|---|
| **Mini App (فرانت‌اند)** | https://kpanah-lang.pages.dev |
| **Edge API (Worker)** | https://kpanah-lang-edge.language-app-backend.workers.dev |
| **Supabase (دیتابیس)** | پروژه شخصی شما (`SUPABASE_URL` در `.env`) |

### مسیر دروازه (مبهم‌سازی‌شده)

تمام فراخوانی‌های API از این مسیر عبور می‌کنند:

```
https://kpanah-lang-edge.language-app-backend.workers.dev/kpanah56/8fjg7rfb/v1/gate?action=<ACTION>
```

سلامت‌سنجی:
```bash
curl "https://kpanah-lang-edge.language-app-backend.workers.dev/kpanah56/8fjg7rfb/v1/gate?action=health"
```

---

## ۲. ربات‌های تلگرام

| ربات | Username | شناسه | نقش |
|---|---|---|---|
| اصلی | `@AILanguageEducationbot` | `8873899662` | کاربر نهایی + Mini App |
| ادمین | `@LanguageEducationAdmin_bot` | `8780849021` | عملیات مدیریتی |

### وضعیت webhook

| ربات | مسیر | رویدادها | وضعیت |
|---|---|---|---|
| اصلی | `/telegram/webhook` | message, callback_query, pre_checkout_query | ✅ `pending: 0` |
| ادمین | `/telegram/admin-webhook` | message, callback_query | ✅ `pending: 0` |

هر دو با `secret_token` محافظت می‌شوند (همان `TELEGRAM_WEBHOOK_SECRET`).

> ⚠️ **نکته امنیتی:** ربات ادمین در حال حاضر اعتبارسنجی secret در کد ندارد
> (`admin-bot.ts` هیچ بررسی `TELEGRAM_WEBHOOK_SECRET` ندارد). پیشنهاد می‌شود
> در نسخه بعدی همان بررسی ربات اصلی به آن هم اضافه شود.

---

## ۳. منابع Cloudflare ساخته‌شده

```
Worker:  kpanah-lang-edge
Version: 239f21b6-8035-4326-b507-ff4b109e28fe
Bundle:  353.58 KiB  /  68.60 KiB gzip
Startup: 21 ms

KV:
  RATE_LIMIT_KV → 5c273b38df14451aa5e0967d3f832579
  CACHE_KV      → 49474852f40b480d8acaf20becbc792c

Pages:
  Project  kpanah-lang
  Domain   kpanah-lang.pages.dev
  Deploy   3e9fe175  (branch: main)

Cron:
  0 * * * *      انقضای اشتراک‌ها
  */5 * * * *    کارهای دوره‌ای
  0 9 * * *      یادآور روزانه
```

---

## ۴. متغیرهای محیطی (Worker vars)

| متغیر | مقدار |
|---|---|
| `MINI_APP_URL` | `https://kpanah-lang.pages.dev` |
| `SELF_URL` | `https://kpanah-lang-edge.language-app-backend.workers.dev` |
| `GATE_PATH` | `/kpanah56/8fjg7rfb/v1/gate` |
| `AI_PRIMARY_MODEL` | `gemini-2.5-flash` |
| `AI_FALLBACK_MODELS` | `deepseek-chat,claude-3-5-sonnet-latest` |
| `ENABLE_PAYLOAD_ENCRYPTION` | `false` |
| `RATE_LIMIT_PER_MINUTE` | `60` |
| `RATE_LIMIT_PER_DAY` | `2000` |
| `FREE_TRIAL_DAYS` | `7` |
| `CYCLE_STALL_DAYS` | `12` |

---

## ۵. Secret های ثبت‌شده (۱۰ مورد)

```
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
```

> مقادیر هرگز در فایل یا لاگ نمایش داده نمی‌شوند. برای به‌روزرسانی:
> ```bash
> bash scripts/set-secrets.sh
> ```

---

## ۶. موتورهای AI — وضعیت فعلی

خروجی زنده از `?action=health`:

```json
"aiProviders": { "gemini": true, "deepseek": false, "anthropic": false }
```

| اولویت | برچسب | پروتکل | مدل | کلید |
|---|---|---|---|---|
| ۱۰ | Gemini Flash | `gemini` | `gemini-2.5-flash` | ✅ دارد |
| ۲۰ | DeepSeek | `openai_compatible` | `deepseek-chat` | ⏳ خالی |
| ۳۰ | Claude Sonnet | `anthropic` | `claude-3-5-sonnet-latest` | ⏳ خالی |

### 🌟 افزودن موتور جدید بدون redeploy

از **پنل ادمین → تب «موتورهای AI»** می‌توانید:

1. provider جدید اضافه کنید (۸ پیش‌فرض آماده: Gemini, DeepSeek, Anthropic,
   OpenAI, Groq, OpenRouter, Together, Custom)
2. ترتیب اولویت را با ▲▼ تغییر دهید
3. با دکمه **تست**، کلید را با یک فراخوانی واقعی ارزان بسنجید
4. هر provider را جداگانه فعال/غیرفعال کنید

**زنجیره failover خودکار:** اگر provider با اولویت بالاتر خطا بدهد، برنامه
خودکار به بعدی می‌رود. هر تلاش در جدول `ai_attempt_log` ثبت و سلامت
(`health_status`, `consecutive_failures`, `avg_latency_ms`) به‌روز می‌شود.

---

## ۷. چه چیزی کار می‌کند (تأیید شده)

| بررسی | نتیجه |
|---|---|
| Worker deploy | ✅ live |
| Worker `?action=health` | ✅ 200 |
| Worker `?action=plans` (داده واقعی Supabase) | ✅ 200، ۵ پلن |
| Pages deploy | ✅ live |
| Mini App صفحه اصلی | ✅ «معلم هوشمند زبان» |
| webhook ربات اصلی | ✅ secret درست → 200، غلط → 403 |
| webhook ربات ادمین | ✅ 200 |
| menu button مینی‌اپ | ✅ |
| command menu هر دو ربات | ✅ |
| Supabase (۱۴ جدول) | ✅ |
| ۱۰۳ تست | ✅ |
| typecheck (۳ workspace) | ✅ |
| نشت کلید در `.env.example` | ✅ رفع شد |

---

## ۸. کارهای باقی‌مانده (اختیاری)

هیچ‌کدام برای کارکرد برنامه لازم نیست:

- **QStash** — بدون آن تولید درس به‌صورت inline انجام می‌شود (به‌جای صف).
  افزودن: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- **عمق بیشتر failover** — `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`
- **رمزنگاری payload** — `ENABLE_PAYLOAD_ENCRYPTION=true` + `PAYLOAD_ENCRYPTION_KEY`
  (عمداً خاموش است؛ سند معماری دلیل را توضیح می‌دهد)
- **دامنه اختصاصی** — در پنل Cloudflare Pages → Custom domains
- **secret برای ربات ادمین** — افزودن بررسی `TELEGRAM_WEBHOOK_SECRET` به `admin-bot.ts`

---

## ۹. دستورات مفید

```bash
# ثبت مجدد secret ها
bash scripts/set-secrets.sh

# دیپلوی مجدد Worker
npx wrangler deploy -c workers/edge/wrangler.toml

# بیلد + دیپلوی مجدد فرانت‌اند
cd apps/tma
VITE_API_BASE="https://kpanah-lang-edge.language-app-backend.workers.dev" \
  npm run build
npx wrangler pages deploy dist --project-name=kpanah-lang

# لاگ زنده Worker
npx wrangler tail kpanah-lang-edge

# لیست deployment های Pages
npx wrangler pages deployment list --project-name=kpanah-lang
```

---

## ۱۰. عیب‌یابی سریع

| علامت | علت احتمالی | راه‌حل |
|---|---|---|
| Mini App باز نمی‌شود | از داخل تلگرام باز نشده | باید از داخل تلگرام باز شود (initData لازم است) |
| `?action=health` می‌گوید `gemini: false` | `GEMINI_API_KEY` ثبت نشده | `bash scripts/set-secrets.sh` |
| webhook خطا می‌دهد | secret ناهماهنگ | `setWebhook` را با مقدار واقعی دوباره اجرا کنید |
| تولید درس شکست می‌خورد | همه provider ها در دسترس نیستند | در پنل ادمین تب AI، با «تست» بررسی کنید |
| پیام‌ها به ربات نمی‌رسند | webhook ثبت نشده | `getWebhookInfo` را چک کنید |
