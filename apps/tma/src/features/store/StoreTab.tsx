import { useTranslation } from 'react-i18next';
import { Card, Chip } from '../../components/ui';
import { StorePanel } from './StorePanel';

/**
 * فروشگاه — یک تب مستقل (قبلاً داخل صفحهٔ کاربری بود).
 *
 * سه روش پرداخت: Telegram Stars (فعال)، درگاه بانکی (به‌زودی)، فیش بانکی (به‌زودی).
 */
export function StoreTab() {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 p-4">
      <StorePanel />

      <Card>
        <p className="mb-2 text-xs font-semibold text-text">{t('store.paymentMethods')}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span className="text-lg">⭐</span>
            <span className="flex-1 text-xs text-text">{t('store.payStars')}</span>
            <Chip tone="success">{t('store.active')}</Chip>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 opacity-60">
            <span className="text-lg">🏦</span>
            <span className="flex-1 text-xs text-text">{t('store.payGateway')}</span>
            <Chip>{t('store.soon')}</Chip>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 opacity-60">
            <span className="text-lg">🧾</span>
            <span className="flex-1 text-xs text-text">{t('store.payReceipt')}</span>
            <Chip>{t('store.soon')}</Chip>
          </div>
        </div>
      </Card>
    </div>
  );
}
