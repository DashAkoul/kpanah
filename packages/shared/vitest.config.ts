import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

/**
 * Vitest configuration for the shared package.
 *
 * Why so explicit: the execution sandbox denies writes to the OS temp
 * directory, and vitest's Vite server writes transformed SSR modules there.
 * Both the Vite cache and the process temp dir are therefore redirected into
 * `node_modules/`, which is writable and already git-ignored.
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

// Vite reads TMPDIR/TEMP at server startup, so it must be set before then.
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
