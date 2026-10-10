# راهنمای کامل راه‌اندازی — قدم به قدم

این سند تمام کاری است که باید انجام دهید تا پروژه از صفر به یک اپ زنده تبدیل شود.
هر مرحله دقیقاً مشخص می‌کند **چه چیزی**، **کجا**، و **چطور** — همراه با مقادیری که باید کپی کنید.

> **ترتیب را رعایت کنید.** هر مرحله به مرحله قبل وابسته است:
> Supabase ← Telegram ← AI Keys ← QStash ← Cloudflare ← دیپلوی ← اتصال نهایی

---

# فاز ۱ — آماده‌سازی Supabase

## ۱.۱ ساخت پروژه

1. وارد <https://supabase.com/dashboard> شوید
2. **New project** را بزنید
3. مقادیر را وارد کنید:

| فیلد | مقدار پیشنهادی |
|---|---|
| Name | `kpanah-lang` |
| Database Password | یک رمز قوی — **جایی ذخیره کنید** |
| Region | نزدیک‌ترین به کاربران (برای ایران: `Frankfurt` یا `Bahrain`) |
| Pricing Plan | Free کافی است برای شروع |

4. حدود ۲ دقیقه صبر کنید تا پروژه provision شود.

## ۱.۲ گرفتن کلیدها

به **Project Settings → API** بروید و این سه مقدار را بردارید:

| مقدار | در پنل کجاست | کجا استفاده می‌شود |
|---|---|---|
| `SUPABASE_URL` | بالای صفحه، `Project URL` | secret ورکر |
| `SUPABASE_ANON_KEY` | `Project API keys` → `anon` `public` | secret ورکر (اختیاری در v1) |
| `SUPABASE_SERVICE_ROLE_KEY` | `Project API keys` → `service_role` | **secret ورکر — هرگز در کلاینت** |

> ⚠️ **هشدار امنیتی:** `service_role` تمام RLS را دور می‌زند. فقط در secret ورکر ذخیره می‌شود،
> هرگز در `.env` کلاینت، هرگز در گیت، هرگز در Mini App.

## ۱.۳ اجرای Migration ها

### راه اول — از طریق SQL Editor (ساده‌تر، بدون نصب چیزی)

1. **SQL Editor** را در منوی کناری باز کنید
2. فایل `supabase/migrations/0001_init.sql` را باز کنید، همه محتوا را کپی و **Run** بزنید
3. همین کار را برای `0002_rls.sql` تکرار کنید
4. سپس `0003_seed.sql`
5. و در آخر `0004_ai_providers.sql`

هر فایل باید `Success. No rows returned` بدهد.

### راه دوم — از طریق CLI (اگر Supabase CLI دارید)

```bash
cd "مسیر/پروژه"
npx supabase login
npx supabase link --project-ref <PROJECT-REF>
npm run db:push
```

`<PROJECT-REF>` همان بخشی از URL است: `https://<PROJECT-REF>.supabase.co`

## ۱.۴ ساخت Storage Bucket برای رسیدها

> این مرحله برای فاز ۲ (پرداخت دستی با رسید) است. اگر فقط Telegram Stars می‌خواهید،
> می‌توانید رد کنید — ولی ساختنش ضرری ندارد.

1. **Storage** → **New bucket**
2. Name: `receipts`
3. **Public bucket: خاموش** (حتماً خصوصی بماند)
4. Create را بزنید

سیاست‌های دسترسی در `0002_rls.sql` تعریف شده‌اند و خودکار اعمال می‌شوند.

## ۱.۵ تنظیم Timezone و Cron

1. **Database → Extensions**: مطمئن شوید `pg_cron` و `pg_net` فعال باشند
   (در migration ها تلاش شده خودکار فعال شوند)
2. Cron های اصلی روی **Cloudflare Worker** تعریف شده‌اند، نه Supabase — پس کار دیگری لازم نیست.

## ۱.۶ تأیید نهایی Supabase

در **SQL Editor** این کوئری را اجرا کنید:

