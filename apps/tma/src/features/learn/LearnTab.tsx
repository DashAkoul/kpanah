import { useTranslation } from 'react-i18next';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Roadmap } from './Roadmap';
import { LessonCard } from './LessonCard';
import { useHome } from '../../hooks/useApi';
import { useSessionStore } from '../../store/session';

/**
 * Learn tab.
 *
 * States, in priority order:
 *   1. loading
 *   2. no cycle yet / cycle generating  → generation screen
 *   3. cycle complete, next not ready   → locked screen
 *   4. active lesson                    → roadmap + lesson card
 */
export function LearnTab({ onStartLesson }: { onStartLesson: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useHome();
  const user = useSessionStore((s) => s.user);

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

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="text-4xl">📡</span>
        <p className="text-sm text-text-hint">{t('errors.network')}</p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  // ── 2. Generating / no cycle ──────────────────────────────────────
  if (!data.cycle) {
    return (
      <GeneratingState
        generating={data.generating}
        onRefresh={() => void refetch()}
      />
    );
  }

  // ── 3. Cycle finished, next not ready ─────────────────────────────
  if (!data.lesson) {
    return <CycleCompleteState />;
  }

  // ── 4. Active lesson ──────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">
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
