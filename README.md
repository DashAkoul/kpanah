# کپناه لهجه — Adaptive AI Language Tutor

A **serverless, adaptive AI language tutor** delivered as a **Telegram Mini App**.
No VPS, no containers, no n8n — the entire backend runs on Cloudflare's edge plus
managed Postgres.

Users learn in **7-day cycles**: five days of teaching, a sixth day of *hidden*
assessment disguised as an ordinary lesson, and a seventh day of consolidation
with an encouraging app lock. When a cycle closes, the engine reads the learner's
telemetry — pauses, mistakes, response speed — and asks an AI to author the next
cycle from that evidence. This is **Delta Patching**.

---

## Why this shape

| Constraint in the brief | What we built |
| --- | --- |
| No VPS, no n8n | Cloudflare Workers (edge gateway + AI orchestration) and Supabase (Postgres + Storage) |
| Cost must stay near zero between users | No always-on compute; AI tokens are only spent when a cycle actually completes |
| Frontend must be modular | `apps/tma` — one folder per feature, no giant component files |
| Must survive AI failure | Three-provider failover with a repair round-trip before giving up |
| Must not be abused for tokens | Route obfuscation, rate limits, injection filtering, calendar stop rule |

---

## Repository layout

```
apps/tma/                    Telegram Mini App (React 18 + Vite + Tailwind)
  src/app/                   App shell, route/tab gating, result handoff
  src/features/              One folder per feature area
    onboarding/              4-step first-run flow
    learn/                   Roadmap, lesson card, lesson player, result
    profile/                 Progress dashboard (charts, qualitative skills)
    store/                   Subscription plans + Telegram Stars checkout
    settings/                Language, goal, notifications, account deletion
    admin/                   In-gift panel (admin only)
  src/components/            Shared UI primitives + layout chrome
  src/hooks/useApi.ts        All React Query hooks (with dev mocks)
  src/lib/telegram.ts        Typed Telegram WebApp SDK wrapper
  src/lib/api.ts             Encrypted-resilient API client + JWT storage
  src/locales/               fa / en (+ ar, tr, ru stubs), RTL handling
  src/mocks/                 Dev fixtures; stripped from production builds
  src/store/                 Zustand stores (session, ui)

workers/edge/                Cloudflare Worker (the entire backend)
  src/index.ts               Request pipeline + dispatch
  src/lib/telegram-auth.ts   Real initData HMAC-SHA256 validation
  src/lib/jwt.ts             Dependency-free HS256 sign/verify
  src/middleware/            Auth, rate limiting, prompt-injection filtering
  src/routes/                auth, learn, store, admin, telegram-bot, admin-bot
  src/services/              ai-engine, repository, supabase, qstash

packages/shared/             Code shared by both sides
  src/types/                 Domain types
  src/schemas/               Zod contracts for all AI output and API input
  src/constants/             Cycle schedule, Leitner intervals, plan pricing, i18n
  src/engine/                The adaptive engine (pure, fully unit tested)
  src/__tests__/             66 tests

supabase/migrations/         0001_init · 0002_rls · 0003_seed
docs/                        API_CONTRACTS.md · DEPLOYMENT.md
ARCHITECTURE.md              Design decisions and honest security analysis
```

---

## How the adaptive loop works

```
  Day 1–5          Day 6                Day 7
  Teaching    →    Hidden assessment →  Consolidation
     │                    │                   │
     └──────── telemetry_events ──────────────┘
                          │
                    buildSkillDelta()          ← pure function in packages/shared
                          │
              shouldGenerateNextCycle()        ← honours the 12-day stall rule
                          │
                  AI generates cycle N+1       ← enqueued via QStash, never blocking
                          │
              generatedCycleSchema.parse()     ← strict Zod gate + repair retry
                          │
                 persistGeneratedCycle()       ← lessons land in Postgres
```

**Leitner spaced repetition** runs *inside* the daily lesson rather than as a
separate section, so the learner never sees a flashcard screen. Each term carries
a box (1–5), an ease factor (1.3–3.2), and an interval; Day 7 deliberately
schedules the terms with the most lapses.

The hidden assessment on Day 6 is structurally an ordinary lesson — same player,
same flow — but its score is recorded as `hiddenAssessmentScore` and feeds the
delta. The learner is never told they were assessed.

### The calendar stop rule

If a cycle is still open on day 13, `shouldGenerateNextCycle()` returns
`CALENDAR_PAUSED_STALL` and no AI call is made. This caps token burn for users
who abandon mid-cycle.

---

## Security posture

The original brief asked for "E2E encryption" between the Mini App and the edge.
**ARCHITECTURE.md documents honestly why that is not achievable in a Mini App**
— any key the client can unwrap ships inside the JS bundle and is readable by
anyone who opens DevTools. Rather than ship security theater, the following was
implemented and accepted:

| Layer | Implementation |
| --- | --- |
| Transport | TLS 1.3, enforced by Cloudflare |
| Identity | `initData` HMAC-SHA256 validation, reconstructed `data_check_string`, timing-safe comparison, 24 h freshness window |
| Session | Short-lived HS256 JWT (15 min) signed in the Worker, held in memory + `sessionStorage` |
| Routing | Single obfuscated gate path (`/kpanah56/8fjg7rfb/v1/gate`), `?action=` dispatch, unknown paths return a bare 404 |
| Abuse | Dual-window rate limiting (per-minute per-IP, per-day per-user) backed by KV |
| Prompt safety | 13 injection patterns, zero-width character detection, recursive payload scanning, untrusted text wrapped before reaching the model |
| Data | Row Level Security on every table; the client can only read its own rows |
| Payments | Telegram Stars with `telegram_payment_charge_id` idempotency and underpayment rejection |