```sql
-- باید ۱۲ جدول برگرداند
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

انتظار می‌رود این جدول‌ها را ببینید:

```
admin_grants        ai_attempt_log      ai_providers
app_settings        cycles              lessons
lexical_items       payment_receipts    plans
star_transactions   subscriptions       telemetry_events
users
```

و برای اطمینان از seed شدن پلن‌ها:

```sql
select plan_type, price_stars, badge from plans order by duration_days;
```

باید ۵ پلن ببینید (۲ هفته‌ای تا ۱ ساله).

بگذارید چک‌لیست فاز ۱ را ببینیم:

---

# فاز ۲ — راه‌اندازی Telegram

## ۲.۱ ساخت ربات کاربر (User Bot)

1. در تلگرام به **@BotFather** پیام دهید
2. دستور `/newbot`
3. نام نمایشی را وارد کنید (مثلاً `کپناه لهجه`)
4. یوزرنیم را وارد کنید — باید به `bot` ختم شود (مثلاً `kpanah_lang_bot`)
5. **توکن** را کپی کنید:
   ```
   1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
   ```
   این می‌شود `TELEGRAM_BOT_TOKEN`

## ۲.۲ ساخت ربات ادمین (Admin Bot)

برای امنیت، ربات ادمین **جدا** از ربات کاربر است.

1. دوباره `/newbot`
2. نام: `کپناه لهجه — ادمین`
3. یوزرنیم: `kpanah_admin_bot`
4. توکن را کپی کنید → این می‌شود `TELEGRAM_ADMIN_BOT_TOKEN`

## ۲.۳ گرفتن Telegram ID خودتان (برای ادمین شدن)

1. به **@userinfobot** پیام دهید
2. عدد `Id` که می‌دهد را یادداشت کنید — این می‌شود `TELEGRAM_ADMIN_IDS`

> اگر چند ادمین دارید، با کاما جدا کنید: `123456789,987654321`

## ۲.۴ ساخت Mini App و گرفتن لینک

Mini App به یک URL عمومی نیاز دارد. **ترتیب مهم است:** اول Cloudflare Pages را دیپلوی می‌کنیم
(فاز ۶)، بعد لینک را اینجا ثبت می‌کنیم. فعلاً فقط توکن‌ها را نگه دارید.

هنگام ثبت، به BotFather دستور `/newapp` می‌دهید و URL Pages را وارد می‌کنید.

## ۲.۵ ساخت Webhook Secret

یک رشته تصادفی بسازید:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

خروجی می‌شود `TELEGRAM_WEBHOOK_SECRET`.

## ۲.۶ ثبت Webhook ها (بعد از دیپلوی Worker)

> این کار را پس از فاز ۶ انجام دهید، چون به URL ورکر نیاز دارد.

```bash
# webhook ربات کاربر
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://kpanah-lang-edge.<subdomain>.workers.dev/kpanah56/8fjg7rfb/v1/gate/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "pre_checkout_query", "successful_payment"]
  }'

# webhook ربات ادمین
curl -X POST "https://api.telegram.org/bot<TELEGRAM_ADMIN_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://kpanah-lang-edge.<subdomain>.workers.dev/kpanah56/8fjg7rfb/v1/gate/telegram/admin-webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

### تأیید ثبت webhook

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

باید `"url"` را ببینید و `"last_error_message"` نباید وجود داشته باشد.

## ۲.۷ تنظیم منوی ربات

```bash
# منوی دستورات ربات کاربر
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"command":"start","description":"شروع یادگیری"},
    {"command":"app","description":"باز کردن اپلیکیشن"},
    {"command":"help","description":"راهنما"}
  ]}'

# منوی دستورات ربات ادمین
curl -X POST "https://api.telegram.org/bot<TELEGRAM_ADMIN_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
    {"command":"gift","description":"اهدای اشتراک: /gift <id> <plan> [روز اضافه]"},
    {"command":"user","description":"اطلاعات کاربر: /user <id>"},
    {"command":"revoke","description":"لغو اشتراک: /revoke <id>"},
    {"command":"stats","description":"آمار کلی"},
    {"command":"plans","description":"لیست پلن‌ها"},
    {"command":"help","description":"راهنما"}
  ]}'
```

