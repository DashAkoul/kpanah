import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useUiStore } from '../../store/ui';

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  // `glass-sheen` لایهٔ نوری بالای کارت است (درخشش لبهٔ شیشه).
  return (
    <Tag className={clsx('card glass-sheen p-4', className)}>{children}</Tag>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  onClick,
  className,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }[variant];

  const sizeClass = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base',
  }[size];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(variantClass, sizeClass, fullWidth && 'w-full', className)}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = 'var(--tg-theme-button-color, #2563eb)',
  height = 8,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress-track" style={{ height }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
  className?: string;
}) {
  const toneClass = {
    neutral: 'bg-[var(--surface-sunken)] text-text-hint',
    success: 'bg-success-100 text-success-500',
    warning: 'bg-warning-100 text-warning-500',
    danger: 'bg-danger-100 text-danger-500',
    brand: 'bg-brand-50 text-brand-600',
  }[tone];

  return <span className={clsx('chip', toneClass, className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && (
        <p className="max-w-xs text-sm text-text-hint">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="max-w-xs text-sm text-text-hint">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;

  const toneClass = {
    info: 'bg-[var(--surface-sunken)] text-text border-border',
    success: 'bg-success-100 text-success-500 border-success-500/20',
    error: 'bg-danger-100 text-danger-500 border-danger-500/20',
  }[toast.kind];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div
        className={clsx(
          'animate-slide-up rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lift',
          toneClass
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
