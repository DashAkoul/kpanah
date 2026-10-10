import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  UI_LANGUAGES,
  TARGET_LANGUAGES,
  SKILL_LEVELS,
  LEARNING_GOALS,
  type SupportedUiLanguage,
  type SupportedTargetLanguage,
  type SkillLevel,
} from '@kpanah/shared';
import { Button, ProgressBar } from '../../components/ui';
import { useOnboarding } from '../../hooks/useApi';
import { useUiStore } from '../../store/ui';
import { haptic } from '../../lib/telegram';

/**
 * First-run onboarding.
 *
 * Per the locked decision: the interface language defaults to the
 * Telegram client language, and the user is asked to confirm or change
 * it here, in the very first screen. This is what makes the default
 * "match Telegram" actually correctable.
 */
export function OnboardingFlow() {
  const { t } = useTranslation();
  const setUiLanguage = useUiStore((s) => s.setUiLanguage);
  const onboarding = useOnboarding();

  const [step, setStep] = useState(0);
  const [uiLang, setUiLang] = useState<SupportedUiLanguage>(
    (useUiStore.getState().uiLanguage ?? 'fa') as SupportedUiLanguage
  );
  const [targetLang, setTargetLang] = useState<SupportedTargetLanguage>('en');
  const [level, setLevel] = useState<SkillLevel>('ZERO');
  const [goal, setGoal] = useState<string>('DAILY');

  const totalSteps = 4;

  const next = () => {
    haptic('tap');
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const pickUiLanguage = (code: SupportedUiLanguage) => {
    haptic('select');
    setUiLang(code);
    setUiLanguage(code);
  };

  const submit = async () => {
    haptic('success');
    setStep(4);
    try {
      await onboarding.mutateAsync({
        uiLanguage: uiLang,
        targetLanguage: targetLang,
        skillLevel: level,
        learningGoal: goal,
      });
    } catch {
      setStep(3); // برگرد تا کاربر دوباره تلاش کند
    }
  };

  // ── Creating state ────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="text-6xl">✨</div>
        <h2 className="text-lg font-bold text-text">{t('onboarding.creating')}</h2>
        <p className="max-w-xs text-sm leading-relaxed text-text-hint">
          {t('onboarding.creatingHint')}
        </p>

        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-accent"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>

        {onboarding.isError && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-danger-500">{t('errors.generic')}</p>
            <Button size="sm" onClick={() => void submit()}>
              {t('common.retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Progress */}
      <div className="safe-top px-5 pt-4">
        <ProgressBar value={step} max={totalSteps - 1} height={5} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Step 0 — UI language */}
        {step === 0 && (
          <Step
            title={t('onboarding.chooseLanguage')}
            hint="زبان پیش‌فرض از تلگرام شما گرفته شده است"
          >
            <div className="space-y-2">
              {UI_LANGUAGES.map((lang) => (
                <OptionRow
                  key={lang.code}
                  active={uiLang === lang.code}
                  onClick={() => pickUiLanguage(lang.code)}
                  label={lang.labelFa}
                  sub={lang.labelEn}
                  icon={lang.flag}
                />
              ))}
            </div>
          </Step>
        )}

        {/* Step 1 — target language */}
        {step === 1 && (
          <Step title={t('onboarding.chooseTarget')}>
            <div className="grid grid-cols-2 gap-2">
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    haptic('select');
                    setTargetLang(lang.code);
                  }}
                  className={clsx(
                    'rounded-xl border p-3.5 text-start transition active:scale-[0.98]',
                    targetLang === lang.code
                      ? 'border-accent bg-accent-soft ring-accent-soft'
                      : 'border-border bg-card'
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <p className="mt-1.5 text-sm font-semibold text-text">{lang.labelFa}</p>
                  <p className="text-[10px] text-text-hint">{lang.labelEn}</p>
                </button>
              ))}
            </div>
          </Step>
        )}

        {/* Step 2 — level */}
        {step === 2 && (
          <Step title={t('onboarding.chooseLevel')}>
            <div className="space-y-2">
              {SKILL_LEVELS.map((lvl) => (
                <OptionRow
                  key={lvl.code}
                  active={level === lvl.code}
                  onClick={() => {
                    haptic('select');
                    setLevel(lvl.code);
                  }}
                  label={lvl.labelFa}
                  sub={lvl.hintFa}
                  badge={lvl.code}
                />
              ))}
            </div>
          </Step>
        )}

        {/* Step 3 — goal */}
        {step === 3 && (
          <Step title={t('onboarding.chooseGoal')}>
            <div className="grid grid-cols-2 gap-2">
              {LEARNING_GOALS.map((g) => (
                <button
                  key={g.code}
                  type="button"
                  onClick={() => {
                    haptic('select');
                    setGoal(g.code);
                  }}
                  className={clsx(
                    'rounded-xl border p-3.5 text-start transition active:scale-[0.98]',
                    goal === g.code
                      ? 'border-accent bg-accent-soft ring-accent-soft'
                      : 'border-border bg-card'
                  )}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <p className="mt-1.5 text-xs font-semibold leading-snug text-text">
                    {g.labelFa}
                  </p>
                </button>
              ))}
            </div>
          </Step>
        )}
      </div>

      {/* Footer */}
      <div className="safe-bottom border-t border-border bg-bg px-5 py-4">
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                haptic('tap');
                setStep((s) => s - 1);
              }}
            >
              {t('common.back')}
            </Button>
          )}

          {step < 3 ? (
            <Button fullWidth onClick={next}>
              {t('common.next')}
            </Button>
          ) : (
            <Button fullWidth loading={onboarding.isPending} onClick={() => void submit()}>
              🚀 {t('onboarding.startLearning')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="text-lg font-bold leading-snug text-text">{title}</h2>
        {hint && <p className="mt-1 text-xs text-text-hint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionRow({
  active,
  onClick,
  label,
  sub,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  icon?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl border p-3.5 text-start transition active:scale-[0.99]',
        active
          ? 'border-accent bg-accent-soft ring-accent-soft'
          : 'border-border bg-card'
      )}
    >
      {icon && <span className="text-xl">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        {sub && <p className="text-[11px] text-text-hint">{sub}</p>}
      </div>
      {badge && (
        <span className="shrink-0 rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-text-hint">
          {badge}
        </span>
      )}
      {active && <span className="shrink-0 text-accent">✓</span>}
    </button>
  );
}