## ۲.۸ پلن‌ها را در کد بررسی کنید

پلن‌ها در جدول `plans` هستند و قیمت استارز دارند. بگذارید تأیید کنیم:

```sql
select plan_type, price_stars, price_irr, badge
from plans
where is_active = true
order by duration_days;
```

انتظار:

| plan_type | price_stars | price_irr |
|---|---|---|
| `2_WEEKS` | 100 | 400000 |
| `1_MONTH` | 175 | 750000 |
| `3_MONTHS` | 400 | 1800000 |
| `6_MONTHS` | 700 | 3200000 |
| `1_YEAR` | 1150 | 5500000 |

> برای تغییر قیمت‌ها کافی است همین جدول را ویرایش کنید — نیازی به دیپلوی نیست.

---

# فاز ۳ — کلیدهای هوش مصنوعی

## ۳.۱ Gemini (موتور اصلی — توصیه‌شده)

1. به <https://aistudio.google.com/apikey> بروید
2. با حساب گوگل وارد شوید
3. **Create API key**
4. کپی کنید → می‌شود `GEMINI_API_KEY`

**چرا Gemini اول؟** پلن رایگان سخاوتمندانه دارد و از `responseSchema` پشتیبانی می‌کند،
یعنی مدل از قبل به ساختار JSON ما مقید می‌شود و خطای اسکیما کم می‌شود.

## ۳.۲ DeepSeek (جایگزین اول — ارزان)

1. به <https://platform.deepseek.com/api_keys> بروید
2. ثبت‌نام و شارژ کنید (حداقل ۲ دلار کافی است برای مدت طولانی)
3. کلید را کپی کنید → `DEEPSEEK_API_KEY`

## ۳.۳ Anthropic Claude (جایگزین دوم — باکیفیت)

1. به <https://console.anthropic.com/settings/keys> بروید
2. کلید بسازید → `ANTHROPIC_API_KEY`

> **نکته:** داشتن هر سه الزامی نیست. یکی هم کافی است. اما چون خواسته شما failover
> خودکار است، داشتن حداقل دو موتور توصیه می‌شود.

## ۳.۴ کلید رمزنگاری provider (مهم)

موتورهایی که در پنل ادمین وارد می‌کنید، رمزنگاری‌شده در دیتابیس ذخیره می‌شوند.
یک کلید master بسازید:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

خروجی می‌شود `PROVIDER_ENCRYPTION_KEY`.

> ⚠️ **این کلید را گم نکنید.** اگر عوضش کنید، تمام کلیدهای ذخیره‌شده در پنل ادمین
> غیرقابل رمزگشایی می‌شوند و باید دوباره واردشان کنید.

---

# فاز ۴ — QStash (صف ناهمزمان)

QStash باعث می‌شود تولید چرخه جدید (که ممکن است ۳۰ ثانیه طول بکشد) در پس‌زمینه انجام شود
و درخواست کاربر معطل نشود.

## ۴.۱ ساخت حساب و گرفتن توکن

1. به <https://console.upstash.com/qstash> بروید
2. ثبت‌نام با گیت‌هاب یا ایمیل
3. در **QStash → Request Builder**، توکن را کپی کنید → `QSTASH_TOKEN`

## ۴.۲ گرفتن Signing Keys

1. در همان صفحه، تب **Signing Keys**
2. دو مقدار را کپی کنید:
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

این‌ها برای تأیید اینکه درخواست واقعاً از QStash آمده استفاده می‌شوند.

## ۴.۳ تنظیم مقصد (Callback)

فقط یک Destination لازم است که به ورکر شما اشاره کند:

```
https://kpanah-lang-edge.<subdomain>.workers.dev/kpanah56/8fjg7rfb/v1/gate/internal/queue?internal=generate-cycle
```

