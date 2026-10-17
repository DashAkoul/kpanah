import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Roadmap } from './Roadmap';
import { LessonCard } from './LessonCard';
import { useHome, useRetryCycle, useDueReviews } from '../../hooks/useApi';
import { ReviewSession } from './ReviewSession';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';

/**
 * Learn tab.
 *
 * States, in priority order:
 *   1. loading
 *   2. generation failed                 → error screen + retry
 *   3. no cycle yet / cycle generating   → generation screen
 *   4. cycle complete, next not ready    → locked screen
 *   5. active lesson                     → roadmap + lesson card
 */
export function LearnTab({ onStartLesson }: { onStartLesson: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isRefetching, error, refetch } = useHome();
  const user = useSessionStore((s) => s.user);
  const retry = useRetryCycle();
  const due = useDueReviews();
  const [reviewOpen, setReviewOpen] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  /**
   * دکمهٔ «تلاش مجدد».
   *
   * ⚠️ باگ رفع‌شده: قبلاً فقط `refetch` می‌زد → همان وضعیت FAILED برمی‌گشت
   * و کاربر هیچ فیدبکی نمی‌گرفت («شبیه دکمه رفتار نمی‌کند»). حالا تولید
   * واقعاً از سر گرفته می‌شود، دکمه حالت loading می‌گیرد و نتیجه با toast
   * اعلام می‌شود — هم موفق هم خطا.
   */
  const handleRetry = () => {
    retry.mutate(undefined, {
      onSuccess: (res) => {
        if (res.alreadyGenerating) {
          showToast(t('learn.retryAlreadyRunning'), 'info');
          return;
        }
        // «recovered: activated» یعنی درس آماده بود ولی چرخه فعال نشده بود
        // (باگ چرخهٔ گیرکرده). پیام دقیق‌تر کمک می‌کند کاربر بفهمد چه شد.
        if (res.recovered === 'activated') {
          showToast(t('learn.retryActivated'), 'success');
          return;
        }
        showToast(t('learn.retryStarted'), 'success');
      },
      onError: () => {
        showToast(t('learn.retryFailed'), 'error');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="skeleton h-24" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  // ⚠️ این شاخه «خطای شبکه» است نه «شکست تولید» — اکشن درست `refetch`
  // است (دوباره خواندن)، نه `retryCycle` (شروع تولید از نو).
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="text-4xl">📡</span>
        <p className="text-sm text-text-hint">{t('errors.network')}</p>
        <Button
          variant="secondary"
          size="sm"
          loading={isRefetching}
          onClick={() => {
            // فیدبک لازم است: بدون آن کاربر نمی‌داند دکمه کار کرد یا نه
            void refetch().then((res) => {
              if (res.isError) showToast(t('errors.network'), 'error');
            });
          }}
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  // ── 2. Generation failed ───────────────────────────────────────────
  // ⚠️ باید قبل از `!data.cycle` بررسی شود: حالا که API چرخهٔ FAILED را هم
  // برمی‌گرداند، بدون این شرط به «چرخه کامل شد» می‌افتادیم که گمراه‌کننده است.
  if (data.generationStatus === 'FAILED') {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="text-4xl">🛠</span>
        <p className="text-sm font-semibold text-text">{t('learn.generationFailed')}</p>
        <p className="max-w-[280px] text-[11px] leading-relaxed text-text-hint">
          {t('learn.generationFailedHint')}
        </p>
        {data.generationError && (
          <p
            className="max-w-[280px] rounded-lg border border-border bg-card p-2 text-left font-mono text-[9px] leading-relaxed text-text-muted"
            dir="ltr"
          >
            {data.generationError.slice(0, 200)}
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={retry.isPending}
          onClick={handleRetry}
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  // ── 3. Generating / no cycle ──────────────────────────────────────
  //
  // ⚠️ باگ رفع‌شده: قبلاً اول `!data.cycle` چک می‌شد و بعد `!data.lesson`.
  // اما وقتی چرخه تازه ساخته شده (onboarding)، `cycle` هست ولی `lesson`
  // هنوز `null` است چون محتوا در حال تولید است. نتیجه: کاربر تازه‌ای که
  // هیچ درسی نرفته بود، به‌جای اسپینر «در حال تولید»، صفحهٔ «برنامه قفل
  // شد» را می‌دید — گمراه‌کننده‌ترین حالت ممکن.
  //
  // رفع: اگر `generating` روشن است (یا چرخه‌ای وجود ندارد)، همیشه حالت
  // تولید را نشان بده — حتی وقتی شیء چرخه در پاسخ هست.
  if (data.generating || !data.cycle) {
    return (
      <GeneratingState generating={data.generating} onRefresh={handleRetry} />
    );
  }

  // ── 4. Cycle finished, next not ready ─────────────────────────────
  if (!data.lesson) {
    return <CycleCompleteState />;
  }

  // ── 4. Active lesson ──────────────────────────────────────────────
  const dueItems = due.data?.items ?? [];

  return (
    <div className="space-y-4 p-4">
      {/* مرور آزاد — واژه‌هایی که فاصلهٔ لایتنرشان سر رسیده */}
      {dueItems.length > 0 && (
        <Card className="border-brand-200 bg-brand-50/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">
                🔁 {t('review.cardTitle', { count: dueItems.length })}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-hint">
                {t('review.cardBody')}
              </p>
            </div>
            <Button size="sm" onClick={() => setReviewOpen(true)}>
              {t('review.start')}
            </Button>
          </div>
        </Card>
      )}

      {reviewOpen && dueItems.length > 0 && (
        <ReviewSession items={dueItems} onClose={() => setReviewOpen(false)} />
      )}
      {/* Cycle header */}
      <div>
        <h1 className="text-lg font-bold leading-snug text-text">
          {t('learn.cycleTitle', {
            number: data.cycle.cycleNumber,
            title: data.cycle.titleFa ?? data.cycle.title,
          })}
        </h1>
        {data.cycle.focusSummary && (
          <p className="mt-1 text-xs leading-relaxed text-text-hint">
            {data.cycle.focusSummary}
          </p>
        )}
      </div>

      {/* Roadmap */}
      <Card>
        <p className="mb-3 text-xs font-semibold text-text-hint">
          🗺 {t('learn.roadmap')}
        </p>
        <Roadmap days={data.cycle.days} />
      </Card>

      {/* Today's lesson */}
      <LessonCard
        lesson={data.lesson}
        dayNumber={data.lesson.dayNumber}
        completedDays={data.cycle.progress.completedDays}
        totalDays={data.cycle.progress.totalDays}
        onStart={onStartLesson}
      />

      {/* Streak nudge */}
      {user && user.streakCount > 0 && (
        <p className="pb-2 text-center text-xs text-text-muted">
          🔥 {user.streakCount} {t('learn.streak')}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function GeneratingState({
  generating,
  onRefresh,
}: {
  generating: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="text-5xl">{generating ? '✨' : '🌱'}</div>

      <h2 className="text-base font-bold text-text">
        {generating ? t('learn.generating') : t('onboarding.welcome')}
      </h2>

      <p className="max-w-xs text-sm leading-relaxed text-text-hint">
        {generating ? t('learn.generatingHint') : t('onboarding.welcomeHint')}
      </p>

      {generating && (
        <div className="flex gap-1.5 pt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-accent"
              style={{ animationDelay: `${i * 250}ms` }}
            />
          ))}
        </div>
      )}

      <Button variant="secondary" size="sm" onClick={onRefresh}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

function CycleCompleteState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
      <div className="text-5xl">🔒</div>

      <h2 className="text-lg font-bold text-text">{t('learn.lockedTitle')}</h2>

      <p className="max-w-xs text-sm leading-relaxed text-text-hint">
        {t('learn.lockedMessage')}
      </p>

      <Card className="mt-2 w-full">
        <ProgressBar value={7} max={7} color="var(--success-500, #16a34a)" />
        <p className="mt-2 text-xs text-text-hint">
          {t('learn.daysCompleted', { done: 7, total: 7 })}
        </p>
      </Card>

      <p className="pt-2 text-xs text-text-muted">بازگشت به‌زودی 🚀</p>
    </div>
  );
}
