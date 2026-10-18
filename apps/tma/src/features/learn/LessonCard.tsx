import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@kpanah/shared';
import { Card, ProgressBar } from '../../components/ui';

/**
 * Today's lesson card with the two locked parts:
 *   Part 1 — patterns & vocabulary   (unlocks first)
 *   Part 2 — real-world application  (unlocks after Part 1)
 */
export function LessonCard({
  lesson,
  dayNumber,
  completedDays,
  totalDays,
  part1Done,
  onStart,
}: {
  lesson: Lesson;
  dayNumber: number;
  completedDays: number;
  totalDays: number;
  /** بخش ۱ تمام شده → بخش ۲ (و ۳) باز می‌شود */
  part1Done: boolean;
  onStart: (part?: 1 | 2 | 3) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <Card>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-text-hint">{t('learn.todayLesson')}</p>
            <h2 className="mt-0.5 truncate text-base font-bold text-text">
              {t('common.day')} {dayNumber}
            </h2>
          </div>
          <span className="chip shrink-0 bg-brand-50 text-brand-600">
            {completedDays}/{totalDays}
          </span>
        </div>
        <ProgressBar value={completedDays} max={totalDays} />
      </Card>

      {/* Lesson title */}
      <Card>
        <h1 className="text-lg font-bold leading-snug text-text">
          {lesson.titleFa ?? lesson.title}
        </h1>
        <p className="mt-1 text-xs text-text-hint target-text" dir="ltr">
          {lesson.title}
        </p>
      </Card>

      {/* Parts */}
      <div className="space-y-2">
        <PartRow
          label={t('learn.part1')}
          subtitle={t('learn.subtitlePattern')}
          icon="🧩"
          itemCount={lesson.part1.items.length}
          unlocked
          done={part1Done}
          onStart={() => onStart(1)}
          ctaLabel={part1Done ? t('common.continue') : t('common.start')}
        />
        <PartRow
          label={t('learn.part2')}
          subtitle={t('learn.subtitleApplication')}
          icon="🌍"
          itemCount={lesson.part2.questions.length}
          unlocked={part1Done}
          onStart={() => onStart(2)}
          ctaLabel={part1Done ? t('common.start') : t('common.locked')}
        />
        {lesson.part3 && (
          <PartRow
            label={t('learn.part3')}
            subtitle={t('learn.subtitleStory')}
            icon="📖"
            itemCount={lesson.part3.lines.length}
            unlocked={part1Done}
            onStart={() => onStart(3)}
            ctaLabel={part1Done ? t('common.start') : t('common.locked')}
          />
        )}
      </div>
    </div>
  );
}

function PartRow({
  label,
  subtitle,
  icon,
  itemCount,
  unlocked,
  done,
  onStart,
  ctaLabel,
}: {
  label: string;
  subtitle: string;
  icon: string;
  itemCount: number;
  unlocked: boolean;
  done?: boolean;
  onStart: () => void;
  ctaLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className={clsx('flex items-center gap-3', !unlocked && 'opacity-60')}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-lg">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">
          {label} {done ? '✅' : ''}
        </p>
        <p className="text-[11px] text-text-hint">
          {subtitle} · {itemCount} {t('common.day') === 'Day' ? 'items' : 'آیتم'}
        </p>
      </div>

      <button
        type="button"
        onClick={unlocked ? onStart : undefined}
        disabled={!unlocked}
        className={clsx(
          'shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-95',
          unlocked
            ? 'bg-accent text-accent-text'
            : 'bg-[var(--surface-sunken)] text-text-muted'
        )}
      >
        {unlocked ? `🟢 ${ctaLabel}` : `🔒 ${ctaLabel}`}
      </button>
    </Card>
  );
}
