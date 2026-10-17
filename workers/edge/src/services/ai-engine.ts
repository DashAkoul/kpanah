import type { z } from 'zod';
import {
  generatedCycleSchema,
  generatedLessonSchema,
  lessonSkeletonSchema,
  cycleOutlineSchema,
  validateWithDetail,
  CYCLE_SCHEDULE,
  DAY_PROFILES,
  dayProfile,
  type AiProviderKind,
  type CycleGenerationInput,
  type GeneratedCycle,
  type GeneratedLesson,
  type LessonSkeleton,
  type CycleOutline,
  type OutlineDay,
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
  /**
   * ⚠️ `initial` = فراخوانی اول، `repair` = تلاش دوباره پس از خطای
   * اعتبارسنجی. پیش از این همهٔ ردیف‌های `ai_attempt_log` با `phase:
   * 'initial'` ثبت می‌شدند و تحلیل «چند درصد خطاها با repair حل شد»
   * غیرممکن بود.
   */
  phase: 'initial' | 'repair';
  error?: string;
  tokensUsed?: number;
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
  /**
   * دستهٔ provider (مِیگرشن ۰۰۱۱): TEXT برای تولید محتوا، TTS برای صوت،
   * STT برای تشخیص گفتار. زنجیرهٔ هر دسته جدا resolve می‌شود تا مدل صوتی
   * در مسیر متن امتحان نشود (و برعکس).
   */
  kind: AiProviderKind;
}

export class AiEngine {
  /**
   * @param env          Worker bindings (for decryption + env fallbacks)
   * @param providers    Active providers ordered by priority, decrypted.
   *                     Built by `loadProviders()` in the repository layer.
   * @param kind         Which category this engine instance serves. Passed in
   *                     (rather than inferred) so a caller cannot accidentally
   *                     build a TEXT engine out of TTS rows.
   */
  constructor(
    private env: Env,
    private providers: ResolvedProvider[] = [],
    private kind: AiProviderKind = 'TEXT'
  ) {}

  /** دستهٔ این موتور — برای لاگ و تشخیص خطای پیکربندی */
  get providerKind(): AiProviderKind {
    return this.kind;
  }

  get hasAnyProvider(): boolean {
    return this.providers.length > 0;
  }

  /** Provider labels in the order they will be tried, for logging. */
  get providerChain(): string[] {
    return this.providers.map((p) => `${p.label} (${p.model})`);
  }

  // ───────────────────────────────────────────────────────────────────
  // Public: modular generation (outline → day 1 → rest in background)
  //
  // تولید ماژولار: اول «نقشهٔ» چرخه ساخته می‌شود (کوچک و ارزان)، بعد محتوای
  // روز ۱ تولید می‌شود تا کاربر فوراً درس بخواند، و بقیهٔ روزها در پس‌زمینه
  // پر می‌شوند. مزیت: کاربر انتظار طولانی نمی‌کشد + هر بخش کوچک‌تر است و
  // retry ارزان‌تر می‌شود.
  // ───────────────────────────────────────────────────────────────────

  async generateOutline(input: CycleGenerationInput): Promise<{
    outline: CycleOutline | null;
    attempts: AiAttempt[];
    model: string;
    totalMs: number;
  }> {
    const r = await this.runChain(
      cycleOutlineSchema,
      buildOutlineSystemPrompt(input),
      buildOutlineUserPrompt(input),
      'outline'
    );
    return {
      // نرمال‌سازی عنوان: کش قدیمی ممکن است titleFa داشته باشد
      outline: r.value ? normalizeOutlineTitles(r.value) : null,
      attempts: r.attempts, model: r.model, totalMs: r.totalMs,
    };
  }

  async generateLesson(
    input: CycleGenerationInput,
    day: OutlineDay,
    outline: CycleOutline
  ): Promise<{
    lesson: GeneratedLesson | null;
    attempts: AiAttempt[];
    model: string;
    totalMs: number;
  }> {
    const r = await this.runChain(
      generatedLessonSchema,
      buildLessonSystemPrompt(input),
      buildLessonUserPrompt(input, day, outline),
      `lesson-${day.dayNumber}`
    );
    return {
      lesson: r.value ? normalizeLessonTitles(r.value) : null,
      attempts: r.attempts, model: r.model, totalMs: r.totalMs,
    };
  }

  /**
   * مرحلهٔ A تولید دو مرحله‌ای — «اسکلت» درس.
   *
   * ⚠️ چرا: گران‌ترین بخش هر درس، جزئیات هر واژه است (معنا/تلفظ/مثال/ترجمه)
   * و این جزئیات **بین همهٔ کاربران مشترک‌اند**. پس مدل فقط ساختار را
   * می‌دهد (صحنه + سوال‌ها + فهرست واژه‌ها) و برای واژه‌های **ناشناخته**
   * جزئیات را در `newCards` برمی‌گرداند تا یک بار برای همیشه ذخیره شوند.
   *
   * @param knownTerms واژه‌هایی که از قبل کارت دارند — مدل نباید دوباره
   *   جزئیاتشان را بسازد (صرفه‌جویی مستقیم توکن).
   */
  async generateLessonSkeleton(
    input: CycleGenerationInput,
    day: OutlineDay,
    outline: CycleOutline,
    knownTerms: string[]
  ): Promise<{
    skeleton: LessonSkeleton | null;
    attempts: AiAttempt[];
    model: string;
    totalMs: number;
  }> {
    const r = await this.runChain(
      lessonSkeletonSchema,
      buildLessonSkeletonSystemPrompt(input, knownTerms),
      buildLessonSkeletonUserPrompt(input, day, outline, knownTerms),
      'lesson-skeleton'
    );
    return {
      skeleton: r.value ? (r.value as LessonSkeleton) : null,
      attempts: r.attempts,
      model: r.model,
      totalMs: r.totalMs,
    };
  }