An optional AES-GCM payload encryption layer is **written and wired but disabled
by default** (`ENABLE_PAYLOAD_ENCRYPTION=false`). It is available if a deployment
ever needs defence-in-depth, with the caveat above understood.

---

## Getting started

Requirements: **Node ≥ 20**, a Supabase project, a Telegram bot token, and a
Cloudflare account. Full walkthrough — including bot creation, KV setup, secret
entry, QStash wiring, and webhook registration — is in **`docs/DEPLOYMENT.md`**.

```bash
npm install
cp .env.example .env            # fill in the values

# database
supabase link --project-ref <ref>
npm run db:push

# local development
npm run dev:tma                 # Mini App at http://localhost:5173
npm run dev:edge                # Worker via wrangler dev

# verification
npm run typecheck               # all three workspaces
npm test                        # 66 adaptive-engine + schema tests
npm run build                   # shared → edge → tma
```

### Previews outside Telegram

Set `VITE_ENABLE_MOCK=true` (or just run the dev server) and the app boots with
fixtures for a mid-cycle learner, a full lesson, the plan catalogue, and the admin
roster. **Production builds strip every fixture** — `vite.config.ts` rewrites the
mock module to an empty stub, so no sample data can leak into the shipped bundle.
This is verified during the build.

---

## The three tabs

**Learn** — the 7-day roadmap (a snake layout that flows with RTL), today's lesson
card, and the day's nudge. Lessons unlock sequentially; a completed cycle shows a
locked state until the next one is generated.

**Profile** — identity card, subscription status with days remaining, and three
sub-panels: a progress dashboard (stats, qualitative "you can now…" skills, a
weekly activity chart, per-skill breakdown, accuracy radial), the **Store** (all
five plans with IRR and Stars pricing), and the **Admin panel** for operators.

**Settings** — UI language (five options, RTL-aware), target language, learning
goal, notification preferences, and a danger zone with one-click account deletion
that wipes all server-side data.

### Onboarding

Four steps — UI language, target language, level, goal. The UI language **defaults
to whatever Telegram reports** and the first step says so explicitly; choosing
manually flips `language_source` from `TELEGRAM` to `MANUAL` permanently, so the
app never overrides a deliberate choice on a later login.

---

## Monetisation (v1)

A **7-day free trial** is granted automatically. When `evaluateAccess()` reports
`TRIAL_EXPIRED`, the Learn tab locks with an encouraging message and points to the
Store.

**Telegram Stars is the only live gateway in v1.** ZarinPal and the manual
receipt flow are present in the UI as disabled "coming soon" entries — the data
model (`payment_receipts`, `star_transactions`) already supports them.

Comp subscriptions — the feature explicitly requested for v1 — are available from
**two** places, both audited into `admin_grants`:

- **In-app admin panel** — search a user, pick a plan, choose whether to extend or
  replace the current subscription, optionally attach bonus days and a note.
- **Telegram admin bot** (separate token) — `/gift <telegram_id> <plan> [bonus_days]`,
  plus `/user`, `/revoke`, `/stats`, `/plans`, `/help`. `normalizePlan()` accepts
  `2W / 1M / 3M / 6M / 1Y`.

Either path notifies the recipient in Telegram.

---

## Deliberate departures from the original brief

| Brief | What shipped | Why |
| --- | --- | --- |
| n8n for orchestration | Removed | QStash + Worker `scheduled` handlers do the same job with no always-on process |
| E2E encryption | HMAC + TLS + short JWT, payload encryption optional and off | Explained in `ARCHITECTURE.md`; the original was not achievable |
| ZarinPal + receipt OCR in v1 | Deferred; schema and UI placeholders exist | Scoped to Stars per the locked decision |
| `skill_level` discovered by the AI | Set at onboarding, then refined by the delta | Gives the first cycle a sane starting point instead of a cold guess |

---

## Documentation

- **`ARCHITECTURE.md`** — decision log, data flow, the security analysis above
- **`docs/API_CONTRACTS.md`** — every endpoint, payload, error code, and the
  bot command reference
- **`docs/DEPLOYMENT.md`** — step-by-step production setup and a launch checklist

---

## Testing

```bash
npm test          # from the repo root, or:
npm run test -w @kpanah/shared
```

66 tests cover the parts where a bug would be silent and expensive:

- **Leitner transitions** — promotion, the two-box skip above box 1, reset on a
  wrong answer, ease clamped to 1.3–3.2, mastery at box 5
- **Delta construction** — accuracy, pause detection, weak versus mastered terms,
  skill-area ranking
- **Cycle triggering** — all five `shouldGenerateNextCycle` reasons, including the
  calendar stall rule
- **Access control** — the four `evaluateAccess` verdicts and day arithmetic
- **Schema contracts** — day-6 and day-7 kind enforcement, duplicate-day rejection,
  out-of-range answer indices, default filling

The suite writes its scratch files under `packages/shared/node_modules/` because the
host environment denies access to the OS temp directory; `scripts/run-tests.mjs`
handles that redirection transparently.

---

## Status

| Area | State |
| --- | --- |
| Shared engine, types, schemas, constants | Complete, 66 tests passing |
| Cloudflare Worker (all routes, bots, AI orchestration) | Complete, bundles clean at 63 KiB gzipped |
| Database migrations + RLS + seed | Complete |
| Telegram Mini App (all tabs, all features) | Complete, builds clean |
| i18n | `fa` and `en` complete; `ar`, `tr`, `ru` fall back to English |
| Docs | Complete |
