import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Shield, Loader2, Save, Trash2, Fuel } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useConfirm } from '../ConfirmDialog';
import type { WalletPolicy, DailySpent } from '../../types';

const THRESHOLD_MAX = 10000;

// Compact gauge for the header
function HeaderGauge({ spent }: { spent: DailySpent }) {
  const { t } = useLanguage();
  const spentNum = parseFloat(spent.daily_spent_usd) || 0;
  const limitNum = parseFloat(spent.daily_limit_usd) || 0;
  const remainNum = parseFloat(spent.remaining_usd) || 0;
  const hasLimit = limitNum > 0;
  const pct = hasLimit ? Math.min(1, spentNum / limitNum) : 0;
  const isHigh = hasLimit && pct >= 0.8;
  const isExceeded = hasLimit && pct >= 1;
  const resetTime = spent.reset_at
    ? new Date(spent.reset_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const R = 32;
  const STROKE = 5;
  const cx = 36;
  const cy = 34;
  const arcLen = Math.PI * R;
  const filled = hasLimit ? arcLen * pct : 0;
  const arcColor = isExceeded ? '#f87171' : isHigh ? '#fb923c' : '#7c3aed';
  const glowColor = isExceeded ? 'rgba(248,113,113,0.5)' : isHigh ? 'rgba(251,146,60,0.4)' : 'rgba(124,58,237,0.35)';

  return (
    <div className="flex items-center gap-3">
      {/* Mini gauge */}
      <div className="shrink-0 flex flex-col items-center" style={{ width: 72 }}>
        <div style={{ width: 72, height: 40 }}>
          <svg width="72" height="40" viewBox="0 0 72 40" className="overflow-visible">
            <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
              fill="none" stroke="currentColor" className="text-surface-container-high"
              strokeWidth={STROKE} strokeLinecap="round" />
            {hasLimit && filled > 0 && (
              <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
                fill="none" stroke={arcColor} strokeWidth={STROKE} strokeLinecap="round"
                strokeDasharray={`${arcLen}`} strokeDashoffset={`${arcLen - filled}`}
                style={{ filter: `drop-shadow(0 0 3px ${glowColor})`, transition: 'stroke-dashoffset 0.8s ease' }} />
            )}
            {hasLimit && (() => {
              const a = Math.PI * (1 - pct);
              const nx = cx + (R - 10) * Math.cos(a);
              const ny = cy - (R - 10) * Math.sin(a);
              return <>
                <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={arcColor} strokeWidth="1.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${glowColor})`, transition: 'all 0.8s ease' }} />
                <circle cx={cx} cy={cy} r="2" fill={arcColor} />
              </>;
            })()}
            {!hasLimit && <circle cx={cx} cy={cy} r="2" fill="currentColor" className="text-outline" />}
          </svg>
        </div>
      </div>
      {/* Text */}
      <div className="text-right">
        <p className={`text-base font-headline font-black tabular-nums ${isExceeded ? 'text-error' : isHigh ? 'text-tertiary' : 'text-on-surface'}`}>
          ${spentNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {hasLimit && <span className="text-xs font-bold text-on-surface-variant"> / ${limitNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
        </p>
        {hasLimit && (
          <p className={`text-[10px] font-medium ${isExceeded ? 'text-error' : isHigh ? 'text-tertiary' : 'text-on-surface-variant'}`}>
            {isExceeded ? t('wallet.limitExceeded') : `$${remainNum.toFixed(2)} ${t('wallet.remaining')}`}
          </p>
        )}
        {resetTime && <p className="text-[9px] text-outline">{t('wallet.resets')} {resetTime}</p>}
      </div>
    </div>
  );
}

export default function PolicyPanel({ walletId, dailySpent, onPolicyChange }: { walletId: string; dailySpent?: DailySpent | null; onPolicyChange?: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { getFreshPasskeyCredential } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        onPolicyChange?.();
      } else {
        toast((res as { error?: string }).error ?? t('policy.saveFail'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('policy.delete'),
      message: t('policy.deleteConfirm'),
      confirmText: t('policy.delete'),
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setDeleting(false); return; }

      const res = await api(`/api/wallets/${walletId}/policy`, {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });

      if (res.success) {
        toast(t('policy.deleteSuccess'), 'success');
        setThresholdUsd('');
        setDailyLimitUsd('');
        setSliderValue(0);
        setEnabled(true);
        setLoaded(false);
        onPolicyChange?.();
      } else {
        toast((res as { error?: string }).error ?? t('policy.saveFail'), 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ConfirmDialog />
      <div className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-on-surface text-sm">{t('policy.spendTitle')}</p>
              <p className="text-xs text-on-surface-variant">{t('policy.spendSubtitle')}</p>
            </div>
          </div>
          {dailySpent && <HeaderGauge spent={dailySpent} />}
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
                  <span>$2,500</span>
                  <span>$5,000</span>
                  <span>$7,500</span>
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

            {/* Actions row: Save + Delete */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-error/30 text-error text-sm font-medium hover:bg-error/10 disabled:opacity-40 transition-all"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? t('policy.deleting') : t('policy.delete')}
              </button>

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
    </>
  );
}
