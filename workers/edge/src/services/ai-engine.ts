import {
  generatedCycleSchema,
  validateWithDetail,
  CYCLE_SCHEDULE,
  type CycleGenerationInput,
  type GeneratedCycle,
} from '@kpanah/shared';
import type { Env } from '../types';
import { resolveProviderKey, FROM_ENV_MARKER } from '../lib/provider-vault';

/**
 * Multi-AI engine with ordered failover.
 *
 * The provider pool is NOT hardcoded. It is read from the `ai_providers`
 * table, ordered by `priority`, so an operator can add, reorder, disable or
 * replace AI providers from the admin panel without a redeploy.
 *
 * Protocol families supported:
 *   - gemini            → Google Generative Language API (native JSON schema)
 *   - openai_compatible → any /chat/completions endpoint (DeepSeek, Groq,
 *                         OpenAI, OpenRouter, Together, local gateways, …)
 *   - anthropic         → /v1/messages
 *
 * Design notes:
 *  - We ALWAYS validate with the shared Zod schema, even when the provider
 *    supports native structured output. Vendor schemas drift; ours must hold.
 *  - Per provider we do one initial attempt and, on validation failure, ONE
 *    repair round-trip carrying the exact errors. Then we move to the next
 *    provider in priority order.
 *  - A provider that throws is recorded but never permanently removed; the
 *    next cycle simply tries again. Health stats are advisory.
 *  - "Provider reached but returned bad content" and "provider threw" are
 *    both failures, and both advance the failover chain.
 */

export interface AiAttempt {
  provider: string;
  /** Rows in the panel are identified by uuid; env-only providers have none. */
  providerId: string | null;
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
  tokensUsed?: number;
}

export interface GenerateCycleResult {
  cycle: GeneratedCycle | null;
  attempts: AiAttempt[];
  model: string | null;
  totalMs: number;
}

/** One row of `ai_providers`, already decrypted and ready to call. */
export interface ResolvedProvider {
  id: string;
  label: string;
  protocol: 'gemini' | 'openai_compatible' | 'anthropic';
  vendor: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  supportsJsonSchema: boolean;
}

export class AiEngine {
  /**
   * @param env          Worker bindings (for decryption + env fallbacks)
   * @param providers    Active providers ordered by priority, decrypted.
   *                     Built by `loadProviders()` in the repository layer.
   */
  constructor(
    private env: Env,
    private providers: ResolvedProvider[] = []
  ) {}

  get hasAnyProvider(): boolean {
    return this.providers.length > 0;
  }

  /** Provider labels in the order they will be tried, for logging. */
  get providerChain(): string[] {
    return this.providers.map((p) => `${p.label} (${p.model})`);
  }

  // ───────────────────────────────────────────────────────────────────
  // Public: generate a full 7-day cycle
  // ───────────────────────────────────────────────────────────────────

  async generateCycle(input: CycleGenerationInput): Promise<GenerateCycleResult> {
    const started = Date.now();
    const attempts: AiAttempt[] = [];

    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);
    const jsonSchema = buildJsonSchema();

    for (const provider of this.providers) {
      // ── Attempt 1 ────────────────────────────────────────────────
      const first = await this.attempt(provider, systemPrompt, userPrompt, jsonSchema, 'initial');
      attempts.push(first.attempt);
      if (first.cycle) {
        return {
          cycle: first.cycle,
          attempts,
          model: `${provider.vendor}:${provider.model}`,
          totalMs: Date.now() - started,
        };
      }

      // ── Attempt 2: repair round-trip with exact errors ───────────
      const repairPrompt = buildRepairPrompt(userPrompt, first.errors ?? []);
      const second = await this.attempt(provider, systemPrompt, repairPrompt, jsonSchema, 'repair');
      attempts.push(second.attempt);
      if (second.cycle) {
        return {
          cycle: second.cycle,
          attempts,
          model: `${provider.vendor}:${provider.model}:repaired`,
          totalMs: Date.now() - started,
        };
      }
    }

