import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { FileCode2, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ConfirmDialog';
import type { AllowedContract } from '../../types';

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function WhitelistPanel({ walletId }: { walletId: string }) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [contracts, setContracts] = useState<AllowedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [abiHint, setAbiHint] = useState('');

  const loadContracts = useCallback(async () => {
    setLoading(true);
    const res = await api<{ contracts: AllowedContract[] }>(
      `/api/wallets/${walletId}/contracts`,
    );
    if (res.success && res.contracts) {
      setContracts(res.contracts);
    } else {
      toast(res.error ?? 'Failed to load whitelist', 'error');
    }
    setLoading(false);
  }, [walletId, toast]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !label.trim()) {
      toast('Address and label are required', 'error');
      return;
    }
    setAdding(true);
    const res = await api(`/api/wallets/${walletId}/contracts`, {
      method: 'POST',
      body: JSON.stringify({
        address: address.trim(),
        label: label.trim(),
        abi_hint: abiHint.trim() || undefined,
      }),
    });
    if (res.success) {
      toast('Contract added to whitelist', 'success');
      setAddress('');
      setLabel('');
      setAbiHint('');
      setShowForm(false);
      await loadContracts();
    } else {
      toast(res.error ?? 'Failed to add contract', 'error');
    }
    setAdding(false);
  };

  const handleRemove = async (contract: AllowedContract) => {
    const ok = await confirm({
      title: 'Remove from whitelist?',
      message: `"${contract.label}" (${truncateAddress(contract.contract_address)}) will be removed from the allowed list.`,
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setRemoving(contract.id);
    const res = await api(`/api/wallets/${walletId}/contracts/${contract.id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      toast('Contract removed', 'success');
      setContracts(prev => prev.filter(c => c.id !== contract.id));
    } else {
      toast(res.error ?? 'Failed to remove contract', 'error');
    }
    setRemoving(null);
  };

  return (
    <>
      <ConfirmDialog />

      <div className="bg-surface-container-low rounded-3xl ghost-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-tertiary/10 flex items-center justify-center">
              <FileCode2 className="w-5 h-5 text-tertiary" />
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface leading-tight">Whitelist</p>
              <p className="text-xs text-on-surface-variant">Allowed contracts &amp; addresses</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              showForm
                ? 'bg-surface-container-high text-on-surface-variant'
                : 'primary-gradient text-white glow-primary'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="px-6 py-5 border-b border-outline-variant/20 bg-surface-container/50"
          >
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
              New whitelisted contract
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-on-surface-variant mb-1">
                  Contract address <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="0x… or base58…"
                  spellCheck={false}
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm font-mono text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">
                  Label <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Uniswap Router"
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">
                  ABI hint <span className="text-outline">(optional)</span>
                </label>
                <input
                  type="text"
                  value={abiHint}
                  onChange={e => setAbiHint(e.target.value)}
                  placeholder="e.g. ERC20, swap, transfer"
                  className="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-medium hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-2 px-5 py-2 rounded-xl primary-gradient text-white text-sm font-bold disabled:opacity-60 transition-opacity"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? 'Adding…' : 'Add contract'}
              </button>
            </div>
          </form>
        )}

        {/* Contract list */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-on-surface-variant">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading whitelist…</span>
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-outline" />
              </div>
              <p className="text-sm text-on-surface-variant">No contracts whitelisted yet</p>
              <p className="text-xs text-outline">Add a contract address to allow interactions</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {contracts.map(contract => (
                <li
                  key={contract.id}
                  className="flex items-center gap-4 bg-surface-container rounded-2xl px-4 py-3.5 border border-outline-variant/15 hover:border-outline-variant/30 transition-colors group"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center shrink-0">
                    <FileCode2 className="w-4 h-4 text-tertiary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-on-surface truncate">
                        {contract.label}
                      </span>
                      {contract.abi_hint && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider border border-primary/20 shrink-0">
                          {contract.abi_hint}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-on-surface-variant mt-0.5 truncate" title={contract.contract_address}>
                      {truncateAddress(contract.contract_address)}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(contract)}
                    disabled={removing === contract.id}
                    title="Remove from whitelist"
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-error hover:bg-error/10 disabled:opacity-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    {removing === contract.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
