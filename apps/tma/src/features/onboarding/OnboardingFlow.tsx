import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  UI_LANGUAGES,
  LEARNING_GOALS,
  SKILL_LEVELS,
  type SupportedUiLanguage,
  type SupportedTargetLanguage,
  type SkillLevel,
} from '@kpanah/shared';
import { Button, ProgressBar } from '../../components/ui';
import { LanguageSelect } from '../../components/LanguageSelect';
import { useOnboarding } from '../../hooks/useApi';
import { useUiStore } from '../../store/ui';
import { haptic } from '../../lib/telegram';

/**
 * First-run onboarding — redesigned order:
 *
 *   0. Interface language (defaults to Telegram)
 *   1. Learning language (+ dialect for English/Spanish/…)
 *   2. Goal                      ← first, so the level list can adapt
 *   3. Level (options depend on the chosen goal)
 *   4. Daily time budget
 *   5. Placement test            ← skipped for "from zero"
 *   6. Creating the first cycle
 *
 * The placement step is a short adaptive quiz. It only runs when the user
 * claims some prior knowledge; a true beginner goes straight to the first
 * cycle, which starts from the alphabet/first words.
 */

type Step = 'uiLang' | 'target' | 'goal' | 'level' | 'time' | 'placement' | 'creating';

/** بازه‌های زمانی روزانهٔ پیشنهادی (دقیقهٔ نماینده) */
const TIME_OPTIONS: { minutes: number; labelFa: string; labelEn: string; icon: string }[] = [
  { minutes: 10, labelFa: 'کمتر از ۱۵ دقیقه', labelEn: 'Under 15 min', icon: '⏱️' },
  { minutes: 22, labelFa: '۱۵ تا ۳۰ دقیقه', labelEn: '15–30 min', icon: '🕐' },
  { minutes: 37, labelFa: '۳۰ تا ۴۵ دقیقه', labelEn: '30–45 min', icon: '🕑' },
  { minutes: 52, labelFa: '۴۵ دقیقه تا ۱ ساعت', labelEn: '45–60 min', icon: '⏳' },
  { minutes: 75, labelFa: 'بیش از ۱ ساعت', labelEn: 'Over 1 hour', icon: '🔥' },
];

/** توضیح سطح‌ها به تفکیک هدف — همان لول، زبان متفاوت */
const GOAL_LEVEL_HINTS: Record<string, Record<SkillLevel, string>> = {
  TRAVEL: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'کلمات پایهٔ سفر (سلام، هتل، تاکسی) را می‌دانم',
    A2: 'می‌توانم سؤال‌های سادهٔ سفر بپرسم',
    B1: 'در سفر معمولی راحت گفت‌وگو می‌کنم',
    B2: 'در سفر روان صحبت می‌کنم',
    C1: 'تسلط کامل دارم',
  },
  BUSINESS: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'ایمیل و پیام ساده می‌نویسم',
    A2: 'در جلسات کوتاه مشارکت می‌کنم',
    B1: 'مذاکرهٔ ساده انجام می‌دهم',
    B2: 'در جلسات کاری روان صحبت می‌کنم',
    C1: 'مذاکرهٔ حرفه‌ای و ارائه می‌دهم',
  },
  EXAM: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'با ساختار آزمون آشنا هستم',
    A2: 'در بخش‌های ساده نمرهٔ متوسط می‌گیرم',
    B1: 'نمرهٔ حدود ۵.۵ تا ۶.۵ می‌گیرم',
    B2: 'نمرهٔ حدود ۶.۵ تا ۷.۵ می‌گیرم',
    C1: 'نمرهٔ بالای ۷.۵ می‌گیرم',
  },
  DAILY: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'کلمات روزمره را می‌دانم',
    A2: 'گفت‌وگوی سادهٔ روزمره دارم',
    B1: 'روزمره راحت صحبت می‌کنم',
    B2: 'روان و طبیعی صحبت می‌کنم',
    C1: 'مثل زبان مادری صحبت می‌کنم',
  },
  MIGRATION: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'برای کارهای روزمره کلمات پایه می‌دانم',
    A2: 'از پس موقعیت‌های سادهٔ اداری برمی‌آیم',
    B1: 'در زندگی روزمره راحت حرف می‌زنم',
    B2: 'روان صحبت می‌کنم',
    C1: 'در همهٔ موقعیت‌ها مسلطم',
  },
  ACADEMIC: {
    ZERO: 'هیچ آشنایی ندارم',
    A1: 'متون ساده را می‌فهمم',
    A2: 'مقالهٔ ساده می‌خوانم',
    B1: 'متن دانشگاهی را می‌فهمم',
    B2: 'می‌توانم مقاله بنویسم',
    C1: 'سطح پژوهشی و آکادمیک دارم',
  },
};

