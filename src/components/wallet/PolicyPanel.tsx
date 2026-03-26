import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Shield, Loader2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { WalletPolicy } from '../../types';

// Approval threshold slider: 0 → disabled, 1–10000 SOL range (log scale label)
const THRESHOLD_MAX = 10000;

function formatAmount(value: string | undefined): string {
  if (!value) return '';
  return value;
}

export default function PolicyPanel({ walletId }: { walletId: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [maxAmount, setMaxAmount] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState('');
  // Slider value: 0 = disabled, 1–10000 mapped to the numeric threshold
  const [sliderValue, setSliderValue] = useState(0);
  const [whitelistOnly, setWhitelistOnly] = useState(false);

  // Track whether we have loaded policy at least once
  const [loaded, setLoaded] = useState(false);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    const res = await api<{ policy: WalletPolicy }>(`/api/wallets/${walletId}/policy`);
    if (res.success && res.policy) {
      const p = res.policy;
      setMaxAmount(formatAmount(p.max_amount));
      const threshold = formatAmount(p.require_approval_above);
      setApprovalThreshold(threshold);
      setSliderValue(threshold ? Math.min(parseFloat(threshold), THRESHOLD_MAX) : 0);
      setWhitelistOnly(p.whitelist_only ?? false);
      setLoaded(true);
    } else {
      toast(res.error ?? t('policy.loadError'), 'error');
    }
    setLoading(false);
  }, [walletId, toast, t]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  // Keep slider and text field in sync
  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSliderValue(v);
    setApprovalThreshold(v === 0 ? '' : String(v));
  };

  const handleThresholdInput = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setApprovalThreshold(raw);
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed) || parsed <= 0) {
      setSliderValue(0);
    } else {
      setSliderValue(Math.min(parsed, THRESHOLD_MAX));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const body: Partial<WalletPolicy> = {
      whitelist_only: whitelistOnly,
    };

    if (maxAmount.trim()) body.max_amount = maxAmount.trim();
    if (approvalThreshold.trim()) body.require_approval_above = approvalThreshold.trim();

    const res = await api(`/api/wallets/${walletId}/policy`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.success) {
      toast(t('policy.savedSuccess'), 'success');
    } else {
      toast(res.error ?? t('policy.saveFail'), 'error');
    }
    setSaving(false);
  };

  return (
    <div className="bg-surface-container-low rounded-3xl ghost-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-outline-variant/20">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface leading-tight">{t('policy.spendTitle')}</p>
          <p className="text-xs text-on-surface-variant">{t('policy.spendSubtitle')}</p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t('policy.loading')}</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-7">

          {/* ── Max amount per transaction ── */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">
              {t('policy.maxTransactionAmount')}
            </label>
            <p className="text-xs text-on-surface-variant">
              {t('policy.maxTransactionDesc')}
            </p>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                step="any"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder={t('policy.noLimit')}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 pr-16 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant pointer-events-none">
                {t('policy.tokens')}
              </span>
            </div>
          </div>

          {/* ── Approval threshold slider ── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-on-surface">
                {t('policy.requireApprovalAbove')}
              </label>
              <span
                className={`text-sm font-bold tabular-nums ${
                  sliderValue === 0 ? 'text-outline' : 'text-primary'
                }`}
              >
                {sliderValue === 0 ? t('policy.disabled') : `${sliderValue} ${t('policy.tokens')}`}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {t('policy.approvalThresholdDesc')}
            </p>

            {/* Slider */}
            <div className="mt-2 px-1">
              <input
                type="range"
                min={0}
                max={THRESHOLD_MAX}
                step={1}
                value={sliderValue}
                onChange={handleSliderChange}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-outline mt-1 select-none">
                <span>{t('policy.off')}</span>
                <span>100</span>
                <span>1 000</span>
                <span>5 000</span>
                <span>{THRESHOLD_MAX.toLocaleString()}</span>
              </div>
            </div>

            {/* Manual text input synced with slider */}
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                step="any"
                value={approvalThreshold}
                onChange={handleThresholdInput}
                placeholder={t('policy.disabledZero')}
                className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 pr-16 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant pointer-events-none">
                {t('policy.tokens')}
              </span>
            </div>
          </div>

          {/* ── Whitelist only toggle ── */}
          <div className="flex items-start justify-between gap-6 bg-surface-container rounded-2xl border border-outline-variant/15 px-5 py-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-on-surface">{t('policy.whitelistOnly')}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t('policy.whitelistOnlyDesc')}
              </p>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={whitelistOnly}
              onClick={() => setWhitelistOnly(v => !v)}
              className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                whitelistOnly ? 'bg-primary-container' : 'bg-surface-container-highest'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  whitelistOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
              <span className="sr-only">{whitelistOnly ? t('policy.enabled') : t('policy.disabled')}</span>
            </button>
          </div>

          {/* ── Current policy summary ── */}
          {loaded && (
            <div className="rounded-2xl bg-surface-container border border-outline-variant/15 px-5 py-4">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                {t('policy.current')}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-outline">{t('policy.maxAmount')}</dt>
                  <dd className="font-semibold text-on-surface">
                    {maxAmount ? `${maxAmount} ${t('policy.tokens')}` : <span className="text-outline font-normal">{t('policy.unlimited')}</span>}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-outline">{t('policy.threshold')}</dt>
                  <dd className="font-semibold text-on-surface">
                    {approvalThreshold ? `> ${approvalThreshold} ${t('policy.tokens')}` : <span className="text-outline font-normal">{t('policy.disabled')}</span>}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-outline">{t('policy.whitelistOnly')}</dt>
                  <dd className={`font-semibold ${whitelistOnly ? 'text-primary' : 'text-outline font-normal'}`}>
                    {whitelistOnly ? t('policy.enabled') : t('policy.disabled')}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl primary-gradient text-white text-sm font-bold glow-primary disabled:opacity-60 transition-opacity"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('policy.saving')}</>
                : <><Save className="w-4 h-4" /> {t('policy.save')}</>
              }
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
