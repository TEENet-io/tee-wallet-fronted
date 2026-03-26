import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Shield, Loader2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { WalletPolicy } from '../../types';

const THRESHOLD_MAX = 10000;

export default function PolicyPanel({ walletId }: { walletId: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { getFreshPasskeyCredential } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Backend fields
  const [thresholdUsd, setThresholdUsd] = useState('');
  const [dailyLimitUsd, setDailyLimitUsd] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    const res = await api<{ policy?: WalletPolicy }>(`/api/wallets/${walletId}/policy`);
    if (res.success && res.policy) {
      const p = res.policy;
      setThresholdUsd(p.threshold_usd || '');
      setDailyLimitUsd(p.daily_limit_usd || '');
      setEnabled(p.enabled ?? true);
      const v = parseFloat(p.threshold_usd) || 0;
      setSliderValue(Math.min(v, THRESHOLD_MAX));
      setLoaded(true);
    }
    setLoading(false);
  }, [walletId]);

  useEffect(() => { loadPolicy(); }, [loadPolicy]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSliderValue(v);
    setThresholdUsd(v === 0 ? '' : String(v));
  };

  const handleThresholdInput = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setThresholdUsd(raw);
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed) || parsed <= 0) {
      setSliderValue(0);
    } else {
      setSliderValue(Math.min(parsed, THRESHOLD_MAX));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!thresholdUsd.trim()) {
      toast('Threshold USD is required', 'error');
      return;
    }

    setSaving(true);
    try {
      // SetPolicy requires passkey auth (passkey-only or parsed in body)
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setSaving(false); return; }

      const body: Record<string, unknown> = {
        ...passkeyBody,
        threshold_usd: thresholdUsd.trim(),
        enabled,
      };
      if (dailyLimitUsd.trim()) {
        body.daily_limit_usd = dailyLimitUsd.trim();
      }

      const res = await api(`/api/wallets/${walletId}/policy`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      if (res.success) {
        toast(t('policy.savedSuccess'), 'success');
      } else {
        toast(res.error ?? t('policy.saveFail'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-outline-variant/10">
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <p className="font-semibold text-on-surface text-sm">{t('policy.spendTitle')}</p>
          <p className="text-xs text-on-surface-variant">{t('policy.spendSubtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t('policy.loading')}</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">

          {/* Threshold USD (required) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-on-surface">
                {t('policy.threshold')} (USD)
              </label>
              <span className={`text-sm font-semibold tabular-nums ${sliderValue === 0 ? 'text-outline' : 'text-primary'}`}>
                {sliderValue === 0 ? t('policy.disabled') : `$${sliderValue.toLocaleString()}`}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {t('policy.thresholdDesc')}
            </p>

            <div className="mt-1 px-1">
              <input
                type="range"
                min={0}
                max={THRESHOLD_MAX}
                step={10}
                value={sliderValue}
                onChange={handleSliderChange}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-outline mt-1 select-none">
                <span>{t('policy.off')}</span>
                <span>$100</span>
                <span>$1,000</span>
                <span>$5,000</span>
                <span>$10,000</span>
              </div>
            </div>

            <input
              type="number"
              min="0"
              step="any"
              value={thresholdUsd}
              onChange={handleThresholdInput}
              placeholder="100"
              className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors mt-1"
            />
          </div>

          {/* Daily Limit USD (optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-on-surface">
              {t('policy.maxAmount')} (USD / {t('history.action.transfer') || 'day'})
            </label>
            <p className="text-xs text-on-surface-variant">
              {t('policy.maxTransactionDesc')}
            </p>
            <input
              type="number"
              min="0"
              step="any"
              value={dailyLimitUsd}
              onChange={e => setDailyLimitUsd(e.target.value)}
              placeholder={t('policy.noLimit')}
              className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between bg-surface-container rounded-xl border border-outline-variant/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-on-surface">{t('policy.enabled')}</p>
              <p className="text-xs text-on-surface-variant">{t('policy.whitelistOnlyDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(v => !v)}
              className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Summary */}
          {loaded && (
            <div className="rounded-xl bg-surface-container border border-outline-variant/10 px-4 py-3">
              <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                {t('policy.current')}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-outline">{t('policy.threshold')}</dt>
                  <dd className="font-medium text-on-surface">
                    {thresholdUsd ? `$${thresholdUsd}` : <span className="text-outline">{t('policy.disabled')}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-outline">{t('policy.maxAmount')}</dt>
                  <dd className="font-medium text-on-surface">
                    {dailyLimitUsd ? `$${dailyLimitUsd}/day` : <span className="text-outline">{t('policy.unlimited')}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-outline">{t('policy.enabled')}</dt>
                  <dd className={`font-medium ${enabled ? 'text-primary' : 'text-outline'}`}>
                    {enabled ? t('policy.enabled') : t('policy.disabled')}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !thresholdUsd.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? t('policy.saving') : t('policy.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
