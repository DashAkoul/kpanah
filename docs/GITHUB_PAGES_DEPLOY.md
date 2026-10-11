# انتشار روی GitHub Pages

> **چرا؟** Cloudflare Pages (`kpanah-lang.pages.dev`) در ایران فیلتر است.
> GitHub Pages معمولاً باز است، پس فرانت‌اند Mini App را آنجا میزبانی می‌کنیم.

## لینک فعلی

```
https://dashakoul.github.io/kpanah/
```

این همان لینکی است که در **BotFather** باید به‌عنوان Mini App URL ثبت شود.

---

## معماری نهایی

| بخش | میزبان | آدرس |
|---|---|---|
| Mini App (فرانت) | GitHub Pages | `https://dashakoul.github.io/kpanah/` |
| Edge Worker (بک) | Cloudflare Workers | `https://kpanah-lang-edge.language-app-backend.workers.dev` |
| داده | Supabase | (خارج از ایران) |

> نکتهٔ مهم: Worker روی `workers.dev` است. اگر `workers.dev` هم در ایران
> بلاک بود، باید یک **Custom Domain** (مثلاً `api.your-domain.com`) روی همان
> Worker ست کنید. فعلاً که کار می‌کند.

---

## تفاوت‌های GitHub Pages با Cloudflare Pages

| موضوع | Cloudflare Pages | GitHub Pages |
|---|---|---|
| مسیر پایه | `/` (ریشه) | `/<repo>/` (زیرمسیر) |
| SPA fallback | `_redirects` | `404.html` |
| نادیده‌گرفتن `_`-files | ندارد | نیاز به `.nojekyll` |
| هدرها | `_headers` | پشتیبانی نمی‌شود |

به همین دلیل:
- در بیلد، `VITE_BASE_PATH=/kpanah/` ست می‌شود تا assetها از زیرمسیر لود شوند.
- `404.html` کپی همان `index.html` است (هر مسیر ناشناخته اپ را بالا می‌آورد).
- `.nojekyll` خالی وجود دارد تا Jekyll فایل‌های مهم را نادیده نگیرد.

---

## انتشار (هر بار که تغییری دادید)

یک دستور، همه‌کار:

```bash
cd "/c/Users/Akoul/WorkBuddy AI/2026-10-10-23-30-06"
npm run deploy:ghpages
```

یا مستقیم:

```bash
REPO=DashAkoul/kpanah bash scripts/deploy-github-pages.sh
```

این اسکریپت:
1. `shared` و `tma` را با `base=/kpanah/` می‌سازد.
2. `.nojekyll` و `404.html` را اضافه می‌کند و فایل‌های Cloudflare را حذف می‌کند.
3. یک شاخهٔ `gh-pages` می‌سازد و با توکن `gh` push می‌کند.
4. اگر Pages فعال نباشد، فعالش می‌کند.

پیش‌نیاز: `gh auth status` باید لاگین باشد.

---

## اگر خواستید دامنهٔ اختصاصی وصل کنید

1. در `scripts/deploy-github-pages.sh` یک فایل `CNAME` با دامنهٔ خود بسازید،
   یا در تنظیمات ریپو → Pages → Custom domain وارد کنید.
2. اگر دامنه هم در ایران فیلتر باشد، این کار کمکی نمی‌کند — GitHub Pages
   معمولاً بدون دامنهٔ اختصاصی هم باز است.

---

## عیب‌یابی سریع

| نشانه | علت | راه‌حل |
|---|---|---|
| صفحه سفید | مسیر پایه اشتباه | مطمئن شوید `VITE_BASE_PATH=/kpanah/` ست شده |
| asset ها 404 | بیلد بدون base | دوباره `npm run deploy:ghpages` |
| اپ لود می‌شود ولی خطای سرور | CORS یا آدرس API | `/debug.html` را باز کنید |
| خطای 404 روی رفرش | 404.html نیست | اسکریپت خودش می‌سازد؛ دوباره دیپلوی کنید |

> **توجه:** GitHub Pages بعد از هر push چند دقیقه طول می‌کشد تا منتشر شود،
> و تلگرام هم کش دارد. پس بعد از دیپلوی، اپ را کامل ببندید و دوباره باز کنید.
