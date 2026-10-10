# راه‌اندازی و استقرار

## پیش‌نیازها

| ابزار | نسخه |
|---|---|
| Node.js | ≥ ۲۰ |
| npm | ≥ ۱۰ |
| Wrangler CLI | برای استقرار Worker |
| Supabase CLI | برای migration ها (اختیاری) |
| اکانت Supabase | پلن رایگان کافی است |
| اکانت Upstash | برای QStash (اختیاری ولی توصیه‌شده) |
| ربات تلگرام | از [@BotFather](https://t.me/BotFather) |
| کلید Gemini | از [AI Studio](https://aistudio.google.com/apikey) |

---

## ۱. نصب

```bash
git clone <repo>
cd kpanah-lang-platform
npm install
```

یک فایل `.env` از `.env.example` بسازید (فقط برای مرجع — مقادیر واقعی به‌صورت secret به Worker می‌روند).

---

## ۲. دیتابیس Supabase

### الف) ساخت پروژه
پروژه جدید در [supabase.com](https://supabase.com) بسازید و این سه مقدار را بردارید:
- `Project URL` → `SUPABASE_URL`
- `anon public key` → `SUPABASE_ANON_KEY`
- `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ این کلید هرگز نباید در فرانت‌اند باشد

### ب) اجرای migration ها

**با Supabase CLI (توصیه‌شده):**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**یا دستی:** در SQL Editor داشبورد، این سه فایل را به ترتیب اجرا کنید:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_seed.sql`

### ج) زمان‌بندی انقضای اشتراک (اختیاری)
در SQL Editor:
```sql
select cron.schedule(
  'expire-subscriptions',
  '0 * * * *',
  $$select public.expire_stale_subscriptions()$$
);
```

---

## ۳. ساخت ربات‌های تلگرام

### الف) ربات کاربر
1. در [@BotFather](https://t.me/BotFather) دستور `/newbot` را بزنید
2. توکن را به‌عنوان `TELEGRAM_BOT_TOKEN` نگه دارید
3. `TELEGRAM_WEBHOOK_SECRET` بسازید:
   ```bash
   openssl rand -hex 32
   ```
4. دستور `/newapp` را بزنید تا Mini App ساخته شود و آدرس آن را بدهید (بعد از استقرار فرانت‌اند)
5. از `/setmenubutton` دکمه منو را به Mini App وصل کنید

### ب) ربات ادمین (جداگانه — سطح حمله مجزا)
ربات دوم بسازید → `TELEGRAM_ADMIN_BOT_TOKEN`

شناسه عددی خودتان را از [@userinfobot](https://t.me/userinfobot) بگیرید → `TELEGRAM_ADMIN_IDS`
(چند ادمین: با کاما جدا کنید — `123456,789012`)

---

## ۴. استقرار Edge Worker

```bash
cd workers/edge
npx wrangler login
```

### الف) فضای KV برای rate limiting
```bash
npx wrangler kv:namespace create RATE_LIMIT_KV
npx wrangler kv:namespace create CACHE_KV
```
شناسه‌های برگشتی را در `wrangler.toml` جای `REPLACE_WITH_YOUR_KV_ID` بگذارید.

### ب) تنظیم secrets
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_ADMIN_BOT_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put JWT_SECRET              # openssl rand -hex 48
npx wrangler secret put GEMINI_API_KEY
# اختیاری:
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put QSTASH_TOKEN
npx wrangler secret put QSTASH_CURRENT_SIGNING_KEY
npx wrangler secret put QSTASH_NEXT_SIGNING_KEY
```

> همچنین `TELEGRAM_ADMIN_IDS` را تنظیم کنید:
> ```bash
> npx wrangler secret put TELEGRAM_ADMIN_IDS
> ```

### ج) انتشار
```bash
npx wrangler deploy
```
خروجی: `https://kpanah-lang-edge.<subdomain>.workers.dev`

مقدار `SELF_URL` در `wrangler.toml` را با همین آدرس جایگزین کنید و دوباره deploy بزنید.

---

## ۵. صف QStash (توصیه‌شده)

بدون QStash، تولید چرخه با `waitUntil` در همان isolate اجرا می‌شود. برای ترافیک واقعی، QStash لازم است چون قوانین `waitUntil` ممکن است در isolate های پرترافیک قطع شوند.

1. در [upstash.com](https://upstash.com) → QStash → توکن را بردارید
2. `QSTASH_TOKEN`، `QSTASH_CURRENT_SIGNING_KEY`، `QSTASH_NEXT_SIGNING_KEY` را تنظیم کنید
3. مطمئن شوید `SELF_URL` درست است

بررسی: پس از تکمیل روز ۷، در پنل QStash باید یک پیام `generate-cycle` ببینید.

---

## ۶. اتصال وب‌هوک‌ها

```bash
# ربات کاربر
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://kpanah-lang-edge.<subdomain>.workers.dev/telegram/webhook",
    "secret_token": "'"${TELEGRAM_WEBHOOK_SECRET}"'",
    "allowed_updates": ["message", "pre_checkout_query"]
  }'

# ربات ادمین
curl -X POST "https://api.telegram.org/bot${TELEGRAM_ADMIN_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kpanah-lang-edge.<subdomain>.workers.dev/telegram/admin-webhook"}'
```

بررسی وضعیت:
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

---

## ۷. استقرار فرانت‌اند (Vercel)

### الف) تنظیم متغیرهای محیطی
در Vercel → Project Settings → Environment Variables:

| نام | مقدار |
|---|---|
| `VITE_API_BASE` | `https://kpanah-lang-edge.<subdomain>.workers.dev` |
| `VITE_GATE_PATH` | `/kpanah56/8fjg7rfb/v1/gate` |
| `VITE_ENABLE_MOCK` | `false` |

### ب) استقرار
```bash
cd apps/tma
npx vercel --prod
```

### ج) اتصال به تلگرام
آدرس Vercel را در BotFather (`/newapp` یا ویرایش Mini App) ثبت کنید.

---

## ۸. اجرای محلی

```bash
# ترمینال ۱ — Worker
cd workers/edge
npx wrangler dev

# ترمینال ۲ — فرانت‌اند
cd apps/tma
npm run dev
```

برای توسعه بدون دیتابیس و کلید AI، در `apps/tma/.env.local`:
```
VITE_ENABLE_MOCK=true
```
با این تنظیم، UI با داده mock کار می‌کند (کاربر نمونه، چرخه نمونه، درس کامل روز ۳).

---

## ۹. بررسی سلامت

```bash
curl "https://<worker-url>/kpanah56/8fjg7rfb/v1/gate?action=health"
```

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "features": {
      "telegramStars": true,
      "adminGift": true,
      "payloadEncryption": false,
      "aiProviders": { "gemini": true, "deepseek": false, "anthropic": false }
    }
  }
}
```

---

## ۱۰. عیب‌یابی

| نشانه | علت محتمل | راه‌حل |
|---|---|---|
| `INVALID_INIT_DATA` | توکن ربات اشتباه، یا `auth_date` قدیمی | توکن را چک کنید؛ حداکثر عمر پیش‌فرض ۲۴ ساعت است |
| `CYCLE_NOT_READY` مداوم | تولید شکست خورده | `select id,status,focus_summary from cycles where status='FAILED'` را ببینید؛ پیام خطا در `focus_summary` است |
| چرخه هرگز تولید نمی‌شود | کلید AI ست نشده یا QStash نیست | `action=health` را چک کنید؛ در لاگ Worker دنبال `[requestId]` بگردید |
| UI با داده jعلی | `VITE_ENABLE_MOCK` روشن مانده | در production آن را `false` کنید |
| `SUBSCRIPTION_REQUIRED` | تست ۷ روزه تمام شده | از پنل ادمین اشتراک هدیه بدهید |
| webhook تلگرام ۴۰۳ | `TELEGRAM_WEBHOOK_SECRET` ناهماهنگ | secret در `setWebhook` و secret Worker باید یکی باشند |

### مشاهده لاگ زنده
```bash
cd workers/edge
npx wrangler tail
```

### بررسی دیتابیس
```sql
-- وضعیت کاربران
select telegram_id, skill_level, streak_count, stars_balance, created_at
from users order by created_at desc limit 20;

-- اشتراک‌های فعال
select u.telegram_id, s.plan_type, s.source, s.expires_at
from subscriptions s join users u on u.id = s.user_id
where s.status = 'ACTIVE' and s.expires_at > now();

-- لاگ هدیه‌های ادمین
select g.created_at, a.telegram_id as admin, t.telegram_id as target, g.action, g.plan_type, g.days_delta
from admin_grants g
join users a on a.id = g.admin_user_id
join users t on t.id = g.target_user_id
order by g.created_at desc;

-- جعبه‌های لایتنر یک کاربر
select box, count(*) from lexical_items
where user_id = (select id from users where telegram_id = 123456789)
group by box order by box;
```

---

## ۱۱. چک‌لیست production

- [ ] همه secrets تنظیم شده‌اند (هیچ کلیدی در `wrangler.toml` نیست)
- [ ] `TELEGRAM_ADMIN_IDS` فقط شامل ادمین‌های واقعی است
- [ ] `JWT_SECRET` تصادفی و بلند است (۴۸ بایت hex)
- [ ] KV برای rate limiting متصل است
- [ ] QStash تنظیم شده (برای ترافیک واقعی)
- [ ] `VITE_ENABLE_MOCK=false` است
- [ ] RLS روی همه جداول فعال است (`0002_rls.sql` اجرا شده)
- [ ] باکت `receipts` خصوصی است
- [ ] cron انقضای اشتراک فعال است
- [ ] `/ping` و `action=health` پاسخ می‌دهند
- [ ] وب‌هوک‌های هر دو ربات `getWebhookInfo` را سبز نشان می‌دهند