> **اگر QStash را تنظیم نکنید:** برنامه همچنان کار می‌کند، اما تولید چرخه جدید
> به‌صورت inline انجام می‌شود و ممکن است کاربر چند ثانیه بیشتر منتظر بماند.
> این یک degradation قابل قبول است، نه خرابی.

---

# فاز ۵ — تنظیم Secrets روی Cloudflare

## ۵.۱ فهرست کامل مقادیری که تا اینجا جمع کرده‌اید

| Secret | از کجا |
|---|---|
| `TELEGRAM_BOT_TOKEN` | فاز ۲.۱ |
| `TELEGRAM_ADMIN_BOT_TOKEN` | فاز ۲.۲ |
| `TELEGRAM_ADMIN_IDS` | فاز ۲.۳ |
| `TELEGRAM_WEBHOOK_SECRET` | فاز ۲.۵ |
| `SUPABASE_URL` | فاز ۱.۲ |
| `SUPABASE_ANON_KEY` | فاز ۱.۲ |
| `SUPABASE_SERVICE_ROLE_KEY` | فاز ۱.۲ |
| `JWT_SECRET` | خودتان بسازید (دستور پایین) |
| `PROVIDER_ENCRYPTION_KEY` | فاز ۳.۴ |
| `GEMINI_API_KEY` | فاز ۳.۱ |
| `DEEPSEEK_API_KEY` | فاز ۳.۲ |
| `ANTHROPIC_API_KEY` | فاز ۳.۳ |
| `QSTASH_TOKEN` | فاز ۴.۱ |
| `QSTASH_CURRENT_SIGNING_KEY` | فاز ۴.۲ |
| `QSTASH_NEXT_SIGNING_KEY` | فاز ۴.۲ |

## ۵.۲ ساخت JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## ۵.۳ ثبت خودکار Secrets

اسکریپت آماده در `scripts/set-secrets.sh` نوشته شده است. مقادیر را در یک فایل
`.env` بگذارید (از `.env.example` کپی کنید) و بعد اجرا کنید:

```bash
bash scripts/set-secrets.sh
```

> این اسکریپت هر مقدار را با `wrangler secret put` ثبت می‌کند. مقادیر خالی را رد می‌کند.

## ۵.۴ یا ثبت دستی (اگر اسکریپت را ترجیح نمی‌دهید)

```bash
cd workers/edge
npx wrangler secret put TELEGRAM_BOT_TOKEN
# ... مقدار را paste کنید و Enter

# و همین‌طور برای بقیه:
npx wrangler secret put TELEGRAM_ADMIN_BOT_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_IDS
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put PROVIDER_ENCRYPTION_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put QSTASH_TOKEN
npx wrangler secret put QSTASH_CURRENT_SIGNING_KEY
npx wrangler secret put QSTASH_NEXT_SIGNING_KEY
```

## ۵.۵ تأیید

```bash
npx wrangler secret list
```

باید نام همهٔ secret ها را ببینید (مقادیر نمایش داده نمی‌شوند — این درست است).

---

# فاز ۶ — دیپلوی

## ۶.۱ دیپلوی Worker

```bash
npm run build -w @kpanah/edge
npx wrangler deploy -c workers/edge/wrangler.toml
```

خروجی چیزی شبیه این است:

```
Uploaded kpanah-lang-edge (3.42 sec)
Published kpanah-lang-edge
  https://kpanah-lang-edge.<subdomain>.workers.dev
```

**این URL را کپی کنید** — در مراحل بعد لازم است.

## ۶.۲ به‌روزرسانی SELF_URL و MINI_APP_URL

در `workers/edge/wrangler.toml` مقادیر را با URL واقعی جایگزین کنید:

```toml
[vars]
SELF_URL = "https://kpanah-lang-edge.<subdomain>.workers.dev"
MINI_APP_URL = "https://kpanah-lang.pages.dev"
```

و دوباره دیپلوی کنید:

```bash
npx wrangler deploy -c workers/edge/wrangler.toml
```

## ۶.۳ تست سلامت ورکر

