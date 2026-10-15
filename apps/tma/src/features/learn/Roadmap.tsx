import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { CycleDay } from '@kpanah/shared';

/**
 * 7-day roadmap — the snake layout from the spec:
 *   [1] → [2] → [3] → [4]
 *                    ↓
 *   [7] ← [6] ← [5]
 */
export function Roadmap({ days }: { days: CycleDay[] }) {
  const { t, i18n } = useTranslation();

  const row1 = days.slice(0, 4);
  const row2 = days.slice(4, 7).reverse(); // 7, 6, 5
  const activeDay = days.find((d) => d.isActive);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {row1.map((day, i) => (
          <div key={day.dayNumber} className="flex flex-1 items-center gap-1.5">
            <DayNode day={day} />
            {i < row1.length - 1 && <Connector active={day.isCompleted} />}
          </div>
        ))}
      </div>

      <div className="flex flex-row-reverse items-center gap-1.5">
        {row2.map((day, i) => (
          <div key={day.dayNumber} className="flex flex-1 flex-row-reverse items-center gap-1.5">
            <DayNode day={day} />
            {i < row2.length - 1 && <Connector active={row2[i + 1]?.isCompleted ?? false} />}
          </div>
        ))}
      </div>

      <p className="pt-1 text-center text-[11px] text-text-muted">
        {t('learn.daysCompleted', {
          done: days.filter((d) => d.isCompleted).length,
          total: days.length,
        })}
      </p>

      {/* مرحلهٔ ۸ — هدف آموزشی روز فعال. یک خط کافی است؛ cram کردن در
          نودهای مارپیچ خوانا نیست. */}
      {activeDay && (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-center text-[10px] leading-relaxed text-text-hint">
          <span className="font-semibold text-accent">
            {t(`learn.phase.${activeDay.phase ?? 'TEACH'}`, {
              defaultValue: `Day ${activeDay.dayNumber}`,
            })}
          </span>
          {` — ${
            i18n.language === 'fa'
              ? (activeDay.objectiveFa ?? activeDay.objective)
              : activeDay.objective
          }`}
        </p>
      )}
    </div>
  );
}

function DayNode({ day }: { day: CycleDay }) {
  const { t } = useTranslation();

  const isAssessment = day.kind === 'HIDDEN_ASSESSMENT';
  const isConsolidation = day.kind === 'CONSOLIDATION';

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div
        className={clsx(
          'flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
          day.isCompleted && 'border-success-500 bg-success-100 text-success-500',
          day.isActive &&
            'border-accent bg-accent text-accent-text shadow-lift ring-accent-glow',
          day.isLocked && 'border-border bg-[var(--surface-sunken)] text-text-muted'
        )}
        aria-label={`${t('common.day')} ${day.dayNumber}`}
      >
        {day.isCompleted ? '✓' : day.isLocked ? '🔒' : day.dayNumber}
      </div>

      <span
        className={clsx(
          'text-[10px] leading-tight',
          day.isActive ? 'font-semibold text-accent' : 'text-text-muted'
        )}
      >
        {isAssessment ? '📝' : isConsolidation ? '🔄' : `${t('common.day')} ${day.dayNumber}`}
      </span>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div
      className={clsx(
        'h-0.5 flex-1 rounded-full transition-colors',
        active ? 'bg-success-500' : 'bg-border'
      )}
    />
  );
}
