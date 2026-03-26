import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Clock, RefreshCw, ChevronRight, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import type { Approval } from '../types';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired';

function getTimeRemaining(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTimeProgress(approval: Approval): number {
  if (!approval.expires_at) return 1;
  const created = new Date(approval.created_at).getTime();
  const expires = new Date(approval.expires_at).getTime();
  const now = Date.now();
  const total = expires - created;
  if (total <= 0) return 0;
  const elapsed = now - created;
  return Math.max(0, Math.min(1, 1 - elapsed / total));
}

interface StatusBadgeProps {
  status: Approval['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLanguage();
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/25 text-secondary text-[10px] font-black uppercase tracking-[0.15em]">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_6px_#5de6ff]" />
        {t('approvals.pending')}
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 text-[10px] font-black uppercase tracking-[0.15em]">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        {t('approvals.approved')}
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-[0.15em]">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        {t('approvals.rejected')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/25 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      {t('approvals.expired')}
    </span>
  );
}

function statusAccentClass(status: Approval['status']): string {
  if (status === 'pending') return 'bg-secondary';
  if (status === 'approved') return 'bg-green-400';
  if (status === 'rejected') return 'bg-red-400';
  return 'bg-slate-500';
}

interface ApprovalCardProps {
  key?: string | number;
  approval: Approval;
  onClick: () => void;
}

function ApprovalCard({ approval, onClick }: ApprovalCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(approval.expires_at));
  const [progress, setProgress] = useState(() => getTimeProgress(approval));

  useEffect(() => {
    if (approval.status !== 'pending' || !approval.expires_at) return;
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(approval.expires_at));
      setProgress(getTimeProgress(approval));
    }, 1000);
    return () => clearInterval(interval);
  }, [approval]);

  const isPending = approval.status === 'pending';

  return (
    <button
      onClick={onClick}
      className="w-full text-left group relative overflow-hidden rounded-2xl bg-surface-container-low ghost-border hover:border-outline/40 transition-all duration-200 hover:shadow-lg hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {/* Status accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusAccentClass(approval.status)} transition-all duration-200 group-hover:w-1.5`} />

      <div className="pl-6 pr-5 py-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={approval.status} />
              {approval.agent_name && (
                <span className="text-[10px] text-on-surface-variant font-medium px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20">
                  {approval.agent_name}
                </span>
              )}
            </div>

            <p className="font-headline font-bold text-on-surface text-lg leading-tight mb-1 truncate capitalize">
              {approval.action.replace(/_/g, ' ')}
            </p>

            {(approval.amount || approval.currency) && (
              <p className="text-2xl font-headline font-black text-on-surface tabular-nums">
                {approval.amount && <span>{Number(approval.amount).toLocaleString()}</span>}
                {approval.currency && <span className="text-base font-bold text-on-surface-variant ml-1">{approval.currency}</span>}
              </p>
            )}

            {approval.memo && (
              <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-1">{approval.memo}</p>
            )}
          </div>

          {/* Right: timer or chevron */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {isPending && timeRemaining ? (
              <div className="flex flex-col items-center p-3 rounded-xl bg-surface-container-high border border-secondary/20 min-w-[88px]">
                <Clock className="w-3.5 h-3.5 text-slate-400 mb-1" />
                <span className="text-secondary font-headline font-black tabular-nums text-base leading-none drop-shadow-[0_0_8px_rgba(93,230,255,0.4)]">
                  {timeRemaining}
                </span>
                {/* Progress bar */}
                <div className="w-full bg-surface-container-low h-1 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full shadow-[0_0_6px_#5de6ff] transition-all duration-1000"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-on-surface-variant group-hover:translate-x-0.5 transition-all mt-1" />
            )}
          </div>
        </div>

        {/* Footer: created time */}
        <p className="text-[11px] text-slate-500 mt-3 pl-0">
          {new Date(approval.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </button>
  );
}

interface ApprovalListProps {
  onSelectApproval: (id: string) => void;
}

export default function ApprovalList({ onSelectApproval }: ApprovalListProps) {
  const { t } = useLanguage();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const STATUS_FILTERS: { value: StatusFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'approvals.all' },
    { value: 'pending', labelKey: 'approvals.pending' },
    { value: 'approved', labelKey: 'approvals.approved' },
    { value: 'rejected', labelKey: 'approvals.rejected' },
    { value: 'expired', labelKey: 'approvals.expired' },
  ];

  const fetchApprovals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const res = await api<{ approvals: Approval[] }>('/api/approvals/pending');
    if (res.success && Array.isArray(res.approvals)) {
      setApprovals(res.approvals);
    } else {
      setError(res.error || t('approvals.loadError'));
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const filtered = filter === 'all'
    ? approvals
    : approvals.filter(a => a.status === filter);

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">{t('approvals.title')}</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary/20 border border-secondary/40 text-secondary text-xs font-black shadow-[0_0_8px_rgba(93,230,255,0.2)]">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-sm">{t('approvals.subtitle')}</p>
        </div>

        <button
          onClick={() => fetchApprovals(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high ghost-border text-on-surface-variant hover:text-on-surface hover:border-outline/40 transition-all duration-200 text-sm font-medium disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('approvals.refresh')}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container-low ghost-border mb-6 w-fit">
        {STATUS_FILTERS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === value
                ? 'bg-surface-container-high text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-surface-container-low ghost-border overflow-hidden relative"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <div className="absolute inset-0 shimmer" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-error" />
          </div>
          <p className="text-on-surface font-semibold mb-1">{t('approvals.loadFailed')}</p>
          <p className="text-on-surface-variant text-sm mb-5">{error}</p>
          <button
            onClick={() => fetchApprovals()}
            className="px-5 py-2 rounded-xl bg-surface-container-high ghost-border text-sm font-medium text-on-surface hover:border-outline/40 transition-all"
          >
            {t('approval.tryAgain')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-high ghost-border flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-on-surface font-semibold mb-1">
            {filter === 'all' ? t('approvals.empty') : `${t('approvals.noStatus')} ${t(`approvals.${filter}`)}`}
          </p>
          <p className="text-on-surface-variant text-sm">
            {filter === 'all'
              ? t('approvals.emptyDesc')
              : t('approvals.noStatusDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onClick={() => onSelectApproval(approval.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