  /**
   * حلقهٔ failover عمومی: هر provider را با یک درخواست اولیه و یک درخواست
   * «تعمیر» (با خطاهای دقیق) امتحان می‌کند.
   *
   * ⚠️ یافتهٔ ۱ بازبینی (بحروری): پیش از این، `responseSchema` همیشه اسکیمای
   * «کل چرخهٔ ۷ درسی» بود — حتی وقتی پرامپت یک outline یا یک درس می‌خواست.
   * مدل سعی می‌کرد شکل چرخهٔ کامل را پر کند و schema validation می‌شکست
   * (`lessons.0.part1.type: Invalid literal value…` / `title: Required`).
   * حالا هر تسک اسکیمای خودش را هم برای validate و هم برای Gemini می‌گیرد.
   */
  private async runChain<T>(
    schema: z.ZodType<T>,
    systemPrompt: string,
    userPrompt: string,
    tag: string,
    /**
     * چه اسکیمای JSON به provider فرستاده شود. اگر داده نشود، از یک
     * `jsonSchemaFor(tag)` استنباط می‌شود تا اشتباه قدیمی تکرار نشود.
     */
    jsonSchema?: unknown
  ): Promise<{ value: T | null; attempts: AiAttempt[]; model: string; totalMs: number }> {
    const started = Date.now();
    const attempts: AiAttempt[] = [];
    const schemaForProvider = jsonSchema ?? jsonSchemaFor(tag);

    // ⚠️ سقف زمان و تعداد provider برای این مسیر.
    // این فراخوانی داخل یک درخواست کاربر اجرا می‌شود (نه پس‌زمینه)، پس نباید
    // دقیقه‌ها طول بکشد. با بودجهٔ ۴۵ ثانیه و ۲ provider، بدترین حالت
    // ~۶۰ ثانیه است و بعد درخواست آزاد می‌شود (چرخه FAILED می‌شود تا UI
    // دکمهٔ تلاش مجدد نشان دهد).
    const deadlineMs = 45_000;
    const maxProviders = 2;

    for (const provider of this.providers.slice(0, maxProviders)) {
      if (Date.now() - started > deadlineMs) break;

      const first = await this.attemptFor(
        provider, schema, systemPrompt, userPrompt, schemaForProvider, 'initial'
      );
      attempts.push(first.attempt);
      if (first.value !== null) {
        return {
          value: first.value,
          attempts,
          model: `${provider.vendor}:${provider.model}:${tag}`,
          totalMs: Date.now() - started,
        };
      }

      if (Date.now() - started > deadlineMs) break;

      const repair = buildRepairPrompt(userPrompt, first.errors ?? []);
      const second = await this.attemptFor(
        provider, schema, systemPrompt, repair, schemaForProvider, 'repair'
      );
      attempts.push(second.attempt);
      if (second.value !== null) {
        return {
          value: second.value,
          attempts,
          model: `${provider.vendor}:${provider.model}:${tag}:repaired`,
          totalMs: Date.now() - started,
        };
      }
    }

    return { value: null, attempts, model: 'none', totalMs: Date.now() - started };
  }

  /** یک تلاش با اسکیمای دلخواه (معادل `attempt` برای اسکیماهای ماژولار) */
  private async attemptFor<T>(
    provider: ResolvedProvider,
    schema: z.ZodType<T>,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema: unknown,
    phase: 'initial' | 'repair'
  ): Promise<{ value: T | null; errors?: string[]; attempt: AiAttempt }> {
    const t0 = Date.now();
    const base = {
      provider: provider.label,
      providerId: provider.id,
      model: provider.model,
      phase,
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
          value: null,
          errors: ['Response was not valid JSON. Return ONLY the JSON object.'],
          attempt: { ...base, ok: false, ms: Date.now() - t0, error: 'invalid_json', tokensUsed },
        };
      }
      const validation = validateWithDetail(schema, parsed);
      if (!validation.success) {
        return {
          value: null,
          errors: validation.errors,
          attempt: {
            ...base,
            ok: false,
            ms: Date.now() - t0,
            error: `schema: ${validation.errors?.[0] ?? ''}`.slice(0, 200),
            tokensUsed,
          },
        };
      }
      return {
        value: validation.data!,
        attempt: { ...base, ok: true, ms: Date.now() - t0, tokensUsed },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        value: null,
        errors: [`Provider error: ${message}`],
        attempt: { ...base, ok: false, ms: Date.now() - t0, error: message.slice(0, 200) },
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
    jsonSchema: unknown,
    /**
     * سقف توکن خروجی.
     *
     * ⚠️ چرا جدا از provider.maxOutputTokens: مسیر «چرخهٔ کامل» (legacy
     * fallback) همهٔ ۷ درس را در **یک** پاسخ می‌خواهد و نیاز به ۳۰k+ توکن
     * دارد. قبلاً سقف مشترک ۱۶k بود → پاسخ بریده می‌شد → خطای schema
     * («title: Required» / «part1.type: Invalid literal value»).
     * مسیر ماژولار (outline + تک‌درس) کوچک است و سقف محافظه می‌خواهد.
     */
    maxOutputTokens?: number
  ): Promise<{ text: string; tokensUsed?: number }> {
    switch (provider.protocol) {
      case 'gemini':
        // Gemini structured output را بومی می‌فهمد → اسکیما در generationConfig
        return this.callGemini(provider, systemPrompt, userPrompt, jsonSchema, maxOutputTokens);
      case 'openai_compatible':
        // ⚠️ این‌ها structured output بومی ندارند (`response_format:
        // json_object` فقط «JSON معتبر» را تضمین می‌کند، نه شکل درست). پس
        // اسکیما را به‌صورت متن به پرامپت می‌چسبانیم؛ وگرنه مدل کلید کم/زیاد
        // می‌کند و validation می‌شکند.
        return this.callOpenAiCompatible(
          provider,
          systemPrompt,
          withSchemaInstruction(userPrompt, jsonSchema),
          maxOutputTokens
        );
      case 'anthropic':
        return this.callAnthropic(
          provider,
          systemPrompt,
          withSchemaInstruction(userPrompt, jsonSchema),
          maxOutputTokens
        );
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
    jsonSchema: unknown,
    maxOutputTokens?: number
  ): Promise<{ text: string; tokensUsed?: number }> {
    const base = provider.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${base.replace(/\/$/, '')}/models/${provider.model}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      temperature: provider.temperature ?? DEFAULT_TEMPERATURE,
      topP: 0.95,
      // پیش‌فرض محافظه‌کارانه (مسیر ماژولار)؛ اگر فراخوان سقف بزرگ‌تر
      // بدهد (مثل چرخهٔ کامل) همان اعمال می‌شود.
      maxOutputTokens: maxOutputTokens ?? Math.min(provider.maxOutputTokens ?? 8192, 16_384),
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
          // ⚠️ عمداً `safetySettings` فرستاده نمی‌شود. نام دسته‌های قدیمی
          // (HARM_CATEGORY_*) در نسخه‌های جدید API باعث خطای ۴۰۰
          // «Request contains an invalid argument» می‌شود. پیش‌فرض‌های
          // Gemini کافی‌اند.
        }),
      },
      30_000
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
    userPrompt: string,
    maxOutputTokens?: number
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
          temperature: provider.temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: maxOutputTokens ?? provider.maxOutputTokens ?? 8192,
          response_format: { type: 'json_object' },
        }),
      },
      30_000
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
    userPrompt: string,
    maxOutputTokens?: number
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
          max_tokens: maxOutputTokens ?? provider.maxOutputTokens ?? 8192,
          temperature: provider.temperature ?? DEFAULT_TEMPERATURE,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `${userPrompt}\n\nReturn ONLY a single valid JSON object. No prose, no markdown fences.`,
            },
          ],
        }),
      },
      30_000
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
  /** دستهٔ provider: TEXT | TTS | STT (مِیگرشن ۰۰۱۱؛ پیش‌فرض TEXT) */
  kind?: string | null;
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

  // دسته: اگر ستون نبود یا مقدار ناشناخته بود، TEXT (سازگاری با گذشته)
  const kind = (row.kind ?? 'TEXT').toUpperCase();
  const validKind: AiProviderKind =
    kind === 'TTS' || kind === 'STT' ? kind : 'TEXT';

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
    kind: validKind,
  };
}

