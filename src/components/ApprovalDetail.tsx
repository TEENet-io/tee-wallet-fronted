import type { ComponentType } from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Bot, Key, Info, CheckCircle2, AlertTriangle,
  Zap, Fingerprint, Clock, Loader2, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Approval } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeRemaining(expiresAt?: string): { display: string; totalSeconds: number } | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { display: '00:00', totalSeconds: 0 };
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return { display: `${hours}h ${String(mins).padStart(2, '0')}m`, totalSeconds };
  }
  return {
    display: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    totalSeconds,
  };
}

function getTimeProgress(approval: Approval): number {
  if (!approval.expires_at) return 1;
  const created = new Date(approval.created_at).getTime();
  const expires = new Date(approval.expires_at).getTime();
  const now = Date.now();
  const total = expires - created;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (now - created) / total));
}

function riskLabel(level?: string): string {
  if (level === 'low') return 'LOW';
  if (level === 'high') return 'HIGH';
  return 'MID';
}

function riskColorClass(level?: string): string {
  if (level === 'low') return 'text-green-400 border-green-400/30';
  if (level === 'high') return 'text-red-400 border-red-400/30';
  return 'text-tertiary border-tertiary/20';
}

function riskBorderFull(level?: string): string {
  if (level === 'low') return 'border-green-400';
  if (level === 'high') return 'border-red-400';
  return 'border-tertiary';
}

function riskTitleKey(level?: string): string {
  if (level === 'low') return 'approval.lowRisk';
  if (level === 'high') return 'approval.highRisk';
  return 'approval.midRisk';
}

function statusColors(status: Approval['status']) {
  if (status === 'approved') return { dot: 'bg-green-400 shadow-[0_0_8px_#4ade80]', text: 'text-green-400', labelKey: 'approval.authorized' };
  if (status === 'rejected') return { dot: 'bg-red-400 shadow-[0_0_8px_#f87171]', text: 'text-red-400', labelKey: 'approval.txRejected' };
  if (status === 'expired') return { dot: 'bg-slate-400', text: 'text-slate-400', labelKey: 'approvals.expired' };
  return { dot: 'bg-secondary shadow-[0_0_8px_#5de6ff] animate-pulse', text: 'text-secondary', labelKey: 'approval.pendingAuth' };
}

// ---------------------------------------------------------------------------
// Context rows — parses tx_context / policy_data for full detail
// ---------------------------------------------------------------------------

