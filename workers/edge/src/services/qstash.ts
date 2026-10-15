import type { Env } from '../types';

/**
 * Upstash QStash — serverless async queue.
 *
 * Used for the long-running cycle generation (Delta Patching). A 7-day
 * cycle can take 30-90s of model time; far too long for an edge request.
 *
 * Flow:
 *   complete-lesson(day 7) → enqueue → QStash → POST /internal/queue?internal=generate-cycle
 */

export interface GenerateCycleMessage {
  kind: 'generate-cycle';
  userId: string;
  cycleNumber: number;
  attempt?: number;
}

/**
 * تولید یک درس در پس‌زمینه (تولید ماژولار).
 *
 * پس از آماده شدن «نقشهٔ» چرخه و روز ۱، هر روز باقی‌مانده یک job جدا می‌شود
 * تا هر درخواست فقط یک فراخوانی AI داشته باشد (خطای کمتر + retry ارزان).
 */
export interface GenerateLessonMessage {
  kind: 'generate-lesson';
  userId: string;
  cycleId: string;
  cycleNumber: number;
  dayNumber: number;
  attempt?: number;
}

export type QueueMessage = GenerateCycleMessage | GenerateLessonMessage;

export class QStashClient {
  private readonly token?: string;
  private readonly selfUrl?: string;

  constructor(private env: Env) {
    this.token = env.QSTASH_TOKEN;
    this.selfUrl = env.SELF_URL;
  }

  get available(): boolean {
    return Boolean(this.token && this.selfUrl);
  }

  async enqueue(
    message: QueueMessage,
    options: { delaySeconds?: number; retries?: number } = {}
  ): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    if (!this.available) {
      return { ok: false, error: 'QStash not configured (QSTASH_TOKEN / SELF_URL missing)' };
    }

    const url = `${this.selfUrl}/internal/queue?internal=${encodeURIComponent(message.kind)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': String(options.retries ?? 2),
      'Upstash-Method': 'POST',
    };

    if (options.delaySeconds) {
      headers['Upstash-Delay'] = `${options.delaySeconds}s`;
    }

    try {
      const res = await fetch(`https://qstash.upstash.io/v2/publish/${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });

      if (!res.ok) {
        return { ok: false, error: `QStash ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }

      const json = (await res.json()) as { messageId?: string };
      return { ok: true, messageId: json.messageId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * مسیر جایگزین: اگر QStash تنظیم نشده باشد، کار را با waitUntil
   * در پس‌زمینه همان isolate اجرا می‌کنیم (برای dev و استقرارهای کوچک).
   */
  get supportsInlineFallback(): boolean {
    return true;
  }
}
