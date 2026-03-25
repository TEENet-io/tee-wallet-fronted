import { useState, type MouseEvent } from 'react';
import { Plus, Wallet, ChevronRight, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';
import ChainSelector from '../components/ChainSelector';

function truncateAddress(address: string): string {
  if (!address || address.length <= 18) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function StatusBadge({ status }: { status: 'ready' | 'creating' | 'error' }) {
  const styles = {
    ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    creating: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-error/10 text-error border-error/20',
  };
  const labels = { ready: 'Ready', creating: 'Creating...', error: 'Error' };
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
  const { wallets, chainsMap, balances, loading, createWallet, deleteWallet, refreshBalance, getChainFamily, getChainCurrency } = useWallets();
  const { requireReauth } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const firstChain = Object.keys(chainsMap)[0] ?? '';
  const effectiveChain = selectedChain || firstChain;

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

  async function handleDelete(e: MouseEvent<HTMLButtonElement>, walletId: string, walletLabel: string) {
    e.stopPropagation();
    const authed = await requireReauth();
    if (!authed) return;
    const ok = await confirm({
      title: 'Delete wallet?',
      message: `This will permanently remove "${walletLabel}". This action cannot be undone.`,
      confirmText: 'Delete Wallet',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(walletId);
    try {
      await deleteWallet(walletId);
    } finally {
      setDeletingId(null);
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
      <ConfirmDialog />

      {/* Hero Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-secondary text-xs font-bold tracking-[0.2em] uppercase font-label">
              TEE-Protected
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-on-surface">
            Your Wallets
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            Manage your hardware-isolated wallets. Each wallet operates inside a Trusted Execution Environment — your keys never leave the enclave.
          </p>
        </div>
      </section>

      {/* Create Wallet Card */}
      <section>
        <button
          onClick={() => setCreateOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-6 py-4 bg-surface-container-low rounded-2xl ghost-border hover:bg-surface-container transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl primary-gradient flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)]">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="font-headline font-bold text-on-surface">Create New Wallet</span>
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
                Chain
              </label>
              <ChainSelector
                chains={chainsMap}
                value={effectiveChain}
                onChange={setSelectedChain}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
                Label <span className="normal-case text-outline font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={effectiveChain ? `${chainsMap[effectiveChain]?.label ?? effectiveChain} wallet` : 'My wallet'}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-on-surface text-sm placeholder:text-outline outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)] transition-all"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !effectiveChain}
                className="flex-1 py-3 rounded-xl primary-gradient text-white text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Wallet
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
              <p className="font-headline font-bold text-on-surface text-xl mb-2">No wallets yet</p>
              <p className="text-sm text-on-surface-variant max-w-xs">
                Create your first TEE-protected wallet above to get started. Your keys are generated inside a secure enclave and never exposed.
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-2 px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Wallet
            </button>
          </div>
        ) : (
          wallets.map(wallet => {
            const family = getChainFamily(wallet.chain);
            const currency = getChainCurrency(wallet.chain);
            const chainLabel = chainsMap[wallet.chain]?.label ?? wallet.chain;
            const balance = balances[wallet.id];
            const isDeleting = deletingId === wallet.id;
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
                      <button
                        onClick={e => handleRefresh(e, wallet.id)}
                        disabled={isRefreshing}
                        title="Refresh balance"
                        className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-variant transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    <button
                      onClick={e => handleDelete(e, wallet.id, wallet.label)}
                      disabled={isDeleting}
                      title="Delete wallet"
                      className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {isDeleting
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>

                    <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* Mobile balance row */}
                {wallet.status === 'ready' && balance !== undefined && (
                  <div className="sm:hidden mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between">
                    <span className="text-xs text-outline">Balance</span>
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