/**
 * Build the failover chain from database rows.
 *
 * Ordering is applied here — not in SQL — so the same list feeds both the
 * engine and the admin panel without duplicating the sort rule.
 *
 * ⚠️ `kind` اختیاری است: وقتی داده شود فقط providerهای همان دسته برمی‌گردند
 * (مثلاً فقط TTS). وقتی داده نشود همه برمی‌گردند — برای پنل ادمین که باید
 * هر سه بخش را نشان بدهد.
 */
export async function resolveProviderChain(
  rows: AiProviderRow[],
  env: Env,
  kind?: AiProviderKind
): Promise<ResolvedProvider[]> {
  const filtered = kind ? rows.filter((r) => (r.kind ?? 'TEXT').toUpperCase() === kind) : rows;

  const ordered = [...filtered].sort((a, b) => {
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

/**
 * یافتهٔ ۳ بازبینی: دما برای خروجی ساختاریافته.
 *
 * ۰.۸ برای تولید محتوای آموزشی طبیعی خوب است، ولی برای JSON با اسکیما
 * سخت‌گیرانه باعث می‌شود مدل گاهی فیلد را جا بیندازد یا شکل را بشکند.
 * ۰.۷ تعادل بهتر است: هنوز تنوع دارد، ولی پایبندی به اسکیما بالاتر.
 * مقدار provider در پنل ادمین اگر ست شده باشد، همان اولویت دارد.
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * یافتهٔ ۲ بازبینی: قاعدهٔ تلفظ به زبان هدف بستگی دارد.
 *
 * برای عربی/فارسی/چینی/یونانی/روسی/کره‌ای/ژاپنی تلفظ لاتین مفید است.
 * برای زبان‌هایی که خودشان لاتین‌اند (انگلیسی، آلمانی، فرانسوی، اسپانیایی،
 * Portuguese) تلفظ لاتین یا بی‌معنی است یا کلید را اشغال — پس تولید نشود.
 *
 * هندسهٔ خط بر اساس چند حرف اول کد زبان تشخیص داده می‌شود تا برای زبان‌های
 * آینده هم کار کند.
 */
const NON_LATIN_SCRIPT_PREFIXES = ['ar', 'fa', 'ur', 'he', 'zh', 'ja', 'ko', 'ru', 'el', 'hi', 'bn', 'th'];

function pronunciationRule(target: string): string {
  const code = target.split('-')[0]?.toLowerCase() ?? '';
  if (NON_LATIN_SCRIPT_PREFIXES.includes(code)) {
    return `"pronunciation" is REQUIRED: give a romanisation of the term and each example, because ${target} uses a non-Latin script.`;
  }
  return `"pronunciation" is OPTIONAL and usually useless for ${target} — prefer to omit it unless the term is genuinely non-obvious to read aloud.`;
}

/**
 * پرامپت «تعمیر» — یافتهٔ ۵ بازبینی.
 *
 * قبلاً کل پرامپت اولیه + خطاها فرستاده می‌شد؛ یعنی تمام ورودی دوباره
 * پردازش می‌شد (هزینهٔ دوبرابه). اما اگر مشخصات را کاملاً حذف کنیم، مدل
 * ممکن است چیز متفاوتی بسازد.
 *
 * تعادل: پرامپت اولیه به «قواعد سخت» خلاصه می‌شود (نوع‌ها، تعدادها، فیلدهای
 * الزامی) و خطاهای دقیق در سر جای خود می‌مانند. این حدود ۶۰٪ از توکن ورودی
 * را کم می‌کند بدون اینکه مدل از مسیر خارج شود.
 */
function buildRepairPrompt(originalPrompt: string, errors: string[]): string {
  return [
    originalPrompt,
    '',
    '───',
    'YOUR PREVIOUS RESPONSE FAILED SCHEMA VALIDATION.',
    'Fix ONLY these problems; keep everything else exactly as it was:',
    ...errors.slice(0, 12).map((e) => `  ✗ ${e}`),
    '',
    'HARD REQUIREMENTS (do not change these):',
    '- exactly 7 days, dayNumber 1..7, each once',
    '- days 1-5 = TEACHING, day 6 = HIDDEN_ASSESSMENT, day 7 = CONSOLIDATION',
    '- required keys: dayNumber, title, titleUi, kind, part1, part2',
    '- part1.type = "PATTERN_DRILL", part2.type = "REAL_APPLICATION"',
    '- part2.questions: 2-6 items, correctIndex must be < options.length',
    '- every drill item needs "speakText", "meaningOptions", "exampleOptions"',
    '  (3 options each, correctIndex < options.length) and substitution.correctIndex',
    '',
    'Return ONLY the corrected JSON object. Nothing else.',
  ].join('\n');
}

// ═════════════════════════════════════════════════════════════════════
// Prompts — تولید ماژولار (outline / تک‌درس)
// ═════════════════════════════════════════════════════════════════════

/** چارچوب مشترک آموزشی — بین outline و درس استفاده می‌شود */
function pedagogyBlock(input: CycleGenerationInput): string {
  return [
    `Learner's native/UI language: ${input.user.uiLanguage}. Language being taught: ${input.user.targetLanguage}.`,
    `Skill level: ${input.user.skillLevel}. Goal: ${input.user.learningGoal ?? 'general fluency'}.`,
    ``,
    `PEDAGOGY — follow exactly:`,
    `- Days 1-5 are TEACHING. Part 1 = pattern-first induction using Substitution Drills.`,
    `  NEVER state grammar rules as formulas. Instead give a base sentence and interchangeable`,
    `  slots so the learner induces the pattern themselves.`,
    `  Part 2 = REAL_APPLICATION: the same pattern in a concrete real-world scenario.`,
    `- Day 6 is HIDDEN_ASSESSMENT. It MUST look and feel like a normal teaching day.`,
    `  Do NOT mention testing, exams, scores, or evaluation anywhere in user-visible text.`,
    `- Day 7 is CONSOLIDATION. Revisit ONLY the learner's weak terms with NEW examples`,
    `  (never repeat the original example sentence). End with encouragement.`,
    ``,
    `LANGUAGE RULES:`,
    `- "meaning", "explanation", "scenario", "prompt" and translations are written in ${input.user.uiLanguage}.`,
    `- "term", "example", "options" content to be learned is in ${input.user.targetLanguage}.`,
    `- "title" is in ${input.user.targetLanguage}; "titleUi" is the same idea rendered in ${input.user.uiLanguage}.`,
    `- "objective" is English; "objectiveFa" is the same sentence rendered in ${input.user.uiLanguage}.`,
    `- ${pronunciationRule(input.user.targetLanguage)}`,
    `- "speakText" is a clean, speakable version of the TERM itself for a text-to-speech`,
    `  engine: strip parentheses, slashes, ellipses and bracketed notes. REQUIRED on every`,
    `  drill item. ⚠️ It must be the WORD/PHRASE, never the example sentence.`,
    ``,
    `DRILL DESIGN — the learner must be able to ANSWER, and we must be able to SCORE it:`,
    `- "meaningOptions": exactly 3 options in ${input.user.uiLanguage}. One is the true`,
    `  meaning (word-for-word identical to "meaning"); the other two are plausible`,
    `  distractors from the SAME semantic field / same part of speech. Never obviously`,
    `  absurd. Set "correctIndex" to the true meaning's position.`,
    `- "exampleOptions": exactly 3 sentences in ${input.user.targetLanguage}.`,
    `  ⚠️ EVERY option MUST contain the exact term itself — otherwise the learner`,
    `  can spot the answer just by looking for the word. One option is the true`,
    `  example (identical to "example"); the other two use the SAME term wrongly`,
    `  (wrong collocation, wrong register, or wrong meaning in context).`,
    `  Set "correctIndex" accordingly.`,
    `- "substitution": "base" is a short frame containing ___ ; "slots" has exactly 3`,
    `  completions of which EXACTLY ONE is correct (grammatical AND appropriate).`,
    `  The two wrong ones must look similar (same length/register) so the answer is not`,
    `  guessable. NEVER put the lesson's "example" sentence — or a full sentence — in`,
    `  "slots"; slots are short complements (1-5 words). Set "correctIndex".`,
  ].join('\n');
}

/**
 * خلاصهٔ عملکرد کاربر (delta) — برای شخصی‌سازی.
 *
 * ⚠️ `compact` برای فراخوانی **تک‌روز** است: فهرست کامل ۲۵+۳۰ واژه برای
 * ساختن یک روز لازم نیست و فقط توکن ورودی می‌سوزاند (~۱۵۰ توکن در هر
 * فراخوانی). outline که تصویر کامل چرخه را می‌سازد، فهرست کامل می‌گیرد.
 */
function deltaBlock(input: CycleGenerationInput, compact = false): string {
  const d = input.delta;
  const weakLimit = compact ? 12 : 25;
  const masteredLimit = compact ? 10 : 30;
  const lines: string[] = [];
  lines.push(`PERFORMANCE SNAPSHOT: answers ${d.totalAnswers}, accuracy ${d.accuracyPct}%, avg ${d.averageResponseMs}ms.`);
  if (d.accuracyPct < 60) lines.push('CALIBRATION: accuracy < 60% → smaller vocabulary per day, more repetition, shorter sentences.');
  if (d.accuracyPct > 90) lines.push('CALIBRATION: accuracy > 90% and fast → push complexity up a notch.');
  if (d.weakTerms.length > 0) {
    lines.push(`WEAK TERMS (must be recycled): ${d.weakTerms.slice(0, weakLimit).map((w) => `${w.term} (box ${w.box})`).join(', ')}`);
  }
  if (d.masteredTerms.length > 0) {
    lines.push(`MASTERED (scaffold only, do not re-teach): ${d.masteredTerms.slice(0, masteredLimit).join(', ')}`);
  }
  if (d.weakestAreas.length > 0) lines.push(`WEAKEST AREAS: ${d.weakestAreas.join(', ')}`);
  if (input.previousCycleSummary) {
    lines.push(`PREVIOUS CYCLE (do not duplicate): ${input.previousCycleSummary}`);
  }
  return lines.join('\n');
}

function buildOutlineSystemPrompt(input: CycleGenerationInput): string {
  return [
    `You are an expert adaptive language tutor. You are planning (NOT writing) a 7-day micro-cycle.`,
    ``,
    pedagogyBlock(input),
    ``,
    `TASK: produce the cycle OUTLINE only — a title, a one-paragraph focus summary,`,
    `and for each of the 7 days: a short title, its kind, and a one-sentence objective.`,
    `Kinds MUST be: days 1-5 = TEACHING, day 6 = HIDDEN_ASSESSMENT, day 7 = CONSOLIDATION.`,
    `Titles must be concrete and distinct (no two days about the same sub-skill).`,
    ``,
    `THE ARC — days 1-5 are NOT interchangeable. Each teaches a different skill stage:`,
    ...Object.entries(DAY_PROFILES)
      .slice(0, 5)
      .map(([n, p]) => `  Day ${n} = ${p.phase}: ${p.objective} → toward: ${p.emphasis}`),
    `  Day 6 = ASSESS (hidden — looks like a normal teaching day).`,
    `  Day 7 = CONSOLIDATE (weak terms only, brand-new examples).`,
    ``,
    `Write each day's objective as a concrete micro-goal in one sentence (not a restatement of the title).`,
    `Objectives must show the progression: what the learner can DO after that day that they could not do before.`,
    ``,
    `Output ONE JSON object matching the provided schema. No markdown, no commentary.`,
  ].join('\n');
}

function buildOutlineUserPrompt(input: CycleGenerationInput): string {
  return [
    `Plan cycle #${input.cycleNumber}.`,
    '',
    deltaBlock(input),
    '',
    `Return: title, titleUi, focusSummary, and days[] with exactly 7 entries (dayNumber 1..7).`,
    `Each day needs: title, titleUi, kind, objective, objectiveFa.`,
  ].join('\n');
}

function buildLessonSystemPrompt(input: CycleGenerationInput): string {
  return [
    `You are an expert adaptive language tutor writing ONE day of an existing 7-day cycle.`,
    ``,
    pedagogyBlock(input),
    ``,
    `The cycle outline is already fixed — stay consistent with it and do not change its topic.`,
    `Write ONLY the requested day.`,
    ``,
    `Output ONE JSON object matching the provided schema. No markdown, no commentary.`,
    ``,
    `EXAMPLE of the required shape (copy the STRUCTURE only, never the content):`,
    `{"dayNumber":3,"title":"...","titleUi":"...","kind":"TEACHING",`,
    `"part1":{"type":"PATTERN_DRILL",`,
    `"items":[{"term":"...","meaning":"...","example":"...","speakText":"...",`,
    `"substitution":{"base":"I would like ___","slots":["a coffee","water"]}}]},`,
    `"part2":{"type":"REAL_APPLICATION","scenario":"...","questions":[{"id":"q1","prompt":"...",`,
    `"options":["...","..."],"correctIndex":0,"explanation":"...","linkedTerm":"..."}]}}`,
  ].join('\n');
}

function buildLessonUserPrompt(
  input: CycleGenerationInput,
  day: OutlineDay,
  outline: CycleOutline
): string {
  // پروفایل روز (با fallback برای چرخه‌های قدیمی/کش‌شده)
  const profile = dayProfile(day.dayNumber);
  const objective = day.objective ?? profile.objective;

  return [
    `Cycle: ${outline.title} — ${outline.focusSummary}`,
    `Full outline: ${outline.days.map((d) => `D${d.dayNumber}(${d.kind}) ${d.title}`).join(' | ')}`,
    '',
    `NOW WRITE DAY ${day.dayNumber}: "${day.title}" (kind ${day.kind}).`,
    `Day objective: ${objective}`,
    `Day phase: ${profile.phase} — ${profile.emphasis}`,
    '',
    deltaBlock(input, true),
    '',
    `Content budget for this day (do not exceed):`,
    `- part1 items: ${profile.items.min}-${profile.items.max}`,
    `- part2 questions: ${profile.part2.min}-${profile.part2.max}`,
    `- share of items that must be BRAND NEW: ${Math.round(profile.newItemRatio * 100)}%`,
    `- the rest must REVIEW items from earlier days of this cycle.`,
    '',
    `Rules for this day:`,
    `- part1: PATTERN_DRILL (term, meaning, pronunciation, example, exampleTranslation, speakText,`,
    `  meaningOptions, exampleOptions, substitution).`,
    `- every drill item MUST have "speakText" (the TERM, clean for TTS — not the example).`,
    `- every drill item MUST have "meaningOptions" and "exampleOptions" (3 options each,`,
    `  exactly one correct, plausible distractors) and a "substitution" whose "slots"`,
    `  contain exactly one correct completion plus two look-alike wrong ones.`,
    `- Do NOT produce an "explanation", "pattern", "patternTranslation", "dialogue",`,
    `  "scenarioTranslation" or "microExercises" key — they are not part of the schema.`,
    `- If WEAK TERMS were listed above, they are the PREFERRED SOURCE for the REVIEW`,
    `  share of this day — never for the BRAND NEW share. The budget above wins.`,
    day.kind === 'CONSOLIDATION'
      ? `- This is CONSOLIDATION: reuse ONLY weak terms with NEW example sentences; never repeat an old example.`
      : day.kind === 'HIDDEN_ASSESSMENT'
        ? `- This is HIDDEN_ASSESSMENT but must look like a normal teaching day. Never mention tests/scores.`
        : `- part2: REAL_APPLICATION with 2-6 questions in a concrete scenario.`,
    `- dayNumber MUST be ${day.dayNumber}, kind MUST be ${day.kind}.`,
    `- title/titleUi should match the outline: "${day.title}".`,
  ].join('\n');
}

/** پرامپت مرحلهٔ A — خروجی «اسکلت» (بدون جزئیات واژه) */
function buildLessonSkeletonSystemPrompt(
  input: CycleGenerationInput,
  knownTerms: string[]
): string {
  const knownLine = knownTerms.length
    ? `KNOWN TERMS (already have cards — do NOT repeat their details): ${knownTerms.join(', ')}`
    : `KNOWN TERMS: (none yet — every term needs a card in "newCards")`;

  return [
    `You are an expert adaptive language tutor writing ONE day of an existing 7-day cycle.`,
    ``,
    pedagogyBlock(input),
    ``,
    `The cycle outline is already fixed — stay consistent with it and do not change its topic.`,
    `Write ONLY the requested day.`,
    ``,
    `⚠️ SPLIT OUTPUT — the most important rule:`,
    `1. "part1.items" lists the words/phrases to drill. For each item give ONLY`,
    `   "term" (plus an optional "substitution" pattern). NEVER write "meaning",`,
    `   "pronunciation", "example" or "exampleTranslation" inside an item.`,
    `2. "newCards" carries the full details (meaning, pronunciation, example,`,
    `   exampleTranslation) ONLY for terms that are NOT in the KNOWN TERMS list.`,
    `   If every term you picked is already known, omit "newCards" entirely.`,
    ``,
    knownLine,
    ``,
    `⚠️ INTEGRITY RULE: every "term" in "part1.items" must EITHER appear in`,
    `   KNOWN TERMS OR have a matching entry in "newCards". A term with neither`,
    `   makes the lesson unrenderable.`,
    ``,
    `Output ONE JSON object matching the provided schema. No markdown, no commentary.`,
    ``,
    `EXAMPLE of the required shape (copy the STRUCTURE only, never the content):`,
    `{"dayNumber":3,"title":"...","titleUi":"...","kind":"TEACHING",`,
    `"part1":{"type":"PATTERN_DRILL","items":[{"term":"...",`,
    `"substitution":{"base":"I would like ___","slots":["a coffee","water"]}}]},`,
    `"part2":{"type":"REAL_APPLICATION","scenario":"...","questions":[{"id":"q1",`,
    `"prompt":"...","options":["...","..."],"correctIndex":0,"explanation":"...","linkedTerm":"..."}]},`,
    `"newCards":[{"term":"...","meaning":"...","example":"...","exampleTranslation":"..."}]}`,
  ].join('\n');
}

/** ورودی مرحلهٔ A — همان ورودی درس + فهرست واژه‌های شناخته‌شده */
function buildLessonSkeletonUserPrompt(
  input: CycleGenerationInput,
  day: OutlineDay,
  outline: CycleOutline,
  knownTerms: string[]
): string {
  const profile = dayProfile(day.dayNumber);
  const objective = day.objective ?? profile.objective;

  return [
    `Cycle: ${outline.title} — ${outline.focusSummary}`,
    `Full outline: ${outline.days.map((d) => `D${d.dayNumber}(${d.kind}) ${d.title}`).join(' | ')}`,
    '',
    `NOW WRITE DAY ${day.dayNumber}: "${day.title}" (kind ${day.kind}).`,
    `Day objective: ${objective}`,
    `Day phase: ${profile.phase} — ${profile.emphasis}`,
    '',
    deltaBlock(input, true),
    '',
    `Content budget for this day (do not exceed):`,
    `- part1 items: ${profile.items.min}-${profile.items.max}`,
    `- part2 questions: ${profile.part2.min}-${profile.part2.max}`,
    `- share of items that must be BRAND NEW: ${Math.round(profile.newItemRatio * 100)}%`,
    `- the rest must REVIEW items from earlier days of this cycle.`,
    '',
    `Rules for this day:`,
    `- part1.items: give ONLY "term" + a "substitution" frame. No meaning/example.`,
    `- "substitution": base with ___ ; exactly 3 slots where ONLY ONE is correct`,
    `  (the other two look similar but are wrong); set "correctIndex".`,
    `  ⚠️ Slots are short complements (1-5 words) — never a full sentence.`,
    `- ${knownTerms.length} term(s) already have cards: reuse them by name, do NOT re-describe them.`,
    `- If WEAK TERMS were listed above, they are the PREFERRED SOURCE for the REVIEW`,
    `  share of this day — never for the BRAND NEW share. The budget above wins.`,
    `- Do NOT produce "explanation", "pattern", "patternTranslation", "dialogue" or`,
    `  "scenarioTranslation" — they are not part of the schema.`,
    `- dayNumber MUST be ${day.dayNumber}, kind MUST be ${day.kind}.`,
    `- title/titleUi should match the outline: "${day.title}".`,
  ].join('\n');
}

// ═════════════════════════════════════════════════════════════════════
// Gemini responseSchema (OpenAPI 3.0 subset)
//
// ⚠️ دو اسکیمای جدا: یک درس / طرح کلی (outline). هر تسک اسکیمای خودش را
// می‌گیرد. مسیر legacy «کل چرخهٔ ۷ درسی» حذف شد (با سقف ۸۱۹۲ توکن
// همیشه می‌شکست و فقط سهمیهٔ AI را می‌سوزاند).
// ═════════════════════════════════════════════════════════════════════

const KIND_ENUM = ['TEACHING', 'HIDDEN_ASSESSMENT', 'CONSOLIDATION'];

/** رشتهٔ اسکیما با توضیح اختیاری */
function jsonStr(description?: string): Record<string, unknown> {
  return { type: 'string', ...(description ? { description } : {}) };
}

/** اسکیمای یک آیتم واژه */
function patternDrillItemJson(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      term: jsonStr('The target-language word or phrase'),
      meaning: jsonStr('Meaning in the learner UI language'),
      pronunciation: jsonStr('Optional romanisation'),
      example: jsonStr('Example sentence in the target language'),
      exampleTranslation: jsonStr('Translation into the learner UI language'),
      speakText: jsonStr('Clean speakable form of the TERM (not the example), for TTS'),
      meaningOptions: {
        type: 'object',
        properties: {
          options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
          correctIndex: { type: 'integer', minimum: 0, maximum: 2 },
        },
        required: ['options', 'correctIndex'],
      },
      exampleOptions: {
        type: 'object',
        properties: {
          options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
          correctIndex: { type: 'integer', minimum: 0, maximum: 2 },
        },
        required: ['options', 'correctIndex'],
      },
      substitution: {
        type: 'object',
        properties: {
          base: jsonStr('Base sentence with a slot'),
          slots: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
          correctIndex: { type: 'integer', minimum: 0, maximum: 2 },
        },
        required: ['base', 'slots', 'correctIndex'],
      },
    },
    required: ['term', 'meaning', 'example', 'meaningOptions', 'exampleOptions'],
  };
}

/** اسکیمای یک سوال کاربرد واقعی */
function applicationQuestionJson(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      id: jsonStr(),
      prompt: jsonStr(),
      options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
      correctIndex: { type: 'integer', minimum: 0, maximum: 4 },
      explanation: jsonStr(),
      linkedTerm: jsonStr('Term to record in the Leitner box'),
    },
    required: ['id', 'prompt', 'options', 'correctIndex'],
  };
}

