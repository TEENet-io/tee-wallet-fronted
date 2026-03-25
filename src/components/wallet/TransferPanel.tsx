import { useState, useEffect, type FormEvent } from 'react';
import { Send, Loader2, ArrowRightLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { useWallets } from '../../contexts/WalletContext';
import { useToast } from '../../contexts/ToastContext';
import type { AllowedContract } from '../../types';

type TransferMode = 'native' | 'token';

interface TransferResult {
  tx_hash?: string;
  approval_url?: string;
  approval_id?: string;
  error?: string;
}

const INPUT_CLASS =
  'w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary transition-colors placeholder:text-outline';

const LABEL_CLASS = 'block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide';

export default function TransferPanel({ walletId, chain }: { walletId: string; chain: string }) {
  const { getChainFamily, getChainCurrency, refreshBalance } = useWallets();
  const { toast } = useToast();

  const family = getChainFamily(chain);
  const currency = getChainCurrency(chain);

  const [mode, setMode] = useState<TransferMode>('native');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [contracts, setContracts] = useState<AllowedContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);

  // Load whitelisted contracts when switching to token mode
  useEffect(() => {
    if (mode !== 'token') return;
    let cancelled = false;
    setContractsLoading(true);
    api<{ contracts?: AllowedContract[] }>(`/api/wallets/${walletId}/contracts`)
      .then(res => {
        if (!cancelled) {
          setContracts(res.contracts ?? []);
          if (res.contracts?.length) setSelectedContract(res.contracts[0].address);
        }
      })
      .finally(() => { if (!cancelled) setContractsLoading(false); });
    return () => { cancelled = true; };
  }, [mode, walletId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!to.trim()) { toast('Recipient address is required', 'error'); return; }
    if (!amount.trim()) { toast('Amount is required', 'error'); return; }
    if (mode === 'token' && !selectedContract) { toast('Select a token contract', 'error'); return; }

    setLoading(true);
    setResult(null);

    const body: Record<string, string> = { to: to.trim(), amount: amount.trim(), memo: memo.trim() };
    if (mode === 'token') body.token_contract = selectedContract;

    const res = await api<TransferResult>(`/api/wallets/${walletId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.success) {
      setResult({ error: res.error || 'Transfer failed' });
      toast(res.error || 'Transfer failed', 'error');
      return;
    }

    if (res.approval_url || res.approval_id) {
      setResult({ approval_url: res.approval_url, approval_id: res.approval_id });
      toast('Transfer submitted for approval', 'info');
      return;
    }

    setResult({ tx_hash: res.tx_hash });
    toast('Transfer submitted successfully', 'success');
    await refreshBalance(walletId);

    // Reset form
    setTo('');
    setAmount('');
    setMemo('');
  };

  return (
    <div className="bg-surface-container-low rounded-3xl p-6 ghost-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center shrink-0">
          <Send className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface text-base leading-tight">Transfer Funds</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            <span className="font-mono text-primary/80">{walletId.slice(0, 8)}…</span>
            {' '}on <span className="text-secondary">{chain}</span>
          </p>
        </div>
      </div>

      {/* Segment control */}
      <div className="mb-6">
        <div className="inline-flex bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => { setMode('native'); setResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'native'
                ? 'primary-gradient text-white shadow-sm'
                : 'text-slate-400 hover:text-on-surface'
            }`}
          >
            Native {currency}
          </button>
          <button
            type="button"
            onClick={() => { setMode('token'); setResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'token'
                ? 'primary-gradient text-white shadow-sm'
                : 'text-slate-400 hover:text-on-surface'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Token
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Token contract selector — token mode only */}
        {mode === 'token' && (
          <div>
            <label className={LABEL_CLASS}>Token Contract</label>
            {contractsLoading ? (
              <div className="flex items-center gap-2 text-sm text-outline py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading contracts…
              </div>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-outline py-2">
                No whitelisted token contracts found for this wallet.
              </p>
            ) : (
              <select
                value={selectedContract}
                onChange={e => setSelectedContract(e.target.value)}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {contracts.map(c => (
                  <option key={c.id} value={c.address}>
                    {c.label} — {c.address.slice(0, 10)}…{c.address.slice(-6)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Recipient */}
        <div>
          <label className={LABEL_CLASS}>Recipient Address</label>
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder={family === 'solana' ? 'Solana public key…' : '0x…'}
            className={INPUT_CLASS}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Amount */}
        <div>
          <label className={LABEL_CLASS}>
            Amount{mode === 'native' ? ` (${currency})` : ''}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className={INPUT_CLASS}
          />
        </div>

        {/* Memo */}
        <div>
          <label className={LABEL_CLASS}>Memo <span className="text-outline normal-case">(optional)</span></label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="Reference or note…"
            className={INPUT_CLASS}
          />
        </div>

        {/* Result banner */}
        {result && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${
            result.error
              ? 'bg-error-container/20 border-error/30 text-error'
              : result.approval_url || result.approval_id
              ? 'bg-[#0c1a4d]/60 border-[#1e3a8a]/50 text-[#93c5fd]'
              : 'bg-[#052e16]/60 border-[#14532d]/50 text-[#4ade80]'
          }`}>
            {result.error && <span>{result.error}</span>}
            {(result.approval_url || result.approval_id) && (
              <span>
                Pending Approval
                {result.approval_id && (
                  <> — ID: <span className="font-mono">{result.approval_id}</span></>
                )}
                {result.approval_url && (
                  <>
                    {' '}
                    <a
                      href={result.approval_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline ml-1"
                    >
                      Review
                    </a>
                  </>
                )}
              </span>
            )}
            {result.tx_hash && (
              <span>
                Transaction submitted —{' '}
                <span className="font-mono break-all">{result.tx_hash}</span>
              </span>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || (mode === 'token' && (contractsLoading || contracts.length === 0))}
          className="flex items-center justify-center gap-2 primary-gradient text-white font-semibold text-sm px-6 py-3 rounded-xl glow-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send {mode === 'native' ? currency : 'Token'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
