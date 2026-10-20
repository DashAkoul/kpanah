import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Plan, PlanType } from '@kpanah/shared';
import { Card, Button, Chip, Skeleton } from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { usePlans, useCreateInvoice, useHome } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';
import { openInvoice, haptic, isTelegram } from '../../lib/telegram';

/**
 * Store / subscription purchase.
 *
 * Phase 1: Telegram Stars only (locked decision). ZarinPal and the admin
 * receipt bot render as disabled "coming soon" rows so the UI shape is
 * already correct when they ship.
 */
export function StorePanel() {
  const { t } = useTranslation();
  const { data, isLoading } = usePlans();
  const user = useSessionStore((s) => s.user);
  const [selected, setSelected] = useState<string | null>(null);
  const [useCoins, setUseCoins] = useState(false);
  const { data: home } = useHome();
  const balance = home?.user?.starsBalance ?? 0;

  // پیش‌نمایش تخفیف — درصد از سرور می‌آید (نرخ تبدیل به کلاینت نمی‌رسد)
  const { data: discount } = useQuery({
    queryKey: ['coin-discount', selected, balance],
    enabled: Boolean(selected) && useCoins && balance > 0,
    staleTime: 60_000,
    queryFn: () => api.previewDiscount(selected!),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const currentPlan = user?.subscription?.planType ?? null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-text">{t('store.title')}</h2>
        <p className="mt-0.5 text-xs text-text-hint">{t('store.choosePlan')}</p>
      </div>

      {currentPlan && currentPlan !== 'TRIAL' && (
        <Card className="border-success-500/30 bg-success-100/50">
          <p className="text-xs text-text-hint">{t('store.currentPlan')}</p>
          <p className="mt-0.5 text-sm font-bold text-success-500">
            {labelForPlan(currentPlan, t)}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {data.plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            isCurrent={plan.planType === currentPlan}
            isSelected={selected === plan.id}
            onSelect={() => {
              haptic('select');
              setSelected(plan.id);
            }}
          />
        ))}
      </div>

      {/* تخفیف با سکه */}
      {selected && balance > 0 && (
        <Card className="border-brand-200 bg-brand-50/40">
          <button
            type="button"
            onClick={() => {
              haptic('select');
              setUseCoins((v) => !v);
            }}
            className="flex w-full items-center gap-3 text-start"
          >
            <span
              className={
                useCoins
                  ? 'flex h-5 w-5 items-center justify-center rounded-md bg-accent text-[11px] text-accent-text'
                  : 'h-5 w-5 rounded-md border border-border'
              }
            >
              {useCoins ? '✓' : ''}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-text">
                🪙 {t('store.useCoinsForDiscount')}
              </span>
              <span className="block text-[11px] text-text-hint">
                {useCoins && discount && discount.percent > 0
                  ? t('store.coinDiscountApplied', { percent: discount.percent })
                  : t('store.useCoinsHint')}
              </span>
            </span>
          </button>

          {useCoins && discount && discount.percent === 0 && (
            <p className="mt-2 text-[11px] text-text-muted">{t('store.coinsTooFew')}</p>
          )}
          {useCoins && discount && discount.percent > 0 && (
            <p className="mt-2 text-[11px] font-semibold text-success-500">
              {t('store.finalPrice', { stars: discount.finalStars })}
            </p>
          )}
        </Card>
      )}

      <PurchaseButton
        plan={data.plans.find((p) => p.id === selected) ?? null}
        useCoins={useCoins && Boolean(discount && discount.percent > 0)}
        finalStars={
          useCoins && discount && discount.percent > 0 ? discount.finalStars : undefined
        }
        onDone={() => {
          setSelected(null);
          setUseCoins(false);
        }}
      />


      <div className="pt-1">
        <p className="mb-2 text-[11px] font-medium text-text-hint">
          {t('store.adminReceipt')}
        </p>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center justify-between rounded-xl border border-dashed border-border bg-[var(--surface-sunken)] px-3 py-2.5 opacity-60">
            <span className="text-xs text-text-hint">🏦 زرین‌پال</span>
            <Chip>{t('store.comingSoon')}</Chip>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-xl border border-dashed border-border bg-[var(--surface-sunken)] px-3 py-2.5 opacity-60">
            <span className="text-xs text-text-hint">🧾 {t('store.adminReceipt')}</span>
            <Chip>{t('store.comingSoon')}</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  isCurrent,
  isSelected,
  onSelect,
}: {
  plan: Plan;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  const badgeLabel =
    plan.badge === 'POPULAR'
      ? t('common.popular')
      : plan.badge === 'BEST_VALUE'
        ? t('common.bestValue')
        : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'w-full rounded-card border p-3.5 text-start transition-all active:scale-[0.99]',
        isSelected
          ? 'border-accent bg-accent-soft ring-accent-soft'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">{plan.titleFa}</span>
            {badgeLabel && <Chip tone="brand">{badgeLabel}</Chip>}
            {isCurrent && <Chip tone="success">{t('common.active')}</Chip>}
          </div>

          <p className="mt-0.5 text-[11px] text-text-hint">
            {t('store.duration', { days: plan.durationDays })}
          </p>

          {plan.discountPercent > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              <Chip tone="danger">{t('store.discount', { percent: plan.discountPercent })}</Chip>
            </p>
          )}
        </div>

        <div className="shrink-0 text-end">
          {plan.discountPercent > 0 ? (
            <>
              <p className="text-xs text-text-muted line-through">
                {plan.priceStars} ⭐
              </p>
              <p className="text-base font-bold text-text">
                {plan.finalPriceStars}
                <span className="text-xs font-normal text-text-hint"> ⭐</span>
              </p>
            </>
          ) : (
            <p className="text-base font-bold text-text">
              {plan.finalPriceStars}
              <span className="text-xs font-normal text-text-hint"> ⭐</span>
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function PurchaseButton({
  plan,
  useCoins,
  finalStars,
  onDone,
}: {
  plan: Plan | null;
  useCoins?: boolean;
  /** قیمت نهایی تخفیف‌خورده (از سرور) */
  finalStars?: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const showToast = useUiStore((s) => s.showToast);
  const invoice = useCreateInvoice();

  const handleBuy = async () => {
    if (!plan) return;

    if (!isTelegram() && import.meta.env.DEV) {
      showToast('پیش‌نمایش: پرداخت شبیه‌سازی شد', 'success');
      onDone();
      return;
    }

    try {
      const result = await invoice.mutateAsync({ planId: plan.id, useCoins });
      const status = await openInvoice(result.invoiceLink);

      if (status === 'paid') {
        haptic('success');
        showToast(t('store.paymentSuccess'), 'success');
      } else if (status === 'cancelled') {
        showToast(t('store.paymentCancelled'), 'info');
      } else if (status === 'failed') {
        showToast(t('store.paymentFailed'), 'error');
      }
      onDone();
    } catch {
      // onError در useCreateInvoice پیام را نشان می‌دهد
    }
  };

  return (
    <Button
      fullWidth
      size="lg"
      disabled={!plan}
      loading={invoice.isPending}
      onClick={() => void handleBuy()}
    >
      {plan
        ? t('store.payStarsHint', {
            stars: finalStars ?? plan.finalPriceStars,
          })
        : t('store.payWithStars')}
    </Button>
  );
}

function labelForPlan(planType: PlanType, t: (k: string) => string): string {
  const labels: Record<string, string> = {
    '2_WEEKS': '۲ هفته‌ای',
    '1_MONTH': '۱ ماهه',
    '3_MONTHS': '۳ ماهه',
    '6_MONTHS': '۶ ماهه',
    '1_YEAR': '۱ ساله',
    TRIAL: t('profile.sourceTrial'),
  };
  return labels[planType] ?? planType;
}