    return { cycle: null, attempts, model: null, totalMs: Date.now() - started };
  }

  // ───────────────────────────────────────────────────────────────────
  // Single provider attempt + validation
  // ───────────────────────────────────────────────────────────────────

  private async attempt(
    provider: ResolvedProvider,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema: unknown,
    phase: 'initial' | 'repair'
  ): Promise<{ cycle: GeneratedCycle | null; errors?: string[]; attempt: AiAttempt }> {
    const t0 = Date.now();
    const base = {
      provider: provider.label,
      providerId: provider.id,
      model: provider.model,
    };

    try {
      const { text, tokensUsed } = await this.callProvider(
        provider,
        systemPrompt,
        userPrompt,
        jsonSchema
      );

      const parsed = extractJson(text);
      if (parsed === null) {
        return {
          cycle: null,
          errors: ['Response was not valid JSON. Return ONLY the JSON object.'],
          attempt: {
            ...base, ok: false, ms: Date.now() - t0, error: 'invalid_json', tokensUsed,
          },
        };
      }

      const validation = validateWithDetail(generatedCycleSchema, parsed);
      if (!validation.success) {
        return {
          cycle: null,
          errors: validation.errors,
          attempt: {
            ...base, ok: false, ms: Date.now() - t0,
            error: `schema: ${validation.errors?.[0] ?? ''}`.slice(0, 200),
            tokensUsed,
          },
        };
      }

      return {
        cycle: enforceSchedule(validation.data!),
        attempt: { ...base, ok: true, ms: Date.now() - t0, tokensUsed },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        cycle: null,
        errors: [`Provider error: ${message}`],
        attempt: {
          ...base, ok: false, ms: Date.now() - t0, error: message.slice(0, 200),
        },
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Protocol dispatch
  // ───────────────────────────────────────────────────────────────────

  private callProvider(
    provider: ResolvedProvider,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema: unknown
  ): Promise<{ text: string; tokensUsed?: number }> {
    switch (provider.protocol) {
      case 'gemini':
        return this.callGemini(provider, systemPrompt, userPrompt, jsonSchema);
      case 'openai_compatible':
        return this.callOpenAiCompatible(provider, systemPrompt, userPrompt);
      case 'anthropic':
        return this.callAnthropic(provider, systemPrompt, userPrompt);
      default: {
        // Exhaustiveness guard: adding a protocol without handling it here
        // becomes a compile error rather than a silent runtime skip.
        const never: never = provider.protocol;
        return Promise.reject(new Error(`Unsupported protocol: ${String(never)}`));
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Providers
  // ───────────────────────────────────────────────────────────────────

  private async callGemini(
    provider: ResolvedProvider,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema: unknown
  ): Promise<{ text: string; tokensUsed?: number }> {
    const base = provider.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${base.replace(/\/$/, '')}/models/${provider.model}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      temperature: provider.temperature ?? 0.8,
      topP: 0.95,
      maxOutputTokens: provider.maxOutputTokens ?? 32_768,
    };
    if (provider.supportsJsonSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = jsonSchema;
    } else {
      generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': provider.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      },
      90_000
    );

    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { totalTokenCount?: number };
    };

    const candidate = json.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Gemini stopped: ${candidate.finishReason}`);
    }

    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned empty content');

    return { text, tokensUsed: json.usageMetadata?.totalTokenCount };
  }

  private async callOpenAiCompatible(
    provider: ResolvedProvider,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ text: string; tokensUsed?: number }> {
    // DeepSeek's documented endpoint; any other OpenAI-shaped gateway must
    // supply its own base_url through the admin panel.
    const base = provider.baseUrl ?? 'https://api.deepseek.com';
    const url = `${base.replace(/\/$/, '')}/chat/completions`;

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: provider.temperature ?? 0.8,
          max_tokens: provider.maxOutputTokens ?? 8192,
          response_format: { type: 'json_object' },
        }),
      },
      90_000
    );

    if (!res.ok) {
      throw new Error(
        `${provider.vendor} ${res.status}: ${(await res.text()).slice(0, 300)}`
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };

    const text = json.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error(`${provider.vendor} returned empty content`);

    return { text, tokensUsed: json.usage?.total_tokens };
  }

  private async callAnthropic(
    provider: ResolvedProvider,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ text: string; tokensUsed?: number }> {
    const base = provider.baseUrl ?? 'https://api.anthropic.com';
    const url = `${base.replace(/\/$/, '')}/v1/messages`;

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: provider.maxOutputTokens ?? 8192,
          temperature: provider.temperature ?? 0.8,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `${userPrompt}\n\nReturn ONLY a single valid JSON object. No prose, no markdown fences.`,
            },
          ],
        }),
      },
      90_000
    );

    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = json.content?.map((c) => c.text ?? '').join('') ?? '';
    if (!text) throw new Error('Anthropic returned empty content');

    return {
      text,
      tokensUsed: json.usage
        ? (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0)
        : undefined,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════
// Provider pool loading
// ═════════════════════════════════════════════════════════════════════

/** Raw shape of an `ai_providers` row as returned by PostgREST. */
export interface AiProviderRow {
  id: string;
  label: string;
  protocol: string;
  vendor: string;
  model: string;
  base_url: string | null;
  api_key_encrypted: string;
  key_hint: string;
  priority: number;
  is_active: boolean;
  temperature: number | string | null;
  max_output_tokens: number | null;
  supports_json_schema: boolean;
  note: string | null;
  // Advisory health, written by recordProviderOutcome()
  health_status: string;
  last_error: string | null;
  consecutive_failures: number;
  total_successes: number;
  total_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
}

/**
 * Turn a database row into a callable provider, decrypting its key.
 *
 * Returns `null` when the key cannot be resolved (missing env secret, wrong
 * master key, tampered ciphertext). A provider we cannot authenticate to is
 * indistinguishable from one that does not exist, so we drop it and let the
 * chain continue instead of failing every cycle.
 */
export async function resolveProvider(
  row: AiProviderRow,
  env: Env
): Promise<ResolvedProvider | null> {
  const envKeyByName: Record<string, string | undefined> = {
    gemini: env.GEMINI_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  };

  const apiKey =
    row.api_key_encrypted === FROM_ENV_MARKER
      ? (envKeyByName[row.vendor] ?? env[`${row.vendor.toUpperCase()}_API_KEY` as keyof Env] as string | undefined)
      : await resolveProviderKey(
          row.api_key_encrypted,
          undefined,
          env.PROVIDER_ENCRYPTION_KEY
        );

  if (!apiKey) return null;

  const protocol = row.protocol as ResolvedProvider['protocol'];
  if (!['gemini', 'openai_compatible', 'anthropic'].includes(protocol)) return null;

  return {
    id: row.id,
    label: row.label,
    protocol,
    vendor: row.vendor,
    model: row.model,
    baseUrl: row.base_url,
    apiKey,
    temperature: row.temperature === null ? null : Number(row.temperature),
    maxOutputTokens: row.max_output_tokens,
    supportsJsonSchema: row.supports_json_schema,
  };
}

/**
 * Build the full failover chain from database rows.
 *
 * Ordering is applied here — not in SQL — so the same list feeds both the
 * engine and the admin panel without duplicating the sort rule.
 */
export async function resolveProviderChain(
  rows: AiProviderRow[],
  env: Env
): Promise<ResolvedProvider[]> {
  const ordered = [...rows].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.label.localeCompare(b.label);
  });

  const resolved: ResolvedProvider[] = [];
  for (const row of ordered) {
    const provider = await resolveProvider(row, env);
    if (provider) resolved.push(provider);
  }
  return resolved;
}

// ═════════════════════════════════════════════════════════════════════
// Prompts
// ═════════════════════════════════════════════════════════════════════

function buildSystemPrompt(input: CycleGenerationInput): string {
  const uiLang = input.user.uiLanguage;
  const target = input.user.targetLanguage;

  return [
    `You are an expert adaptive language tutor building a 7-day micro-cycle.`,
    `Learner's native/UI language: ${uiLang}. Language being taught: ${target}.`,
    `Skill level: ${input.user.skillLevel}. Goal: ${input.user.learningGoal ?? 'general fluency'}.`,
    ``,
    `PEDAGOGY — follow exactly:`,
    `- Days 1-5 are TEACHING. Part 1 = pattern-first induction using Substitution Drills.`,
    `  NEVER state grammar rules as formulas. Instead give a base sentence and interchangeable`,
    `  slots so the learner induces the pattern themselves.`,
    `  Part 2 = REAL_APPLICATION: the same pattern in a concrete real-world scenario.`,
    `- Day 6 is HIDDEN_ASSESSMENT. It MUST look and feel like a normal teaching day.`,
    `  Do NOT mention testing, exams, scores, or evaluation anywhere in user-visible text.`,
    `  Assess what days 1-5 taught using fresh contexts.`,
    `- Day 7 is CONSOLIDATION. Revisit ONLY the learner's weak terms with NEW examples`,
    `  (never repeat the original example sentence). End with encouragement.`,
    ``,
    `SPACED REPETITION:`,
    `- The learner has a 5-box Leitner system. Prioritise terms with box 1-2 or high lapse counts.`,
    `- Terms with box 5 are mastered: use them as scaffolding, do not re-teach them.`,
    ``,
    `LANGUAGE RULES:`,
    `- "meaning", "explanation", "scenario", "prompt" and translations are written in ${uiLang}.`,
    `- "term", "example", "options" content to be learned is in ${target}.`,
    `- "title" is in ${target}; "titleFa" is the same idea rendered in ${uiLang}.`,
    ``,
    `CALIBRATION:`,
    `- accuracy ${input.delta.accuracyPct}%, avg response ${input.delta.averageResponseMs}ms.`,
    `- If accuracy < 60%: smaller vocabulary per day, more repetition, shorter sentences.`,
    `- If accuracy > 90% and responses are fast: push complexity up a notch.`,
    ``,
    `Output ONE JSON object matching the provided schema. No markdown, no commentary.`,
  ].join('\n');
}

function buildUserPrompt(input: CycleGenerationInput): string {
  const d = input.delta;
  const lines: string[] = [];

  lines.push(`Build cycle #${input.cycleNumber} for this learner.`);
  lines.push('');
  lines.push(`PERFORMANCE SNAPSHOT:`);
  lines.push(`- answers: ${d.totalAnswers}, accuracy: ${d.accuracyPct}%`);
  lines.push(`- avg response time: ${d.averageResponseMs}ms, longest pause: ${d.maxPauseMs}ms`);
  lines.push(`- pace: ${d.paceAnswersPerMinute} answers/min`);
  if (d.hiddenAssessmentScore !== null) {
    lines.push(`- day-6 assessment result: ${d.hiddenAssessmentScore}%`);
  }

  if (d.weakTerms.length > 0) {
    lines.push('');
    lines.push(`WEAK TERMS — must appear in days 1-5 AND again in day 7 with new examples:`);
    for (const w of d.weakTerms.slice(0, 25)) {
      lines.push(`  • ${w.term} (box ${w.box}, ${w.lapses} lapses, fail rate ${Math.round(w.failRate * 100)}%)`);
    }
  }

  if (d.masteredTerms.length > 0) {
    lines.push('');
    lines.push(`MASTERED (scaffold only, do not re-teach): ${d.masteredTerms.slice(0, 30).join(', ')}`);
  }

  if (d.weakestAreas.length > 0) {
    lines.push('');
    lines.push(`WEAKEST AREAS — allocate most time here: ${d.weakestAreas.join(', ')}`);
  }
  if (d.strongestAreas.length > 0) {
    lines.push(`STRONGEST AREAS — can move faster: ${d.strongestAreas.join(', ')}`);
  }

  if (input.previousCycleSummary) {
    lines.push('');
    lines.push(`PREVIOUS CYCLE (do not duplicate its content or scenario):`);
    lines.push(input.previousCycleSummary);
  }

  lines.push('');
  lines.push(`Produce exactly 7 lessons: dayNumber 1..7, kind per the pedagogy rules,`);
  lines.push(`each with part1 (PATTERN_DRILL, 3-8 items) and part2 (REAL_APPLICATION, 2-6 questions).`);

  return lines.join('\n');
}

function buildRepairPrompt(originalPrompt: string, errors: string[]): string {
  return [
    originalPrompt,
    '',
    '───',
    'YOUR PREVIOUS RESPONSE FAILED SCHEMA VALIDATION.',
    'Fix these exact problems and return the corrected JSON object:',
    ...errors.slice(0, 12).map((e) => `  ✗ ${e}`),
    '',
    'Return ONLY the corrected JSON object. Nothing else.',
  ].join('\n');
}

// ═════════════════════════════════════════════════════════════════════
// Gemini responseSchema (OpenAPI 3.0 subset)
// ═════════════════════════════════════════════════════════════════════

function buildJsonSchema(): Record<string, unknown> {
  const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });

  const patternDrillItem = {
    type: 'object',
    properties: {
      term: str('The target-language word or phrase'),
      meaning: str('Meaning in the learner UI language'),
      pronunciation: str('Optional romanisation'),
      example: str('Example sentence in the target language'),
      exampleTranslation: str('Translation into the learner UI language'),
      substitution: {
        type: 'object',
        properties: {
          base: str('Base sentence with a slot'),
          slots: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8 },
        },
        required: ['base', 'slots'],
      },
    },
    required: ['term', 'meaning', 'example'],
  };

  const patternDrillPart = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['PATTERN_DRILL'] },
      explanation: str('Inductive explanation in the UI language — no grammar formulas'),
      pattern: str('Optional pattern template'),
      patternTranslation: str(),
      items: { type: 'array', items: patternDrillItem, minItems: 3, maxItems: 12 },
      microExercises: {
        type: 'array',
        minItems: 0,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            id: str(),
            kind: { type: 'string', enum: ['FILL_BLANK', 'REORDER', 'MATCH', 'CHOOSE'] },
            prompt: str(),
            options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
            correctIndex: { type: 'integer', minimum: 0, maximum: 5 },
            answer: str(),
            explanation: str(),
          },
          required: ['id', 'kind', 'prompt'],
        },
      },
    },
    required: ['type', 'explanation', 'items'],
  };

  const realApplicationPart = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['REAL_APPLICATION'] },
      scenario: str('Real-world scenario in the UI language'),
      scenarioTranslation: str(),
      dialogue: {
        type: 'array',
        minItems: 0,
        maxItems: 20,
        items: {
          type: 'object',
          properties: { speaker: str(), text: str(), translation: str() },
          required: ['speaker', 'text'],
        },
      },
      questions: {
        type: 'array',
        minItems: 2,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            id: str(),
            prompt: str(),
            options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
            correctIndex: { type: 'integer', minimum: 0, maximum: 4 },
            explanation: str(),
            linkedTerm: str('Term to record in the Leitner box'),
          },
          required: ['id', 'prompt', 'options', 'correctIndex'],
        },
      },
    },
    required: ['type', 'scenario', 'questions'],
  };

  const lesson = {
    type: 'object',
    properties: {
      dayNumber: { type: 'integer', minimum: 1, maximum: 7 },
      title: str('Target-language title'),
      titleFa: str('Title in the learner UI language'),
      kind: { type: 'string', enum: ['TEACHING', 'HIDDEN_ASSESSMENT', 'CONSOLIDATION'] },
      part1: patternDrillPart,
      part2: realApplicationPart,
    },
    required: ['dayNumber', 'title', 'titleFa', 'kind', 'part1', 'part2'],
  };

  return {
    type: 'object',
    properties: {
      title: str('Cycle title in the target language'),
      titleFa: str('Cycle title in the learner UI language'),
      focusSummary: str('One-paragraph summary in the UI language'),
      lessons: { type: 'array', items: lesson, minItems: 7, maxItems: 7 },
    },
    required: ['title', 'titleFa', 'focusSummary', 'lessons'],
  };
}

// ═════════════════════════════════════════════════════════════════════
// Post-processing
// ═════════════════════════════════════════════════════════════════════

/**
 * روز ۶ و ۷ باید نوع درست داشته باشند، حتی اگر مدل اشتباه بدهد.
 * (اسکیمای Zod هم چک می‌کند؛ این لایه دوم دفاع است.)
 */
function enforceSchedule(cycle: GeneratedCycle): GeneratedCycle {
  return {
    ...cycle,
    lessons: cycle.lessons.map((lesson) => {
      const expectedKind = CYCLE_SCHEDULE[lesson.dayNumber as 1 | 2 | 3 | 4 | 5 | 6 | 7];
      return expectedKind ? { ...lesson, kind: expectedKind } : lesson;
    }),
  };
}

/** استخراج JSON از پاسخ مدل (حذف ```json، متن اضافی، ...) */
function extractJson(text: string): unknown | null {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  // ```json ... ```
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    const parsed = tryParse(fence[1].trim());
    if (parsed !== undefined) return parsed;
  }

  // اولین { تا آخرین }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const parsed = tryParse(trimmed.slice(first, last + 1));
    if (parsed !== undefined) return parsed;
  }

  return null;
}

function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
