import { useState, type FormEvent } from 'react';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface ActionResult {
  tx_hash?: string;
  message?: string;
}

export default function WrapPanel({ walletId }: { walletId: string }) {
  const { toast } = useToast();

  // Wrap state
  const [wrapAmount, setWrapAmount] = useState('');
  const [wrapping, setWrapping] = useState(false);
  const [wrapResult, setWrapResult] = useState<ActionResult | null>(null);
  const [wrapError, setWrapError] = useState<string | null>(null);

  // Unwrap state
  const [unwrapping, setUnwrapping] = useState(false);
  const [unwrapResult, setUnwrapResult] = useState<ActionResult | null>(null);
  const [unwrapError, setUnwrapError] = useState<string | null>(null);

  const handleWrap = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(wrapAmount);
    if (!wrapAmount || isNaN(amount) || amount <= 0) {
      toast('Enter a valid SOL amount to wrap', 'error');
      return;
    }
    setWrapping(true);
    setWrapResult(null);
    setWrapError(null);

    const res = await api<ActionResult>(`/api/wallets/${walletId}/wrap-sol`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });

    if (res.success) {
      setWrapResult(res as ActionResult);
      toast(`Wrapped ${amount} SOL to wSOL`, 'success');
      setWrapAmount('');
    } else {
      const msg = res.error ?? 'Wrap failed';
      setWrapError(msg);
      toast(msg, 'error');
    }
    setWrapping(false);
  };

  const handleUnwrap = async () => {
    setUnwrapping(true);
    setUnwrapResult(null);
    setUnwrapError(null);

    const res = await api<ActionResult>(`/api/wallets/${walletId}/unwrap-sol`, {
      method: 'POST',
    });

    if (res.success) {
      setUnwrapResult(res as ActionResult);
      toast('Unwrapped all wSOL to SOL', 'success');
    } else {
      const msg = res.error ?? 'Unwrap failed';
      setUnwrapError(msg);
      toast(msg, 'error');
    }
    setUnwrapping(false);
  };

  return (
    <div className="bg-surface-container-low rounded-3xl ghost-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-outline-variant/20">
        <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface leading-tight">Wrap / Unwrap SOL</p>
          <p className="text-xs text-on-surface-variant">Convert between SOL and wSOL</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Wrap section ── */}
        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <p className="font-semibold text-sm text-blue-300">Wrap SOL → wSOL</p>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Lock native SOL into a wrapped SPL token account (wSOL). Useful for DeFi protocols
            that require the SPL token standard.
          </p>

          <form onSubmit={handleWrap} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-on-surface-variant mb-1.5">
                Amount (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={wrapAmount}
                  onChange={e => setWrapAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-container-high border border-blue-500/20 rounded-xl px-4 py-2.5 pr-14 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/25 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-400 pointer-events-none">
                  SOL
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={wrapping || !wrapAmount}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-bold hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {wrapping
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Wrapping…</>
                : <><ArrowDownUp className="w-4 h-4" /> Wrap SOL</>
              }
            </button>
          </form>

          {/* Wrap feedback */}
          {wrapResult && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
              <p className="text-xs font-semibold text-blue-300 mb-1">Wrap successful</p>
              {wrapResult.tx_hash && (
                <p className="font-mono text-[11px] text-on-surface-variant break-all">
                  tx: {wrapResult.tx_hash}
                </p>
              )}
              {wrapResult.message && (
                <p className="text-xs text-on-surface-variant">{wrapResult.message}</p>
              )}
            </div>
          )}
          {wrapError && (
            <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3">
              <p className="text-xs font-semibold text-error mb-0.5">Wrap failed</p>
              <p className="text-xs text-on-surface-variant">{wrapError}</p>
            </div>
          )}
        </div>

        {/* ── Unwrap section ── */}
        <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <p className="font-semibold text-sm text-green-300">Unwrap wSOL → SOL</p>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Close the entire wSOL token account and reclaim all wrapped SOL back as native SOL.
            This closes the account and returns the rent exemption fee as well.
          </p>

          <div className="rounded-xl bg-surface-container-high border border-green-500/15 px-4 py-3">
            <p className="text-xs text-on-surface-variant">
              No amount needed — all wSOL in the account will be unwrapped and the account will
              be closed.
            </p>
          </div>

          <button
            onClick={handleUnwrap}
            disabled={unwrapping}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-bold hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-auto"
          >
            {unwrapping
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Unwrapping…</>
              : <><ArrowDownUp className="w-4 h-4" /> Unwrap all wSOL</>
            }
          </button>

          {/* Unwrap feedback */}
          {unwrapResult && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
              <p className="text-xs font-semibold text-green-300 mb-1">Unwrap successful</p>
              {unwrapResult.tx_hash && (
                <p className="font-mono text-[11px] text-on-surface-variant break-all">
                  tx: {unwrapResult.tx_hash}
                </p>
              )}
              {unwrapResult.message && (
                <p className="text-xs text-on-surface-variant">{unwrapResult.message}</p>
              )}
            </div>
          )}
          {unwrapError && (
            <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-3">
              <p className="text-xs font-semibold text-error mb-0.5">Unwrap failed</p>
              <p className="text-xs text-on-surface-variant">{unwrapError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