function Row({ icon: Icon, label, value, mono }: { icon: ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-sm text-on-surface ${mono ? 'font-mono break-all text-xs' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function ContextRows({ approval, t }: { approval: Approval; t: (k: string) => string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ctx: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pol: Record<string, any> = {};
  try { if (approval.tx_context) ctx = JSON.parse(approval.tx_context); } catch { /* ignore */ }
  try { if (approval.policy_data) pol = JSON.parse(approval.policy_data); } catch { /* ignore */ }

  const approvalType = approval.approval_type ?? '';
  const isPolicyChange = approvalType === 'policy_change';
  const isContractAdd = approvalType === 'contract_add' || approvalType === 'contract_update';

  // Type badge label
  let typeLabel = (approval.action ?? '').replace(/_/g, ' ');
  if (ctx.type === 'spl_transfer') typeLabel = 'SPL Transfer';
  else if (ctx.type === 'erc20_transfer') typeLabel = 'ERC-20 Transfer';
  else if (ctx.type === 'program_call') typeLabel = 'Program Call';
  else if (ctx.type === 'approve_token' || ctx.action === 'approve_token') typeLabel = 'Token Approve';
  else if (ctx.type === 'revoke_approval' || ctx.action === 'revoke_approval') typeLabel = 'Revoke Approval';
  else if (isPolicyChange) typeLabel = 'Policy Change';
  else if (isContractAdd) typeLabel = approvalType === 'contract_update' ? 'Whitelist Update' : 'Whitelist Add';
  else if (approvalType === 'sign') typeLabel = 'Sign Message';
  else if (approvalType === 'contract_call') typeLabel = 'Contract Call';

  return (
    <div className="bg-surface-container-low rounded-2xl ghost-border divide-y divide-outline-variant/10">
      {/* Type badge */}
      <div className="flex items-start gap-3 p-4">
        <Info className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">{t('approval.action')}</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider capitalize">
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Agent */}
      {approval.agent_name && (
        <div className="flex items-start gap-3 p-4">
          <Bot className="w-5 h-5 text-secondary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">{t('approval.agent')}</p>
            <p className="text-sm text-on-surface">{approval.agent_name}</p>
            {approval.agent_intent && <p className="text-xs text-on-surface-variant mt-1">{approval.agent_intent}</p>}
          </div>
        </div>
      )}

      {/* Policy change details */}
      {isPolicyChange && (pol.threshold_usd || pol.threshold_amount) && <Row icon={Info} label="Threshold" value={`$${pol.threshold_usd || pol.threshold_amount} USD`} />}
      {isPolicyChange && pol.daily_limit_usd && <Row icon={Info} label="Daily Limit" value={`$${pol.daily_limit_usd} USD`} />}
      {isPolicyChange && <Row icon={Info} label="Enabled" value={pol.enabled !== false ? 'Yes' : 'No'} />}

      {/* Contract whitelist add/update */}
      {isContractAdd && pol.contract_address && <Row icon={Key} label="Contract" value={pol.contract_address} mono />}
      {isContractAdd && pol.symbol && <Row icon={Info} label="Symbol" value={pol.symbol} />}
      {isContractAdd && pol.label && <Row icon={Info} label="Label" value={pol.label} />}
      {isContractAdd && pol.decimals !== undefined && <Row icon={Info} label="Decimals" value={String(pol.decimals)} />}
      {isContractAdd && pol.allowed_methods && <Row icon={Info} label="Allowed Methods" value={pol.allowed_methods} />}

      {/* Transaction context */}
      {!isPolicyChange && !isContractAdd && (ctx.amount || approval.amount) && <Row icon={Zap} label="Amount" value={`${ctx.amount || approval.amount}${ctx.currency || ctx.symbol || approval.currency ? ` ${ctx.currency || ctx.symbol || approval.currency}` : ''}`} />}
      {!isPolicyChange && !isContractAdd && ctx.from && <Row icon={Key} label="From" value={ctx.from} mono />}
      {!isPolicyChange && !isContractAdd && (ctx.to || approval.to_address) && <Row icon={Key} label="To" value={ctx.to || approval.to_address} mono />}
      {!isPolicyChange && !isContractAdd && ctx.contract && <Row icon={Key} label={ctx.type === 'approve_token' || ctx.type === 'revoke_approval' ? 'Token Contract' : 'Contract'} value={ctx.contract} mono />}
      {!isPolicyChange && !isContractAdd && ctx.mint && <Row icon={Key} label="Token Mint" value={ctx.mint} mono />}
      {!isPolicyChange && !isContractAdd && ctx.program_id && <Row icon={Key} label="Program" value={ctx.program_id} mono />}
      {!isPolicyChange && !isContractAdd && ctx.method && <Row icon={Info} label="Method" value={ctx.method} />}
      {!isPolicyChange && !isContractAdd && ctx.func_sig && <Row icon={Info} label="Function Signature" value={ctx.func_sig} mono />}
      {!isPolicyChange && !isContractAdd && ctx.spender && <Row icon={Key} label="Spender" value={ctx.spender} mono />}
      {!isPolicyChange && !isContractAdd && ctx.symbol && <Row icon={Info} label="Token" value={ctx.symbol} />}
      {!isPolicyChange && !isContractAdd && ctx.chain && <Row icon={Info} label="Chain" value={ctx.chain} />}
      {!isPolicyChange && !isContractAdd && ctx.value_eth && <Row icon={Zap} label="ETH Value" value={`${ctx.value_eth} ETH`} />}
      {!isPolicyChange && !isContractAdd && ctx.args && <Row icon={Info} label="Arguments" value={JSON.stringify(ctx.args)} mono />}
      {!isPolicyChange && !isContractAdd && ctx.data && <Row icon={Info} label="Data" value={ctx.data} mono />}
      {!isPolicyChange && !isContractAdd && ctx.accounts && <Row icon={Info} label="Accounts" value={Array.isArray(ctx.accounts) ? `${ctx.accounts.length} account(s)` : ctx.accounts} />}
      {!isPolicyChange && !isContractAdd && (ctx.memo || approval.memo) && <Row icon={Info} label="Memo" value={ctx.memo || approval.memo} />}
      {!isPolicyChange && !isContractAdd && ctx.approval_reason && <Row icon={AlertTriangle} label="Reason" value={ctx.approval_reason} />}

      {/* Amount USD */}
      {approval.amount_usd && <Row icon={Zap} label="USD Value" value={`$${approval.amount_usd}`} />}

      {/* Network fee */}
      {approval.network_fee && <Row icon={Zap} label={t('approval.networkFee')} value={approval.network_fee} />}

      {/* Tx hash / signature */}
      {approval.tx_hash && <Row icon={Info} label={t('approval.txHash')} value={approval.tx_hash} mono />}
      {approval.signature && <Row icon={Info} label="Signature" value={approval.signature} mono />}

      {/* Expires */}
      {approval.expires_at && <Row icon={Clock} label={t('approval.expires')} value={new Date(approval.expires_at).toLocaleString()} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8 h-5 w-32 rounded-lg bg-surface-container-high shimmer" />
      <div className="rounded-3xl p-8 bg-surface-container-low ghost-border mb-8 h-40 shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="h-52 rounded-2xl bg-surface-container-low ghost-border shimmer" />
          <div className="h-52 rounded-2xl bg-surface-container-low ghost-border shimmer" />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <div className="h-32 rounded-2xl bg-surface-container-low ghost-border shimmer" />
          <div className="h-48 rounded-3xl bg-surface-container-high shimmer" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ApprovalDetailProps {
  approvalId: string;
  onBack: () => void;
}

export default function ApprovalDetail({ approvalId, onBack }: ApprovalDetailProps) {
  const { getFreshPasskeyCredential } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [approval, setApproval] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Live countdown state
  const [timeRemaining, setTimeRemaining] = useState<ReturnType<typeof getTimeRemaining>>(null);
  const [progress, setProgress] = useState(1);

  // ---------------------------------------------------------------------------
  // Data fetch – try single endpoint first, fallback to list+filter
  // ---------------------------------------------------------------------------
  const fetchApproval = useCallback(async () => {
    if (!approvalId) return;
    setLoading(true);
    setError(null);

    // Try single-item endpoint
    const single = await api<{ approval: Approval }>(`/api/approvals/${approvalId}`);
    if (single.success && single.approval) {
      setApproval(single.approval);
      setLoading(false);
      return;
    }

    // Fallback: fetch list and filter
    const list = await api<{ approvals: Approval[] }>('/api/approvals/pending');
    if (list.success && Array.isArray(list.approvals)) {
      const found = list.approvals.find(a => a.id === approvalId) ?? null;
      if (found) {
        setApproval(found);
      } else {
        setError(t('approval.loadError'));
      }
    } else {
      setError(list.error || single.error || t('approval.loadErrorGeneric'));
    }
    setLoading(false);
  }, [approvalId, t]);

  useEffect(() => {
    fetchApproval();
  }, [fetchApproval]);

  // ---------------------------------------------------------------------------
  // Countdown timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!approval?.expires_at || approval.status !== 'pending') {
      setTimeRemaining(null);
      setProgress(approval ? getTimeProgress(approval) : 1);
      return;
    }
    const tick = () => {
      setTimeRemaining(getTimeRemaining(approval.expires_at));
      setProgress(getTimeProgress(approval));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [approval]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleApprove = useCallback(async () => {
    if (!approvalId || !approval || approval.status !== 'pending') return;
    setApproving(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) {
        setApproving(false);
        return;
      }
      const res = await api(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        body: JSON.stringify(passkeyBody),
      });
      if (res.success) {
        toast(t('approval.authorizeSuccess'), 'success');
        onBack();
      } else {
        toast(res.error || t('approval.authorizeFail'), 'error');
      }
    } catch (e) {
      toast((e as Error).message || t('approval.authorizeFail'), 'error');
    } finally {
      setApproving(false);
    }
  }, [approvalId, approval, getFreshPasskeyCredential, toast, onBack, t]);

  const handleReject = useCallback(async () => {
    if (!approvalId || !approval || approval.status !== 'pending') return;
    setRejecting(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setRejecting(false); return; }
      const res = await api(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        body: JSON.stringify(passkeyBody),
      });
      if (res.success) {
        toast(t('approval.rejectSuccess'), 'info');
        onBack();
      } else {
        toast(res.error || t('approval.rejectFail'), 'error');
      }
    } catch (e) {
      toast((e as Error).message || t('approval.rejectFail'), 'error');
    } finally {
      setRejecting(false);
    }
  }, [approvalId, approval, toast, onBack, t]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (loading) return <DetailSkeleton />;

  if (error || !approval) {
    return (
      <div className="animate-in fade-in duration-500">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-slate-400 cursor-pointer group w-fit hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-label text-sm font-medium">{t('approval.back')}</span>
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-error" />
          </div>
          <p className="text-on-surface font-semibold mb-1">{t('approval.loadError')}</p>
          <p className="text-on-surface-variant text-sm mb-5">{error ?? t('approval.unknownError')}</p>
          <button
            onClick={fetchApproval}
            className="px-5 py-2 rounded-xl bg-surface-container-high ghost-border text-sm font-medium text-on-surface hover:border-outline/40 transition-all"
          >
            {t('approval.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  const isPending = approval.status === 'pending';
  const sc = statusColors(approval.status);
  const busy = approving || rejecting;

  // Parse tx_context for header display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let headerCtx: Record<string, any> = {};
  try { if (approval.tx_context) headerCtx = JSON.parse(approval.tx_context); } catch { /* */ }
  const displayAmount = headerCtx.amount || approval.amount;
  const displayCurrency = headerCtx.currency || headerCtx.symbol || approval.currency;
  const displayAction = (approval.action ?? '').replace(/_/g, ' ');

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {t('approval.back')}
      </button>

      {/* Status Header */}
      <div className="relative bg-surface-container-low rounded-3xl p-6 ghost-border overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[100px] -mr-16 -mt-16 pointer-events-none" />
        <div className="relative space-y-4">
          {/* Status label */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
            <span className={`${sc.text} text-xs font-bold uppercase tracking-[0.15em]`}>{t(sc.labelKey)}</span>
          </div>

          {/* Timer row: countdown (compact) + amount */}
          {isPending && approval.expires_at ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-lg border border-secondary/20 shrink-0">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                <div>
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-widest leading-none">{t('approval.expires')}</p>
                  <p className="text-sm font-headline font-black text-secondary tabular-nums leading-tight">{timeRemaining?.display ?? '--:--'}</p>
                </div>
                <div className="w-12 bg-surface-container-low h-1 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
              {displayAmount && (
                <p className="text-3xl font-headline font-black text-on-surface tabular-nums">
                  {Number(displayAmount).toLocaleString()}
                  {displayCurrency && <span className="text-lg font-bold text-on-surface-variant ml-1.5">{displayCurrency}</span>}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              {!isPending && (
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-lg shrink-0">
                  <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                  <p className="text-sm text-on-surface-variant">
                    {new Date(approval.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {displayAmount && (
                <p className="text-3xl font-headline font-black text-on-surface tabular-nums">
                  {Number(displayAmount).toLocaleString()}
                  {displayCurrency && <span className="text-lg font-bold text-on-surface-variant ml-1.5">{displayCurrency}</span>}
                </p>
              )}
            </div>
          )}

          {(approval.agent_intent || approval.memo) && (
            <p className="text-sm text-on-surface-variant">{approval.agent_intent || approval.memo}</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4">
        {/* Context rows — parsed from tx_context / policy_data */}
        <ContextRows approval={approval} t={t} />

        {/* Risk Assessment — compact */}
        {approval.risk_level && (
          <div className="bg-surface-container-low rounded-2xl ghost-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-full border-2 ${riskColorClass(approval.risk_level)} flex items-center justify-center`}>
                <span className={`text-[10px] font-black ${riskColorClass(approval.risk_level).split(' ')[0]}`}>{riskLabel(approval.risk_level)}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{t(riskTitleKey(approval.risk_level))}</p>
              </div>
            </div>
            {approval.risk_details && approval.risk_details.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {approval.risk_details.map((detail, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-high text-xs text-on-surface-variant">
                    {approval.risk_level === 'low' ? <CheckCircle2 className="w-3 h-3 text-secondary" /> : <AlertTriangle className="w-3 h-3 text-tertiary" />}
                    {detail}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {isPending ? (
        <div className="bg-surface-container-high rounded-2xl ghost-border p-5 space-y-3">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="w-full py-3.5 rounded-xl primary-gradient text-white font-bold flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(124,58,237,0.3)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {approving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
            {approving ? t('approval.verifying') : t('approval.authorize')}
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-surface-container border border-outline-variant/20 text-error/80 hover:text-error hover:bg-error/10 hover:border-error/30 active:scale-[0.98] transition-all text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {rejecting ? t('approval.rejecting') : t('approval.reject')}
          </button>
          <p className="text-[9px] text-center text-on-surface-variant uppercase tracking-widest">
            {t('approval.disclaimer')}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl ghost-border p-5 flex flex-col items-center gap-3 ${
          approval.status === 'approved' ? 'bg-green-500/5 border-green-500/20' :
          approval.status === 'rejected' ? 'bg-red-500/5 border-red-500/20' :
          'bg-surface-container-high'
        }`}>
          <CheckCircle2 className={`w-8 h-8 ${
            approval.status === 'approved' ? 'text-green-400' :
            approval.status === 'rejected' ? 'text-red-400' : 'text-slate-400'
          }`} />
          <p className="font-headline font-bold text-on-surface text-sm capitalize">
            {approval.status === 'approved' ? t('approval.txAuthorized') :
             approval.status === 'rejected' ? t('approval.txRejected') : t('approval.txExpired')}
          </p>
          <button onClick={onBack} className="px-6 py-2 rounded-xl bg-surface-container ghost-border text-on-surface-variant hover:text-on-surface text-sm font-medium transition-all">
            {t('approval.backToApprovals')}
          </button>
        </div>
      )}
    </div>
  );
}
