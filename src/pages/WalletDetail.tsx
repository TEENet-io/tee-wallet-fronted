import { useState, type ReactNode } from 'react';
import { ArrowLeft, Copy, Check, RefreshCw, ArrowUpRight, FileCode2, ShieldCheck, SlidersHorizontal, Repeat2 } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import TransferPanel from '../components/wallet/TransferPanel';
import ContractPanel from '../components/wallet/ContractPanel';
import WhitelistPanel from '../components/wallet/WhitelistPanel';
import WrapPanel from '../components/wallet/WrapPanel';
import PolicyPanel from '../components/wallet/PolicyPanel';

type TabId = 'transfer' | 'contract' | 'whitelist' | 'wrap' | 'policy';

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
  solanaOnly?: boolean;
}

const TABS: Tab[] = [
  { id: 'transfer', label: 'Transfer', icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: 'contract', label: 'Contract', icon: <FileCode2 className="w-4 h-4" /> },
  { id: 'whitelist', label: 'Whitelist', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'wrap', label: 'Wrap/Unwrap', icon: <Repeat2 className="w-4 h-4" />, solanaOnly: true },
  { id: 'policy', label: 'Policy', icon: <SlidersHorizontal className="w-4 h-4" /> },
];

function StatusDot({ status }: { status: 'ready' | 'creating' | 'error' }) {
  const styles = {
    ready: 'bg-emerald-400',
    creating: 'bg-yellow-400 animate-pulse',
    error: 'bg-error',
  };
  const labels = { ready: 'Ready', creating: 'Creating', error: 'Error' };
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

interface WalletDetailProps {
  walletId: string;
  onBack: () => void;
}

export default function WalletDetail({ walletId, onBack }: WalletDetailProps) {
  const { wallets, balances, refreshBalance, getChainFamily, getChainCurrency, chainsMap, loading } = useWallets();

  const [activeTab, setActiveTab] = useState<TabId>('transfer');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const wallet = wallets.find(w => w.id === walletId);
  const family = wallet ? getChainFamily(wallet.chain) : 'evm';
  const isSolana = family === 'solana';
  const currency = wallet ? getChainCurrency(wallet.chain) : '';
  const chainLabel = wallet ? (chainsMap[wallet.chain]?.label ?? wallet.chain) : '';
  const balance = wallet ? balances[wallet.id] : undefined;

  const visibleTabs = TABS.filter(t => !t.solanaOnly || isSolana);

  async function handleCopy() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // Loading state — wallets not loaded yet
  if (loading && wallets.length === 0) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wallets
        </button>
        <div className="bg-surface-container-low rounded-3xl p-8 ghost-border">
          <div className="space-y-4">
            <div className="h-6 w-40 rounded-xl bg-surface-container-high shimmer" />
            <div className="h-4 w-64 rounded-xl bg-surface-container-high shimmer" />
            <div className="h-4 w-48 rounded-xl bg-surface-container-high shimmer" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!wallet) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wallets
        </button>
        <div className="bg-surface-container-low rounded-3xl p-12 ghost-border flex flex-col items-center justify-center gap-4 text-center">
          <p className="font-headline font-bold text-on-surface text-xl">Wallet not found</p>
          <p className="text-sm text-on-surface-variant">
            The wallet with ID <span className="font-mono text-primary">{walletId}</span> could not be found.
          </p>
          <button
            onClick={onBack}
            className="mt-2 px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold hover:opacity-90 transition-all"
          >
            Back to Wallets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Wallets
      </button>

      {/* Wallet header card */}
      <div className="relative bg-surface-container-low rounded-3xl p-7 ghost-border overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 blur-[120px] -mr-24 -mt-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 blur-[100px] -ml-16 -mb-16 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start gap-6">
          {/* Chain icon */}
          <div className="w-16 h-16 rounded-3xl bg-surface-container-high ghost-border flex items-center justify-center text-3xl flex-shrink-0">
            {isSolana ? '◎' : '⬡'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-headline font-bold text-2xl md:text-3xl text-on-surface tracking-tight">
                  {wallet.label}
                </h1>
                <StatusDot status={wallet.status} />
              </div>
              <p className="text-secondary text-sm font-medium mt-1">{chainLabel}</p>
            </div>

            {/* Address row */}
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs text-on-surface-variant font-mono bg-surface-container-high px-3 py-1.5 rounded-lg ghost-border break-all">
                {wallet.address}
              </code>
              <button
                onClick={handleCopy}
                title="Copy address"
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all ghost-border"
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>

          {/* Balance panel */}
          {wallet.status === 'ready' && (
            <div className="flex-shrink-0 text-left md:text-right flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2">
              <div>
                <p className="text-xs text-outline uppercase tracking-widest font-label mb-1">Balance</p>
                <p className="font-headline font-black text-2xl text-on-surface tracking-tighter">
                  {balance ?? '—'}
                </p>
                <p className="text-xs text-secondary font-bold uppercase tracking-widest">{currency}</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh balance"
                className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all ghost-border disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl ghost-border overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'primary-gradient text-white shadow-[0_0_15px_rgba(124,58,237,0.25)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in duration-200" key={activeTab}>
        {activeTab === 'transfer' && (
          <TransferPanel walletId={wallet.id} chain={wallet.chain} />
        )}
        {activeTab === 'contract' && (
          <ContractPanel walletId={wallet.id} chain={wallet.chain} />
        )}
        {activeTab === 'whitelist' && (
          <WhitelistPanel walletId={wallet.id} />
        )}
        {activeTab === 'wrap' && isSolana && (
          <WrapPanel walletId={wallet.id} />
        )}
        {activeTab === 'policy' && (
          <PolicyPanel walletId={wallet.id} />
        )}
      </div>
    </div>
  );
}