```bash
curl "https://kpanah-lang-edge.<subdomain>.workers.dev/kpanah56/8fjg7rfb/v1/gate?action=health"
```

انتظار:

```json
{ "ok": true, "data": { "status": "healthy", "ts": 1760000000000 }, ... }
```

**اگر این کار نکرد، بقیه مراحل را ادامه ندهید.** جدول عیب‌یابی پایین را ببینید.

## ۶.۴ دیپلوی Mini App روی Cloudflare Pages

### راه اول — CLI (سریع)

```bash
# build با URL واقعی ورکر
cd apps/tma
VITE_API_BASE="https://kpanah-lang-edge.<subdomain>.workers.dev" npm run build

# deploy
npx wrangler pages deploy dist --project-name=kpanah-lang
```

خروجی URL می‌دهد:

```
https://kpanah-lang.pages.dev
```

### راه دوم — اتصال به گیت‌هاب

1. **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. مخزن را انتخاب کنید
3. Build settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build -w @kpanah/tma`
   - **Build output directory:** `apps/tma/dist`
   - **Root directory:** `/` (ریشه monorepo)
4. Environment variable اضافه کنید:
   ```
   VITE_API_BASE = https://kpanah-lang-edge.<subdomain>.workers.dev
   ```
5. Save and Deploy

## ۶.۵ تنظیم CORS روی Worker

بعد از اینکه URL Pages را گرفتید، مطمئن شوید Worker آن origin را می‌پذیرد.
اگر `ALLOWED_ORIGINS` دارید، URL Pages را اضافه کنید. (در نسخه فعلی CORS باز است
چون احراز هویت با initData انجام می‌شود، نه با origin.)

## ۶.۶ اتصال Mini App به ربات

برگردید به تلگرام و به **@BotFather**:

```
/mybots → ربات خود را انتخاب کنید → Bot Settings → Menu Button
```

یا مستقیماً برای ساخت Mini App:

```
/newapp
→ ربات را انتخاب کنید
→ Title: کپناه لهجه
→ Description: یادگیری هوشمند زبان
→ Photo: (اختیاری، ۶۴۰×۳۶۰)
→ Web App URL: https://kpanah-lang.pages.dev
→ Short name: app
```

حالا `/app` در ربات کار می‌کند.

## ۶.۷ ثبت Webhook ها

حالا که همه URL ها را دارید، دستورات فاز ۲.۶ را اجرا کنید.

---

# فاز ۷ — تست End-to-End

## ۷.۱ تست ورکر

```bash
BASE="https://kpanah-lang-edge.<subdomain>.workers.dev/kpanah56/8fjg7rfb/v1/gate"

# سلامت
curl "$BASE?action=health"

