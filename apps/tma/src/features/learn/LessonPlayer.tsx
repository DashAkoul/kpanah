import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Lesson, PatternDrillItem, ApplicationQuestion } from '@kpanah/shared';
import { Card, Button, ProgressBar } from '../../components/ui';
import { useLessonSession } from '../../store/session';
import { useSessionStore } from '../../store/session';
import { haptic } from '../../lib/telegram';
import { API_BASE } from '../../lib/api';
import { useAudio } from '../../hooks/useAudio';

/**
 * Lesson player.
 *
 * Flow:
 *   Part 1 — for every term:
 *     (a) choose the correct MEANING from 3 options   → scored
 *     (b) choose the correct EXAMPLE from 3 options   → scored
 *     (c) reveal the full card (meaning + example + audio)
 *     (d) complete the substitution PATTERN (1 of 3)  → scored
 *   Part 2 — scenario + MCQ.
 *
 * ⚠️ چرا سه سؤال در بخش ۱: قبلاً معنی/مثال مستقیم نشان داده می‌شد و
 * «بررسی پاسخ» هیچ چیزی را بررسی نمی‌کرد؛ سیستم هم نمی‌توانست عملکرد
 * کاربر را ردیابی کند. حالا هر آیتم سه پاسخ قابل‌ثبت تولید می‌کند.
 *
 * Deliberately absent: any hint that a given day is an assessment.
 */
type P1Step = 'meaning' | 'example' | 'reveal' | 'pattern';

/** اولین مرحله‌ای که این آیتم پشتیبانی می‌کند */
function firstStep(item: PatternDrillItem | undefined): P1Step {
  if (item?.meaningOptions) return 'meaning';
  if (item?.exampleOptions) return 'example';
  return 'reveal';
}

/** مرحلهٔ بعدی؛ `null` یعنی «برو آیتم بعد» */
function stepAfter(step: P1Step, item: PatternDrillItem | undefined): P1Step | null {
  if (step === 'meaning') return item?.exampleOptions ? 'example' : 'reveal';
  if (step === 'example') return 'reveal';
  if (step === 'reveal') {
    // الگو فقط وقتی سؤال می‌شود که پاسخ درست مشخص باشد
    if (item?.substitution && item.substitution.correctIndex !== undefined) return 'pattern';
    return null;
  }
  return null;
}

interface Choice {
  options: string[];
  correctIndex: number;
}

/** گزینه‌های مرحلهٔ جاری (یا `undefined` اگر این مرحله سؤال ندارد) */
function choiceFor(item: PatternDrillItem | undefined, step: P1Step): Choice | undefined {
  if (!item) return undefined;
  if (step === 'meaning') return item.meaningOptions;
  if (step === 'example') return item.exampleOptions;
  if (step === 'pattern' && item.substitution) {
    return {
      options: item.substitution.slots,
      correctIndex: item.substitution.correctIndex ?? 0,
    };
  }
  return undefined;
}

