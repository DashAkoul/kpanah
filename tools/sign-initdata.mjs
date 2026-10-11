#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  sign-initdata.mjs — تولید initData معتبر برای تست محلی
 *
 *  این اسکریپت همان الگوریتم تلگرام را پیاده می‌کند تا بتوانیم بدون
 *  باز کردن تلگرام، مسیر واقعی ورود (`POST ?action=auth`) را تست کنیم:
 *
 *     secret_key = HMAC_SHA256(bot_token, "WebAppData")
 *     data_check_string = "key=value" های مرتب‌شده با "\n"
 *     hash = HMAC_SHA256(data_check_string, secret_key)   (هگز)
 *
 *  استفاده:
 *    node tools/sign-initdata.mjs                 # کاربر پیش‌فرض تست
 *    node tools/sign-initdata.mjs --id 12345 --name Ali
 *    node tools/sign-initdata.mjs --json          # خروجی JSON
 *    BOT_TOKEN=... node tools/sign-initdata.mjs   # توکن دستی
 *
 *  توکن از فایل‌های زیر خوانده می‌شود (به‌ترتیب اولویت):
 *    env BOT_TOKEN → workers/edge/.dev.vars → .env
 * ═══════════════════════════════════════════════════════════════════
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

// ── read bot token ──────────────────────────────────────────────────
function readEnvFile(path, key) {
  if (!existsSync(path)) return '';
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const botToken =
  process.env.BOT_TOKEN ||
  readEnvFile(join(ROOT, 'workers/edge/.dev.vars'), 'TELEGRAM_BOT_TOKEN') ||
  readEnvFile(join(ROOT, '.env'), 'TELEGRAM_BOT_TOKEN');

if (!botToken) {
  console.error('✗ TELEGRAM_BOT_TOKEN پیدا نشد. آن را در .env بگذارید یا BOT_TOKEN=... بدهید.');
  process.exit(1);
}

// ── payload ─────────────────────────────────────────────────────────
const user = {
  id: Number(arg('id', '999000111')),
  first_name: arg('name', 'Test'),
  last_name: arg('last', 'User'),
  username: arg('username', `testuser${arg('id', '999000111')}`),
  language_code: arg('lang', 'fa'),
  allows_write_to_pm: true,
};

const authDate = Math.floor(Date.now() / 1000);

const params = new URLSearchParams();
params.set('query_id', 'AAF' + Math.random().toString(36).slice(2, 12));
params.set('user', JSON.stringify(user));
params.set('auth_date', String(authDate));
const startParam = arg('start', null);
if (startParam) params.set('start_param', startParam);

// ── sign ────────────────────────────────────────────────────────────
const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
const dataCheckString = [...params.entries()]
  .filter(([k]) => k !== 'hash' && k !== 'signature')
  .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');
const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

params.set('hash', hash);
const initData = params.toString();

if (has('json')) {
  process.stdout.write(JSON.stringify({ initData, user, authDate }) + '\n');
} else {
  process.stdout.write(initData + '\n');
}
