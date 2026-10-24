import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Roadmap } from './Roadmap';
import { LessonCard } from './LessonCard';
import { useHome, useRetryCycle, useDueReviews } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { ReviewSession } from './ReviewSession';
import { CalibrationFlow } from './CalibrationFlow';
import { DelayedCheck } from './DelayedCheck';
import { RoleplayFlow } from './RoleplayFlow';
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

  /**
   * ⚠️ polling سبک: فقط `gen-status` (۲ کوئری) هر ۵ ثانیه، و به‌محض آماده
   * شدن درس یک‌بار `home` تازه می‌شود. قبلاً خودِ `home` هر ۵ ثانیه اجرا
   * می‌شد و سهمیهٔ درخواست کلادفلر را می‌سوزاند.
   */
  useEffect(() => {
    if (!data?.generating) return;
    const id = setInterval(() => {
      void api
        .genStatus()
        .then((s) => {
          if (s.ready) void refetch();
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [data?.generating, refetch]);
  const user = useSessionStore((s) => s.user);
  const retry = useRetryCycle();
  const due = useDueReviews();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [delayedOpen, setDelayedOpen] = useState(false);
  const [roleplayOpen, setRoleplayOpen] = useState(false);
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

  /**
   * ⚠️ باگ رفع‌شده: این صفحه هر بار که `lesson` null بود نشان داده می‌شد —
   * حتی وقتی چرخه فقط ۲ روز از ۷ روز پیش رفته بود. حالا فقط وقتی چرخه
   * **واقعاً کامل** شده (۷ از ۷) این صفحه می‌آید.
   */
  const completedDays = data.cycle.progress.completedDays;
  const totalDays = data.cycle.progress.totalDays;
  if (!data.lesson && completedDays >= totalDays) {
    return <CycleCompleteState />;
  }

  // ── 4. Active lesson ──────────────────────────────────────────────
  const dueItems = due.data?.items ?? [];

  // درس آماده شد → مارکر تایمر تولید پاک شود
  try {
    localStorage.removeItem('kpanah:genStartedAt');
  } catch {
    /* ignore */
  }

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

      {/* نقش‌آفرینی — بخشی از قوس چرخه (روز ۵ به بعد) */}
      {data.map?.calibrated && data.lesson && data.lesson.dayNumber >= 5 && (
        <Card className="border-brand-200 bg-brand-50/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text">
                🎭 {t('roleplay.cardTitle')}
              </p>
              <p className="mt-0.5 text-[11px] text-text-hint">
                {t('roleplay.cardHintDay', { day: data.lesson.dayNumber })}
              </p>
            </div>
            <Button size="sm" onClick={() => setRoleplayOpen(true)}>
              {t('roleplay.open')}
            </Button>
          </div>
        </Card>
      )}

      {roleplayOpen && <RoleplayFlow onClose={() => setRoleplayOpen(false)} />}

      {/* مرور تأخیری — ماندگاری (روزی یک‌بار) */}
      {data.map?.calibrated &&
        (() => {
          try {
            return !localStorage.getItem(`kpanah:delayed:${new Date().toDateString()}`);
          } catch {
            return true;
          }
        })() && (
        <Card className="border-dashed">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text">⏳ {t('delayed.cardTitle')}</p>
              <p className="mt-0.5 text-[11px] text-text-hint">{t('delayed.cardHint')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setDelayedOpen(true)}>
              {t('delayed.open')}
            </Button>
          </div>
        </Card>
      )}

      {delayedOpen && <DelayedCheck onClose={() => setDelayedOpen(false)} />}

      {/* کالیبراسیون — سطح برآوردی */}
      {data.map && !data.map.calibrated && (
        <Card className="border-brand-200 bg-brand-50/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">🎯 {t('calibration.title')}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-hint">
                {t('calibration.subtitle')}
              </p>
            </div>
            <Button size="sm" onClick={() => setCalibrationOpen(true)}>
              {t('calibration.start')}
            </Button>
          </div>
        </Card>
      )}

      {calibrationOpen && (
        <CalibrationFlow
          onClose={() => setCalibrationOpen(false)}
          onDone={() => {
            setCalibrationOpen(false);
            void refetch();
          }}
        />
      )}

      {/* نقشهٔ ثابت — مرحلهٔ جاری */}
      {data.map && (
        <Card className="border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-text-hint">
                🗺 {t('learn.stageOf', {
                  current: data.map.stageIndex,
                  total: data.map.totalStages,
                })}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-text">
                {data.map.currentStage}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-hint">
                {data.map.objective}
              </p>
            </div>
            <span className="chip shrink-0 bg-brand-50 text-brand-700">
              v{data.map.version}
            </span>
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
        <Roadmap
          days={
            !data.lesson
              ? data.cycle.days.map((d) =>
                  d.status === 'AVAILABLE'
                    ? { ...d, status: 'LOCKED' as const, isActive: false, isLocked: true }
                    : d
                )
              : data.cycle.days
          }
        />
      </Card>

      {/* Today's lesson — یا شمارش معکوس نیمه‌شب محلی */}
      {data.lesson ? (
        <LessonCard
          lesson={data.lesson}
          dayNumber={data.lesson.dayNumber}
          completedDays={data.cycle.progress.completedDays}
          totalDays={data.cycle.progress.totalDays}
          partsDone={(() => {
            // سرور اولویت دارد (مستقل از دستگاه)
            if (typeof data.partsDone === 'number') return data.partsDone;
            try {
              const id = data.lesson.id;
              if (localStorage.getItem(`kpanah:part3:${id}`)) return 3;
              if (localStorage.getItem(`kpanah:part2:${id}`)) return 2;
              if (localStorage.getItem(`kpanah:part1:${id}`)) return 1;
              return 0;
            } catch {
              return 0;
            }
          })()}
          onStart={(part) => {
            // بخش انتخاب‌شده را به پلیر منتقل کن
            try {
              localStorage.setItem('kpanah:startPart', String(part ?? 1));
            } catch {
              /* ignore */
            }
            onStartLesson();
          }}
        />
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <p className="text-sm font-semibold text-text">🌙 {t('learn.doneForToday')}</p>
            <p className="text-xs text-text-hint">{t('learn.nextLessonAtMidnight')}</p>
            <WaitTimer
              minutes={minutesUntilLocalMidnight(data.nextUnlockAt)}
              label={t('learn.untilNextLesson')}
            />
          </div>
        </Card>
      )}

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

      {generating ? (
        <>
          <WaitTimer
            minutes={15}
            label={t('learn.estimatedWait')}
            persistKey="kpanah:genStartedAt"
          />
          <p className="max-w-[260px] text-[11px] leading-relaxed text-text-muted">
            {t('learn.firstWaitNote')}
          </p>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * تایمر نمایشی (نه منطقی): فقط برای این‌که انتظار «قابل‌درک» باشد.
 * ⚠️ به‌محض آماده شدن محتوا، کل این صفحه با محتوای واقعی جایگزین می‌شود.
 */
function WaitTimer({
  minutes,
  label,
  persistKey,
}: {
  minutes: number;
  label: string;
  /** اگر داده شود، شمارش با رفرش/تغییر صفحه از صفر شروع نمی‌شود */
  persistKey?: string;
}) {
  const [left, setLeft] = useState(() => {
    if (!persistKey) return minutes * 60;
    try {
      const raw = localStorage.getItem(persistKey);
      let started = raw ? Number(raw) : NaN;
      if (!Number.isFinite(started) || started <= 0) {
        started = Date.now();
        localStorage.setItem(persistKey, String(started));
      }
      const endAt = started + minutes * 60_000;
      return Math.max(0, Math.round((endAt - Date.now()) / 1000));
    } catch {
      return minutes * 60;
    }
  });

  useEffect(() => {
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // ⚠️ ساعت:دقیقه:ثانیه — قبلاً دقیقه:ثانیه بود و «۱۳۵۴:۴۱» عجیب دیده می‌شد
  const hh = String(Math.floor(left / 3600)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="rounded-xl border border-border bg-[var(--surface-sunken)] px-4 py-2">
      <p className="font-mono text-lg font-bold text-text" dir="ltr">
        {hh}:{mm}:{ss}
      </p>
      <p className="text-[10px] text-text-hint">{label}</p>
    </div>
  );
}

/**
 * دقیقه تا باز شدن درس بعدی.
 * اگر سرور `nextUnlockAt` داده باشد همان، وگرنه نیمه‌شب محلی بعدی.
 * ⚠️ fallback لازم است: کلاینتی که پاسخ قدیمی/ناقص گرفته هم باید شمارش
 * درست نشان دهد، نه صفحهٔ «برنامه قفل شد».
 */
function minutesUntilLocalMidnight(iso?: string | null): number {
  if (iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isFinite(ms) && ms > 0) return Math.max(1, Math.round(ms / 60_000));
  }
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.round((midnight.getTime() - now.getTime()) / 60_000));
}

/**
 * «درس امروز تمام شد» — تا نیمه‌شبِ **ساعت خود کاربر** درس بعدی باز نیست.
 */
function NextUnlockState({ unlockAt }: { unlockAt: string }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(() => new Date(unlockAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(unlockAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [unlockAt]);

  const total = Math.max(0, left);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="text-5xl">🌙</div>
      <h2 className="text-lg font-bold text-text">{t('learn.doneForToday')}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-text-hint">
        {t('learn.nextLessonAtMidnight')}
      </p>

      <div className="mt-2 rounded-2xl border border-border bg-card px-6 py-4">
        <p className="font-mono text-2xl font-bold text-text" dir="ltr">
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </p>
        <p className="mt-1 text-[11px] text-text-hint">{t('learn.untilNextLesson')}</p>
      </div>
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