export function LessonPlayer({
  lesson,
  onFinish,
  onExit,
  onPartComplete,
  submitting = false,
}: {
  lesson: Lesson;
  /**
   * یک بخش تمام شد → به صفحهٔ آموزش برگرد (تیک سبز + باز شدن بخش بعد).
   * بخش آخر (۳ یا ۲ اگر داستانی نیست) با `finish` درس را ثبت می‌کند.
   */
  onPartComplete: (part: 1 | 2 | 3) => void;
  submitting?: boolean;
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

  const [part, setPart] = useState<1 | 2 | 3>(1);
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

  // ── Part 1 state ──────────────────────────────────────────────────
  const [p1Step, setP1Step] = useState<P1Step>(() => firstStep(part1Items[0]));

  const [p1Selected, setP1Selected] = useState<number | null>(null);
  const [p1Checked, setP1Checked] = useState(false);

  /**
   * ⚠️ ادامه از همان‌جا که کاربر خارج شد.
   * پیشرفت در localStorage نگه داشته می‌شود (سبک، بدون درخواست شبکه).
   */
  const progressKey = `kpanah:lesson:${lesson.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressKey);
      if (!raw) return;
      const p = JSON.parse(raw) as {
        part?: 1 | 2 | 3;
        itemIndex?: number;
        p1Step?: P1Step;
      };
      if (p.part) setPart(p.part);
      if (typeof p.itemIndex === 'number') setItemIndex(p.itemIndex);
      if (p.p1Step) setP1Step(p.p1Step);
    } catch {
      /* پیشرفت خراب = شروع از اول */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);

  // شروع از بخشی که کاربر انتخاب کرده (کارت بخش ۲/۳ در صفحهٔ آموزش)
  useEffect(() => {
    try {
      const startPart = localStorage.getItem('kpanah:startPart');
      if (startPart) {
        localStorage.removeItem('kpanah:startPart');
        const p = Number(startPart);
        if (p === 2) setPart(2);
        if (p === 3 && lesson.part3) setPart(3);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        progressKey,
        JSON.stringify({ part, itemIndex, p1Step })
      );
    } catch {
      /* ذخیرهٔ پیشرفت اختیاری است */
    }
  }, [progressKey, part, itemIndex, p1Step]);

  const totalItems = part1Items.length + part2Questions.length;
  const doneItems = part === 1 ? itemIndex : part1Items.length + itemIndex;

  const currentItem: PatternDrillItem | undefined = part1Items[itemIndex];
  const currentChoice = choiceFor(currentItem, p1Step);

  /** آیتم بعدی یا ورود به بخش ۲ */
  const advanceItem = useCallback(() => {
    if (itemIndex + 1 < part1Items.length) {
      const next = part1Items[itemIndex + 1];
      setItemIndex(itemIndex + 1);
      setP1Step(firstStep(next));
      setP1Selected(null);
      setP1Checked(false);
      session.markItemStart();
      return;
    }
    // ⚠️ باگ رفع‌شده: `revealed` ریست نمی‌شد؛ اولین سؤال بخش ۲ با
    // revealed=true رندر می‌شد و جواب درست از قبل سبز دیده می‌شد.
    setRevealed(false);
    setUsedHint(false);
    // بخش ۱ تمام شد → خودکار به صفحهٔ آموزش (تیک سبز + باز شدن بخش ۲)
    onPartComplete(1);
  }, [itemIndex, part1Items, session, onPartComplete]);

  /** بررسی پاسخ بخش ۱ و ثبت آن در آمار */
  const checkP1 = useCallback(() => {
    if (!currentItem || p1Selected === null || !currentChoice) return;

    const isCorrect = p1Selected === currentChoice.correctIndex;
    session.recordAnswer({
      itemId: `${p1Step}-${itemIndex}`,
      isCorrect,
      linkedTerm: currentItem.term,
      usedHint: false,
    });
    haptic(isCorrect ? 'success' : 'error');
    setP1Checked(true);
  }, [currentItem, currentChoice, p1Selected, p1Step, itemIndex, session]);

  /** رفتن به مرحلهٔ بعدی (یا آیتم بعدی) */
  const nextP1 = useCallback(() => {
    const next = stepAfter(p1Step, currentItem);
    if (next) {
      setP1Step(next);
      setP1Selected(null);
      setP1Checked(false);
      session.markItemStart();
      return;
    }
    advanceItem();
  }, [p1Step, currentItem, session, advanceItem]);

  /** خودارزیابی — فقط برای محتوای قدیمی که گزینه ندارد */
  const selfAssess = useCallback(
    (knewIt: boolean) => {
      if (!currentItem) return;
      session.recordAnswer({
        itemId: `term-${itemIndex}`,
        isCorrect: knewIt,
        linkedTerm: currentItem.term,
        usedHint,
      });
      haptic(knewIt ? 'success' : 'warning');
      advanceItem();
    },
    [currentItem, itemIndex, session, usedHint, advanceItem]
  );

  // ── Part 2 ────────────────────────────────────────────────────────
  const story = lesson.part3;
  const storyQuestions = story?.questions ?? [];
  const storyQuestion: ApplicationQuestion | undefined =
    part === 3 ? storyQuestions[itemIndex] : undefined;

  /**
   * ⚠️ دکمهٔ «انجام شد» حذف شد: وقتی آخرین سؤالِ آخرین بخش بررسی شد،
   * بعد از ۱٫۲ ثانیه (تا کاربر بازخورد را ببیند) خودکار ادامه می‌دهیم.
   */
  useEffect(() => {
    if (!revealed) return;
    const lastP2 = part === 2 && itemIndex + 1 >= part2Questions.length;
    const lastP3 = part === 3 && itemIndex + 1 >= storyQuestions.length;
    if (!lastP2 && !lastP3) return;
    const id = setTimeout(() => {
      if (lastP3) finish();
      else if (story) onPartComplete(2);
      else finish();
    }, 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, part, itemIndex, part2Questions.length, storyQuestions.length, story]);

  const finish = useCallback(() => {
    try {
      localStorage.removeItem(`kpanah:lesson:${lesson.id}`);
    } catch {
      /* ignore */
    }
    onFinish(session.pendingAnswers);
  }, [lesson.id, onFinish, session]);

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
    } else if (story) {
      // بخش ۲ تمام شد و داستان داریم → برگرد به آموزش، بخش ۳ باز می‌شود
      onPartComplete(2);
    } else {
      // بخش ۲ آخرین بخش است → ثبت درس
      finish();
    }
  }, [currentQuestion, itemIndex, part2Questions.length, session, story, onPartComplete, finish]);

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
            step={p1Step}
            selected={p1Selected}
            checked={p1Checked}
            choice={currentChoice}
            onSelect={(i) => {
              if (!p1Checked) {
                setP1Selected(i);
                haptic('tap');
              }
            }}
          />
        )}

        {part === 3 && story && (
          <StoryView
            story={story}
            question={storyQuestion}
            selected={selected}
            revealed={revealed}
            onSelect={(i: number) => {
              if (!revealed) {
                setSelected(i);
                haptic('tap');
              }
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
            step={p1Step}
            hasChoice={Boolean(
              currentItem.meaningOptions ||
                currentItem.exampleOptions ||
                currentItem.substitution?.correctIndex !== undefined
            )}
            checked={p1Checked}
            canCheck={p1Selected !== null}
            onCheck={checkP1}
            onNext={nextP1}
            onSelfAssess={selfAssess}
          />
        )}

        {part === 3 && story && storyQuestion && (
          <Part2Actions
            revealed={revealed}
            canCheck={selected !== null}
            isLast={itemIndex + 1 >= storyQuestions.length}
            onCheck={() => {
              if (selected === null) return;
              const isCorrect = selected === storyQuestion.correctIndex;
              session.recordAnswer({
                itemId: `story-${storyQuestion.id}`,
                isCorrect,
                linkedTerm: storyQuestion.linkedTerm,
              });
              haptic(isCorrect ? 'success' : 'error');
              setRevealed(true);
            }}
            onNext={() => {
              if (itemIndex + 1 < storyQuestions.length) {
                setItemIndex(itemIndex + 1);
                setSelected(null);
                setRevealed(false);
                session.markItemStart();
              } else {
                finish();
              }
            }}
          />
        )}

        {part === 3 && story && !storyQuestion && (
          <Button fullWidth onClick={finish}>
            {t('common.done')}
          </Button>
        )}

        {part === 2 && currentQuestion && (
          <Part2Actions
            revealed={revealed}
            canCheck={selected !== null}
            isLast={itemIndex + 1 >= part2Questions.length}
            onCheck={checkAnswer}
            onNext={nextQuestion}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Part 1 — actions
// ═════════════════════════════════════════════════════════════════════

function Part1Actions({
  step,
  hasChoice,
  checked,
  canCheck,
  onCheck,
  onNext,
  onSelfAssess,
}: {
  step: P1Step;
  hasChoice: boolean;
  checked: boolean;
  canCheck: boolean;
  onCheck: () => void;
  onNext: () => void;
  onSelfAssess: (knewIt: boolean) => void;
}) {
  const { t } = useTranslation();

  // محتوای قدیمی (بدون گزینه و بدون پاسخ الگو) → خودارزیابی
  if (step === 'reveal' && !hasChoice) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onSelfAssess(false)}>
          🤔 سخت بود
        </Button>
        <Button onClick={() => onSelfAssess(true)}>😎 مسلط بودم</Button>
      </div>
    );
  }

  if (step === 'reveal') {
    return (
      <Button fullWidth onClick={onNext}>
        {t('common.continue')}
      </Button>
    );
  }

  if (!checked) {
    return (
      <Button fullWidth disabled={!canCheck} onClick={onCheck}>
        {t('lesson.checkAnswer')}
      </Button>
    );
  }

  return (
    <Button fullWidth onClick={onNext}>
      {t('common.next')}
    </Button>
  );
}

/** دکمهٔ پخش تلفظ — همیشه خودِ متن داده‌شده را می‌خواند */
function SpeakButton({ text, compact }: { text: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { play, loading, playing, error } = useAudio();
  const targetLanguage = useSessionStore((s) => s.user?.targetLanguage);

  const busy = loading || playing;
  const icon = loading ? '⏳' : playing ? '🔈' : error ? '⚠️' : '🔊';
  const label = loading
    ? t('lesson.loadingAudio')
    : playing
      ? t('lesson.playing')
      : error
        ? t('lesson.audioFailed')
        : t('lesson.listen');

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        haptic('tap');
        void play(text, targetLanguage ?? 'en');
      }}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium transition active:scale-95',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        busy ? 'bg-[var(--surface-sunken)] text-text-muted' : 'bg-brand-50 text-brand-600'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Part 1 — view
// ═════════════════════════════════════════════════════════════════════

function PatternItemView({
  item,
  step,
  selected,
  checked,
  choice,
  onSelect,
}: {
  item: PatternDrillItem;
  step: P1Step;
  selected: number | null;
  checked: boolean;
  choice: Choice | undefined;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();

  const showDetails = step === 'reveal' || step === 'pattern';
  const chosen =
    step === 'pattern' && selected !== null && item.substitution
      ? item.substitution.slots[selected]
      : null;
  const filled =
    item.substitution && chosen
      ? item.substitution.base.replace(/_{2,}/, chosen)
      : item.substitution?.base;

  const question =
    step === 'meaning'
      ? t('lesson.whichMeaning')
      : step === 'example'
        ? t('lesson.whichExample')
        : step === 'pattern'
          ? t('lesson.whichCompletion')
          : null;

  return (
    <div className="space-y-4">
      {/* کارت واژه — معنی/مثال فقط بعد از پاسخ‌دادن آشکار می‌شود */}
      <Card className="text-center">
        <p className="text-xs text-text-hint">{t('lesson.term')}</p>

        <h2 className="target-text mt-2 text-2xl font-bold leading-tight text-text" dir="ltr">
          {item.term}
        </h2>

        <div className="mt-2 flex items-center justify-center gap-2">
          {/* ⚠️ باگ رفع‌شده: قبلاً speakText (که مثال بود) خوانده می‌شد */}
          <SpeakButton text={item.term} />
        </div>

        {item.pronunciation && (
          <p className="target-text mt-1 text-xs text-text-muted" dir="ltr">
            /{item.pronunciation}/
          </p>
        )}

        {showDetails && (
          <div className="mt-4 space-y-3 border-t border-border pt-4 text-start">
            <div>
              <p className="text-[11px] font-medium text-text-hint">{t('lesson.meaning')}</p>
              <p className="mt-0.5 text-sm text-text">{item.meaning}</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-text-hint">{t('lesson.example')}</p>
                <SpeakButton text={item.example} compact />
              </div>
              <p className="target-text mt-0.5 text-sm font-medium text-text" dir="ltr">
                {item.example}
              </p>
              {item.exampleTranslation && (
                <p className="mt-0.5 text-xs text-text-hint">{item.exampleTranslation}</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* سؤال مرحلهٔ جاری */}
      {choice && step !== 'reveal' && (
        <Card className={clsx(step === 'pattern' && 'border-dashed')}>
          {step === 'pattern' && (
            <p className="mb-1 text-[11px] font-medium text-text-hint">
              🧩 {t('learn.subtitlePattern')}
            </p>
          )}

          <p className="mb-2 text-sm font-semibold leading-relaxed text-text">{question}</p>

          {step === 'pattern' && (
            <p className="target-text mb-3 text-sm font-medium text-text" dir="ltr">
              {filled}
            </p>
          )}

          <ChoiceList
            options={choice.options}
            correctIndex={choice.correctIndex}
            selected={selected}
            checked={checked}
            onSelect={onSelect}
            ltr={step !== 'meaning'}
            allowDontKnow
          />

          {checked && (
            <div
              className={clsx(
                'mt-3 rounded-xl border p-3 text-start',
                selected === choice.correctIndex
                  ? 'border-success-500/30 bg-success-100/50'
                  : 'border-danger-500/30 bg-danger-100/50'
              )}
            >
              <p className="text-xs font-semibold text-text">
                {selected === choice.correctIndex ? t('lesson.correct') : t('lesson.incorrect')}
              </p>
              <p
                className={clsx(
                  'mt-1 text-sm font-medium text-text',
                  step !== 'meaning' && 'target-text'
                )}
                dir={step !== 'meaning' ? 'ltr' : undefined}
              >
                {choice.options[choice.correctIndex]}
              </p>
              {selected === -1 && (
                <p className="mt-1 text-[11px] text-text-hint">{t('lesson.dontKnowHint')}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {checked && step === 'pattern' && chosen && (
        <p className="text-center text-[11px] text-text-muted">
          {t('lesson.yourSentence')}:{' '}
          <span className="target-text" dir="ltr">
            {filled}
          </span>
        </p>
      )}
    </div>
  );
}

/** لیست گزینه‌های انتخاب‌شدنی با بازخورد درست/غلط */
function ChoiceList({
  options,
  correctIndex,
  selected,
  checked,
  onSelect,
  ltr,
  allowDontKnow,
}: {
  options: string[];
  correctIndex: number;
  selected: number | null;
  checked: boolean;
  onSelect: (index: number) => void;
  ltr: boolean;
  /** گزینهٔ «نمی‌دانم» — همیشه غلط حساب می‌شود ولی کاربر را گیر نمی‌اندازد */
  allowDontKnow?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const isSelected = selected === index;
        const isCorrect = index === correctIndex;

        return (
          <button
            key={`${option}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            disabled={checked}
            className={clsx(
              'w-full rounded-xl border p-3 text-start transition-all active:scale-[0.99]',
              !checked && isSelected && 'border-brand-500 bg-brand-50',
              !checked && !isSelected && 'border-border bg-card',
              checked && isCorrect && 'border-success-500 bg-success-100',
              checked && isSelected && !isCorrect && 'border-danger-500 bg-danger-100',
              checked && !isCorrect && !isSelected && 'border-border bg-card opacity-60'
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  !checked && isSelected && 'border-brand-500 bg-brand-500 text-white',
                  !checked && !isSelected && 'border-border text-text-muted',
                  checked && isCorrect && 'border-success-500 bg-success-500 text-white',
                  checked && isSelected && !isCorrect && 'border-danger-500 bg-danger-500 text-white'
                )}
              >
                {checked && isCorrect
                  ? '✓'
                  : checked && isSelected
                    ? '✕'
                    : String.fromCharCode(65 + index)}
              </span>

              <span
                className={clsx('flex-1 text-sm leading-relaxed text-text', ltr && 'target-text')}
                dir={ltr ? 'ltr' : undefined}
              >
                {option}
              </span>
            </div>
          </button>
        );
      })}

      {allowDontKnow && (
        <button
          type="button"
          onClick={() => onSelect(-1)}
          disabled={checked}
          className={clsx(
            'w-full rounded-xl border border-dashed p-2.5 text-center text-xs font-medium transition active:scale-[0.99]',
            !checked && selected === -1
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-border bg-transparent text-text-muted'
          )}
        >
          🤷 {t('lesson.dontKnow')}
        </button>
      )}
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
  submitting = false,
}: {
  revealed: boolean;
  canCheck: boolean;
  isLast: boolean;
  onCheck: () => void;
  onNext: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();

  if (!revealed) {
    return (
      <Button fullWidth disabled={!canCheck} onClick={onCheck}>
        {t('lesson.checkAnswer')}
      </Button>
    );
  }

  // ⚠️ دکمهٔ «انجام شد» حذف شد: آخرین سؤال بعد از نمایش بازخورد خودکار
  // ادامه می‌دهد و درس ثبت می‌شود.
  if (isLast) {
    return (
      <p className="py-2 text-center text-xs text-text-hint">
        {submitting ? t('lesson.saving') : t('lesson.finishing')}
      </p>
    );
  }

  return (
    <Button fullWidth onClick={onNext}>
      {t('common.next')}
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

      <ChoiceList
        options={question.options}
        correctIndex={question.correctIndex}
        selected={selected}
        checked={revealed}
        onSelect={onSelect}
        ltr
        allowDontKnow
      />

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

// ═════════════════════════════════════════════════════════════════════
// Part 3 — story + karaoke playback + comprehension
// ═════════════════════════════════════════════════════════════════════

/**
 * پخش داستان با هایلایت کلمهٔ در حال خواندن.
 *
 * ⚠️ صدا از سرویس آنلاین رایگان (Google Translate TTS) می‌آید، نه AI.
 * چون آن سرویس زمان‌بندی کلمه نمی‌دهد، مدت هر کلمه به‌صورت **تخمینی**
 * (متناسب با طول کلمه) از `duration` کلیپ محاسبه می‌شود — برای کARAOKE
 * آموزشی کافی است و هیچ هزینهٔ هوش مصنوعی ندارد.
 */
function StoryView({
  story,
  question,
  selected,
  revealed,
  onSelect,
}: {
  story: { title: string; lines: { speaker?: string; text: string }[] };
  question: ApplicationQuestion | undefined;
  selected: number | null;
  revealed: boolean;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const targetLanguage = useSessionStore((s) => s.user?.targetLanguage);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [activeWord, setActiveWord] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = async (text: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/kpanah56/8fjg7rfb/v1/media/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: targetLanguage ?? 'en' }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: boolean; data?: { url: string } }
        | null;
      if (!payload?.ok || !payload.data?.url) return null;
      const url = payload.data.url;
      return /^https?:/i.test(url) ? url : `${API_BASE}${url}`;
    } catch {
      return null;
    }
  };

  const playLine = async (index: number) => {
    const line = story.lines[index];
    if (!line) return;
    audioRef.current?.pause();

    const url = await speak(line.text);
    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;
    setActiveLine(index);
    setPlaying(true);

    const words = line.text.split(/\s+/).filter(Boolean);
    // وزن هر کلمه ≈ طول + ۲ (شکاف بین کلمات)
    const weights = words.map((w) => w.length + 2);
    const total = weights.reduce((a, b) => a + b, 0);

    audio.ontimeupdate = () => {
      if (!audio.duration) return;
      const progress = audio.currentTime / audio.duration;
      let acc = 0;
      for (let i = 0; i < weights.length; i += 1) {
        acc += (weights[i] ?? 1) / total;
        if (progress <= acc) {
          setActiveWord(i);
          return;
        }
      }
      setActiveWord(words.length - 1);
    };

    audio.onended = () => {
      setActiveWord(-1);
      const next = index + 1;
      if (next < story.lines.length) {
        void playLine(next);
      } else {
        setPlaying(false);
        setActiveLine(null);
      }
    };

    await audio.play().catch(() => {
      setPlaying(false);
      setActiveLine(null);
    });
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setActiveLine(null);
    setActiveWord(-1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-text-hint">📖 {t('lesson.story')}</p>
            <p className="mt-0.5 text-sm font-semibold text-text">{story.title}</p>
          </div>
          <Button
            size="sm"
            variant={playing ? 'secondary' : 'primary'}
            onClick={() => (playing ? stop() : void playLine(0))}
          >
            {playing ? t('lesson.stop') : t('lesson.playStory')}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {story.lines.map((line, li) => {
            const words = line.text.split(/\s+/).filter(Boolean);
            const isActive = activeLine === li;

            return (
              <div
                key={`${li}-${line.text.slice(0, 12)}`}
                className={clsx(
                  'rounded-xl border p-3 transition',
                  isActive ? 'border-brand-500 bg-brand-50' : 'border-border bg-card'
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  {line.speaker && (
                    <span className="text-[10px] font-semibold text-text-hint">
                      {line.speaker}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void playLine(li)}
                    className="ms-auto text-[11px] text-brand-600"
                  >
                    🔊
                  </button>
                </div>

                <p className="target-text text-sm leading-relaxed text-text" dir="ltr">
                  {words.map((w, wi) => (
                    <span
                      key={`${w}-${wi}`}
                      className={clsx(
                        'transition-colors',
                        isActive && activeWord === wi && 'rounded bg-brand-500/20 font-semibold text-brand-700'
                      )}
                    >
                      {w}{' '}
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {question && (
        <Card>
          <p className="mb-2 text-sm font-semibold leading-relaxed text-text">
            {question.prompt}
          </p>

          <ChoiceList
            options={question.options}
            correctIndex={question.correctIndex}
            selected={selected}
            checked={revealed}
            onSelect={onSelect}
            ltr
            allowDontKnow
          />

          {revealed && (
            <div
              className={clsx(
                'mt-3 rounded-xl border p-3 text-start',
                selected === question.correctIndex
                  ? 'border-success-500/30 bg-success-100/50'
                  : 'border-danger-500/30 bg-danger-100/50'
              )}
            >
              <p className="text-xs font-semibold text-text">
                {selected === question.correctIndex
                  ? t('lesson.correct')
                  : t('lesson.incorrect')}
              </p>
              <p className="target-text mt-1 text-sm text-text" dir="ltr">
                {question.options[question.correctIndex]}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
