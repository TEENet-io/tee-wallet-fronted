import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Bot, Key, Info, CheckCircle2, AlertTriangle,
  Zap, Fingerprint, Clock, Loader2, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
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

function riskTitle(level?: string): string {
  if (level === 'low') return 'Low Risk';
  if (level === 'high') return 'High Risk';
  return 'Moderate Risk';
}

function statusColors(status: Approval['status']) {
  if (status === 'approved') return { dot: 'bg-green-400 shadow-[0_0_8px_#4ade80]', text: 'text-green-400', label: 'Authorized' };
  if (status === 'rejected') return { dot: 'bg-red-400 shadow-[0_0_8px_#f87171]', text: 'text-red-400', label: 'Rejected' };
  if (status === 'expired') return { dot: 'bg-slate-400', text: 'text-slate-400', label: 'Expired' };
  return { dot: 'bg-secondary shadow-[0_0_8px_#5de6ff] animate-pulse', text: 'text-secondary', label: 'Pending Authorization' };
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
    const list = await api<{ approvals: Approval[] }>('/api/approvals');
    if (list.success && Array.isArray(list.approvals)) {
      const found = list.approvals.find(a => a.id === approvalId) ?? null;
      if (found) {
        setApproval(found);
      } else {
        setError('Approval not found');
      }
    } else {
      setError(list.error || single.error || 'Failed to load approval');
    }
    setLoading(false);
  }, [approvalId]);

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
        toast('Approval authorized successfully', 'success');
        onBack();
      } else {
        toast(res.error || 'Authorization failed', 'error');
      }
    } catch (e) {
      toast((e as Error).message || 'Authorization failed', 'error');
    } finally {
      setApproving(false);
    }
  }, [approvalId, approval, getFreshPasskeyCredential, toast, onBack]);

  const handleReject = useCallback(async () => {
    if (!approvalId || !approval || approval.status !== 'pending') return;
    setRejecting(true);
    try {
      const res = await api(`/api/approvals/${approvalId}/reject`, { method: 'POST' });
      if (res.success) {
        toast('Transaction rejected', 'info');
        onBack();
      } else {
        toast(res.error || 'Rejection failed', 'error');
      }
    } catch (e) {
      toast((e as Error).message || 'Rejection failed', 'error');
    } finally {
      setRejecting(false);
    }
  }, [approvalId, approval, toast, onBack]);

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
          <span className="font-label text-sm font-medium">Return to Queue</span>
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-error" />
          </div>
          <p className="text-on-surface font-semibold mb-1">Could not load approval</p>
          <p className="text-on-surface-variant text-sm mb-5">{error ?? 'Unknown error'}</p>
          <button
            onClick={fetchApproval}
            className="px-5 py-2 rounded-xl bg-surface-container-high ghost-border text-sm font-medium text-on-surface hover:border-outline/40 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isPending = approval.status === 'pending';
  const sc = statusColors(approval.status);
  const busy = approving || rejecting;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Back Action */}
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-400 cursor-pointer group w-fit hover:text-on-surface transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="font-label text-sm font-medium">Return to Queue</span>
      </button>

      {/* Hero Status Card */}
      <section className="relative overflow-hidden rounded-3xl p-8 bg-surface-container-low ghost-border shadow-2xl mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
              <span className={`${sc.text} text-xs font-bold uppercase tracking-[0.2em]`}>{sc.label}</span>
            </div>
            <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2 capitalize">
              {approval.amount
                ? `${approval.action.replace(/_/g, ' ')} ${Number(approval.amount).toLocaleString()}${approval.currency ? ` ${approval.currency}` : ''}`
                : approval.action.replace(/_/g, ' ')}
            </h1>
            {approval.agent_intent ? (
              <p className="text-on-surface-variant max-w-md">{approval.agent_intent}</p>
            ) : approval.memo ? (
              <p className="text-on-surface-variant max-w-md">{approval.memo}</p>
            ) : null}
          </div>

          {/* Timer — shown for pending with expires_at; resolved badge for others */}
          {isPending && approval.expires_at ? (
            <div className="flex flex-col items-center justify-center p-6 bg-surface-container-high rounded-2xl border border-secondary/30 min-w-[180px] shadow-[0_0_30px_rgba(93,230,255,0.1)]">
              <span className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Expires In</span>
              <span className="text-4xl font-headline font-black text-secondary tabular-nums drop-shadow-[0_0_10px_rgba(93,230,255,0.4)]">
                {timeRemaining?.display ?? '--:--'}
              </span>
              <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-secondary h-full shadow-[0_0_10px_#5de6ff] transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          ) : !isPending ? (
            <div className={`flex flex-col items-center justify-center px-8 py-6 rounded-2xl bg-surface-container-high border ${
              approval.status === 'approved' ? 'border-green-500/30' :
              approval.status === 'rejected' ? 'border-red-500/30' : 'border-slate-500/30'
            }`}>
              <Clock className="w-5 h-5 text-slate-400 mb-2" />
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Resolved</p>
              <p className="text-sm font-semibold text-on-surface">
                {new Date(approval.created_at).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Transaction Context */}
          <div className="p-6 rounded-2xl bg-surface-container-low ghost-border">
            <h3 className="font-headline font-bold text-lg mb-6 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary fill-primary/20" />
              Transaction Context
            </h3>
            <div className="space-y-6">
              {approval.agent_name && (
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-white/5">
                    <Bot className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Agent</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{approval.agent_name}</p>
                    {approval.agent_intent && (
                      <p className="text-sm text-on-surface-variant leading-relaxed mt-1">{approval.agent_intent}</p>
                    )}
                  </div>
                </div>
              )}

              {approval.to_address && (
                <div className={`flex gap-4 ${approval.agent_name ? 'pt-6 border-t border-outline-variant/10' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-white/5">
                    <Key className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Destination</p>
                    <p className="text-sm text-on-surface-variant font-mono break-all">
                      {approval.destination_label && (
                        <span className="font-sans font-semibold text-on-surface block mb-0.5">
                          {approval.destination_label}
                        </span>
                      )}
                      {approval.to_address}
                    </p>
                  </div>
                </div>
              )}

              {/* Fallback row when neither agent nor address is set */}
              {!approval.agent_name && !approval.to_address && (
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-white/5">
                    <Info className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface uppercase tracking-wider mb-1">Action</p>
                    <p className="text-sm text-on-surface-variant capitalize">{approval.action.replace(/_/g, ' ')}</p>
                    {approval.memo && <p className="text-sm text-on-surface-variant mt-1">{approval.memo}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Risk Assessment */}
          {approval.risk_level && (
            <div className="p-8 rounded-2xl glass-panel border border-primary/20 relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-tertiary group-hover:w-2.5 transition-all" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-6">Security Intelligence</p>

              <div className="flex items-center gap-6 mb-8">
                <div className={`w-20 h-20 rounded-full border-4 ${riskColorClass(approval.risk_level)} flex items-center justify-center relative`}>
                  <div className={`absolute inset-0 border-4 ${riskBorderFull(approval.risk_level)} rounded-full clip-path-75 animate-pulse`} />
                  <span className={`text-xl font-headline font-black ${riskColorClass(approval.risk_level).split(' ')[0]}`}>
                    {riskLabel(approval.risk_level)}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xl text-on-surface">{riskTitle(approval.risk_level)}</h4>
                  {approval.risk_details?.[0] && (
                    <p className="text-sm text-on-surface-variant">{approval.risk_details[0]}</p>
                  )}
                </div>
              </div>

              {approval.risk_details && approval.risk_details.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {approval.risk_details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                      {approval.risk_level === 'low' ? (
                        <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      ) : approval.risk_level === 'high' ? (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-tertiary shrink-0" />
                      )}
                      <span className="text-xs text-on-surface-variant">{detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Destination address bento */}
          <div className="space-y-4">
            {(approval.destination_label || approval.destination_address || approval.to_address) && (
              <div className="p-6 rounded-2xl bg-surface-container-low ghost-border">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-4">Destination Address</p>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-white/10 shrink-0">
                    <Key className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    {approval.destination_label && (
                      <span className="font-headline font-bold text-on-surface block truncate">{approval.destination_label}</span>
                    )}
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5 break-all">
                      {approval.destination_address ?? approval.to_address}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {approval.network_fee && (
              <div className="p-6 rounded-2xl bg-surface-container-low ghost-border">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-4">Network Logistics</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-tertiary" />
                    <span className="font-headline font-bold text-on-surface">{approval.network_fee}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[10px] text-secondary font-black uppercase tracking-widest">
                    Network Fee
                  </span>
                </div>
              </div>
            )}

            {approval.tx_hash && (
              <div className="p-6 rounded-2xl bg-surface-container-low ghost-border">
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">Transaction Hash</p>
                <p className="text-xs font-mono text-primary break-all">{approval.tx_hash}</p>
              </div>
            )}
          </div>

          {/* Action Panel */}
          {isPending ? (
            <div className="p-8 rounded-3xl bg-surface-container-high border border-white/5 shadow-2xl space-y-4 relative">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <h4 className="text-xs font-bold text-center text-slate-500 uppercase tracking-[0.3em] mb-4">
                Biometric Verification Required
              </h4>

              <button
                onClick={handleApprove}
                disabled={busy}
                className="w-full py-5 rounded-2xl primary-gradient text-white font-black flex flex-col items-center justify-center gap-2 shadow-[0_10px_40px_rgba(124,58,237,0.4)] hover:shadow-[0_15px_50px_rgba(124,58,237,0.6)] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_10px_40px_rgba(124,58,237,0.4)]"
              >
                {approving ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-1 animate-spin" />
                    <span className="uppercase tracking-widest text-sm">Verifying...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-8 h-8 mb-1" />
                    <span className="uppercase tracking-widest text-sm">Authorize with Passkey</span>
                  </>
                )}
              </button>

              <button
                onClick={handleReject}
                disabled={busy}
                className="w-full py-4 rounded-xl bg-surface-container border border-outline-variant/20 text-error/80 hover:text-error hover:bg-error/10 hover:border-error/30 active:scale-95 transition-all duration-200 font-bold uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejecting...
                  </>
                ) : 'Reject Transaction'}
              </button>

              <p className="text-[9px] text-center text-slate-500 uppercase tracking-widest leading-relaxed">
                By authorizing, you confirm that this agent action <br /> aligns with your defined risk parameters.
              </p>
            </div>
          ) : (
            /* Resolved state panel */
            <div className="p-8 rounded-3xl bg-surface-container-high border border-white/5 shadow-2xl relative">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-outline-variant/40 to-transparent" />
              <div className={`flex flex-col items-center gap-3 py-4 rounded-2xl ${
                approval.status === 'approved'
                  ? 'bg-green-500/5 border border-green-500/20'
                  : approval.status === 'rejected'
                  ? 'bg-red-500/5 border border-red-500/20'
                  : 'bg-slate-500/5 border border-slate-500/20'
              }`}>
                <CheckCircle2 className={`w-10 h-10 ${
                  approval.status === 'approved' ? 'text-green-400' :
                  approval.status === 'rejected' ? 'text-red-400' : 'text-slate-400'
                }`} />
                <p className="font-headline font-bold text-on-surface capitalize">
                  {approval.status === 'approved' ? 'Transaction Authorized' :
                   approval.status === 'rejected' ? 'Transaction Rejected' : 'Request Expired'}
                </p>
                <p className="text-xs text-on-surface-variant text-center">
                  {approval.status === 'approved'
                    ? 'This transaction was approved and executed.'
                    : approval.status === 'rejected'
                    ? 'This transaction was rejected and will not be executed.'
                    : 'The authorization window has closed for this request.'}
                </p>
              </div>
              <button
                onClick={onBack}
                className="mt-4 w-full py-3 rounded-xl bg-surface-container ghost-border text-on-surface-variant hover:text-on-surface hover:border-outline/40 transition-all duration-200 text-sm font-medium"
              >
                Back to Approvals
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
