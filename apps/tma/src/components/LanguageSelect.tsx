import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { LANGUAGE_CATALOG, type LanguageOption } from '@kpanah/shared';
import { haptic } from '../lib/telegram';
import { Portal } from './Portal';

/**
 * انتخابگر زبان (Bottom Sheet با جست‌وجو).
 *
 * دو نکتهٔ مهم که قبلاً باگ داشتند:
 *   ۱. شیت باید اسکرول شود — چیدمان `flex-col` با `min-h-0` روی لیست، وگرنه
 *      فقط چند ردیف اول دیده می‌شد (کاربر فکر می‌کرد فقط ۷ زبان هست).
 *   ۲. گویش جدا از زبان مدیریت می‌شود. قبلاً کد گویش (مثل `en-US`) به‌عنوان
 *      زبان هدف به سرور فرستاده می‌شد و اعتبارسنجی رد می‌کرد («خطایی رخ داد»).
 *
 * @param value      کد زبان پایه (مثل `en`)
 * @param dialect    کد گویش فعلی (مثل `en-US`) — اختیاری
 * @param onChange   انتخاب زبان پایه
 * @param onDialect  انتخاب گویش (اگر داده شود، ردیف گویش نمایش داده می‌شود)
 */
export function LanguageSelect({
  label,
  value,
  dialect = null,
  onChange,
  onDialect,
  hint,
}: {
  label: string;
  value: string;
  dialect?: string | null;
  onChange: (code: string) => void;
  onDialect?: (code: string) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // زبان پایه = بخش قبل از خط تیره (en-US → en)
  const base = (value ?? '').split('-')[0];

  const current = useMemo(
    () => LANGUAGE_CATALOG.find((l) => l.code === base),
    [base]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGE_CATALOG;
    return LANGUAGE_CATALOG.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.labelEn.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        (l.dialects ?? []).some(
          (d) =>
            d.nativeName.toLowerCase().includes(q) ||
            d.labelEn.toLowerCase().includes(q) ||
            d.code.toLowerCase().includes(q)
        )
    );
  }, [query]);

  const dialects = current?.dialects ?? [];
  const activeDialect = dialect ?? (value.includes('-') ? value : null);

  // گویش فعال را برای نمایش پیدا کن
  const activeDialectLabel = useMemo(() => {
    if (!activeDialect) return null;
    const d = dialects.find((x) => x.code === activeDialect);
    return d ? d.nativeName : activeDialect;
  }, [activeDialect, dialects]);

  // اگر زبان عوض شد و گویش فعلی دیگر معتبر نیست، پاکش کن
  useEffect(() => {
    if (!onDialect) return;
    if (dialect && !dialects.some((d) => d.code === dialect)) {
      onDialect('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          setQuery('');
          setOpen(true);
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3 text-start transition active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xl">{current?.flag ?? '🌐'}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-text">
              {current ? current.nativeName : value}
            </span>
            <span className="block truncate text-[11px] text-text-hint">
              {current ? current.labelEn : ''}
              {activeDialectLabel ? ` · ${activeDialectLabel}` : ''}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs text-text-hint">{label} ›</span>
      </button>

      {hint && <p className="mt-1 text-[11px] text-text-hint">{hint}</p>}

      {/* ردیف گویش — فقط وقتی زبان گویش دارد و انتخاب گویش فعال است */}
      {onDialect && dialects.length > 0 && (
        <div className="mt-2 rounded-xl border border-border bg-[var(--surface-sunken)] p-2.5">
          <p className="mb-1.5 text-[10px] font-medium text-text-hint">
            {current?.nativeName} — گویش / variant
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dialects.map((d) => {
              const active = activeDialect === d.code;
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => {
                    haptic('select');
                    onDialect(active ? '' : d.code);
                  }}
                  className={clsx(
                    'rounded-pill border px-3 py-1.5 text-[11px] transition active:scale-95',
                    active
                      ? 'border-accent bg-accent text-accent-text font-semibold'
                      : 'border-border bg-card text-text'
                  )}
                >
                  {d.nativeName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <Sheet
          title={label}
          onClose={() => setOpen(false)}
          query={query}
          setQuery={setQuery}
        >
          {filtered.map((l) => (
            <LangRow
              key={l.code}
              lang={l}
              active={base === l.code}
              onPick={() => {
                haptic('select');
                onChange(l.code);
                setOpen(false);
              }}
            />
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-xs text-text-hint">—</p>
          )}
        </Sheet>
      )}
    </>
  );
}

function Sheet({
  title,
  onClose,
  query,
  setQuery,
  children,
}: {
  title: string;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 animate-fade-in"
        onClick={onClose}
      >
        {/* ⚠️ flex-col + min-h-0 روی لیست، تا اسکرول واقعاً کار کند */}
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

          <div className="shrink-0 px-4 pb-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو…"
              className="input py-2.5"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function LangRow({
  lang,
  active,
  onPick,
}: {
  lang: LanguageOption;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition',
        active ? 'bg-accent-soft' : 'active:bg-[var(--surface-sunken)]'
      )}
    >
      <span className="text-xl">{lang.flag}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">
          {lang.nativeName}
        </span>
        <span className="block truncate text-[11px] text-text-hint">{lang.labelEn}</span>
      </span>
      {lang.dialects && lang.dialects.length > 0 && (
        <span className="shrink-0 text-[9px] text-text-muted">
          {lang.dialects.length} گویش
        </span>
      )}
      {active && <span className="shrink-0 text-accent">✓</span>}
    </button>
  );
}
