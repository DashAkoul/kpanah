import { useTranslation } from 'react-i18next';
import { Card, Button, ProgressBar } from '../../components/ui';
import type { ResultData } from '../../app/AppShell';
import { haptic } from '../../lib/telegram';

/**
 * Post-lesson summary.
 *
 * Tone matters here: this is the moment that decides whether the learner
 * comes back tomorrow. Celebrate progress, never punish mistakes, and
 * never reveal that day 6 was an assessment.
 */
export function LessonResult({
  result,
  onContinue,
}: {
  result: ResultData;
  onContinue: () => void;
}) {
  const { t } = useTranslation();

  const isGreat = result.score.score >= 85;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 py-10">
      {/* Celebration */}
      <div className="text-6xl">{isGreat ? '🎉' : '💪'}</div>

      <div className="text-center">
        <h2 className="text-lg font-bold text-text">
          {result.appLocked ? t('learn.lockedTitle') : t('learn.lessonComplete')}
        </h2>
        <p className="mt-1 text-xs text-text-hint">
          {t('learn.daysCompleted', {
            done: result.dayNumber,
            total: 7,
          })}
        </p>
      </div>

      {/* Score card */}
      <Card className="w-full">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label={t('learn.score')} value={`${result.score.score}`} accent />
          <Metric label={t('learn.accuracy')} value={`${result.score.accuracy}%`} />
          <Metric label={t('learn.speedBonus')} value={`${result.score.speedBonus}%`} />
        </div>

        <div className="mt-4">
          <ProgressBar
            value={result.score.score}
            height={8}
            color={
              isGreat
                ? 'var(--success-500, #16a34a)'
                : 'var(--tg-theme-button-color, #2563eb)'
            }
          />
        </div>
      </Card>

      {/* Rewards */}
      <div className="flex w-full gap-2">
        <Card className="flex flex-1 items-center justify-center gap-2 py-3">
          <span className="text-lg">⭐</span>
          <span className="text-sm font-bold text-text">
            {t('learn.rewardEarned', { count: result.reward }).replace('+', '')}
          </span>
        </Card>

        <Card className="flex flex-1 items-center justify-center gap-2 py-3">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-text">{result.streak}</span>
        </Card>
      </div>

      {/* Cycle completion message */}
      {result.cycleCompleted && (
        <Card className="w-full border-success-500/30 bg-success-100/50">
          <p className="text-center text-sm leading-relaxed text-text">
            {result.nextCycleTriggered
              ? '🏆 چرخه را کامل کردی! چرخه بعدی در حال ساخت است.'
              : t('learn.lockedMessage')}
          </p>
        </Card>
      )}

      <Button fullWidth size="lg" onClick={() => { haptic('tap'); onContinue(); }}>
        {t('common.continue')}
      </Button>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-text-hint">{label}</p>
      <p
        className={
          accent
            ? 'text-xl font-bold text-accent'
            : 'text-xl font-bold text-text'
        }
      >
        {value}
      </p>
    </div>
  );
}
