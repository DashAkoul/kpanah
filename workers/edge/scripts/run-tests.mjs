#!/usr/bin/env node
/**
 * Test runner wrapper.
 *
 * The sandbox that hosts this project denies writes to the OS temp directory,
 * and vitest's embedded Vite server writes transformed modules there, which
 * aborts the run with EPERM. Pointing TMPDIR/TEMP/TMP at a workspace-local
 * folder (which is writable and git-ignored) sidesteps the problem entirely.
 *
 * Set `KPANAH_KEEP_TMP=1` to leave the scratch directory behind for debugging.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(here);
const tmpDir = join(packageRoot, 'node_modules', '.vite-tmp');

mkdirSync(tmpDir, { recursive: true });

const env = {
  ...process.env,
  TMPDIR: tmpDir,
  TMP: tmpDir,
  TEMP: tmpDir,
};

// Resolve vitest's CLI entry from the hoisted root node_modules and run it
// with the current Node binary. Calling the JS entry directly (instead of the
// .bin shim) avoids shell quoting problems with the space in the project path.
const vitestEntry = join(
  packageRoot,
  '..',
  '..',
  'node_modules',
  'vitest',
  'vitest.mjs'
);

const child = spawn(process.execPath, [vitestEntry, 'run', ...process.argv.slice(2)], {
  cwd: packageRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  if (!process.env.KPANAH_KEEP_TMP) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  process.exit(code ?? 1);
});
