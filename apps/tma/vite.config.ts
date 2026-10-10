import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Paths are resolved with `fileURLToPath` because `__dirname` does not exist
 * in an ESM config file.
 */
const srcPath = fileURLToPath(new URL('./src', import.meta.url));
const sharedPath = fileURLToPath(
  new URL('../../packages/shared/src/index.ts', import.meta.url)
);

/**
 * Empty-out the demo fixtures for real production builds.
 *
 * `VITE_ENABLE_MOCK=true` (or any dev server) keeps the fixtures. A production
 * build without that flag rewrites every `mocks/user` import to `mocks/empty`,
 * so no sample user, admin roster or lesson can leak into the shipped JS.
 */
function stripMocks(): PluginOption {
  const realPath = fileURLToPath(new URL('./src/mocks/user.ts', import.meta.url));
  const emptyPath = fileURLToPath(new URL('./src/mocks/empty.ts', import.meta.url));

  return {
    name: 'kpanah-strip-mocks',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.includes('mocks/user')) return null;
      // Only rewrite the app's own fixtures, never a node_modules file.
      if (importer && importer.includes('node_modules')) return null;
      return emptyPath;
    },
    load(id) {
      if (id === realPath) {
        // Safety net if a resolver ignores the rewrite above.
        return `export * from ${JSON.stringify(emptyPath)};`;
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const withMocks =
    mode === 'development' || process.env.VITE_ENABLE_MOCK === 'true';

  return {
    plugins: [react(), ...(withMocks ? [] : [stripMocks()])],
    resolve: {
      alias: {
        '@': srcPath,
        '@kpanah/shared': sharedPath,
      },
    },
    server: {
      port: 5173,
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              // Split the biggest feature areas so the initial shell loads fast.
              if (id.includes('/features/profile/')) return 'profile';
              return undefined;
            }
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('i18next')) return 'i18n';
            if (id.includes('react-router')) return 'router';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor';
            return 'vendor';
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
  };
});
