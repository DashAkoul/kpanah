#!/usr/bin/env node
/**
 * setup-bot.mjs — پیکربندی ربات تلگرام
 *
 * چه می‌کند؟
 *   1. webhook را روی دامنهٔ جدید ثبت می‌کند
 *   2. دکمهٔ منوی ربات (چت) را به نسخهٔ جدید Mini App تغییر می‌دهد
 *      ← این همان دلیلی است که «آموزش زبان» نسخهٔ قدیمی را باز می‌کرد
 *   3. دستورات ربات را ثبت می‌کند
 *
 * اجرا:
 *   node tools/setup-bot.mjs
 *
 * پیش‌نیاز: متغیرهای TELEGRAM_BOT_TOKEN و TELEGRAM_WEBHOOK_SECRET در .env
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── خواندن .env ──────────────────────────────────────────────────────
function readEnv() {
  const out = {};
  try {
    const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
  return out;
}

const env = { ...readEnv(), ...process.env };
const TOKEN = env.TELEGRAM_BOT_TOKEN;
const SECRET = env.TELEGRAM_WEBHOOK_SECRET;

const API_BASE = env.PUBLIC_API_URL || 'https://api.infolange.kdns.fr';
const APP_URL = env.PUBLIC_APP_URL || 'https://app.infolange.kdns.fr/';

if (!TOKEN) {
  console.error('✗ TELEGRAM_BOT_TOKEN یافت نشد (در .env یا محیط)');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json();
  const ok = json.ok ? '✓' : '✗';
  console.log(`${ok} ${method}:`, json.ok ? (json.result?.url ?? 'ok') : json.description);
  return json;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  پیکربندی ربات');
  console.log('  API :', API_BASE);
  console.log('  App :', APP_URL);
  console.log('═══════════════════════════════════════════\n');

  // 1) webhook
  await call('setWebhook', {
    url: `${API_BASE}/telegram/webhook`,
    secret_token: SECRET,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });

  // 2) دکمهٔ منو — همان چیزی که نسخهٔ قدیمی را باز می‌کرد
  await call('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'آموزش زبان',
      web_app: { url: APP_URL },
    },
  });

  // 3) دستورات
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'شروع / Start' },
      { command: 'app', description: 'باز کردن اپلیکیشن / Open app' },
      { command: 'store', description: 'خرید اشتراک / Store' },
      { command: 'help', description: 'راهنما / Help' },
    ],
  });

  console.log('\n── وضعیت نهایی ──');
  await call('getWebhookInfo');
  await call('getChatMenuButton');
}

main().catch((e) => {
  console.error('✗ خطا:', e);
  process.exit(1);
});
