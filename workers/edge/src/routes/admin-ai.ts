import {
  createAiProviderSchema,
  updateAiProviderSchema,
  reorderAiProvidersSchema,
  validateWithDetail,
} from '@kpanah/shared';
import type { RequestContext } from '../types';
import { jsonError, jsonSuccess, readJson } from '../lib/response';
import { ContentRepository } from '../services/repository';
import { SupabaseClient } from '../services/supabase';
import {
  encryptProviderKey,
  keyHint,
  FROM_ENV_MARKER,
} from '../lib/provider-vault';
import {
  resolveProviderChain,
  type AiProviderRow,
  type ResolvedProvider,
} from '../services/ai-engine';

/**
 * AI provider pool administration.
 *
 * The operator can register any number of providers, order them, toggle them,
 * and see which one is being used. The engine walks the list in priority order
 * and fails over automatically, so a provider outage never stops lesson
 * generation.
 *
 * Security posture
 * ────────────────
 * • API keys are AES-GCM encrypted before they touch Postgres.
 * • Keys are NEVER returned to the client. Responses carry `keyHint` only
 *   (the last four characters), which is enough to tell two keys apart.
 * • Omitting `apiKey` on update preserves the stored key.
 * • RLS restricts the table to the service role, so even a crafted direct
 *   PostgREST call from a user's token cannot read the encrypted column.
 */

export function repo(env: RequestContext['env']): ContentRepository {
  return new ContentRepository(new SupabaseClient(env), env);
}

// ═════════════════════════════════════════════════════════════════════
// GET /gate?action=admin-ai-providers
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminListProviders(
  _request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const r = repo(env);

  const [rows, attempts] = await Promise.all([
    r.listAllAiProviders(),
    r.listAiAttempts(30),
  ]);

  // Resolve the chain so the panel can show which providers are actually
  // usable right now (a row whose key cannot be decrypted is dead weight).
  const chain = await resolveProviderChain(rows, env);
  const usableIds = new Set(chain.map((p) => p.id));

  const providers = rows.map((row) => toProviderDto(row, usableIds.has(row.id)));

  return jsonSuccess(
    {
      providers,
      attempts,
      // The exact order the engine will try, for display.
      chain: chain.map((p) => ({ id: p.id, label: p.label, model: p.model })),
      encryptionReady: Boolean(env.PROVIDER_ENCRYPTION_KEY),
    },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-ai-provider-create
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminCreateProvider(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  if (!env.PROVIDER_ENCRYPTION_KEY) {
    return jsonError(
      'INTERNAL_ERROR',
      'PROVIDER_ENCRYPTION_KEY is not configured on the Worker',
      requestId,
      env,
      500,
      'admin.ai.encryptionMissing'
    );
  }

  const body = await readJson(request);
  const parsed = validateWithDetail(createAiProviderSchema, body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.errors!.join('; '), requestId, env, 422);
  }

  const input = parsed.data!;
  const r = repo(env);

  const encrypted = await encryptProviderKey(input.apiKey, env.PROVIDER_ENCRYPTION_KEY);

  const row = await r.createAiProvider({
    label: input.label,
    protocol: input.protocol,
    vendor: input.vendor,
    model: input.model,
    baseUrl: input.baseUrl ?? null,
    apiKeyEncrypted: encrypted,
    keyHint: keyHint(input.apiKey),
    priority: input.priority ?? 100,
    isActive: input.isActive ?? true,
    temperature: input.temperature ?? null,
    maxOutputTokens: input.maxOutputTokens ?? null,
    supportsJsonSchema: input.supportsJsonSchema ?? false,
    note: input.note ?? null,
  });

  if (!row) {
    return jsonError('INTERNAL_ERROR', 'Could not save provider', requestId, env, 500);
  }

  return jsonSuccess({ provider: toProviderDto(row, true) }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-ai-provider-update
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminUpdateProvider(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonError('VALIDATION_ERROR', 'id is required', requestId, env, 422);
  }

  const body = await readJson(request);
  const parsed = validateWithDetail(updateAiProviderSchema, body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.errors!.join('; '), requestId, env, 422);
  }

  const input = parsed.data!;
  const patch: Record<string, unknown> = {};

  if (input.label !== undefined) patch.label = input.label;
  if (input.protocol !== undefined) patch.protocol = input.protocol;
  if (input.vendor !== undefined) patch.vendor = input.vendor;
  if (input.model !== undefined) patch.model = input.model;
  if (input.baseUrl !== undefined) patch.base_url = input.baseUrl ?? null;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.temperature !== undefined) patch.temperature = input.temperature ?? null;
  if (input.maxOutputTokens !== undefined) {
    patch.max_output_tokens = input.maxOutputTokens ?? null;
  }
  if (input.supportsJsonSchema !== undefined) {
    patch.supports_json_schema = input.supportsJsonSchema;
  }
  if (input.note !== undefined) patch.note = input.note ?? null;

  // A new key means re-encrypt; its absence means "keep what is stored".
  if (input.apiKey) {
    if (!env.PROVIDER_ENCRYPTION_KEY) {
      return jsonError(
        'INTERNAL_ERROR',
        'PROVIDER_ENCRYPTION_KEY is not configured on the Worker',
        requestId,
        env,
        500,
        'admin.ai.encryptionMissing'
      );
    }
    patch.api_key_encrypted = await encryptProviderKey(
      input.apiKey,
      env.PROVIDER_ENCRYPTION_KEY
    );
    patch.key_hint = keyHint(input.apiKey);

    // A key change invalidates prior health history.
    patch.health_status = 'unknown';
    patch.consecutive_failures = 0;
    patch.last_error = null;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('VALIDATION_ERROR', 'Nothing to update', requestId, env, 422);
  }

  const r = repo(env);
  const row = await r.updateAiProvider(id, patch);
  if (!row) {
    return jsonError('NOT_FOUND', 'Provider not found', requestId, env, 404);
  }

  return jsonSuccess({ provider: toProviderDto(row, true) }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-ai-provider-delete
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminDeleteProvider(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonError('VALIDATION_ERROR', 'id is required', requestId, env, 422);
  }

  const r = repo(env);
  await r.deleteAiProvider(id);

  return jsonSuccess({ deleted: true, id }, requestId, env);
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-ai-provider-reorder
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminReorderProviders(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;

  const body = await readJson(request);
  const parsed = validateWithDetail(reorderAiProvidersSchema, body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.errors!.join('; '), requestId, env, 422);
  }

  const { order } = parsed.data!;
  const r = repo(env);

  // Rewrite priority as a dense 1..n sequence. Doing it in one pass keeps
  // the chain order exactly as the admin arranged it.
  await Promise.all(
    order.map((id, index) =>
      r.updateAiProvider(id, { priority: index + 1 }).catch(() => null)
    )
  );

  const rows = await r.listAllAiProviders();
  const chain = await resolveProviderChain(rows, env);
  const usableIds = new Set(chain.map((p) => p.id));

  return jsonSuccess(
    { providers: rows.map((row) => toProviderDto(row, usableIds.has(row.id))) },
    requestId,
    env
  );
}

// ═════════════════════════════════════════════════════════════════════
// POST /gate?action=admin-ai-provider-test
//
// Runs a tiny live call so the admin can verify a key before trusting it.
// Deliberately cheap: one short prompt, no cycle generation.
// ═════════════════════════════════════════════════════════════════════

export async function handleAdminTestProvider(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const { env, requestId } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonError('VALIDATION_ERROR', 'id is required', requestId, env, 422);
  }

  const r = repo(env);
  const row = await r.getAiProviderById(id);
  if (!row) {
    return jsonError('NOT_FOUND', 'Provider not found', requestId, env, 404);
  }

  const chain = await resolveProviderChain([row], env);
  const provider = chain[0];

  if (!provider) {
    return jsonSuccess(
      {
        ok: false,
        error:
          row.api_key_encrypted === FROM_ENV_MARKER
            ? 'No matching environment secret is set for this provider.'
            : 'The stored key could not be decrypted (wrong PROVIDER_ENCRYPTION_KEY?).',
      },
      requestId,
      env
    );
  }

  const result = await probeProvider(provider);

  // Keep health state honest so the panel reflects the test outcome.
  await r.recordProviderOutcome({
    cycleId: null,
    providerId: provider.id,
    providerLabel: provider.label,
    model: provider.model,
    attemptNo: 1,
    phase: 'initial',
    ok: result.ok,
    latencyMs: result.ms,
    error: result.error,
  });

  return jsonSuccess(result, requestId, env);
}

