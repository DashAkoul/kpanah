import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type {
  AiProvider,
  AiProviderTestResult,
  AiProtocol,
  AiVendorPreset,
  CreateAiProviderInput,
} from '@kpanah/shared';
import { AI_VENDOR_PRESETS, AI_HEALTH_LABELS } from '@kpanah/shared';
import { Card, Button, Chip, Skeleton, EmptyState } from '../../components/ui';
import {
  useAiProviders,
  useCreateAiProvider,
  useUpdateAiProvider,
  useDeleteAiProvider,
  useReorderAiProviders,
  useTestAiProvider,
} from '../../hooks/useApi';
import { useUiStore } from '../../store/ui';
import { haptic, showConfirm, showAlert } from '../../lib/telegram';

/**
 * AI engine pool manager.
 *
 * The operator registers providers here; the Worker walks them in the order
 * shown and fails over automatically, so one vendor going down never stops
 * lesson generation.
 *
 * Two things worth noticing:
 *   • Keys are write-only. The list shows a hint (last 4 chars) and editing a
 *     row without re-entering a key leaves the stored one untouched.
 *   • The "Test" button makes a real call, so a saved-but-broken key is caught
 *     before it matters.
 */
export function AiProvidersPanel() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<AiProvider | 'new' | null>(null);

  const { data, isLoading, refetch } = useAiProviders();
  const reorder = useReorderAiProviders();
  const remove = useDeleteAiProvider();
  const test = useTestAiProvider();
  const update = useUpdateAiProvider();
  const showToast = useUiStore((s) => s.showToast);

  const providers = data?.providers ?? [];
  const [testingId, setTestingId] = useState<string | null>(null);

  /** Move a provider one slot up or down and persist the new order. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= providers.length) return;

    const next = [...providers];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);

    haptic('tap');
    try {
      await reorder.mutateAsync(next.map((p) => p.id));
    } catch {
      showToast(t('admin.ai.reorderFailed'), 'error');
    }
  }

  async function runTest(id: string) {
    setTestingId(id);
    haptic('tap');
    try {
      const result = (await test.mutateAsync(id)) as AiProviderTestResult;
      haptic(result.ok ? 'success' : 'error');
      showAlert(
        result.ok
          ? t('admin.ai.testOk', { ms: result.ms, sample: result.sample ?? '' })
          : t('admin.ai.testFailed', { error: result.error ?? '' })
      );
      void refetch();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('admin.ai.testFailed', { error: '' }),
        'error'
      );
    } finally {
      setTestingId(null);
    }
  }

  async function toggleActive(p: AiProvider) {
    haptic('tap');
    try {
      await update.mutateAsync({ id: p.id, patch: { isActive: !p.isActive } });
    } catch {
      showToast(t('admin.ai.saveFailed'), 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Failover explanation */}
      <Card className="p-3">
        <p className="text-xs leading-relaxed text-text-hint">
          {t('admin.ai.explain')}
        </p>
      </Card>

      {/* Encryption warning */}
      {data && !data.encryptionReady && (
        <Card className="border-warning-500/40 bg-warning-100/50 p-3">
          <p className="text-xs font-medium text-text">
            ⚠️ {t('admin.ai.encryptionWarning')}
          </p>
        </Card>
      )}

      {/* Active chain preview */}
      {data && data.chain.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-hint">{t('admin.ai.chain')}:</span>
          {data.chain.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-text-muted">←</span>}
              <Chip className="bg-[var(--surface-sunken)] text-text">
                {i + 1}. {p.label}
              </Chip>
            </span>
          ))}
        </div>
      )}

      {/* Provider list */}
      {providers.length === 0 ? (
        <EmptyState icon="🤖" title={t('admin.ai.empty')} />
      ) : (
        <div className="space-y-2">
          {providers.map((p, index) => (
            <ProviderCard
              key={p.id}
              provider={p}
              index={index}
              total={providers.length}
              testing={testingId === p.id}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onTest={() => runTest(p.id)}
              onToggle={() => toggleActive(p)}
              onEdit={() => setEditing(p)}
              onDelete={async () => {
                const ok = await showConfirm(t('admin.ai.confirmDelete', { label: p.label }));
                if (!ok) return;
                try {
                  await remove.mutateAsync(p.id);
                  haptic('success');
                  showToast(t('admin.ai.deleted'), 'success');
                } catch {
                  showToast(t('admin.ai.deleteFailed'), 'error');
                }
              }}
            />
          ))}
        </div>
      )}

      <Button variant="primary" className="w-full" onClick={() => setEditing('new')}>
        + {t('admin.ai.addProvider')}
      </Button>

      {/* Attempt log */}
      {data && data.attempts.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-text">{t('admin.ai.recentAttempts')}</h3>
          {data.attempts.slice(0, 8).map((a) => (
            <div
              key={a.id}
              className={clsx(
                'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs',
                a.ok ? 'bg-success-100/50' : 'bg-danger-100/50'
              )}
            >
              <span className="flex-1 truncate text-text">
                {a.ok ? '✓' : '✗'} {a.provider_label ?? '—'}
              </span>
              <span className="text-text-hint">{a.latency_ms ?? 0}ms</span>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit sheet */}
      {editing && (
        <ProviderSheet
          provider={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Provider card
// ═════════════════════════════════════════════════════════════════════

const HEALTH_STYLE: Record<string, string> = {
  healthy: 'bg-success-100 text-success-500',
  degraded: 'bg-warning-100 text-warning-500',
  failing: 'bg-danger-100 text-danger-500',
  unknown: 'bg-[var(--surface-sunken)] text-text-hint',
};

function ProviderCard({
  provider,
  index,
  total,
  testing,
  onMoveUp,
  onMoveDown,
  onTest,
  onToggle,
  onEdit,
  onDelete,
}: {
  provider: AiProvider;
  index: number;
  total: number;
  testing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTest: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const p = provider;

  return (
    <Card className={clsx('p-3', !p.isActive && 'opacity-60')}>
      <div className="flex items-start gap-2">
        {/* Order controls */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-text-hint disabled:opacity-30"
            aria-label="up"
          >
            ▲
          </button>
          <span className="text-[10px] font-mono text-text-muted">{index + 1}</span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-text-hint disabled:opacity-30"
            aria-label="down"
          >
            ▼
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">{p.label}</span>
            <span
              className={clsx(
                'shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-medium',
                HEALTH_STYLE[p.healthStatus] ?? HEALTH_STYLE.unknown
              )}
            >
              {AI_HEALTH_LABELS[p.healthStatus] ?? p.healthStatus}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-hint">
            <span className="target-text font-mono">{p.model}</span>
            <span>·</span>
            <span>{p.protocol}</span>
            <span>·</span>
            <span className="font-mono">{p.keyHint || '—'}</span>
          </div>

          {p.lastError && (
            <p className="mt-1 truncate text-[11px] text-danger-500" title={p.lastError}>
              {p.lastError}
            </p>
          )}

          <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
            <span>✓ {p.totalSuccesses}</span>
            <span>✗ {p.totalFailures}</span>
            {!p.usable && <span className="text-warning-500">{t('admin.ai.unusable')}</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <MiniAction onClick={onTest} disabled={testing}>
          {testing ? t('admin.ai.testing') : t('admin.ai.test')}
        </MiniAction>
        <MiniAction onClick={onToggle}>
          {p.isActive ? t('admin.ai.disable') : t('admin.ai.enable')}
        </MiniAction>
        <MiniAction onClick={onEdit}>{t('common.edit')}</MiniAction>
        <MiniAction onClick={onDelete} danger>
          {t('common.delete')}
        </MiniAction>
      </div>
    </Card>
  );
}

function MiniAction({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50',
        danger
          ? 'bg-danger-100 text-danger-500'
          : 'bg-[var(--surface-sunken)] text-text'
      )}
    >
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Add / edit sheet
// ═════════════════════════════════════════════════════════════════════

function ProviderSheet({
  provider,
  onClose,
  onSaved,
}: {
  provider: AiProvider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const showToast = useUiStore((s) => s.showToast);
  const create = useCreateAiProvider();
  const update = useUpdateAiProvider();

  const isEdit = provider !== null;

  const [preset, setPreset] = useState<AiVendorPreset>(() => {
    if (!provider) return 'gemini';
    const match = AI_VENDOR_PRESETS.find((p) => p.vendor === provider.vendor);
    return (match?.id ?? 'custom') as AiVendorPreset;
  });

  const [label, setLabel] = useState(provider?.label ?? '');
  const [model, setModel] = useState(provider?.model ?? 'gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [protocol, setProtocol] = useState<AiProtocol>(provider?.protocol ?? 'gemini');
  const [vendor, setVendor] = useState(provider?.vendor ?? 'gemini');
  const [temperature, setTemperature] = useState(String(provider?.temperature ?? 0.8));
  const [maxTokens, setMaxTokens] = useState(String(provider?.maxOutputTokens ?? 8192));
  const [supportsSchema, setSupportsSchema] = useState(provider?.supportsJsonSchema ?? false);
  const [busy, setBusy] = useState(false);

  /** Apply a vendor preset to the form (new providers only). */
  function applyPreset(id: AiVendorPreset) {
    setPreset(id);
    const p = AI_VENDOR_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setProtocol(p.protocol);
    setVendor(p.vendor);
    setModel(p.model);
    setBaseUrl(p.baseUrl ?? '');
    setSupportsSchema(p.supportsJsonSchema);
    if (!label || label === '') setLabel(p.label);
  }

  const presetInfo = AI_VENDOR_PRESETS.find((p) => p.id === preset);

  async function save() {
    // Client-side guards mirror the server schema so the operator gets an
    // immediate, specific message instead of a round-trip rejection.
    if (!label.trim()) return showToast(t('admin.ai.errLabel'), 'error');
    if (!model.trim()) return showToast(t('admin.ai.errModel'), 'error');
    if (!isEdit && apiKey.trim().length < 8) {
      return showToast(t('admin.ai.errKey'), 'error');
    }
    if (protocol === 'openai_compatible' && vendor !== 'deepseek' && !baseUrl.trim()) {
      return showToast(t('admin.ai.errBaseUrl'), 'error');
    }

    setBusy(true);
    try {
      const payload: CreateAiProviderInput = {
        label: label.trim(),
        protocol,
        vendor,
        model: model.trim(),
        baseUrl: baseUrl.trim() || null,
        apiKey: apiKey.trim(),
        temperature: Number(temperature) || 0.8,
        maxOutputTokens: Number(maxTokens) || 8192,
        supportsJsonSchema: supportsSchema,
      };

      if (isEdit) {
        // An empty key field means "keep the existing key".
        const patch = { ...payload } as Partial<CreateAiProviderInput>;
        if (!apiKey.trim()) delete patch.apiKey;
        await update.mutateAsync({ id: provider!.id, patch });
      } else {
        await create.mutateAsync(payload);
      }

      haptic('success');
      showToast(isEdit ? t('admin.ai.saved') : t('admin.ai.created'), 'success');
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.ai.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-card p-4 animate-slide-up safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">
            {isEdit ? t('admin.ai.editProvider') : t('admin.ai.addProvider')}
          </h2>
          <button type="button" onClick={onClose} className="text-text-hint">
            ✕
          </button>
        </div>

        {/* Vendor preset picker (new only) */}
        {!isEdit && (
          <div className="mb-3 space-y-1.5">
            <Label>{t('admin.ai.vendor')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {AI_VENDOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as AiVendorPreset)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition',
                    preset === p.id
                      ? 'bg-accent text-accent-text'
                      : 'bg-[var(--surface-sunken)] text-text'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {presetInfo?.note && (
              <p className="pt-0.5 text-[11px] leading-relaxed text-text-hint">
                {presetInfo.note}
                {presetInfo.keyUrl && (
                  <>
                    {' '}
                    <a
                      href={presetInfo.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link underline"
                    >
                      {t('admin.ai.getKey')}
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Label */}
        <Field label={t('admin.ai.label')}>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Gemini Flash (اصلی)"
          />
        </Field>

        {/* Model */}
        <Field label={t('admin.ai.model')}>
          <input
            dir="ltr"
            className="input target-text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gemini-2.5-flash"
          />
        </Field>

        {/* API key */}
        <Field
          label={t('admin.ai.apiKey')}
          hint={isEdit ? t('admin.ai.apiKeyEditHint') : undefined}
        >
          <input
            dir="ltr"
            type="password"
            className="input target-text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={isEdit ? provider!.keyHint || '••••••••' : 'AIza...'}
            autoComplete="off"
          />
        </Field>

        {/* Base URL — only when the protocol needs one */}
        {(protocol === 'openai_compatible' || preset === 'custom') && (
          <Field label={t('admin.ai.baseUrl')} hint={t('admin.ai.baseUrlHint')}>
            <input
              dir="ltr"
              className="input target-text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </Field>
        )}

        {/* Protocol / vendor are advanced — show them collapsed-ish */}
        <details className="mb-3">
          <summary className="cursor-pointer text-xs font-medium text-text-hint">
            {t('admin.ai.advanced')}
          </summary>
          <div className="pt-2">
            <Field label={t('admin.ai.protocol')}>
              <select
                className="input"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as AiProtocol)}
              >
                <option value="gemini">gemini</option>
                <option value="openai_compatible">openai_compatible</option>
                <option value="anthropic">anthropic</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t('admin.ai.temperature')}>
                <input
                  dir="ltr"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  className="input target-text"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </Field>
              <Field label={t('admin.ai.maxTokens')}>
                <input
                  dir="ltr"
                  type="number"
                  min="256"
                  className="input target-text"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 py-1 text-xs text-text">
              <input
                type="checkbox"
                checked={supportsSchema}
                onChange={(e) => setSupportsSchema(e.target.checked)}
                className="size-4"
              />
              {t('admin.ai.supportsSchema')}
            </label>
          </div>
        </details>

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" className="flex-1" onClick={save} disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-hint">{hint}</p>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-text-hint">{children}</div>;
}
