import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  UI_LANGUAGES,
  LEARNING_GOALS,
  findLanguage,
  dialectsFor,
  type SupportedUiLanguage,
} from '@kpanah/shared';
import { Card, Button, Chip } from '../../components/ui';
import { LanguageSelect } from '../../components/LanguageSelect';
import { Portal } from '../../components/Portal';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';
import { useUpdateProfile, useDeleteAccount } from '../../hooks/useApi';
import { haptic, showConfirm, closeApp } from '../../lib/telegram';

/** کلید ذخیرهٔ ترجیح یادآور روزانه */
const REMINDER_KEY = 'kpanah.reminder';

function readReminderPref(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) !== '0';
  } catch {
    return true;
  }
}

function setReminderPref(v: boolean): void {
  try {
    localStorage.setItem(REMINDER_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** ساعت یادآور روزانه (پیش‌فرض ۲۰:۰۰) */
const REMINDER_TIME_KEY = 'kpanah.reminderTime';

function readReminderTime(): string {
  try {
    return localStorage.getItem(REMINDER_TIME_KEY) ?? '20:00';
  } catch {
    return '20:00';
  }
}

function setReminderTimePref(v: string): void {
  try {
    localStorage.setItem(REMINDER_TIME_KEY, v);
  } catch {
    /* ignore */
  }
}

/**
 * Settings tab — interface language, learning language, goal,
 * and the account-deletion ("right to be forgotten") action required
 * by the spec: one click removes all data.
 */
/** همان گزینه‌های سؤال onboarding — نه اعداد دلخواه */
const DAILY_MINUTE_OPTIONS = [
  { minutes: 10, label: '<15' },
  { minutes: 20, label: '15-30' },
  { minutes: 35, label: '30-45' },
  { minutes: 50, label: '45-60' },
  { minutes: 75, label: '>60' },
] as const;

export function SettingsTab() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const setUiLanguage = useUiStore((s) => s.setUiLanguage);
  const showToast = useUiStore((s) => s.showToast);
  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);

  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [deleting, setDeleting] = useState(false);
  const [reminderOn, setReminderOn] = useState(readReminderPref());
  const [reminderTime, setReminderTime] = useState<string>(readReminderTime());
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const [multiLang, setMultiLang] = useState(false);

  if (!user) return null;

  // اطلاعات زبان یادگیری (فقط نمایش)
  const targetLangInfo = findLanguage(user.targetLanguage);
  const dialectInfo =
    user.dialect && dialectsFor(user.targetLanguage).some((d) => d.code === user.dialect)
      ? (dialectsFor(user.targetLanguage).find((d) => d.code === user.dialect)?.nativeName ??
        null)
      : null;

  const changeUiLanguage = async (lang: SupportedUiLanguage) => {
    haptic('select');
    setUiLanguage(lang);
    try {
      await updateProfile.mutateAsync({ uiLanguage: lang });
      showToast(t('settings.saved'), 'success');
    } catch {
      showToast(t('errors.generic'), 'error');
    }
  };

  /** تغییر بودجهٔ زمانی روزانه — در چرخهٔ **بعدی** اعمال می‌شود */
  const changeDailyMinutes = async (minutes: number) => {
    try {
      haptic('select');
      await updateProfile.mutateAsync({ dailyMinutes: minutes });
      showToast(t('settings.dailyMinutesSaved'), 'success');
    } catch {
      showToast(t('errors.server_error'), 'error');
    }
  };

  const changeGoal = async (goal: string) => {
    haptic('select');
    try {
      await updateProfile.mutateAsync({ learningGoal: goal });
      showToast(t('settings.saved'), 'success');
    } catch {
      showToast(t('errors.generic'), 'error');
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm(t('settings.deleteConfirm'));
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount.mutateAsync();
      // پس از حذف کامل، اپ بلافاصله بسته می‌شود
      closeApp();
    } catch {
      showToast(t('errors.generic'), 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-base font-bold text-text">{t('settings.title')}</h2>

      {/* Interface language */}
      <Card>
        <p className="mb-2.5 text-xs font-semibold text-text">{t('settings.uiLanguage')}</p>
        <div className="flex flex-wrap gap-2">
          {UI_LANGUAGES.map((lang) => (
            <SelectChip
              key={lang.code}
              active={user.uiLanguage === lang.code}
              onClick={() => void changeUiLanguage(lang.code as SupportedUiLanguage)}
            >
              {lang.flag} {lang.nativeName}
            </SelectChip>
          ))}
        </div>
        <div className="mt-3">
          <LanguageSelect
            label={t('settings.otherLanguages')}
            value={user.uiLanguage}
            onChange={(code) => void changeUiLanguage(code as SupportedUiLanguage)}
          />
        </div>
      </Card>

      {/* Learning language — خواندنی.
          ویرایش زبان هدف عمداً قفل شده: در نسخهٔ دوم کاربر می‌تواند چند زبان
          (دوم/سوم/…) انتخاب کند و هر زبان اشتراک و آمار مستقل دارد. */}
      <Card>
        <p className="mb-2.5 text-xs font-semibold text-text">
          {t('settings.targetLanguage')}
        </p>

        <div className="flex items-center justify-between rounded-xl border border-border bg-[var(--surface-sunken)] px-3.5 py-3">
          <span className="flex items-center gap-2">
            <span className="text-xl">{targetLangInfo?.flag ?? '🌐'}</span>
            <span>
              <span className="block text-sm font-semibold text-text">
                {targetLangInfo?.nativeName ?? user.targetLanguage}
              </span>
              <span className="block text-[11px] text-text-hint">
                {targetLangInfo?.labelEn ?? ''}
                {dialectInfo ? ` · ${dialectInfo}` : ''}
              </span>
            </span>
          </span>
          <span className="text-xs text-text-hint">🔒</span>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-text-hint">
          {t('settings.languageLockedHint')}
        </p>

        <Button
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-3"
          onClick={() => {
            haptic('tap');
            setMultiLang(true);
          }}
        >
          🌐 {t('settings.manageLanguages')}
        </Button>
      </Card>

      {/* Learning goal */}
      <Card>
        <p className="mb-2.5 text-xs font-semibold text-text">{t('settings.learningGoal')}</p>
        <div className="grid grid-cols-2 gap-2">
          {LEARNING_GOALS.map((goal) => (
            <button
              key={goal.code}
              type="button"
              onClick={() => void changeGoal(goal.code)}
              className={clsx(
                'rounded-xl border p-2.5 text-start text-xs transition active:scale-[0.98]',
                user.learningGoal === goal.code
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-border bg-card text-text'
              )}
            >
              {goal.icon} {goal.labelFa}
            </button>
          ))}
        </div>
      </Card>

      {/* Daily time budget */}
      <Card>
        <p className="mb-1 text-xs font-semibold text-text">{t('settings.dailyMinutes')}</p>
        <p className="mb-2.5 text-[11px] leading-relaxed text-text-hint">
          {t('settings.dailyMinutesHint')}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {DAILY_MINUTE_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => void changeDailyMinutes(opt.minutes)}
              className={clsx(
                'rounded-xl border py-2 text-center text-[11px] transition active:scale-[0.98]',
                (user.dailyMinutes ?? 15) === opt.minutes
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-border bg-card text-text'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card>
        <p className="mb-2.5 text-xs font-semibold text-text">{t('settings.theme')}</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { mode: 'auto', icon: '🌗', label: t('settings.themeAuto') },
              { mode: 'light', icon: '☀️', label: t('settings.themeLight') },
              { mode: 'dark', icon: '🌙', label: t('settings.themeDark') },
            ] as const
          ).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => {
                haptic('select');
                setThemeMode(opt.mode);
              }}
              className={clsx(
                'rounded-xl border p-3 text-center text-xs transition active:scale-[0.98]',
                themeMode === opt.mode
                  ? 'border-accent bg-accent-soft font-semibold text-accent'
                  : 'border-border bg-card text-text'
              )}
            >
              <span className="block text-lg">{opt.icon}</span>
              <span className="mt-1 block">{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Daily reminder */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="min-w-0 pe-3">
            <p className="text-xs font-semibold text-text">{t('settings.notifications')}</p>
            <p className="text-[11px] text-text-hint">{t('settings.notificationsHint')}</p>
          </div>
          <Switch
            checked={reminderOn}
            onChange={(v) => {
              haptic('select');
              setReminderOn(v);
              setReminderPref(v);
              showToast(v ? t('settings.reminderOn') : t('settings.reminderOff'), 'success');
            }}
          />
        </div>

        {reminderOn && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[11px] text-text-hint">{t('settings.reminderTime')}</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => {
                setReminderTime(e.target.value);
                setReminderTimePref(e.target.value);
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
            />
          </div>
        )}
      </Card>

      {/* About */}
      <Card>
        <p className="mb-2 text-xs font-semibold text-text">{t('settings.about')}</p>
        <p className="mb-3 text-[11px] leading-relaxed text-text-hint">
          {t('settings.aboutBody')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLegal('privacy')}
            className="flex-1 rounded-xl border border-border bg-card py-2 text-center text-[11px] font-medium text-text transition active:scale-95"
          >
            🔒 {t('settings.privacy')}
          </button>
          <button
            type="button"
            onClick={() => setLegal('terms')}
            className="flex-1 rounded-xl border border-border bg-card py-2 text-center text-[11px] font-medium text-text transition active:scale-95"
          >
            📜 {t('settings.terms')}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-text-muted">
          {t('settings.versionLabel')} 0.1.0
        </p>
      </Card>

      {legal && <LegalSheet kind={legal} onClose={() => setLegal(null)} />}
      {multiLang && <MultiLanguageSheet onClose={() => setMultiLang(false)} />}

      {/* Danger zone */}
      <Card className="border-danger-soft">
        <p className="mb-1 text-xs font-semibold text-danger-500">
          {t('settings.dangerZone')}
        </p>
        <p className="mb-3 text-[11px] leading-relaxed text-text-hint">
          {t('settings.deleteAccountHint')}
        </p>
        <Button
          variant="danger"
          size="sm"
          fullWidth
          loading={deleting}
          onClick={() => void handleDelete()}
        >
          🗑 {t('settings.deleteAccount')}
        </Button>
      </Card>
    </div>
  );
}

function SelectChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-pill border px-3.5 py-2 text-xs transition active:scale-95',
        active
          ? 'border-accent bg-accent text-accent-text font-semibold'
          : 'border-border bg-card text-text'
      )}
    >
      {children}
    </button>
  );
}