/**
 * اسکیمای یک درس تنها — برای فراخوانی ماژولار (تولید روز به روز).
 *
 * ⚠️ مستقل ساخته می‌شود (نه استخراج‌شده از اسکیمای چرخه) تا با حذف مسیر
 * legacy، اسکیمای چرخه کاملاً از کد برود. باگ قبلی `properties =
 * lessonItem` (به‌جای `lessonItem.properties`) هم دیگر قابل تکرار نیست.
 */
function buildLessonJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      dayNumber: { type: 'integer', minimum: 1, maximum: 7 },
      title: jsonStr('Target-language title'),
      titleUi: jsonStr('Title in the learner UI language'),
      kind: { type: 'string', enum: KIND_ENUM },
      part1: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['PATTERN_DRILL'] },
          items: { type: 'array', items: patternDrillItemJson(), minItems: 3, maxItems: 12 },
        },
        required: ['type', 'items'],
      },
      part2: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['REAL_APPLICATION'] },
          scenario: jsonStr('Real-world scenario in the UI language'),
          questions: {
            type: 'array',
            items: applicationQuestionJson(),
            minItems: 2,
            maxItems: 10,
          },
        },
        required: ['type', 'scenario', 'questions'],
      },
    },
    required: ['dayNumber', 'title', 'titleUi', 'kind', 'part1', 'part2'],
  };
}

