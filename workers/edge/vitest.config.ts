import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

/**
 * Vitest configuration for the Edge Worker.
 *
 * The Worker code targets the Cloudflare runtime, where `crypto` is the
 * WebCrypto global — available in Node 20+ too, so the WebCrypto-dependent
 * modules under test run unchanged.
 *
 * `cacheDir` and the process temp directory are redirected into
 * `node_modules/` because the execution sandbox denies writes to the OS temp
 * folder, which would make vitest abort with EPERM before running anything.
 */
const root = fileURLToPath(new URL('.', import.meta.url));
const cacheDir = `${root}node_modules/.vite-cache`;
const tmpDir = `${root}node_modules/.vite-tmp`;

for (const dir of [cacheDir, tmpDir]) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* already present */
  }
}

process.env.TMPDIR = tmpDir;
process.env.TMP = tmpDir;
process.env.TEMP = tmpDir;

export default defineConfig({
  root,
  cacheDir,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    reporters: ['default'],
  },
});
