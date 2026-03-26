import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowLeft, Copy, Check, RefreshCw, SlidersHorizontal, FileCode2, AlertTriangle, Pencil, X } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import type { DailySpent } from '../types';
import PolicyPanel from '../components/wallet/PolicyPanel';
import ProgramPanel from '../components/wallet/ProgramPanel';

type TabId = 'policy' | 'program';

function StatusDot({ status }: { status: 'ready' | 'creating' | 'error' }) {
  const { t } = useLanguage();
  const styles = {
    ready: 'bg-emerald-400',
    creating: 'bg-yellow-400 animate-pulse',
    error: 'bg-error',
  };
  const labels = {
    ready: t('wallet.status.ready'),
    creating: t('wallet.status.creating'),
    error: t('wallet.status.error'),
  };
  const textStyles = {
    ready: 'text-emerald-400',
    creating: 'text-yellow-400',
    error: 'text-error',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${textStyles[status]}`}>
      <span className={`w-2 h-2 rounded-full ${styles[status]}`} />
      {labels[status]}
    </span>
  );
}

function DailySpendBanner({ spent }: { spent: DailySpent }) {
  const { t } = useLanguage();
  const spentNum = parseFloat(spent.daily_spent_usd) || 0;
  const limitNum = parseFloat(spent.daily_limit_usd) || 0;
  const remainNum = parseFloat(spent.remaining_usd) || 0;
  const pct = limitNum > 0 ? Math.min(1, spentNum / limitNum) : 0;
  const isHigh = pct >= 0.8;
  const isExceeded = pct >= 1;

  const resetTime = spent.reset_at
    ? new Date(spent.reset_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`rounded-2xl p-4 ghost-border flex flex-col sm:flex-row sm:items-center gap-4 ${
      isExceeded ? 'bg-error/10 border-error/20' : isHigh ? 'bg-tertiary/10 border-tertiary/20' : 'bg-surface-container-low'
    }`}>
      {isHigh && (
        <AlertTriangle className={`w-5 h-5 shrink-0 ${isExceeded ? 'text-error' : 'text-tertiary'}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {t('wallet.dailySpend')}
          </span>
          <span className="text-xs text-on-surface-variant">
            ${spentNum.toFixed(2)} / ${limitNum.toFixed(2)} USD
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isExceeded ? 'bg-error' : isHigh ? 'bg-tertiary' : 'bg-primary'
            }`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs font-medium ${isExceeded ? 'text-error' : isHigh ? 'text-tertiary' : 'text-on-surface-variant'}`}>
            {isExceeded
              ? t('wallet.limitExceeded')
              : `$${remainNum.toFixed(2)} ${t('wallet.remaining')}`}
          </span>
          {resetTime && (
            <span className="text-[10px] text-on-surface-variant">{t('wallet.resets')} {resetTime}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface WalletDetailProps {
  walletId: string;
  onBack: () => void;
}

export default function WalletDetail({ walletId, onBack }: WalletDetailProps) {
  const { wallets, balances, refreshBalance, getChainFamily, getChainCurrency, chainsMap, loading } = useWallets();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [copied, setCopied] = useState(false);
  const [pubkeyCopied, setPubkeyCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dailySpent, setDailySpent] = useState<DailySpent | null>(null);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Public key state
  const [pubkey, setPubkey] = useState<string | null>(null);

  // USD price
  const [usdPrice, setUsdPrice] = useState<number | null>(null);

  const wallet = wallets.find(w => w.id === walletId);
  const family = wallet ? getChainFamily(wallet.chain) : 'evm';
  const isSolana = family === 'solana';
  const currency = wallet ? getChainCurrency(wallet.chain) : '';
  const chainLabel = wallet ? (chainsMap[wallet.chain]?.label ?? wallet.chain) : '';
  const balance = wallet ? balances[wallet.id] : undefined;

  // Fetch daily spend on mount
  useEffect(() => {
    if (!walletId) return;
    api<DailySpent>(`/api/wallets/${walletId}/daily-spent`).then(res => {
      if (res.success) setDailySpent(res);
    });
  }, [walletId]);

  // Fetch USD price
  useEffect(() => {
    if (!currency) return;
    api<{ success: boolean; prices?: Record<string, number> }>('/api/prices').then(res => {
      if (res.success && res.prices) {
        const sym = currency.toUpperCase();
        if (res.prices[sym]) setUsdPrice(res.prices[sym]);
      }
    });
  }, [currency]);

  // Fetch public key on mount
  useEffect(() => {
    if (!walletId) return;
    api<{ success: boolean; pubkey?: string }>(`/api/wallets/${walletId}/pubkey`).then(res => {
      if (res.success && res.pubkey) setPubkey(res.pubkey);
    });
  }, [walletId]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  async function handleCopy() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyPubkey() {
    if (!pubkey) return;
    await navigator.clipboard.writeText(pubkey);
    setPubkeyCopied(true);
    setTimeout(() => setPubkeyCopied(false), 2000);
  }

  async function handleRefresh() {
    if (!wallet) return;
    setRefreshing(true);
    try {
      await refreshBalance(wallet.id);
    } finally {
      setRefreshing(false);
    }
  }

  function startRename() {
    if (!wallet) return;
    setRenameValue(wallet.label);
    setIsRenaming(true);
  }

  function cancelRename() {
    setIsRenaming(false);
    setRenameValue('');
  }

  async function commitRename() {
    if (!wallet || renameSaving) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === wallet.label) {
      cancelRename();
      return;
    }
    setRenameSaving(true);
    try {
      const res = await api(`/api/wallets/${walletId}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: trimmed }),
      });
      if (res.success) {
        toast(t('wallet.renameSuccess'), 'success');
        // Refresh wallets list so the label updates in context
        // The wallet context will re-fetch on next load; trigger a balance refresh to stay responsive
        await refreshBalance(wallet.id);
      } else {
        toast((res as { error?: string }).error ?? 'Rename failed', 'error');
      }
    } finally {
      setRenameSaving(false);
      setIsRenaming(false);
      setRenameValue('');
    }
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }

  if (loading && wallets.length === 0) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('wallet.back')}
        </button>
        <div className="bg-surface-container-low rounded-3xl p-8 ghost-border">
          <div className="space-y-4">
            <div className="h-6 w-40 rounded-xl bg-surface-container-high shimmer" />
            <div className="h-4 w-64 rounded-xl bg-surface-container-high shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('wallet.back')}
        </button>
        <div className="bg-surface-container-low rounded-3xl p-12 ghost-border flex flex-col items-center justify-center gap-4 text-center">
          <p className="font-headline font-bold text-on-surface text-xl">{t('wallet.notFound')}</p>
          <button onClick={onBack} className="mt-2 px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold hover:opacity-90 transition-all">
            {t('wallet.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {t('wallet.back')}
      </button>

      {/* Wallet header */}
      <div className="relative bg-surface-container-low rounded-3xl p-7 ghost-border overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 blur-[120px] -mr-24 -mt-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 blur-[100px] -ml-16 -mb-16 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-16 h-16 rounded-3xl bg-surface-container-high ghost-border flex items-center justify-center text-3xl flex-shrink-0">
            {isSolana ? '◎' : '⬡'}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div>
              {/* Label row with rename */}
              <div className="flex items-center gap-3 flex-wrap">
                {isRenaming ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={handleRenameKeyDown}
                      disabled={renameSaving}
                      className="font-headline font-bold text-2xl md:text-3xl text-on-surface tracking-tight bg-transparent border-b-2 border-primary outline-none min-w-0 flex-1 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); cancelRename(); }}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="font-headline font-bold text-2xl md:text-3xl text-on-surface tracking-tight">{wallet.label}</h1>
                    <button
                      type="button"
                      onClick={startRename}
                      title={t('wallet.rename')}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all ghost-border"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <StatusDot status={wallet.status} />
              </div>
              <p className="text-secondary text-sm font-medium mt-1">{chainLabel}</p>
            </div>

            {/* Address row */}
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs text-on-surface-variant font-mono bg-surface-container-high px-3 py-1.5 rounded-lg ghost-border break-all">
                {wallet.address}
              </code>
              <button onClick={handleCopy} title={t('wallet.copyAddress')} className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all ghost-border">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Public key row */}
            {pubkey && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-on-surface-variant font-medium shrink-0">{t('wallet.pubkey')}:</span>
                <code className="text-xs text-on-surface-variant font-mono bg-surface-container-high px-3 py-1.5 rounded-lg ghost-border break-all">
                  {pubkey}
                </code>
                <button onClick={handleCopyPubkey} title={t('wallet.pubkey')} className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all ghost-border">
                  {pubkeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {wallet.status === 'ready' && (
            <div className="flex-shrink-0 text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2">
              <div>
                <p className="text-xs text-outline uppercase tracking-widest font-label mb-1">{t('wallet.balance')}</p>
                <p className="font-headline font-black text-2xl text-on-surface tracking-tighter">{balance ?? '—'}</p>
                {usdPrice !== null && balance && (
                  <p className="text-xs text-on-surface-variant tabular-nums">
                    ≈ ${(parseFloat(balance.split(' ')[0]) * usdPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                  </p>
                )}
              </div>
              <button onClick={handleRefresh} disabled={refreshing} title={t('wallets.refreshBalance')} className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all ghost-border disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Daily Spend Banner */}
      {dailySpent && dailySpent.daily_limit_usd && (
        <DailySpendBanner spent={dailySpent} />
      )}

      {/* Tab bar — only 2 tabs */}
      <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl ghost-border">
        <button
          onClick={() => setActiveTab('policy')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'policy'
              ? 'primary-gradient text-white shadow-[0_0_15px_rgba(124,58,237,0.25)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t('wallet.tab.threshold')}
        </button>
        <button
          onClick={() => setActiveTab('program')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'program'
              ? 'primary-gradient text-white shadow-[0_0_15px_rgba(124,58,237,0.25)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          {t('wallet.tab.program')}
        </button>
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in duration-200" key={activeTab}>
        {activeTab === 'policy' && <PolicyPanel walletId={wallet.id} />}
        {activeTab === 'program' && <ProgramPanel walletId={wallet.id} chainFamily={family} />}
      </div>
    </div>
  );
}