/** اسکیمای «اسکلت» درس — آیتم‌ها فقط `term` دارند، جزئیات در `newCards` */
function buildLessonSkeletonJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      dayNumber: { type: 'integer', minimum: 1, maximum: 7 },
      title: jsonStr('Target-language title'),
      titleUi: jsonStr('Title in the learner UI language'),
      kind: { type: 'string', enum: KIND_ENUM },
      part1: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['PATTERN_DRILL'] },
          items: {
            type: 'array',
            minItems: 3,
            maxItems: 12,
            items: {
              type: 'object',
              properties: {
                term: jsonStr('The target-language word or phrase'),
                substitution: {
                  type: 'object',
                  properties: {
                    base: jsonStr('Base sentence with a slot'),
                    slots: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
                    correctIndex: { type: 'integer', minimum: 0, maximum: 2 },
                  },
                  required: ['base', 'slots', 'correctIndex'],
                },
              },
              required: ['term'],
            },
          },
        },
        required: ['type', 'items'],
      },
      part2: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['REAL_APPLICATION'] },
          scenario: jsonStr('Real-world scenario in the UI language'),
          questions: {
            type: 'array',
            items: applicationQuestionJson(),
            minItems: 2,
            maxItems: 10,
          },
        },
        required: ['type', 'scenario', 'questions'],
      },
      newCards: {
        type: 'array',
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            term: jsonStr('The target-language word or phrase'),
            meaning: jsonStr('Meaning in the learner UI language'),
            pronunciation: jsonStr('Optional romanisation'),
            example: jsonStr('One short example sentence in the target language'),
            exampleTranslation: jsonStr('Translation into the learner UI language'),
          },
          required: ['term', 'meaning', 'example'],
        },
      },
    },
    required: ['dayNumber', 'title', 'titleUi', 'kind', 'part1', 'part2'],
  };
}

