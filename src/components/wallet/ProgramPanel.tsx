import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { FileCode2, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';
import type { AllowedContract } from '../../types';

// Default well-known contracts by chain family
const EVM_PROGRAMS = [
  { label: 'Uniswap V3 Router', address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', abi_hint: 'DEX', symbol: 'UNI', decimals: 18 },
  { label: 'USDT (Tether)', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', abi_hint: 'Stablecoin', symbol: 'USDT', decimals: 6 },
  { label: 'USDC (Circle)', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', abi_hint: 'Stablecoin', symbol: 'USDC', decimals: 6 },
  { label: 'Aave V3 Pool', address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', abi_hint: 'Lending', symbol: 'AAVE', decimals: 18 },
  { label: 'Lido stETH', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', abi_hint: 'Staking', symbol: 'stETH', decimals: 18 },
];

const SOLANA_PROGRAMS = [
  { label: 'USDC (Solana)', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', abi_hint: 'Stablecoin', symbol: 'USDC', decimals: 6 },
  { label: 'USDT (Solana)', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', abi_hint: 'Stablecoin', symbol: 'USDT', decimals: 6 },
  { label: 'Jupiter Aggregator', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', abi_hint: 'DEX', symbol: 'JUP', decimals: 6 },
  { label: 'Raydium AMM', address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', abi_hint: 'DEX', symbol: 'RAY', decimals: 6 },
  { label: 'Marinade Finance', address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', abi_hint: 'Staking', symbol: 'mSOL', decimals: 9 },
];

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function badgeColor(hint?: string): string {
  if (!hint) return 'bg-surface-container-high text-on-surface-variant';
  const h = hint.toLowerCase();
  if (h.includes('stablecoin') || h.includes('stable')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (h.includes('dex') || h.includes('swap')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  if (h.includes('lending') || h.includes('lend')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
  if (h.includes('staking') || h.includes('stake')) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  return 'bg-primary/10 text-primary border border-primary/20';
}

type ActivePanel = { id: string | number; mode: 'edit' } | null;

interface ProgramPanelProps {
  walletId: string;
  chainFamily: 'evm' | 'solana';
}

export default function ProgramPanel({ walletId, chainFamily }: ProgramPanelProps) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { t } = useLanguage();
  const { getFreshPasskeyCredential } = useAuth();

  const [contracts, setContracts] = useState<AllowedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  // Active inline panel: only one open at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Edit form
  const [editLabel, setEditLabel] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editDecimals, setEditDecimals] = useState('');

  // New contract form
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newAbiHint, setNewAbiHint] = useState('');

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ contracts?: AllowedContract[] }>(`/api/wallets/${walletId}/contracts`);
      if (res.success && Array.isArray(res.contracts)) {
        setContracts(res.contracts);
      }
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  function toggleEdit(id: string | number, contract: AllowedContract) {
    if (activePanel?.id === id) {
      setActivePanel(null);
      return;
    }
    setEditLabel(contract.label || '');
    setEditSymbol(contract.symbol || '');
    setEditDecimals(contract.decimals != null ? String(contract.decimals) : '');
    setActivePanel({ id, mode: 'edit' });
  }

  async function handleRemove(contract: AllowedContract) {
    const ok = await confirm({
      title: t(chainFamily === 'evm' ? 'program.removeTitle.evm' : 'program.removeTitle'),
      message: `${t('program.removeMessage')} "${contract.label || truncateAddr(contract.contract_address)}"?`,
      confirmText: t('program.removeBtn'),
      danger: true,
    });
    if (!ok) return;

    setRemoving(String(contract.id));
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setRemoving(null); return; }
      const res = await api(`/api/wallets/${walletId}/contracts/${contract.id}`, {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });
      if (res.success) {
        toast(t('program.removeSuccess'), 'success');
        if (activePanel?.id === contract.id) setActivePanel(null);
        await loadContracts();
      } else {
        toast((res as { error?: string }).error || t('program.removeFail'), 'error');
      }
    } finally {
      setRemoving(null);
    }
  }

  async function handleEdit(e: FormEvent, contract: AllowedContract) {
    e.preventDefault();
    setActionBusy(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setActionBusy(false); return; }

      const body: Record<string, unknown> = {
        ...passkeyBody,
        label: editLabel.trim() || contract.label,
        symbol: editSymbol.trim() || undefined,
      };
      if (editDecimals.trim() !== '') {
        body.decimals = parseInt(editDecimals.trim(), 10);
      }

      const res = await api(`/api/wallets/${walletId}/contracts/${contract.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (res.success) {
        toast(t('program.editSuccess'), 'success');
        setActivePanel(null);
        await loadContracts();
      } else {
        toast((res as { error?: string }).error || t('program.editFail'), 'error');
      }
    } finally {
      setActionBusy(false);
    }
  }

  const DEFAULT_PROGRAMS = chainFamily === 'solana' ? SOLANA_PROGRAMS : EVM_PROGRAMS;

  async function handleAddDefault(program: typeof EVM_PROGRAMS[number]) {
    setAdding(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setAdding(false); return; }
      const res = await api(`/api/wallets/${walletId}/contracts`, {
        method: 'POST',
        body: JSON.stringify({ ...passkeyBody, contract_address: program.address, label: program.label, symbol: program.symbol, decimals: program.decimals }),
      });
      if (res.success) {
        toast(`${program.label} ${t('program.addedSuffix')}`, 'success');
        await loadContracts();
      } else {
        toast((res as { error?: string }).error || t('program.addFail'), 'error');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleAddCustom(e: FormEvent) {
    e.preventDefault();
    if (!newAddress.trim()) { toast(t('program.addressRequired'), 'error'); return; }

    setAdding(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setAdding(false); return; }
      const res = await api(`/api/wallets/${walletId}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          ...passkeyBody,
          contract_address: newAddress.trim(),
          label: newLabel.trim() || t('program.customContract'),
          symbol: newAbiHint.trim() || undefined,
        }),
      });
      if (res.success) {
        toast(t('program.contractAdded'), 'success');
        setNewLabel('');
        setNewAddress('');
        setNewAbiHint('');
        setShowAdd(false);
        await loadContracts();
      } else {
        toast((res as { error?: string }).error || t('program.addFail'), 'error');
      }
    } finally {
      setAdding(false);
    }
  }

  // Contracts already in whitelist (by address)
  const whitelistedAddresses = new Set(contracts.map(c => c.contract_address.toLowerCase()));
  const availableDefaults = DEFAULT_PROGRAMS.filter(p => !whitelistedAddresses.has(p.address.toLowerCase()));

  return (
    <>
      <ConfirmDialog />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-primary" />
              {t(chainFamily === 'evm' ? 'program.title.evm' : 'program.title')}
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              {t('program.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl primary-gradient text-white text-sm font-bold hover:opacity-90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('program.newBtn')}
          </button>
        </div>

        {/* Add Custom Form */}
        {showAdd && (
          <form onSubmit={handleAddCustom} className="bg-surface-container rounded-2xl p-6 ghost-border space-y-4">
            <h3 className="font-headline font-semibold text-on-surface text-sm">{t('program.addCustomTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder={t('program.addressPlaceholder')}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary font-mono md:col-span-2"
              />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder={t('program.labelPlaceholder')}
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                value={newAbiHint}
                onChange={e => setNewAbiHint(e.target.value)}
                placeholder={t('program.typePlaceholder')}
                className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={adding || !newAddress.trim()}
                className="px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center gap-2"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('program.addBtn')}
              </button>
            </div>
          </form>
        )}

        {/* Quick-add defaults */}
        {availableDefaults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">{t('program.quickAdd')}</p>
            <div className="flex flex-wrap gap-2">
              {availableDefaults.map(p => (
                <button
                  key={p.address}
                  onClick={() => handleAddDefault(p)}
                  disabled={adding}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low ghost-border text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  {p.label}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor(p.abi_hint)}`}>{p.abi_hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contract List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface-container-low rounded-2xl p-5 ghost-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-surface-container-high shimmer" />
                    <div className="h-3 w-48 rounded bg-surface-container-high shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="bg-surface-container-low rounded-2xl p-12 ghost-border flex flex-col items-center justify-center gap-3 text-center">
            <FileCode2 className="w-10 h-10 text-outline" />
            <p className="text-on-surface-variant text-sm">{t(chainFamily === 'evm' ? 'program.empty.evm' : 'program.empty')}</p>
            <p className="text-outline text-xs">{t('program.emptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map(contract => {
              const isRemoving = removing === String(contract.id);
              const panel = activePanel?.id === contract.id ? activePanel.mode : null;

              return (
                <div
                  key={contract.id}
                  className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden transition-all"
                >
                  {/* Card row */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0 ghost-border">
                      <FileCode2 className="w-5 h-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-on-surface text-sm">{contract.label || t('program.unnamed')}</p>
                        {contract.symbol && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor(contract.symbol)}`}>
                            {contract.symbol}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant font-mono mt-0.5">{truncateAddr(contract.contract_address)}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Edit contract */}
                      <button
                        onClick={() => toggleEdit(contract.id, contract)}
                        title={t('program.edit')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          panel === 'edit'
                            ? 'bg-primary/15 text-primary border border-primary/25'
                            : 'text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-transparent'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('program.edit')}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleRemove(contract)}
                        disabled={isRemoving}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all disabled:opacity-50 ml-1"
                        title={t('program.removeBtn')}
                      >
                        {isRemoving
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Inline panel: Edit */}
                  {panel === 'edit' && (
                    <form
                      onSubmit={e => handleEdit(e, contract)}
                      className="border-t border-outline-variant/10 bg-surface-container px-4 py-4 space-y-3"
                    >
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t('program.edit')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          placeholder={t('program.label')}
                          className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2.5 text-on-surface text-sm outline-none focus:border-primary sm:col-span-1"
                        />
                        <input
                          value={editSymbol}
                          onChange={e => setEditSymbol(e.target.value)}
                          placeholder={t('program.symbol')}
                          className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2.5 text-on-surface text-sm outline-none focus:border-primary"
                        />
                        <input
                          value={editDecimals}
                          onChange={e => setEditDecimals(e.target.value)}
                          placeholder={t('program.decimals')}
                          type="number"
                          min="0"
                          max="18"
                          className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2.5 text-on-surface text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActivePanel(null)}
                          className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                          {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                          {actionBusy ? t('program.editing') : t('program.edit')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {contracts.length > 0 && (
          <div className="px-2 text-xs text-on-surface-variant">
            {contracts.length} {contracts.length !== 1 ? t('program.programs') : t('program.program')} {t('program.whitelisted')}
          </div>
        )}
      </div>
    </>
  );
}
