import { useState, type FormEvent, type ReactNode } from 'react';
import { Code, Loader2, CheckSquare, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useWallets } from '../../contexts/WalletContext';
import { useToast } from '../../contexts/ToastContext';

type EvmMode = 'call' | 'approve' | 'read';

interface CallResult {
  tx_hash?: string;
  return_value?: unknown;
  approval_url?: string;
  approval_id?: string;
  error?: string;
}

const INPUT_CLASS =
  'w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary transition-colors placeholder:text-outline';

const TEXTAREA_CLASS =
  'w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary transition-colors placeholder:text-outline font-mono resize-y min-h-[80px]';

const LABEL_CLASS = 'block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide';

// ─── Shared result banner ────────────────────────────────────────────────────

function ResultBanner({ result }: { result: CallResult }) {
  if (result.error) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm border bg-error-container/20 border-error/30 text-error">
        {result.error}
      </div>
    );
  }
  if (result.approval_url || result.approval_id) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm border bg-[#0c1a4d]/60 border-[#1e3a8a]/50 text-[#93c5fd]">
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
      </div>
    );
  }
  if (result.return_value !== undefined) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm border bg-[#052e16]/60 border-[#14532d]/50 text-[#4ade80]">
        <span className="text-on-surface-variant mr-2">Result:</span>
        <span className="font-mono break-all">{JSON.stringify(result.return_value)}</span>
      </div>
    );
  }
  if (result.tx_hash) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm border bg-[#052e16]/60 border-[#14532d]/50 text-[#4ade80]">
        Transaction submitted —{' '}
        <span className="font-mono break-all">{result.tx_hash}</span>
      </div>
    );
  }
  return null;
}

// ─── EVM sub-panels ──────────────────────────────────────────────────────────

function EvmCallForm({
  walletId,
  readOnly,
}: {
  walletId: string;
  readOnly: boolean;
}) {
  const { toast } = useToast();
  const [contractAddress, setContractAddress] = useState('');
  const [functionSignature, setFunctionSignature] = useState('');
  const [argsStr, setArgsStr] = useState('[]');
  const [value, setValue] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contractAddress.trim()) { toast('Contract address is required', 'error'); return; }
    if (!functionSignature.trim()) { toast('Function signature is required', 'error'); return; }

    let args: unknown[] = [];
    try {
      args = JSON.parse(argsStr);
      if (!Array.isArray(args)) throw new Error('args must be a JSON array');
    } catch (err) {
      toast(`Args JSON invalid: ${(err as Error).message}`, 'error');
      return;
    }

    setLoading(true);
    setResult(null);

    const body: Record<string, unknown> = {
      contract_address: contractAddress.trim(),
      function_signature: functionSignature.trim(),
      args,
      memo: memo.trim(),
    };
    if (!readOnly && value.trim()) body.value = value.trim();
    if (readOnly) body.read_only = true;

    const res = await api<CallResult>(`/api/wallets/${walletId}/contract-call`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.success) {
      setResult({ error: res.error || 'Call failed' });
      toast(res.error || 'Call failed', 'error');
      return;
    }

    if (res.approval_url || res.approval_id) {
      setResult({ approval_url: res.approval_url, approval_id: res.approval_id });
      toast('Submitted for approval', 'info');
      return;
    }

    setResult({ tx_hash: res.tx_hash, return_value: res.return_value });
    toast(readOnly ? 'Read complete' : 'Transaction submitted', 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={LABEL_CLASS}>Contract Address</label>
        <input
          type="text"
          value={contractAddress}
          onChange={e => setContractAddress(e.target.value)}
          placeholder="0x…"
          className={INPUT_CLASS}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Function Signature</label>
        <input
          type="text"
          value={functionSignature}
          onChange={e => setFunctionSignature(e.target.value)}
          placeholder='e.g. transfer(address,uint256)'
          className={INPUT_CLASS}
          spellCheck={false}
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Args <span className="text-outline normal-case">(JSON array)</span>
        </label>
        <textarea
          value={argsStr}
          onChange={e => setArgsStr(e.target.value)}
          placeholder='["0xRecipient", "1000000000000000000"]'
          className={TEXTAREA_CLASS}
        />
      </div>
      {!readOnly && (
        <>
          <div>
            <label className={LABEL_CLASS}>
              Value <span className="text-outline normal-case">(ETH, optional)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0.00"
              className={INPUT_CLASS}
            />
          </div>
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
        </>
      )}

      {result && <ResultBanner result={result} />}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 primary-gradient text-white font-semibold text-sm px-6 py-3 rounded-xl glow-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {readOnly ? 'Reading…' : 'Executing…'}
          </>
        ) : (
          <>
            {readOnly ? <BookOpen className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            {readOnly ? 'Read Contract' : 'Execute Call'}
          </>
        )}
      </button>
    </form>
  );
}

