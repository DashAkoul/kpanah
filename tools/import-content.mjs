#!/usr/bin/env node
/**
 * import-content.mjs — بارگذاری محتوای از پیش آماده در `content_cache`
 *
 * استفاده:
 *   node tools/import-content.mjs content/english.json
 *   node tools/import-content.mjs content/            # همهٔ فایل‌های .json
 *
 * قالب هر فایل (یا هر آیتم آرایه):
 *   {
 *     "kind":     "WORD" | "PATTERN" | "EXERCISE" | "DIALOGUE" | "PLACEMENT_Q",
 *     "language": "en",
 *     "level":    "A1",
 *     "topic":    "travel",
 *     "items":    [ ... ]
 *   }
 *
 * فایل می‌تواند یک شیء یا آرایه‌ای از این اشیاء باشد.
 * cache_key ساخته می‌شود: <language>:<level>:<topic>
 *
 * پیش‌نیاز: SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY در .env
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
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
const SUPABASE_URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('✗ SUPABASE_URL یا SUPABASE_SERVICE_ROLE_KEY یافت نشد (.env)');
  process.exit(1);
}

const KINDS = ['WORD', 'PATTERN', 'EXERCISE', 'DIALOGUE', 'PLACEMENT_Q'];

/** ساخت کلید یکتای کش */
function cacheKey(b) {
  return `${b.language}:${b.level}:${b.topic}`;
}

async function upsert(bundle) {
  if (!KINDS.includes(bundle.kind)) {
    console.warn(`  ! kind ناشناخته: ${bundle.kind} — رد شد`);
    return;
  }
  if (!bundle.language || !bundle.items?.length) {
    console.warn('  ! language یا items خالی — رد شد');
    return;
  }

  const body = {
    kind: bundle.kind,
    cache_key: cacheKey(bundle),
    language: bundle.language,
    payload: {
      level: bundle.level ?? null,
      topic: bundle.topic ?? null,
      items: bundle.items,
    },
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/content_cache?on_conflict=kind,cache_key`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });

  const ok = res.ok ? '✓' : '✗';
  console.log(
    `  ${ok} ${bundle.kind} ${cacheKey(bundle)} — ${bundle.items.length} آیتم` +
      (res.ok ? '' : ` (${res.status}: ${await res.text()})`)
  );
}

function collectFiles(arg) {
  const p = resolve(ROOT, arg);
  const st = statSync(p);
  if (st.isDirectory()) {
    return readdirSync(p)
      .filter((f) => extname(f) === '.json' && !f.startsWith('template-'))
      .map((f) => join(p, f));
  }
  return [p];
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('استفاده: node tools/import-content.mjs <file.json|dir>');
    process.exit(1);
  }

  const files = collectFiles(arg);
  console.log('═══════════════════════════════════════════');
  console.log(`  بارگذاری ${files.length} فایل در content_cache`);
  console.log('═══════════════════════════════════════════\n');

  let total = 0;
  for (const file of files) {
    console.log(`📄 ${file.replace(ROOT, '.')}`);
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const bundles = Array.isArray(raw) ? raw : [raw];
    for (const b of bundles) {
      await upsert(b);
      total++;
    }
    console.log('');
  }

  console.log(`✅ ${total} بستهٔ محتوا پردازش شد.`);
}

main().catch((e) => {
  console.error('✗ خطا:', e);
  process.exit(1);
});
