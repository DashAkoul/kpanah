-- ═══════════════════════════════════════════════════════════════════════
-- 0004_ai_providers.sql
--
-- Admin-managed AI provider pool with ordered failover.
--
-- Design notes
-- ────────────
-- • API keys are stored encrypted (AES-GCM) by the Edge Worker, never in
--   plaintext. The `api_key_encrypted` column only holds a versioned blob;
--   the master key lives in the Worker secret `PROVIDER_ENCRYPTION_KEY`.
-- • `priority` is a dense ordering: lower value = tried first. The engine
--   sorts by (priority ASC, created_at ASC) so ties are deterministic.
-- • `kind` selects the wire protocol, not the vendor. Two different vendors
--   can share a protocol (OpenAI-compatible covers DeepSeek, Groq, Together,
--   OpenRouter, …), which is what makes "add any AI" actually work.
-- • `health` columns let the engine skip a provider that is failing without
--   an admin having to disable it manually. They are advisory only — a
--   single failure never permanently removes a provider.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Protocol family ────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_protocol') then
    create type ai_protocol as enum (
      'gemini',           -- Google Generative Language API
      'openai_compatible',-- /v1/chat/completions (DeepSeek, Groq, OpenAI, OpenRouter, …)
      'anthropic'         -- /v1/messages
    );
  end if;
end $$;

-- ── Provider table ────────────────────────────────────────────────────

create table if not exists ai_providers (
  id                  uuid primary key default gen_random_uuid(),

  -- Human label shown in the admin panel, e.g. "Gemini Flash (main)"
  label               text not null,

  -- Wire protocol family — determines how we build the request
  protocol            ai_protocol not null,

  -- Vendor slug used only for logging/analytics, e.g. 'gemini', 'deepseek'
  vendor              text not null,

  -- Model identifier passed to the vendor, e.g. 'gemini-2.5-flash'
  model               text not null,

  -- Base URL. Required for openai_compatible (lets admins point at any
  -- OpenAI-shaped gateway). Optional for gemini/anthropic, where the
  -- vendor default is used unless overridden.
  base_url            text,

  -- AES-GCM ciphertext, base64. Never returned to the client in full;
  -- the API sends back only `key_hint` (last 4 chars) for identification.
  api_key_encrypted   text not null,
  key_hint            text not null default '',

  -- Failover order. Lower runs first.
  priority            integer not null default 100,

  -- Admin kill-switch independent of health
  is_active           boolean not null default true,

  -- Generation tuning; null means "use engine default"
  temperature         numeric(3,2),
  max_output_tokens   integer,

  -- Whether this provider supports a native JSON schema / structured output
  supports_json_schema boolean not null default false,

  -- ── Advisory health (written by the engine, read by the panel) ──────
  health_status       text not null default 'unknown'
                      check (health_status in ('unknown','healthy','degraded','failing')),
  last_success_at     timestamptz,
  last_failure_at     timestamptz,
  last_error          text,
  consecutive_failures integer not null default 0,
  total_successes     integer not null default 0,
  total_failures      integer not null default 0,
  avg_latency_ms      integer,

  -- Optional free-text note for the operator
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fast path for the engine: "give me active providers in priority order"
create index if not exists ai_providers_priority_idx
  on ai_providers (is_active, priority asc, created_at asc);

drop trigger if exists ai_providers_set_updated_at on ai_providers;
create trigger ai_providers_set_updated_at
  before update on ai_providers
  for each row execute function public.tg_set_updated_at();

-- ── Failover audit log ────────────────────────────────────────────────
-- One row per provider attempt during a cycle generation, so the admin can
-- see exactly what happened ("Gemini failed, DeepSeek succeeded, 3.2s").

create table if not exists ai_attempt_log (
  id             bigserial primary key,
  cycle_id       uuid references cycles(id) on delete set null,
  provider_id    uuid references ai_providers(id) on delete set null,
  provider_label text,
  model          text,
  attempt_no     integer not null default 1,
  phase          text not null default 'initial'
                 check (phase in ('initial','repair')),
  ok             boolean not null,
  latency_ms     integer,
  error          text,
  tokens_used    integer,
  created_at     timestamptz not null default now()
);

create index if not exists ai_attempt_log_created_idx
  on ai_attempt_log (created_at desc);
create index if not exists ai_attempt_log_cycle_idx
  on ai_attempt_log (cycle_id);

-- ── Bootstrap: seed from the env-configured providers ─────────────────
-- These rows are placeholders so the panel is not empty on first open.
-- The api_key_encrypted value is the marker '__FROM_ENV__', which the
-- engine interprets as "read the key from the Worker secret instead".
-- An admin replaces these by editing the row and pasting a real key.
-- They carry priority 10/20/30 so any newly added provider slots in after.

insert into ai_providers
  (label, protocol, vendor, model, priority, supports_json_schema,
   api_key_encrypted, key_hint, note)
values
  ('Gemini Flash (from env)', 'gemini', 'gemini', 'gemini-2.5-flash',
   10, true, '__FROM_ENV__', 'env',
   'Seeded placeholder — uses GEMINI_API_KEY. Replace with a real key or disable.'),
  ('DeepSeek (from env)', 'openai_compatible', 'deepseek', 'deepseek-chat',
   20, false, '__FROM_ENV__', 'env',
   'Seeded placeholder — uses DEEPSEEK_API_KEY.'),
  ('Claude Sonnet (from env)', 'anthropic', 'anthropic', 'claude-3-5-sonnet-latest',
   30, false, '__FROM_ENV__', 'env',
   'Seeded placeholder — uses ANTHROPIC_API_KEY.')
on conflict do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────
-- Provider rows contain secrets: readable and writable by service role only.
-- The admin panel talks to the Worker, which uses the service-role key, so
-- end users can never read a key even by crafting a direct PostgREST call.

alter table ai_providers    enable row level security;
alter table ai_attempt_log  enable row level security;

drop policy if exists ai_providers_service_only on ai_providers;
create policy ai_providers_service_only on ai_providers
  for all
  using (public.is_service_role())
  with check (public.is_service_role());

drop policy if exists ai_attempt_log_service_only on ai_attempt_log;
create policy ai_attempt_log_service_only on ai_attempt_log
  for all
  using (public.is_service_role())
  with check (public.is_service_role());