/** پرسش‌های کوتاه تعیین سطح (نمونه — سطح دشواری پله‌ای) */
const PLACEMENT_QUESTIONS: {
  level: SkillLevel;
  prompt: string;
  options: string[];
  correctIndex: number;
}[] = [
  {
    level: 'A1',
    prompt: 'Choose the correct word: “I ___ a student.”',
    options: ['am', 'is', 'are', 'be'],
    correctIndex: 0,
  },
  {
    level: 'A1',
    prompt: 'What is the plural of “child”?',
    options: ['childs', 'children', 'childes', 'child'],
    correctIndex: 1,
  },
  {
    level: 'A2',
    prompt: 'She ___ to the gym every morning.',
    options: ['go', 'goes', 'going', 'gone'],
    correctIndex: 1,
  },
  {
    level: 'A2',
    prompt: 'Choose the correct past form: “Yesterday I ___ a film.”',
    options: ['watch', 'watches', 'watched', 'watching'],
    correctIndex: 2,
  },
  {
    level: 'B1',
    prompt: 'If I ___ more time, I would travel the world.',
    options: ['have', 'had', 'will have', 'has'],
    correctIndex: 1,
  },
  {
    level: 'B1',
    prompt: 'He has been working here ___ 2019.',
    options: ['for', 'since', 'from', 'during'],
    correctIndex: 1,
  },
  {
    level: 'B2',
    prompt: 'The report, ___ was published yesterday, caused a stir.',
    options: ['who', 'which', 'whose', 'whom'],
    correctIndex: 1,
  },
  {
    level: 'C1',
    prompt: 'Hardly ___ the meeting begun when the power failed.',
    options: ['has', 'had', 'have', 'was'],
    correctIndex: 1,
  },
];

