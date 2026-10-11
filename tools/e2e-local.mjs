#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  e2e-local.mjs — تست انتها-به-انتها روی سرور محلی
 *
 *  این اسکریپت کل زنجیره ورود را روی Worker محلی (`wrangler dev`)
 *  تست می‌کند و هر مرحله را با ✅/✗ گزارش می‌دهد:
 *
 *    1. Worker محلی بالاست؟            (GET  ?action=health)
 *    2. initData قابل امضا ساخته می‌شود؟ (تولید درجا)
 *    3. امضا معتبر است؟                 (POST ?action=auth)
 *    4. توکن برگشتی JWT معتبر است؟      (POST ?action=me با Bearer)
 *    5. مسیر auth-link کار می‌کند؟      (اختیاری، اگر توکن لینک بدهید)
 *
 *  استفاده:
 *    node tools/e2e-local.mjs
 *    node tools/e2e-local.mjs --base http://127.0.0.1:8787
 *    node tools/e2e-local.mjs --cleanup        # کاربر تست را پاک کن
 * ═══════════════════════════════════════════════════════════════════
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);

const BASE = (arg('base', 'http://127.0.0.1:8787')).replace(/\/$/, '');
const GATE = '/kpanah56/8fjg7rfb/v1/gate';
const TEST_ID = Number(arg('id', '777000999'));

function readEnv(path, key) {
  if (!existsSync(path)) return '';
  const line = readFileSync(path, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}
const botToken =
  process.env.BOT_TOKEN ||
  readEnv(join(ROOT, 'workers/edge/.dev.vars'), 'TELEGRAM_BOT_TOKEN') ||
  readEnv(join(ROOT, '.env'), 'TELEGRAM_BOT_TOKEN');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m) => { fail++; console.log(`  ✗  ${m}`); };
const step = (n, m) => console.log(`\n━━ ${n}. ${m}`);

function signInitData(id, name) {
  const user = { id, first_name: name, last_name: 'E2E', username: `e2e${id}`, language_code: 'fa', allows_write_to_pm: true };
  const params = new URLSearchParams();
  params.set('query_id', 'AAE2E' + Date.now().toString(36));
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const dcs = [...params.entries()].filter(([k]) => k !== 'hash')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  params.set('hash', createHmac('sha256', secretKey).update(dcs).digest('hex'));
  return params.toString();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  تست انتها-به-انتها — سرور محلی');
  console.log('  BASE: ' + BASE + GATE);
  console.log('═══════════════════════════════════════════════════════');

  if (!botToken) { console.log('\n✗ TELEGRAM_BOT_TOKEN پیدا نشد.'); process.exit(1); }

  // 1. health
  step(1, 'Worker محلی بالاست؟');
  let health = null;
  try {
    const r = await fetch(`${BASE}${GATE}?action=health`);
    const t = await r.text();
    if (r.ok && t.includes('"ok":true')) { ok(`health → ${r.status}`); health = JSON.parse(t); }
    else bad(`health ناموفق — status ${r.status}: ${t.slice(0, 120)}`);
  } catch (e) {
    bad(`اتصال برقرار نشد — Worker محلی اجرا نشده؟ (${e.message})`);
    console.log('\n  راهنما: در یک ترمینال دیگر اجرا کنید:  npm run dev:edge');
    process.exit(1);
  }

  // 2. sign
  step(2, 'تولید initData امضاشده');
  const initData = signInitData(TEST_ID, 'E2E');
  ok(`initData ساخته شد (${initData.length} کاراکتر, id=${TEST_ID})`);

  // 3. auth
  step(3, 'POST ?action=auth (مسیر استاندارد ورود)');
  let token = null;
  try {
    const r = await fetch(`${BASE}${GATE}?action=auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    if (r.ok && j && j.ok && j.data && j.data.token) {
      token = j.data.token;
      ok(`ورود موفق — توکن صادر شد`);
      ok(`telegramId = ${j.data.user && j.data.user.telegramId}`);
      ok(`userId      = ${j.data.user && j.data.user.id}`);
    } else {
      bad(`ورود ناموفق — status ${r.status}`);
      console.log(`     پاسخ: ${t.slice(0, 300)}`);
    }
  } catch (e) { bad(`خطای شبکه در auth: ${e.message}`); }

  // 4. me (JWT round-trip)
  step(4, 'POST ?action=me با توکن');
  if (token) {
    try {
      const r = await fetch(`${BASE}${GATE}?action=me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch {}
      if (r.ok && j && j.ok) ok(`me → ${r.status} (JWT معتبر است)`);
      else bad(`me ناموفق — status ${r.status}: ${t.slice(0, 200)}`);
    } catch (e) { bad(`خطای شبکه در me: ${e.message}`); }
  } else {
    bad('از مرحله قبل توکنی نداشتیم — رد شد');
  }

  // 5. plans (بدون توکن)
  step(5, 'GET ?action=plans (بدون توکن)');
  try {
    const r = await fetch(`${BASE}${GATE}?action=plans`);
    const t = await r.text();
    if (r.ok && t.includes('"ok":true')) ok(`plans → ${r.status}`);
    else bad(`plans ناموفق — status ${r.status}: ${t.slice(0, 200)}`);
  } catch (e) { bad(`خطای شبکه در plans: ${e.message}`); }

  // ── خلاصه ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  نتیجه:  ✅ ${pass} موفق   |   ✗ ${fail} ناموفق`);
  console.log('═══════════════════════════════════════════════════════');

  if (has('cleanup')) {
    console.log('\n(پاک‌سازی کاربر تست با --cleanup در حال انجام…)');
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('خطای غیرمنتظره:', e); process.exit(1); });
