import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env } from './types';
import { ContentRepository } from './services/repository';
import { SupabaseClient } from './services/supabase';
import { runCycleGeneration, runLessonGeneration } from './routes/learn';
import {
  buildAudioOwnerKey,
  hasMediaBucket,
  mediaUrl,
  storeAudio,
} from './services/media';
import { cleanForSpeech, synthesizeSpeech } from './services/tts';

/**
 * ═════════════════════════════════════════════════════════════════════
 *  CycleGenerationWorkflow — تولید durable چرخهٔ ۷ روزه
 *  (Cloudflare Workflows · روی پلن رایگان هم فعال است)
 * ═════════════════════════════════════════════════════════════════════
 *
 *  چرا Workflow به‌جای Queue/Cron برای این کار:
 *
 *  • **گام‌های مستقل**: هر روز یک `step.do` جدا است. اگر روز ۵ شکست
 *    بخورد، فقط همان گام retry می‌شود — ۴ روز موفق دوباره ساخته نمی‌شوند.
 *  • **وضعیت پایدار**: اگر Worker کرش کند یا AI چند دقیقه قطع شود،
 *    instance از آخرین گام موفق ادامه می‌یابد (نه از اول).
 *  • **retry با backoff**: هر گام سیاست retry خودش را دارد.
 *  • **مدت نامحدود per step**: یک فراخوانی AI کند کل workflow را نمی‌کشد.
 *
 *  محدودیت‌های پلن رایگان (تأییدشده از مستندات رسمی): ۱٬۰۲۴ گام ·
 *  ۱۰۰ اجرای هم‌زمان · ۱۰۰٬۰۰۰ اجرا در روز · state ۱۰۰MB.
 *  برای یک چرخهٔ ۷ روزه با ۸ گام، این سقف عملاً نامحدود است.
 *
 *  ⚠️ ترتیب: چون هر step نتیجه‌اش کش می‌شود، _idها باید پایدار باشند
 *  (`day-1` نه `day-${Date.now()}`) وگرنه هر retry گام تازه می‌سازد و
 *  پایداری از بین می‌رود.
 * ═════════════════════════════════════════════════════════════════════
 */

export interface CycleWorkflowParams {
  userId: string;
  cycleNumber: number;
  /** فقط روز ۱ را بساز (برای پاسخ سریع به کاربر) */
  firstOnly?: boolean;
  /** صدfaهای تلفچ روزها را هم بساز (اگر R2 configured باشد) */
  withAudio?: boolean;
}

export class CycleGenerationWorkflow extends WorkflowEntrypoint<
  Env,
  CycleWorkflowParams
> {
  override async run(event: WorkflowEvent<CycleWorkflowParams>, step: WorkflowStep) {
    const { userId, cycleNumber, firstOnly = false, withAudio = false } = event.payload;

    // ── گام ۱: چرخه + outline + روز ۱ ────────────────────────────────
    // تنها بخشی که کاربر مستقیم منتظرش است؛ باید سریع تمام شود.
    const first = await step.do('cycle-outline-and-day-1', async () => {
      const res = await runCycleGeneration(this.env, userId, cycleNumber, {
        firstOnly: true,
      });
      if (!res.ok) throw new Error(res.error ?? 'day 1 failed');
      return res;
    });

    if (firstOnly) return { ok: true, mode: 'first-only', cycleNumber };

    // ── گام ۲: پیدا کردن cycleId برای مراحل بعدی ─────────────────────
    const cycleId = await step.do('resolve-cycle-id', async () => {
      const r = new ContentRepository(new SupabaseClient(this.env), this.env);
      const c = await r.getLatestCycle(userId);
      if (!c || c.cycle_number !== cycleNumber) return null;
      return c.id;
    });
    if (!cycleId) {
      return { ok: true, mode: 'full', cycleNumber, note: 'cycle id not found' };
    }

    // ── گام‌های ۳..۸: هر روز durable و مستقل ─────────────────────────
    const results: Record<number, boolean> = { 1: true };

    for (const day of [2, 3, 4, 5, 6, 7]) {
      // ⚠️ id پایدار لازم است تا retry همان گام را ادامه بدهد نه گام تازه
      const ok = await step.do(`lesson-day-${day}`, async () => {
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
      });
      results[day] = ok;
    }

    // ── گام اختیاری: صدfaهای تلفچ روز ۱ ─────────────────────────────
    // ⚠️ فقط وقتی R2 تنظیم شده. صدfaای روزهای ۲..۷ درخواستی است
    // (وقتی کاربر پخش می‌کند) تا ۵۰ فراخوانی بی‌مصرف نشود.
    let audioBuilt = 0;
    if (withAudio && hasMediaBucket(this.env)) {
      audioBuilt = await step.do('audio-day-1', async () => {
        const r = new ContentRepository(new SupabaseClient(this.env), this.env);
        const lessons = await r.getLessonsForCycle(cycleId);
        const day1 = lessons.find((l) => l.day_number === 1);
        if (!day1) return 0;
        return this.buildLessonAudio(r, day1, cycleId, 1);
      });
    }

    const failedDays = Object.entries(results)
      .filter(([, ok]) => !ok)
      .map(([day]) => Number(day));

    return {
      ok: failedDays.length === 0,
      mode: 'full',
      cycleNumber,
      failedDays,
      audioBuilt,
    };
  }

  /**
   * صدfaهای تلفچ یک درس: واژه‌ها + مثال‌ها + خطوط دیالوگ.
   *
   * ⚠️ هر کلیپ از `speakText` ساخته می‌شود نه از `example` — چون
   * `speakText` نسخهٔ پاک‌شده از نشانه‌های نوشتاری است.
   * ⚠️ فقط روز ۱: بقیه درخواستی‌اند (route `media/speak`).
   */
  private async buildLessonAudio(
    r: ContentRepository,
    lesson: {
      id: string;
      day_number: number;
      part_1_data: unknown;
      part_2_data: unknown;
    },
    _cycleId: string,
    dayNumber: number
  ): Promise<number> {
    const language = (lesson.part_1_data as { language?: string })?.language ?? 'en';
    const texts: string[] = [];

    const p1 = lesson.part_1_data as {
      items?: { term?: string; example?: string; speakText?: string }[];
    };
    for (const item of p1?.items ?? []) {
      const spoken = cleanForSpeech(item.speakText ?? item.example ?? '');
      if (spoken) texts.push(spoken);
    }

    const p2 = lesson.part_2_data as {
      dialogue?: { text?: string; speakText?: string }[];
    };
    for (const line of p2?.dialogue ?? []) {
      const spoken = cleanForSpeech(line.speakText ?? line.text ?? '');
      if (spoken) texts.push(spoken);
    }

    let built = 0;
    for (const text of texts) {
      const ownerKey = buildAudioOwnerKey(language, text, 'default');
      const existing = await r.findMediaByOwnerKey('AUDIO', ownerKey);
      if (existing) continue; // قبلاً ساخته شده

      const tts = await synthesizeSpeech(this.env, text, language);
      if (!tts.ok || !tts.audio) continue;

      await storeAudio(this.env, r, {
        audio: tts.audio,
        language,
        ownerKey,
        voice: 'default',
        source: this.env.TTS_PROVIDER ?? 'online-tts',
      });
      built += 1;
    }
    return built;
  }
}
