/**
 * Production stub for `src/mocks/user.ts`.
 *
 * When a production build runs with `VITE_ENABLE_MOCK` unset, Vite aliases
 * `../mocks/user` to this module so every fixture — the fake admin roster,
 * the sample cycle, the demo lesson — is physically absent from the shipped
 * bundle. Nothing here is ever rendered: the `MOCK` flag in the hooks and in
 * `lib/api.ts` is `false`, so these values are addressed but never read.
 *
 * Keeping the same export surface means the swap needs no code changes
 * anywhere else in the app.
 */

export const MOCK_USER = null;
export const MOCK_CYCLE = null;
export const MOCK_LESSON = null;
export const MOCK_PLANS: never[] = [];
export const MOCK_DASHBOARD = null;
export const MOCK_ADMIN_USERS: never[] = [];
export const MOCK_AI_PROVIDERS = {
  providers: [],
  attempts: [],
  chain: [],
  encryptionReady: false,
};