/**
 * اسکیمای طرح کلی (outline) — سبک و ارزان: فقط عنوان و نوع و هدف هر روز.
 */
function buildOutlineJsonSchema(): Record<string, unknown> {
  const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });
  return {
    type: 'object',
    properties: {
      title: str('Cycle title in the target language'),
      titleUi: str('Cycle title in the learner UI language'),
      focusSummary: str('One-paragraph summary in the UI language'),
      days: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        items: {
          type: 'object',
          properties: {
            dayNumber: { type: 'integer', minimum: 1, maximum: 7 },
            title: str('Short target-language title for this day'),
            titleUi: str('Same title in the learner UI language'),
            kind: { type: 'string', enum: KIND_ENUM },
            objective: str('One-sentence learning goal for this day'),
            objectiveFa: str('The goal rendered in the learner UI language'),
          },
          required: ['dayNumber', 'title', 'titleUi', 'kind'],
        },
      },
    },
    required: ['title', 'titleUi', 'focusSummary', 'days'],
  };
}

/**
 * اسکیمای JSON را به‌صورت متنی به پرامپت می‌چسباند.
 *
 * ⚠️ چرا: providerهای OpenAI-compatible و Anthropic اسکیمای ساختاریافتهٔ
 * بومی ندارند. بدون این بلوک، مدل شکل خروجی را از توضیحات پرامپت حدس می‌زند
 * و اغلب کلید کم/زیاد می‌کند → `schema: … Required` یا
 * `Invalid literal value`. این بلوک شکل دقیق را قفل می‌کند.
 */