/** سوییچ سبک برای تنظیمات دودویی */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-[var(--surface-sunken)] border border-border'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
          checked ? 'start-[22px]' : 'start-0.5'
        )}
      />
    </button>
  );
}

/** پاپ‌آپ متن حقوقی (حریم خصوصی / شرایط استفاده) با محتوای مخصوص خودش */function LegalSheet({
  kind,
  onClose,
}: {
  kind: 'privacy' | 'terms';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title = kind === 'privacy' ? t('settings.privacy') : t('settings.terms');
  const body = kind === 'privacy' ? t('legal.privacyBody') : t('legal.termsBody');

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 animate-fade-in"
        onClick={onClose}
      >
        {/* ⚠️ flex-col + min-h-0 روی متن، تا متن بلند اسکرول شود (قبلاً بریده می‌شد) */}
        <div
          className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border glass-strong"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
            <h3 className="text-sm font-bold text-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="px-1 text-lg leading-none text-text-hint"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-line px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] leading-relaxed text-text-hint">
            {body}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * مدیریت زبان‌ها — نسخهٔ دوم.
 *
 * در نسخهٔ بعدی کاربر می‌تواند چند زبان (دوم، سوم، …) را همزمان یاد بگیرد؛
 * هر زبان اشتراک، چرخه، لایتنر و آمار مستقل خودش را دارد تا داده‌ها قاطی
 * نشوند. فعلاً فقط زبان فعال نمایش داده می‌شود و افزودن زبان غیرفعال است.
 */
function MultiLanguageSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const active = findLanguage(user?.targetLanguage);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 animate-fade-in"
        onClick={onClose}
      >
        <div
          className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border glass-strong"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
            <h3 className="text-sm font-bold text-text">{t('settings.manageLanguages')}</h3>
            <button
              type="button"
              onClick={onClose}
              className="px-1 text-lg leading-none text-text-hint"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* زبان فعال */}
            <div className="flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-3.5 py-3">
              <span className="flex items-center gap-2">
                <span className="text-xl">{active?.flag ?? '🌐'}</span>
                <span>
                  <span className="block text-sm font-semibold text-text">
                    {active?.nativeName ?? user?.targetLanguage}
                  </span>
                  <span className="block text-[11px] text-text-hint">
                    {active?.labelEn ?? ''}
                  </span>
                </span>
              </span>
              <Chip tone="success">{t('common.active')}</Chip>
            </div>

            {/* توضیح نسخهٔ دوم */}
            <div className="rounded-xl border border-dashed border-border bg-[var(--surface-sunken)] p-3.5">
              <p className="mb-1 text-xs font-semibold text-text">
                {t('settings.multiLangTitle')}
              </p>
              <p className="text-[11px] leading-relaxed text-text-hint">
                {t('settings.multiLangBody')}
              </p>
            </div>

            <Button variant="secondary" size="sm" fullWidth disabled>
              + {t('settings.addLanguage')}
            </Button>
            <p className="text-center text-[10px] text-text-muted">
              {t('settings.comingSoonV2')}
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