function EvmApproveForm({ walletId }: { walletId: string }) {
  const { toast } = useToast();
  const [tokenContract, setTokenContract] = useState('');
  const [spender, setSpender] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenContract.trim()) { toast('Token contract address is required', 'error'); return; }
    if (!spender.trim()) { toast('Spender address is required', 'error'); return; }
    if (!amount.trim()) { toast('Amount is required', 'error'); return; }

    setLoading(true);
    setResult(null);

    const res = await api<CallResult>(`/api/wallets/${walletId}/approve-token`, {
      method: 'POST',
      body: JSON.stringify({
        token_contract: tokenContract.trim(),
        spender: spender.trim(),
        amount: amount.trim(),
      }),
    });

    setLoading(false);

    if (!res.success) {
      setResult({ error: res.error || 'Approval failed' });
      toast(res.error || 'Approval failed', 'error');
      return;
    }

    if (res.approval_url || res.approval_id) {
      setResult({ approval_url: res.approval_url, approval_id: res.approval_id });
      toast('Submitted for approval', 'info');
      return;
    }

    setResult({ tx_hash: res.tx_hash });
    toast('Token approval submitted', 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={LABEL_CLASS}>Token Contract</label>
        <input
          type="text"
          value={tokenContract}
          onChange={e => setTokenContract(e.target.value)}
          placeholder="0x… (ERC-20 address)"
          className={INPUT_CLASS}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Spender Address</label>
        <input
          type="text"
          value={spender}
          onChange={e => setSpender(e.target.value)}
          placeholder="0x… (contract to approve)"
          className={INPUT_CLASS}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Amount</label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Token amount (raw or decimal)"
          className={INPUT_CLASS}
        />
      </div>

      {result && <ResultBanner result={result} />}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 primary-gradient text-white font-semibold text-sm px-6 py-3 rounded-xl glow-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Approving…
          </>
        ) : (
          <>
            <CheckSquare className="w-4 h-4" />
            Approve Token
          </>
        )}
      </button>
    </form>
  );
}

// ─── Solana program call ──────────────────────────────────────────────────────

function SolanaProgramForm({ walletId }: { walletId: string }) {
  const { toast } = useToast();
  const [programId, setProgramId] = useState('');
  const [accountsStr, setAccountsStr] = useState('[]');
  const [data, setData] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!programId.trim()) { toast('Program ID is required', 'error'); return; }

    let accounts: unknown[] = [];
    try {
      accounts = JSON.parse(accountsStr);
      if (!Array.isArray(accounts)) throw new Error('accounts must be a JSON array');
    } catch (err) {
      toast(`Accounts JSON invalid: ${(err as Error).message}`, 'error');
      return;
    }

    setLoading(true);
    setResult(null);

    const res = await api<CallResult>(`/api/wallets/${walletId}/program-call`, {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId.trim(),
        accounts,
        data: data.trim(),
        memo: memo.trim(),
      }),
    });

    setLoading(false);

    if (!res.success) {
      setResult({ error: res.error || 'Program call failed' });
      toast(res.error || 'Program call failed', 'error');
      return;
    }

    if (res.approval_url || res.approval_id) {
      setResult({ approval_url: res.approval_url, approval_id: res.approval_id });
      toast('Submitted for approval', 'info');
      return;
    }

    setResult({ tx_hash: res.tx_hash });
    toast('Program instruction submitted', 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={LABEL_CLASS}>Program ID</label>
        <input
          type="text"
          value={programId}
          onChange={e => setProgramId(e.target.value)}
          placeholder="Solana program public key…"
          className={INPUT_CLASS}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Accounts <span className="text-outline normal-case">(JSON array of pubkeys or account metas)</span>
        </label>
        <textarea
          value={accountsStr}
          onChange={e => setAccountsStr(e.target.value)}
          placeholder='[{"pubkey": "So11...", "isSigner": false, "isWritable": true}]'
          className={TEXTAREA_CLASS}
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>
          Instruction Data <span className="text-outline normal-case">(hex, optional)</span>
        </label>
        <input
          type="text"
          value={data}
          onChange={e => setData(e.target.value)}
          placeholder="e.g. 0a1b2c3d…"
          className={INPUT_CLASS}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
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

      {result && <ResultBanner result={result} />}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 primary-gradient text-white font-semibold text-sm px-6 py-3 rounded-xl glow-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Executing…
          </>
        ) : (
          <>
            <Code className="w-4 h-4" />
            Execute Instruction
          </>
        )}
      </button>
    </form>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ContractPanel({ walletId, chain }: { walletId: string; chain: string }) {
  const { getChainFamily } = useWallets();
  const family = getChainFamily(chain);
  const isSolana = family === 'solana';

  const [evmMode, setEvmMode] = useState<EvmMode>('call');

  const EVM_MODES: { key: EvmMode; label: string; icon: ReactNode }[] = [
    { key: 'call', label: 'Call', icon: <Code className="w-3.5 h-3.5" /> },
    { key: 'approve', label: 'Approve Token', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { key: 'read', label: 'Read', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-surface-container-low rounded-3xl p-6 ghost-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 border border-secondary/20 flex items-center justify-center shrink-0">
          <Code className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface text-base leading-tight">
            {isSolana ? 'Program Call' : 'Contract Interaction'}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            <span className="font-mono text-primary/80">{walletId.slice(0, 8)}…</span>
            {' '}on <span className="text-secondary">{chain}</span>
          </p>
        </div>
      </div>

      {/* EVM mode segment control */}
      {!isSolana && (
        <div className="mb-6">
          <div className="inline-flex bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-1 gap-1">
            {EVM_MODES.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setEvmMode(m.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  evmMode === m.key
                    ? 'primary-gradient text-white shadow-sm'
                    : 'text-slate-400 hover:text-on-surface'
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form body */}
      {isSolana ? (
        <SolanaProgramForm walletId={walletId} />
      ) : evmMode === 'call' ? (
        <EvmCallForm walletId={walletId} readOnly={false} />
      ) : evmMode === 'read' ? (
        <EvmCallForm walletId={walletId} readOnly={true} />
      ) : (
        <EvmApproveForm walletId={walletId} />
      )}
    </div>
  );
}