function withSchemaInstruction(userPrompt: string, jsonSchema: unknown): string {
  return [
    userPrompt,
    '',
    'Your response MUST be a single JSON object that validates against this JSON Schema.',
    'Use exactly these keys, this nesting and these enum values — no extra keys, no omissions:',
    compactSchema(jsonSchema),
  ].join('\n');
}

/** حذف `description`ها برای فشرده‌سازی اسکیما (صرفه‌جویی توکن ورودی) */
function compactSchema(node: unknown): string {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === 'description') continue;
        out[k] = strip(v);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify(strip(node));
}

/**
 * انتخاب اسکیمای درست بر اساس برچسب تسک.
 *
 * برچسب‌ها از `generateOutline` (`outline`) و `generateLesson`
 * (`lesson-<n>`) می‌آیند. هر برچسب ناشناخته → اسکیمای درس (محافظه‌کارانه‌ترین
 * گزینه؛ دیگر مسیر «کل چرخه» وجود ندارد).
 */
export function jsonSchemaFor(tag: string): unknown {
  if (tag === 'outline') return buildOutlineJsonSchema();
  if (tag === 'lesson-skeleton') return buildLessonSkeletonJsonSchema();
  return buildLessonJsonSchema();
}

/**
 * نرمال‌سازی عنوان‌ها در outline (سازگاری با کش قدیمی `titleFa`).
 *
 * ⚠️ ورودی عامداً «شل» تعریف شده: `z.ZodType<T>` در `runChain` تبدیل
 * `.transform()` را از دست می‌دهد و T را با `titleUi?: string` استنتاج
 * می‌کند. پس اینجا صریحاً هر دو نام را می‌پذیریم و خروجی سخت‌گیرانه
 * (`titleUi: string`) می‌سازیم.
 */
