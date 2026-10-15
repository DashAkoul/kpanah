import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env } from './types';
import { ContentRepository } from './services/repository';
import { SupabaseClient } from './services/supabase';
import { runCycleGeneration, runLessonGeneration } from './routes/learn';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  CycleGenerationWorkflow — تولید durable چرخهٔ ۷ روزه
 *  (Cloudflare Workflows · در پلن رایگان هم فعال است)
 *
 *  هر روز یک `step.do` جداگانه است: اگر یک روز شکست بخورد، فقط همان
 *  مرحله retry می‌شود — نه کل چرخه از اول.
 *
 *  چرا Workflow نه cron/Cron:
 *  - وضعیت بین مراحل ذخیره می‌شود (durable) — اگر Worker کرش کند،
 *    از آخرین مرحلهٔ موفق ادامه می‌یابد.
 *  - retry خودکار با backoff.
 *  - می‌تواند ساعت‌ها / روزها زنده بماند.
 *  - رایگان هم هست: https://developers.cloudflare.com/workflows
 * ═════════════════════════════════════════════════════════════════════
 */

export interface CycleWorkflowParams {
  userId: string;
  cycleNumber: number;
  /** ساخت همهٔ ۷ روز در همین workflow (پس‌زمینهٔ کامل) */
  full?: boolean;
}

export class CycleGenerationWorkflow extends WorkflowEntrypoint<
  Env,
  CycleWorkflowParams
> {
  override async run(event: WorkflowEvent<CycleWorkflowParams>, step: WorkflowStep) {
    const { userId, cycleNumber, full = true } = event.payload;

    // ── مرحلهٔ ۱: ساخت چرخه + outline + روز ۱ ──────────────────────
    // این مرحله timeline طولانی دارد (چند فراخوانی AI) ولی فقط یک بار
    // اجرا می‌شود؛ اگر شکست بخورد کل مرحله retry می‌شود.
    const cycle = await step.do(
      'generate cycle outline + day 1',
      { retries: { limit: 2, delay: '10 seconds', backoff: 'exponential' } },
      async () => {
        const res = await runCycleGeneration(this.env, userId, cycleNumber, {
          firstOnly: !full,
        });
        return res;
      }
    );

    if (!cycle.ok) {
      throw new Error(`cycle generation failed: ${cycle.error ?? 'unknown'}`);
    }

    if (!full) {
      return { ok: true, mode: 'first-only', cycleNumber };
    }

    // ── یافتن cycleId برای مراحل بعدی ──────────────────────────────
    const cycleId = await step.do('resolve cycle id', async () => {
      const r = new ContentRepository(new SupabaseClient(this.env), this.env);
      const c = await r.getLatestCycle(userId);
      if (!c || c.cycle_number !== cycleNumber) return null;
      return c.id;
    });

    if (!cycleId) {
      return { ok: true, mode: 'full', cycleNumber, note: 'cycle id not found' };
    }

    // ── مراحل ۲..۸: هر روز به‌صورت durable جدا ─────────────────────
    // روز ۱ قبلاً ساخته شده. بقیه در اینجا با retry مستقل.
    const days = [2, 3, 4, 5, 6, 7];
    const results: Record<number, boolean> = { 1: true };

    for (const day of days) {
      const ok = await step.do(
        `generate lesson day ${day}`,
        { retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' } },
        async () => {
          try {
            const res = await runLessonGeneration(
              this.env,
              userId,
              cycleId,
              cycleNumber,
              day
            );
            return res.ok;
          } catch {
            return false;
          }
        }
      );
      results[day] = ok;
    }

    const failed = Object.entries(results)
      .filter(([, ok]) => !ok)
      .map(([day]) => Number(day));

    return { ok: true, mode: 'full', cycleNumber, failedDays: failed };
  }
}
