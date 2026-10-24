#!/usr/bin/env node
/**
 * بازسازی کش محتوا (چک‌لیست ۲۱.۷ — بازیابی).
 *
 * ⚠️ چرا لازم است: `content_cache` تنها کپیِ محتوای تولیدشده است. اگر محتوایی
 * خراب یا کهنه شد، راه درست «حذف از کش و تولید دوباره» است — نه دست‌کاری DB.
 *
 * استفاده:
 *   node tools/rebuild-cache.mjs                        # فقط شمارش (dry-run)
 *   node tools/rebuild-cache.mjs --lang=en --confirm    # حذف کش یک زبان
 *   node tools/rebuild-cache.mjs --kind=LESSON --confirm
 *   node tools/rebuild-cache.mjs --all --confirm
 *
 * بعد از حذف: کرون هر ۵ دقیقه درس‌های ناقص/کهنه را بازتولید می‌کند.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const devVarsPath = resolve(root, 'workers/edge/.dev.vars');

function loadEnv() {
  const raw = readFileSync(devVarsPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => args.includes(`--${name}`);

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY در workers/edge/.dev.vars نیست.');
  process.exit(1);
}

const lang = flag('lang');
const kind = flag('kind');
const all = has('all');
const confirm = has('confirm');

if (!all && !lang && !kind) {
  console.log('حالت dry-run: هیچ فیلتری داده نشد.');
  console.log('  --lang=en | --kind=LESSON | --all   (برای حذف: --confirm)');
}

const filters = [];
if (lang) filters.push(`language=eq.${encodeURIComponent(lang)}`);
if (kind) filters.push(`kind=eq.${encodeURIComponent(kind)}`);
const qs = filters.length ? `?${filters.join('&')}` : '';

async function count() {
  const res = await fetch(`${url}/rest/v1/content_cache${qs}${qs ? '&' : '?'}select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!res.ok) throw new Error(`count failed: ${res.status} ${await res.text()}`);
  const range = res.headers.get('content-range') ?? '';
  return Number(range.split('/')[1] ?? 0);
}

async function remove() {
  const res = await fetch(`${url}/rest/v1/content_cache${qs}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status} ${await res.text()}`);
}

const before = await count();
console.log(`ردیف‌های کش مطابق فیلتر: ${before}`);

if (!confirm) {
  console.log('dry-run — چیزی حذف نشد. برای حذف: --confirm');
  process.exit(0);
}
if (!all && !lang && !kind) {
  console.error('ERROR: برای حذف باید --all یا --lang یا --kind بدهی.');
  process.exit(1);
}

await remove();
const after = await count();
console.log(`✓ حذف شد: ${before - after} ردیف (باقی‌مانده: ${after})`);
console.log('→ کرون هر ۵ دقیقه محتوای لازم را بازتولید می‌کند؛ هزینهٔ AI مصرف می‌شود.');
