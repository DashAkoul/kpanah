import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Portal } from '../../components/Portal';
import { useSubmitReview, type DueReviewItem } from '../../hooks/useApi';
import { useSessionStore } from '../../store/session';
import { useAudio } from '../../hooks/useAudio';
import { haptic } from '../../lib/telegram';

/**
 * «مرور آزاد» — واژه‌هایی که فاصلهٔ لایتنرشان سر رسیده ولی درس امروز به
 * آن‌ها نمی‌پردازد.
 *
 * ⚠️ چرا لازم است: بدون این صفحه، واژه‌ای که در درس‌های بعدی ظاهر نمی‌شد
 * عملاً از چرخهٔ مرور بیرون می‌افتاد — یعنی حلقهٔ لایتنر فقط به شانس
 * وابسته بود.
 *
 * ⚠️ چرا Portal: هر اورلی باید خارج از کارت‌های دارای backdrop-filter
 * رندر شود (وگرنه `fixed` نسبت به همان کارت محاسبه می‌شود).
 */
export function ReviewSession({
  items,
  onClose,
}: {
  items: DueReviewItem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const submit = useSubmitReview();
  const targetLanguage = useSessionStore((s) => s.user?.targetLanguage);
  const { play, loading: audioLoading } = useAudio();

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [answers, setAnswers] = useState<
    { term: string; isCorrect: boolean; responseMs: number }[]
  >([]);
  const [finished, setFinished] = useState(false);

  const current = items[index];

  /**
   * گزینه‌ها: معنی درست + دو معنی از واژه‌های دیگر همین جلسه.
   * اگر کمتر از دو واژهٔ دیگر باشد، با دو گزینه هم کار می‌کند.
   */
  const options = useMemo(() => {
    if (!current) return { options: [] as string[], correctIndex: 0 };

    const others = items
      .filter((i) => i.term !== current.term && i.meaning)
      .slice(0, 2)
      .map((i) => i.meaning);

    const list = [current.meaning, ...others];
    // شافل ساده — ترتیب ثابت باعث می‌شود کاربر جای جواب را حفظ کند
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return { options: list, correctIndex: list.indexOf(current.meaning) };
  }, [current, items]);

  const check = useCallback(() => {
    if (!current || selected === null) return;

    const isCorrect = selected === options.correctIndex;
    setAnswers((prev) => [
      ...prev,
      {
        term: current.term,
        isCorrect,
        responseMs: Math.min(600_000, Math.max(0, Date.now() - startedAt)),
      },
    ]);
    haptic(isCorrect ? 'success' : 'error');
    setChecked(true);
  }, [current, selected, options.correctIndex, startedAt]);

  const next = useCallback(() => {
    const isLast = index + 1 >= items.length;
    if (isLast) {
      // ثبت نهایی — خطا نباید کاربر را گیر بیندازد
      submit.mutate(
        { answers },
        {
          onSettled: () => {
            setFinished(true);
            haptic('success');
          },
        }
      );
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setChecked(false);
    setStartedAt(Date.now());
  }, [index, items.length, answers, submit]);

  const correctCount = answers.filter((a) => a.isCorrect).length;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
        {/* Header */}
        <div className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-hint transition active:scale-95"
            >
              ✕
            </button>
            <span className="text-xs font-medium text-text-hint">
              {finished
                ? t('review.done')
                : t('lesson.itemOf', { current: index + 1, total: items.length })}
            </span>
            <span className="w-4" />
          </div>
          <ProgressBar
            value={finished ? items.length : index}
            max={items.length}
            height={6}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {finished ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="text-5xl">🎉</div>
              <h2 className="text-lg font-bold text-text">{t('review.finishedTitle')}</h2>
              <p className="text-sm text-text-hint">
                {t('review.finishedBody', {
                  correct: correctCount,
                  total: answers.length,
                })}
              </p>
              <Button className="mt-4 w-full" onClick={onClose}>
                {t('common.done')}
              </Button>
            </div>
          ) : current ? (
            <div className="space-y-4">
              <Card className="text-center">
                <p className="text-xs text-text-hint">{t('lesson.term')}</p>
                <h2
                  className="target-text mt-2 text-2xl font-bold leading-tight text-text"
                  dir="ltr"
                >
                  {current.term}
                </h2>
                <div className="mt-2 flex items-center justify-center">
                  <button
                    type="button"
                    disabled={audioLoading}
                    onClick={() => void play(current.term, targetLanguage ?? 'en')}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-600 transition active:scale-95"
                  >
                    {audioLoading ? '⏳' : '🔊'} {t('lesson.listen')}
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-text-muted">
                  {t('review.box', { box: current.box })}
                </p>
              </Card>

              <Card>
                <p className="mb-2 text-sm font-semibold leading-relaxed text-text">
                  {t('lesson.whichMeaning')}
                </p>

                <div className="space-y-2">
                  {options.options.map((option, i) => {
                    const isSelected = selected === i;
                    const isCorrect = i === options.correctIndex;

                    return (
                      <button
                        key={`${option}-${i}`}
                        type="button"
                        onClick={() => {
                          if (checked) return;
                          setSelected(i);
                          haptic('tap');
                        }}
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
                              checked &&
                                isSelected &&
                                !isCorrect &&
                                'border-danger-500 bg-danger-500 text-white'
                            )}
                          >
                            {checked && isCorrect
                              ? '✓'
                              : checked && isSelected
                                ? '✕'
                                : String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1 text-sm leading-relaxed text-text">
                            {option}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      if (checked) return;
                      setSelected(-1);
                      haptic('tap');
                    }}
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
                </div>

                {checked && (
                  <div
                    className={clsx(
                      'mt-3 rounded-xl border p-3 text-start',
                      selected === options.correctIndex
                        ? 'border-success-500/30 bg-success-100/50'
                        : 'border-danger-500/30 bg-danger-100/50'
                    )}
                  >
                    <p className="text-xs font-semibold text-text">
                      {selected === options.correctIndex
                        ? t('lesson.correct')
                        : t('lesson.incorrect')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-text">
                      {options.options[options.correctIndex]}
                    </p>
                    {current.example && (
                      <p className="target-text mt-2 text-xs text-text-hint" dir="ltr">
                        {current.example}
                      </p>
                    )}
                    {current.exampleTranslation && (
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {current.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!finished && current && (
          <div className="safe-bottom sticky bottom-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
            {checked ? (
              <Button
                fullWidth
                loading={submit.isPending}
                onClick={next}
              >
                {index + 1 >= items.length ? t('common.done') : t('common.next')}
              </Button>
            ) : (
              <Button fullWidth disabled={selected === null} onClick={check}>
                {t('lesson.checkAnswer')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Portal>
  );
}
