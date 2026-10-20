import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Portal } from './Portal';

/**
 * انتخاب ساعت با ظاهر سفارشی (به‌جای دراپ‌داون بومی مرورگر که در تلگرام
 * زشت و گیج‌کننده است).
 *
 * مقدار خروجی `HH:MM` در بازهٔ ۲۴ ساعته است.
 */
export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const [hourStr, minuteStr] = (value || '09:00').split(':');
  const hour = Number(hourStr) || 0;
  const minute = Number(minuteStr) || 0;

  const pick = (h: number, m: number) => {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text transition active:scale-95"
        dir="ltr"
      >
        <span className="text-base">🕐</span>
        {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl bg-bg p-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{t('settings.reminderTime')}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-text-hint"
                >
                  ✕
                </button>
              </div>

              {/* ساعت — ۲۴ عدد در ۴ ستون */}
              <p className="mb-1 text-[11px] text-text-hint">{t('settings.timePickerHour')}</p>
              <div className="mb-3 grid grid-cols-6 gap-1.5">
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pick(h, minute)}
                    className={
                      h === hour
                        ? 'rounded-lg bg-accent py-1.5 text-xs font-bold text-accent-text'
                        : 'rounded-lg bg-[var(--surface-sunken)] py-1.5 text-xs text-text'
                    }
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>

              {/* دقیقه — گام ۵ دقیقه */}
              <p className="mb-1 text-[11px] text-text-hint">{t('settings.timePickerMinute')}</p>
              <div className="mb-4 grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pick(hour, m)}
                    className={
                      m === minute
                        ? 'rounded-lg bg-accent py-1.5 text-xs font-bold text-accent-text'
                        : 'rounded-lg bg-[var(--surface-sunken)] py-1.5 text-xs text-text'
                    }
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-text"
              >
                {t('common.done')}
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
