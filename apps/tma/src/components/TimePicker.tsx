import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Portal } from './Portal';

/**
 * انتخاب ساعت با **صفحهٔ ساعت آنالوگ**.
 *
 * الگو: اول ساعت را روی صفحه انتخاب می‌کنی (۱..۱۲ + AM/PM)، بعد دقیقه‌ها
 * (گام ۵ دقیقه) روی همان صفحه نمایش داده می‌شوند.
 *
 * خروجی `HH:MM` در بازهٔ ۲۴ ساعته است (همان قالبی که سرور انتظار دارد).
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
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');

  const [hStr, mStr] = (value || '09:00').split(':');
  const initialHour = Number(hStr);
  const initialMinute = Number(mStr);

  const [hour24, setHour24] = useState(Number.isFinite(initialHour) ? initialHour : 9);
  const [minute, setMinute] = useState(Number.isFinite(initialMinute) ? initialMinute : 0);

  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const cx = 120;
  const cy = 120;
  const radius = 92;

  const point = (index: number, r: number) => {
    const deg = index * 30 - 90;
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const setHourFromDial = (h12: number) => {
    const base = h12 % 12; // 12 → 0
    setHour24(meridiem === 'PM' ? base + 12 : base);
    setMode('minute');
  };

  const setMinuteFromDial = (m: number) => {
    setMinute(m);
    setMode('hour');
  };

  const commit = () => {
    onChange(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    setOpen(false);
  };

  const handIndex = mode === 'hour' ? hour12 % 12 : minute / 5;
  const handPoint = point(handIndex, mode === 'hour' ? 58 : 70);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode('hour');
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text transition active:scale-95"
        dir="ltr"
      >
        <span className="text-base">🕐</span>
        {String(hour24).padStart(2, '0')}:{String(minute).padStart(2, '0')}
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-xs rounded-t-3xl bg-bg p-4 sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* زمان انتخاب‌شده */}
              <div className="mb-2 flex items-end justify-center gap-1" dir="ltr">
                <button
                  type="button"
                  onClick={() => setMode('hour')}
                  className={
                    mode === 'hour'
                      ? 'rounded-lg px-2 text-3xl font-bold text-accent'
                      : 'rounded-lg px-2 text-3xl font-semibold text-text-muted'
                  }
                >
                  {String(hour24).padStart(2, '0')}
                </button>
                <span className="pb-1 text-3xl font-bold text-text-muted">:</span>
                <button
                  type="button"
                  onClick={() => setMode('minute')}
                  className={
                    mode === 'minute'
                      ? 'rounded-lg px-2 text-3xl font-bold text-accent'
                      : 'rounded-lg px-2 text-3xl font-semibold text-text-muted'
                  }
                >
                  {String(minute).padStart(2, '0')}
                </button>
              </div>

              {/* AM / PM — فقط در حالت ساعت */}
              {mode === 'hour' && (
                <div className="mb-2 flex justify-center gap-1">
                  {(['AM', 'PM'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const base = hour24 % 12;
                        setHour24(m === 'PM' ? base + 12 : base);
                      }}
                      className={
                        meridiem === m
                          ? 'rounded-lg border border-accent px-3 py-1 text-[11px] font-bold text-accent'
                          : 'rounded-lg border border-border px-3 py-1 text-[11px] text-text-muted'
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* صفحهٔ ساعت */}
              <svg viewBox="0 0 240 240" className="mx-auto block w-full max-w-[240px]">
                <circle cx={cx} cy={cy} r={radius + 8} fill="var(--surface-sunken)" />
                <circle cx={cx} cy={cy} r={4} fill="var(--text-muted, #6b7280)" />

                {/* عقربه */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={handPoint.x}
                  y2={handPoint.y}
                  stroke="var(--accent, #3b82f6)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {Array.from({ length: 12 }, (_, i) => {
                  const isHourMode = mode === 'hour';
                  const label = isHourMode
                    ? String(i === 0 ? 12 : i)
                    : String(i * 5).padStart(2, '0');
                  const active = isHourMode ? i === hour12 % 12 : i * 5 === minute;
                  const p = point(i, radius - 22);

                  return (
                    <g
                      key={i}
                      onClick={() =>
                        isHourMode ? setHourFromDial(i === 0 ? 12 : i) : setMinuteFromDial(i * 5)
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={18}
                        fill={active ? 'var(--accent, #3b82f6)' : 'transparent'}
                      />
                      <text
                        x={p.x}
                        y={p.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="15"
                        fontWeight={active ? 700 : 500}
                        fill={active ? '#fff' : 'var(--text-primary, #111827)'}
                        style={{ pointerEvents: 'none' }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <p className="mt-2 text-center text-[11px] text-text-hint">
                {mode === 'hour' ? t('settings.timePickerHour') : t('settings.timePickerMinute')}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-muted"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={commit}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-text"
                >
                  {t('common.done')}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