/**
 * Minimal round-trip that proves the key works and the model responds.
 *
 * We ask for a single word rather than a JSON object: the point is credential
 * validity and reachability, not output quality, and a tiny response keeps the
 * cost of testing negligible.
 */
async function probeProvider(
  provider: ResolvedProvider
): Promise<{ ok: boolean; ms: number; error?: string; sample?: string }> {
  const t0 = Date.now();
  try {
    const sample = await probeOnce(provider);
    return { ok: true, ms: Date.now() - t0, sample };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
    };
  }
}

async function probeOnce(provider: ResolvedProvider): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    if (provider.protocol === 'gemini') {
      const base = provider.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
      const res = await fetch(
        `${base.replace(/\/$/, '')}/models/${provider.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': provider.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: OK' }] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
          signal: controller.signal,
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    }

    if (provider.protocol === 'anthropic') {
      const base = provider.baseUrl ?? 'https://api.anthropic.com';
      const res = await fetch(`${base.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { content?: { text?: string }[] };
      return json.content?.map((c) => c.text ?? '').join('') ?? '';
    }

    // openai_compatible
    const base = provider.baseUrl ?? 'https://api.deepseek.com';
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`${provider.vendor} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ═════════════════════════════════════════════════════════════════════
// Mapper
// ═════════════════════════════════════════════════════════════════════

/**
 * Shape a row for the client.
 *
 * `apiKeyEncrypted` is dropped entirely — the client receives `keyHint`
 * only, which is enough to distinguish keys without exposing them.
 */
function toProviderDto(row: AiProviderRow, usable: boolean): Record<string, unknown> {
  return {
    id: row.id,
    label: row.label,
    protocol: row.protocol,
    vendor: row.vendor,
    model: row.model,
    baseUrl: row.base_url,
    keyHint: row.key_hint ?? '',
    fromEnv: row.api_key_encrypted === FROM_ENV_MARKER,
    priority: row.priority,
    isActive: row.is_active,
    temperature: row.temperature === null ? null : Number(row.temperature),
    maxOutputTokens: row.max_output_tokens,
    supportsJsonSchema: row.supports_json_schema,
    healthStatus: row.health_status ?? 'unknown',
    lastError: row.last_error ?? null,
    consecutiveFailures: row.consecutive_failures ?? 0,
    totalSuccesses: row.total_successes ?? 0,
    totalFailures: row.total_failures ?? 0,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    note: row.note ?? null,
    /** False when the key cannot be resolved — the engine will skip it. */
    usable,
  };
}
