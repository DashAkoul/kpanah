import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  UI_LANGUAGES,
  TARGET_LANGUAGES,
  LEARNING_GOALS,
  type SupportedUiLanguage,
  type SupportedTargetLanguage,
} from '@kpanah/shared';
import { Card, Button, Chip } from '../../components/ui';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';
import { useUpdateProfile, useDeleteAccount } from '../../hooks/useApi';
import { haptic, showConfirm } from '../../lib/telegram';

/**
 * Settings tab — interface language, learning language, goal,
 * and the account-deletion ("right to be forgotten") action required
 * by the spec: one click removes all data.
 */
export function SettingsTab() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const setUiLanguage = useUiStore((s) => s.setUiLanguage);
  const showToast = useUiStore((s) => s.showToast);

  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

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

  const changeTargetLanguage = async (lang: SupportedTargetLanguage) => {
    haptic('select');
    try {
      await updateProfile.mutateAsync({ targetLanguage: lang });
      showToast(t('settings.saved'), 'success');
    } catch {
      showToast(t('errors.generic'), 'error');
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
      showToast(t('settings.deleted'), 'success');
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
              onClick={() => void changeUiLanguage(lang.code)}
            >
              {lang.flag} {lang.labelFa}
            </SelectChip>
          ))}
        </div>
      </Card>

      {/* Target language */}
      <Card>
        <p className="mb-2.5 text-xs font-semibold text-text">
          {t('settings.targetLanguage')}
        </p>
        <div className="flex flex-wrap gap-2">
          {TARGET_LANGUAGES.map((lang) => (
            <SelectChip
              key={lang.code}
              active={user.targetLanguage === lang.code}
              onClick={() => void changeTargetLanguage(lang.code)}
            >
              {lang.flag} {lang.labelFa}
            </SelectChip>
          ))}
        </div>
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

      {/* Notifications (placeholder — wired in phase 2) */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-text">{t('settings.notifications')}</p>
          <p className="text-[11px] text-text-hint">{t('settings.notificationsHint')}</p>
        </div>
        <Chip>{t('store.comingSoon')}</Chip>
      </Card>

      {/* About */}
      <Card className="flex items-center justify-between">
        <span className="text-xs text-text-hint">{t('settings.about')}</span>
        <span className="text-xs text-text-muted">
          {t('settings.version', { version: '0.1.0' })}
        </span>
      </Card>

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