export function OnboardingFlow() {
  const { t } = useTranslation();
  const setUiLanguage = useUiStore((s) => s.setUiLanguage);
  const onboarding = useOnboarding();

  const [step, setStep] = useState<Step>('uiLang');
  const [uiLang, setUiLang] = useState<string>(
    useUiStore.getState().uiLanguage ?? 'fa'
  );
  const [targetLang, setTargetLang] = useState<string>('en');
  const [dialect, setDialect] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('DAILY');
  const [level, setLevel] = useState<SkillLevel>('ZERO');
  const [minutes, setMinutes] = useState<number | null>(null);
  const [placementScore, setPlacementScore] = useState<number | null>(null);
  const [placementLevel, setPlacementLevel] = useState<SkillLevel | null>(null);

  const ORDER: Step[] = [
    'uiLang',
    'target',
    'goal',
    'level',
    'time',
    ...(level === 'ZERO' ? ([] as Step[]) : (['placement'] as Step[])),
    'creating',
  ];
  const idx = ORDER.indexOf(step);
  const totalSteps = ORDER.length - 1;
  const progress = Math.max(0, idx);

  const goNext = () => {
    haptic('tap');
    const next = ORDER[Math.min(idx + 1, ORDER.length - 1)] ?? 'creating';
    setStep(next);
  };

  const goBack = () => {
    haptic('tap');
    const prev = ORDER[Math.max(idx - 1, 0)] ?? 'uiLang';
    setStep(prev);
  };

  const submit = async (finalLevel: SkillLevel) => {
    haptic('success');
    setStep('creating');
    try {
      await onboarding.mutateAsync({
        uiLanguage: uiLang as SupportedUiLanguage,
        targetLanguage: targetLang as SupportedTargetLanguage,
        skillLevel: finalLevel,
        learningGoal: goal,
        dialect: dialect,
        dailyMinutes: minutes,
        placement:
          placementScore !== null
            ? { score: placementScore, estimatedLevel: finalLevel, answers: PLACEMENT_QUESTIONS.length }
            : null,
      });
    } catch {
      setStep('placement');
    }
  };

  // ── Creating state ────────────────────────────────────────────────
  if (step === 'creating') {
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
            <Button size="sm" onClick={() => void submit(level)}>
              {t('common.retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const levelHints = GOAL_LEVEL_HINTS[goal] ?? GOAL_LEVEL_HINTS['DAILY']!;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="safe-top px-5 pt-4">
        <ProgressBar value={progress} max={totalSteps} height={5} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* 0 — interface language */}
        {step === 'uiLang' && (
          <Step title={t('onboarding.chooseLanguage')} hint={t('onboarding.uiLangHint')}>
            <div className="space-y-2">
              {UI_LANGUAGES.map((lang) => (
                <OptionRow
                  key={lang.code}
                  active={uiLang === lang.code}
                  onClick={() => {
                    haptic('select');
                    setUiLang(lang.code);
                    setUiLanguage(lang.code as SupportedUiLanguage);
                  }}
                  label={lang.nativeName}
                  sub={lang.labelEn}
                  icon={lang.flag}
                />
              ))}
            </div>
            <div className="pt-1">
              <LanguageSelect
                label={t('settings.otherLanguages')}
                value={uiLang}
                onChange={(code) => {
                  setUiLang(code);
                  setUiLanguage(code as SupportedUiLanguage);
                }}
              />
            </div>
          </Step>
        )}

        {/* 1 — target language (+dialect) */}
        {step === 'target' && (
          <Step title={t('onboarding.chooseTarget')} hint={t('settings.dialectHint')}>
            <LanguageSelect
              label={t('onboarding.chooseTarget')}
              value={targetLang}
              dialect={dialect}
              onChange={(code) => {
                setTargetLang(code);
                setDialect(null);
              }}
              onDialect={(code) => setDialect(code || null)}
            />
          </Step>
        )}

        {/* 2 — goal */}
        {step === 'goal' && (
          <Step title={t('onboarding.chooseGoal')}>
            <div className="grid grid-cols-2 gap-2">
              {LEARNING_GOALS.map((g) => (
                <button
                  key={g.code}
                  type="button"
                  onClick={() => {
                    haptic('select');
                    setGoal(g.code);
                    setLevel('ZERO');
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

        {/* 3 — level (goal-aware hints) */}
        {step === 'level' && (
          <Step title={t('onboarding.chooseLevel')} hint={t('onboarding.levelHint')}>
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
                  sub={levelHints[lvl.code]}
                  badge={lvl.code}
                />
              ))}
            </div>
          </Step>
        )}

        {/* 4 — daily time */}
        {step === 'time' && (
          <Step title={t('onboarding.chooseTime')} hint={t('onboarding.timeHint')}>
            <div className="space-y-2">
              {TIME_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.minutes}
                  active={minutes === opt.minutes}
                  onClick={() => {
                    haptic('select');
                    setMinutes(opt.minutes);
                  }}
                  label={opt.labelFa}
                  sub={opt.labelEn}
                  icon={opt.icon}
                />
              ))}
            </div>
          </Step>
        )}

        {/* 5 — placement test */}
        {step === 'placement' && (
          <PlacementTest
            goal={goal}
            onDone={(score, estimated) => {
              setPlacementScore(score);
              setPlacementLevel(estimated);
              setLevel(estimated);
              void submit(estimated);
            }}
            onSkip={() => void submit(level)}
          />
        )}
      </div>

      {/* Footer */}
      {step !== 'placement' && (
        <div className="safe-bottom border-t border-border bg-bg px-5 py-4">
          <div className="flex gap-2">
            {idx > 0 && (
              <Button variant="secondary" onClick={goBack}>
                {t('common.back')}
              </Button>
            )}
            {step === 'time' ? (
              <Button
                fullWidth
                disabled={minutes === null}
                loading={onboarding.isPending}
                onClick={() => {
                  if (level === 'ZERO') void submit('ZERO');
                  else goNext();
                }}
              >
                🚀 {level === 'ZERO' ? t('onboarding.startLearning') : t('common.next')}
              </Button>
            ) : (
              <Button fullWidth onClick={goNext}>
                {t('common.next')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** آزمون تعیین سطح کوتاه — نتیجه به سطح تخمینی نگاشت می‌شود */
function PlacementTest({
  goal,
  onDone,
  onSkip,
}: {
  goal: string;
  onDone: (score: number, estimated: SkillLevel) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);

  const q = PLACEMENT_QUESTIONS[i];
  const progress = i;

  if (!q) return null;

  const answer = (idx: number) => {
    haptic('select');
    const isRight = idx === q.correctIndex;
    const nextCorrect = correct + (isRight ? 1 : 0);
    if (i + 1 >= PLACEMENT_QUESTIONS.length) {
      const score = Math.round((nextCorrect / PLACEMENT_QUESTIONS.length) * 100);
      onDone(score, estimateLevel(score));
    } else {
      setCorrect(nextCorrect);
      setI(i + 1);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <ProgressBar value={progress} max={PLACEMENT_QUESTIONS.length} height={4} />

      <div>
        <h2 className="text-lg font-bold leading-snug text-text">
          {t('onboarding.placementTitle')}
        </h2>
        <p className="mt-1 text-xs text-text-hint">{t('onboarding.placementHint')}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-text target-text" dir="ltr">
          {q.prompt}
        </p>
      </div>

      <div className="space-y-2">
        {q.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => answer(idx)}
            className="w-full rounded-xl border border-border bg-card p-3.5 text-start text-sm text-text transition active:scale-[0.99] target-text"
            dir="ltr"
          >
            {opt}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          haptic('tap');
          onSkip();
        }}
        className="w-full py-2 text-center text-xs text-text-hint underline"
      >
        {t('onboarding.skipPlacement')}
      </button>
    </div>
  );
}

/** نگاشت امتیاز به سطح تخمینی */
function estimateLevel(score: number): SkillLevel {
  if (score >= 88) return 'C1';
  if (score >= 75) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 35) return 'A2';
  return 'A1';
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
        active ? 'border-accent bg-accent-soft ring-accent-soft' : 'border-border bg-card'
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