# پلن‌ها (عمومی)
curl "$BASE?action=plans"
```

## ۷.۲ تست اپ

1. ربات را در تلگرام باز کنید
2. `/app` را بزنید
3. باید صفحه Onboarding بیاید (چون کاربر جدید هستید)
4. زبان، زبان مقصد، سطح و هدف را انتخاب کنید
5. باید صفحه Learn با چرخه جدید بیاید

> **توجه:** اولین تولید چرخه ممکن است ۲۰ تا ۶۰ ثانیه طول بکشد چون AI باید
> ۷ درس کامل بسازد. صفحه «در حال ساخت چرخه» را نشان می‌دهد.

## ۷.۳ تست پنل ادمین

1. خودتان را در `TELEGRAM_ADMIN_IDS` گذاشته‌اید، پس `isAdmin` هستید
2. به تب **Profile → Admin** بروید
3. تب **AI engines** را بزنید
4. باید سه provider seed شده را ببینید
5. روی **Test** یکی بزنید — باید `ok: true` بدهید

## ۷.۴ تست اهدای اشتراک

از ربات ادمین:

```
/gift <telegram_id> 1M
```

کاربر باید در تلگرام پیام هدیه بگیرد.

## ۷.۵ تست failover (اختیاری ولی توصیه‌شده)

1. در پنل ادمین، provider اول را **غیرفعال** کنید
2. یک چرخه جدید تولید کنید (چرخه ۱ را تمام کنید یا کاربر جدید بسازید)
3. باید در **Recent attempts** ببینید که موتور دوم استفاده شده

---

# عیب‌یابی

| مشکل | علت احتمالی | راه‌حل |
|---|---|---|
| `health` برمی‌گردد ولی بقیه ۵۰۰ می‌دهند | secrets ناقص | `wrangler secret list` را چک کنید |
| `INVALID_INIT_DATA` | `TELEGRAM_BOT_TOKEN` غلط است | توکن را دوباره از BotFather بگیرید |
| `no AI provider could be resolved` | کلیدها تنظیم نشده یا `PROVIDER_ENCRYPTION_KEY` غلط | در پنل ادمین Test بزنید |
| چرخه هیچ‌وقت ساخته نمی‌شود | QStash/کلاudflare KV وصل نیست | `wrangler tail` را ببینید |
| Mini App سفید می‌ماند | `VITE_API_BASE` اشتباه یا CORS | کنسول مرورگر را در Telegram Desktop باز کنید |
| `PROVIDER_ENCRYPTION_KEY is not configured` | secret ثبت نشده | فاز ۵.۴ را تکرار کنید |
| کلید در پنل قابل استفاده نیست (`unusable`) | کلید عوض شده یا master عوض شده | کلید را دوباره در پنل وارد کنید |
| `429` از تلگرام | rate limit | چند دقیقه صبر کنید |

## دیدن لاگ زنده ورکر

```bash
npx wrangler tail kpanah-lang-edge
```

---

# چک‌لیست نهایی

پیش از اعلام «آماده»، اینها باید تیک بخورند:

- [ ] ۱۲ جدول در Supabase ساخته شده (`select table_name ...`)
- [ ] ۵ پلن seed شده است
- [ ] Bucket `receipts` ساخته شده (اختیاری)
- [ ] ربات کاربر ساخته و توکن گرفته شده
- [ ] ربات ادمین ساخته و توکن گرفته شده
- [ ] `TELEGRAM_ADMIN_IDS` شامل ID خودتان است
- [ ] حداقل یک کلید AI گرفته شده
- [ ] `PROVIDER_ENCRYPTION_KEY` ساخته و ذخیره شده
- [ ] همه secret ها روی Worker ثبت شده (`wrangler secret list`)
- [ ] `wrangler deploy` موفق بوده
- [ ] `?action=health` جواب می‌دهد
- [ ] Pages دیپلوی شده و URL دارد
- [ ] `MINI_APP_URL` روی Worker به URL Pages اشاره می‌کند
- [ ] webhook ها ثبت شده‌اند (`getWebhookInfo` بدون خطا)
- [ ] Mini App از داخل تلگرام باز می‌شود
- [ ] Onboarding کار می‌کند
- [ ] یک چرخه با موفقیت ساخته شد
- [ ] پنل ادمین باز می‌شود و Test سبز است
- [ ] `/gift` از ربات ادمین کار می‌کند

---

# بعد از راه‌اندازی

## افزودن موتور AI جدید (بدون دیپلوی)

1. **Profile → Admin → AI engines → Add engine**
2. یک سرویس‌دهنده انتخاب کنید (یا Custom)
3. کلید را paste کنید
4. **Test** بزنید
5. اگر سبز شد، با فلش‌های ▲▼ ترتیبش را تنظیم کنید
6. **ذخیره** — بلافاصله فعال می‌شود

## تغییر قیمت‌ها

```sql
update plans set price_stars = 200 where plan_type = '1_MONTH';
```

نیازی به دیپلوی نیست. Mini App دفعه بعد که Store را باز کند، قیمت جدید را می‌بیند.

## غیرفعال کردن یک موتور خراب

در پنل ادمین دکمه **Disable** را بزنید. موتور از چرخه failover حذف می‌شود
ولی رکوردش می‌ماند تا بعداً دوباره فعال کنید.
