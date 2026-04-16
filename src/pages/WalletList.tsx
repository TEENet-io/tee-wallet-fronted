// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, useMemo, type MouseEvent } from 'react';
import { Plus, Wallet, ChevronRight, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import { useLanguage } from '../contexts/LanguageContext';
import ChainSelector from '../components/ChainSelector';
import { isTestnetChain } from '../lib/chainNetwork';
import type { ChainConfig } from '../types';

function truncateAddress(address: string): string {
  if (!address || address.length <= 18) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function StatusBadge({ status }: { status: 'ready' | 'creating' | 'error' }) {
  const { t } = useLanguage();
  const styles = {
    ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    creating: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-error/10 text-error border-error/20',
  };
  const labels = {
    ready: t('wallet.status.ready'),
    creating: t('wallet.status.creating'),
    error: t('wallet.status.error'),
  };
  const dots = {
    ready: 'bg-emerald-400',
    creating: 'bg-yellow-400 animate-pulse',
    error: 'bg-error',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

interface WalletListProps {
  onSelectWallet: (id: string) => void;
}

export default function WalletList({ onSelectWallet }: WalletListProps) {
  const { wallets, chainsMap, balances, loading, createWallet, refreshBalance, getChainFamily, getChainCurrency } = useWallets();
  const { t } = useLanguage();

  const [createOpen, setCreateOpen] = useState(false);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet');
  const [selectedChain, setSelectedChain] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // First chain in the currently selected network — used as fallback
  // when the user hasn't explicitly picked one or after switching networks.
  const firstChainInNetwork = useMemo(() => {
    const all = Object.values(chainsMap) as ChainConfig[];
    const match = all.find(c =>
      network === 'testnet' ? isTestnetChain(c) : !isTestnetChain(c),
    );
    return match?.name ?? '';
  }, [chainsMap, network]);

  // Clear the selection if it doesn't belong to the active network.
  const selectedCfg = selectedChain ? (chainsMap[selectedChain] as ChainConfig | undefined) : undefined;
  const selectedBelongsToNetwork = !!selectedCfg &&
    (network === 'testnet' ? isTestnetChain(selectedCfg) : !isTestnetChain(selectedCfg));
  const effectiveChain = selectedBelongsToNetwork ? selectedChain : firstChainInNetwork;

  function handleNetworkChange(next: 'mainnet' | 'testnet') {
    if (next === network) return;
    setNetwork(next);
    setSelectedChain('');
  }

  async function handleCreate() {
    if (!effectiveChain) return;
    setCreating(true);
    try {
      const wallet = await createWallet(effectiveChain, label.trim());
      if (wallet) {
        setLabel('');
        setSelectedChain('');
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRefresh(e: MouseEvent<HTMLButtonElement>, walletId: string) {
    e.stopPropagation();
    setRefreshingId(walletId);
    try {
      await refreshBalance(walletId);
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-on-surface">{t('wallets.title')}</h1>
      </div>

      {/* Create Wallet Card */}
      <section>
        <button type="button"
          onClick={() => setCreateOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-6 py-4 bg-surface-container-low rounded-2xl ghost-border hover:bg-surface-container transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-on-surface">{t('wallets.createNew')}</span>
          </div>
          {createOpen
            ? <ChevronUp className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
            : <ChevronDown className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
          }
        </button>

        {createOpen && (
          <div className="mt-2 bg-surface-container-low rounded-3xl p-6 ghost-border space-y-5 animate-in slide-in-from-top-2 duration-200">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[80px] -mr-16 -mt-16 pointer-events-none" />

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                {t('wallets.network')}
              </label>
              <div className="inline-flex p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => handleNetworkChange('mainnet')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    network === 'mainnet'
                      ? 'bg-primary/20 text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t('wallets.mainnet')}
                </button>
                <button
                  type="button"
                  onClick={() => handleNetworkChange('testnet')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    network === 'testnet'
                      ? 'bg-primary/20 text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t('wallets.testnet')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                {t('wallets.chain')}
              </label>
              <ChainSelector
                chains={chainsMap}
                value={effectiveChain}
                onChange={setSelectedChain}
                network={network}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                {t('wallets.label')}
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={effectiveChain ? `${chainsMap[effectiveChain]?.label ?? effectiveChain} wallet` : t('wallets.labelPlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-on-surface text-sm placeholder:text-outline outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)] transition-all"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button type="button"
                onClick={handleCreate}
                disabled={creating || !effectiveChain}
                className="flex-1 py-3 rounded-xl primary-gradient text-white text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('wallets.creating')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t('wallets.create')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Wallet List */}
      <section className="space-y-4">
        {loading && wallets.length === 0 ? (
          /* Skeleton loaders */
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface-container-low rounded-3xl p-6 ghost-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-high shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded-lg bg-surface-container-high shimmer" />
                    <div className="h-3 w-48 rounded-lg bg-surface-container-high shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : wallets.length === 0 ? (
          /* Empty state */
          <div className="bg-surface-container-low rounded-3xl p-12 ghost-border flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-3xl bg-surface-container-high flex items-center justify-center">
              <Wallet className="w-8 h-8 text-outline" />
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface text-xl mb-2">{t('wallets.empty')}</p>
              <p className="text-sm text-on-surface-variant max-w-xs">
                {t('wallets.emptyDescFull')}
              </p>
            </div>
            <button type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-2 px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('wallets.createFirst')}
            </button>
          </div>
        ) : (
          wallets.map(wallet => {
            const family = getChainFamily(wallet.chain);
            const currency = getChainCurrency(wallet.chain);
            const chainLabel = chainsMap[wallet.chain]?.label ?? wallet.chain;
            const balance = balances[wallet.id];
            const isRefreshing = refreshingId === wallet.id;

            return (
              <div
                key={wallet.id}
                onClick={() => onSelectWallet(wallet.id)}
                className="group relative bg-surface-container-low rounded-3xl p-6 ghost-border hover:bg-surface-container hover:shadow-[0_0_30px_rgba(124,58,237,0.08)] cursor-pointer transition-all duration-200 overflow-hidden"
              >
                {/* Subtle hover glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/0 group-hover:bg-primary/5 blur-[60px] -mr-16 -mt-16 transition-all duration-500 pointer-events-none" />

                <div className="relative flex items-center gap-4">
                  {/* Chain icon */}
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-2xl flex-shrink-0 ghost-border">
                    {family === 'solana' ? '◎' : '⬡'}
                  </div>

                  {/* Wallet info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline font-bold text-on-surface truncate">
                        {wallet.label}
                      </span>
                      <StatusBadge status={wallet.status} />
                    </div>
                    <p className="text-xs text-secondary font-medium mt-0.5">{chainLabel}</p>
                    <p className="text-xs text-outline font-mono mt-1 truncate">
                      {truncateAddress(wallet.address)}
                    </p>
                  </div>

                  {/* Balance + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {wallet.status === 'ready' && (
                      <div className="text-right hidden sm:block">
                        {balance !== undefined ? (
                          <>
                            <p className="font-headline font-bold text-on-surface text-sm">
                              {balance}
                            </p>
                            <p className="text-[10px] text-outline uppercase tracking-widest">{currency}</p>
                          </>
                        ) : (
                          <p className="text-xs text-outline">—</p>
                        )}
                      </div>
                    )}

                    {wallet.status === 'ready' && (
                      <button type="button"
                        onClick={e => handleRefresh(e, wallet.id)}
                        disabled={isRefreshing}
                        title={t('wallets.refreshBalance')}
                        className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* Mobile balance row */}
                {wallet.status === 'ready' && balance !== undefined && (
                  <div className="sm:hidden mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                    <span className="text-xs text-outline">{t('wallet.balance')}</span>
                    <span className="text-sm font-bold text-on-surface font-mono">
                      {balance} <span className="text-outline text-[10px]">{currency}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