function normalizeOutlineTitles(outline: {
  title: string;
  titleUi?: string;
  titleFa?: string;
  focusSummary: string;
  days: {
    dayNumber: number;
    title: string;
    titleUi?: string;
    titleFa?: string;
    kind: OutlineDay['kind'];
    objective?: string;
    objectiveFa?: string;
  }[];
}): CycleOutline {
  return {
    title: outline.title,
    titleUi: outline.titleUi ?? outline.titleFa ?? '',
    focusSummary: outline.focusSummary,
    days: outline.days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      titleUi: d.titleUi ?? d.titleFa ?? '',
      kind: d.kind,
      objective: d.objective,
      objectiveFa: d.objectiveFa,
    })),
  };
}

/** نرمال‌سازی عنوان یک درس (سازگاری با کش قدیمی) */
function normalizeLessonTitles(lesson: {
  dayNumber: number;
  title: string;
  titleUi?: string;
  titleFa?: string;
  kind: GeneratedLesson['kind'];
  part1: GeneratedLesson['part1'];
  part2: GeneratedLesson['part2'];
}): GeneratedLesson {
  return {
    dayNumber: lesson.dayNumber,
    title: lesson.title,
    titleUi: lesson.titleUi ?? lesson.titleFa ?? '',
    kind: lesson.kind,
    part1: lesson.part1,
    part2: lesson.part2,
  };
}

// ═════════════════════════════════════════════════════════════════════
// Post-processing
// ═════════════════════════════════════════════════════════════════════

/**
 * روز ۶ و ۷ باید نوع درست داشته باشند، حتی اگر مدل اشتباه بدهد.
 * (اسکیمای Zod هم چک می‌کند؛ این لایه دوم دفاع است.)
 */
function enforceSchedule(cycle: {
  title: string;
  titleUi?: string;
  titleFa?: string;
  focusSummary: string;
  lessons: {
    dayNumber: number;
    title: string;
    titleUi?: string;
    titleFa?: string;
    kind: GeneratedLesson['kind'];
    part1: GeneratedLesson['part1'];
    part2: GeneratedLesson['part2'];
  }[];
}): GeneratedCycle {
  return {
    title: cycle.title,
    titleUi: cycle.titleUi ?? cycle.titleFa ?? '',
    focusSummary: cycle.focusSummary,
    lessons: cycle.lessons.map((lesson) => {
      const expectedKind = CYCLE_SCHEDULE[lesson.dayNumber as 1 | 2 | 3 | 4 | 5 | 6 | 7];
      return normalizeLessonTitles(
        expectedKind ? { ...lesson, kind: expectedKind } : lesson
      );
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
