import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Lesson, PatternDrillItem, ApplicationQuestion } from '@kpanah/shared';
import { Card, Button, ProgressBar } from '../../components/ui';
import { useLessonSession } from '../../store/session';
import { haptic } from '../../lib/telegram';

/**
 * Lesson player.
 *
 * Flow: Part 1 (pattern items, one per screen) → Part 2 (scenario + MCQ).
 * Every answer is timed and buffered in the session store; only the
 * completed lesson is submitted, so a mid-lesson drop loses nothing but
 * the current item.
 *
 * Deliberately absent: any hint that a given day is an assessment.
 * (Day 6 uses this exact component with no visual difference.)
 */
export function LessonPlayer({
  lesson,
  onFinish,
  onExit,
}: {
  lesson: Lesson;
  onFinish: (answers: {
    itemId: string;
    isCorrect: boolean;
    responseMs: number;
    linkedTerm?: string;
    usedHint?: boolean;
  }[]) => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const session = useLessonSession();

  const [part, setPart] = useState<1 | 2>(1);
  const [itemIndex, setItemIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [usedHint, setUsedHint] = useState(false);

  const { part1Items, part2Scenario, part2Questions } = useMemo(
    () => ({
      part1Items: lesson.part1.items,
      part2Scenario: lesson.part2.scenario,
      part2Questions: lesson.part2.questions,
    }),
    [lesson]
  );

  const totalItems = part1Items.length + part2Questions.length;
  const doneItems = part === 1 ? itemIndex : part1Items.length + itemIndex;

  // ── Part 1: self-assessed pattern drill ───────────────────────────
  const currentItem: PatternDrillItem | undefined = part1Items[itemIndex];

  const advancePart1 = useCallback(
    (knewIt: boolean) => {
      if (!currentItem) return;

      session.recordAnswer({
        itemId: `term-${itemIndex}`,
        isCorrect: knewIt,
        linkedTerm: currentItem.term,
        usedHint,
      });

      haptic(knewIt ? 'success' : 'warning');

      if (itemIndex + 1 < part1Items.length) {
        setItemIndex(itemIndex + 1);
        setRevealed(false);
        setUsedHint(false);
        session.markItemStart();
      } else {
        setPart(2);
        setItemIndex(0);
        setSelected(null);
        session.setPart(2);
        session.markItemStart();
      }
    },
    [currentItem, itemIndex, part1Items.length, session, usedHint]
  );

  // ── Part 2: multiple-choice application ───────────────────────────
  const currentQuestion: ApplicationQuestion | undefined = part2Questions[itemIndex];

  const checkAnswer = useCallback(() => {
    if (!currentQuestion || selected === null) return;

    const isCorrect = selected === currentQuestion.correctIndex;
    session.recordAnswer({
      itemId: currentQuestion.id,
      isCorrect,
      linkedTerm: currentQuestion.linkedTerm,
      usedHint,
    });

    haptic(isCorrect ? 'success' : 'error');
    setRevealed(true);
  }, [currentQuestion, selected, session, usedHint]);

  const nextQuestion = useCallback(() => {
    if (!currentQuestion) return;

    if (itemIndex + 1 < part2Questions.length) {
      setItemIndex(itemIndex + 1);
      setSelected(null);
      setRevealed(false);
      setUsedHint(false);
      session.markItemStart();
    } else {
      onFinish(session.pendingAnswers);
    }
  }, [currentQuestion, itemIndex, part2Questions.length, onFinish, session]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      {/* Header */}
      <div className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onExit}
            className="text-sm text-text-hint transition active:scale-95"
          >
            ✕
          </button>
          <span className="text-xs font-medium text-text-hint">
            {t('lesson.itemOf', { current: doneItems + 1, total: totalItems })}
          </span>
          <span className="w-4" />
        </div>
        <ProgressBar value={doneItems} max={totalItems} height={6} />
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-5">
        {part === 1 && currentItem && (
          <PatternItemView
            item={currentItem}
            revealed={revealed}
            usedHint={usedHint}
            onReveal={() => {
              setRevealed(true);
              setUsedHint(true);
            }}
          />
        )}

        {part === 2 && currentQuestion && (
          <ApplicationView
            scenario={part2Scenario}
            question={currentQuestion}
            selected={selected}
            revealed={revealed}
            showScenario={itemIndex === 0}
            onSelect={(i) => {
              if (!revealed) {
                setSelected(i);
                haptic('tap');
              }
            }}
          />
        )}
      </div>

      {/* Footer actions */}
      <div className="safe-bottom sticky bottom-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        {part === 1 && currentItem && (
          <Part1Actions
            revealed={revealed}
            onReveal={() => {
              setRevealed(true);
              setUsedHint(true);
            }}
            onAnswer={advancePart1}
          />
        )}

        {part === 2 && currentQuestion && (
          <Part2Actions
            revealed={revealed}
            canCheck={selected !== null}
            isLast={itemIndex + 1 >= part2Questions.length}
            onCheck={checkAnswer}
            onNext={nextQuestion}
          />
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Part 1
// ═════════════════════════════════════════════════════════════════════

function Part1Actions({
  revealed,
  onReveal,
  onAnswer,
}: {
  revealed: boolean;
  onReveal: () => void;
  onAnswer: (knewIt: boolean) => void;
}) {
  const { t } = useTranslation();

  if (!revealed) {
    return (
      <Button fullWidth onClick={onReveal}>
        {t('lesson.checkAnswer')}
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={() => onAnswer(false)}>
        🤔 سخت بود
      </Button>
      <Button onClick={() => onAnswer(true)}>😎 مسلط بودم</Button>
    </div>
  );
}

function PatternItemView({
  item,
  revealed,
  usedHint,
  onReveal,
}: {
  item: PatternDrillItem;
  revealed: boolean;
  usedHint: boolean;
  onReveal: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* The pattern / term */}
      <Card className="text-center">
        <p className="text-xs text-text-hint">{t('lesson.meaning')}</p>

        <h2 className="target-text mt-2 text-2xl font-bold leading-tight text-text" dir="ltr">
          {item.term}
        </h2>

        {item.pronunciation && (
          <p className="target-text mt-1 text-xs text-text-muted" dir="ltr">
            /{item.pronunciation}/
          </p>
        )}

        {revealed ? (
          <div className="mt-4 space-y-3 border-t border-border pt-4 text-start">
            <div>
              <p className="text-[11px] font-medium text-text-hint">{t('lesson.meaning')}</p>
              <p className="mt-0.5 text-sm text-text">{item.meaning}</p>
            </div>

            <div>
              <p className="text-[11px] font-medium text-text-hint">{t('lesson.example')}</p>
              <p className="target-text mt-0.5 text-sm font-medium text-text" dir="ltr">
                {item.example}
              </p>
              {item.exampleTranslation && (
                <p className="mt-0.5 text-xs text-text-hint">{item.exampleTranslation}</p>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            className="mx-auto mt-4 block text-xs font-medium text-accent"
          >
            {t('common.continue')} ↓
          </button>
        )}
      </Card>

      {/* Substitution drill — the core pedagogical device */}
      {item.substitution && (
        <Card className="border-dashed">
          <p className="mb-2 text-[11px] font-medium text-text-hint">
            🧩 {(t('learn.subtitlePattern'))} — تمرین جایگزینی
          </p>

          <p className="target-text text-sm font-medium text-text" dir="ltr">
            {item.substitution.base}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.substitution.slots.map((slot) => (
              <span
                key={slot}
                className="target-text chip border border-border bg-[var(--surface-sunken)] text-text"
                dir="ltr"
              >
                {slot}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Micro exercises */}
      {revealed && item.box !== undefined && (
        <p className="text-center text-[11px] text-text-muted">
          📦 جعبه لایتنر: {item.box}/5
        </p>
      )}

      {usedHint && null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Part 2
// ═════════════════════════════════════════════════════════════════════

function Part2Actions({
  revealed,
  canCheck,
  isLast,
  onCheck,
  onNext,
}: {
  revealed: boolean;
  canCheck: boolean;
  isLast: boolean;
  onCheck: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();

  if (!revealed) {
    return (
      <Button fullWidth disabled={!canCheck} onClick={onCheck}>
        {t('lesson.checkAnswer')}
      </Button>
    );
  }

  return (
    <Button fullWidth onClick={onNext}>
      {isLast ? t('common.done') : t('common.next')}
    </Button>
  );
}

function ApplicationView({
  scenario,
  question,
  selected,
  revealed,
  showScenario,
  onSelect,
}: {
  scenario: string;
  question: ApplicationQuestion;
  selected: number | null;
  revealed: boolean;
  showScenario: boolean;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {showScenario && (
        <Card className="border-brand-200 bg-brand-50/40">
          <p className="text-[11px] font-medium text-brand-700">🌍 {t('lesson.scenario')}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-text">{scenario}</p>
        </Card>
      )}

      <Card>
        <p className="text-sm font-semibold leading-relaxed text-text">{question.prompt}</p>
      </Card>

      <div className="space-y-2">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrect = index === question.correctIndex;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(index)}
              disabled={revealed}
              className={clsx(
                'w-full rounded-xl border p-3.5 text-start transition-all active:scale-[0.99]',
                !revealed && isSelected && 'border-accent bg-accent-soft ring-accent-soft',
                !revealed && !isSelected && 'border-border bg-card',
                revealed && isCorrect && 'border-success-500 bg-success-100',
                revealed && isSelected && !isCorrect && 'border-danger-500 bg-danger-100',
                revealed && !isCorrect && !isSelected && 'border-border bg-card opacity-60'
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                    !revealed && isSelected && 'border-accent bg-accent text-accent-text',
                    !revealed && !isSelected && 'border-border text-text-muted',
                    revealed && isCorrect && 'border-success-500 bg-success-500 text-white',
                    revealed && isSelected && !isCorrect && 'border-danger-500 bg-danger-500 text-white'
                  )}
                >
                  {revealed && isCorrect ? '✓' : revealed && isSelected ? '✕' : String.fromCharCode(65 + index)}
                </span>

                <span
                  className="target-text flex-1 text-sm leading-relaxed text-text"
                  dir="ltr"
                >
                  {option}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {revealed && (
        <Card
          className={clsx(
            'animate-fade-in',
            selected === question.correctIndex
              ? 'border-success-500/30 bg-success-100/50'
              : 'border-danger-500/30 bg-danger-100/50'
          )}
        >
          <p className="text-sm font-semibold text-text">
            {selected === question.correctIndex
              ? t('lesson.correct')
              : t('lesson.incorrect')}
          </p>

          {selected !== question.correctIndex && (
            <p className="target-text mt-1 text-sm font-medium text-text" dir="ltr">
              {question.options[question.correctIndex]}
            </p>
          )}

          {question.explanation && (
            <p className="mt-2 text-xs leading-relaxed text-text-hint">
              {question.explanation}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
