// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Clock, RefreshCw, ChevronRight, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import type { Approval } from '../types';


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

// Loose string-typed view of backend JSON blobs. Fields come from the
// approval's tx_context / policy_data and are all rendered as text in this
// summary card — any non-string fields are `String()`-coerced at use sites.
type ApprovalJson = Record<string, string | undefined>;

function parseContext(approval: Approval) {
  let ctx: ApprovalJson = {};
  let pol: ApprovalJson = {};
  try {
    if (approval.tx_context) {
      ctx = JSON.parse(approval.tx_context) as ApprovalJson;
    }
  } catch {
    /* ignore malformed context */
  }
  try {
    if (approval.policy_data) {
      pol = JSON.parse(approval.policy_data) as ApprovalJson;
    }
  } catch {
    /* ignore malformed policy data */
  }

  const at = approval.approval_type ?? '';
  const isPolicyChange = at === 'policy_change';
  const isContractAdd = at === 'contract_add' || at === 'contract_update';

  // Type label
  let typeLabel = (approval.action ?? '').replace(/_/g, ' ');
  if (ctx.type === 'spl_transfer') typeLabel = 'SPL Transfer';
  else if (ctx.type === 'erc20_transfer') typeLabel = 'ERC-20 Transfer';
  else if (ctx.type === 'program_call') typeLabel = 'Program Call';
  else if (ctx.type === 'approve_token' || ctx.action === 'approve_token') typeLabel = 'Token Approve';
  else if (ctx.type === 'revoke_approval' || ctx.action === 'revoke_approval') typeLabel = 'Revoke Approval';
  else if (isPolicyChange) typeLabel = 'Policy Change';
  else if (isContractAdd) typeLabel = at === 'contract_update' ? 'Whitelist Update' : 'Whitelist Add';
  else if (at === 'addressbook_add') typeLabel = 'Address Book Add';
  else if (at === 'addressbook_update') typeLabel = 'Address Book Update';
  else if (at === 'sign') typeLabel = 'Sign';
  else if (at === 'contract_call') typeLabel = 'Contract Call';
  else if (at === 'transfer') typeLabel = 'Transfer';

  // Amount display
  const amount = ctx.amount || approval.amount;
  const currency = ctx.currency || ctx.symbol || approval.currency;

  // Summary line
  let summary = '';
  if (isPolicyChange) {
    summary = `Threshold $${pol.threshold_usd || pol.threshold_amount || '?'}`;
    if (pol.daily_limit_usd) summary += ` · Daily $${pol.daily_limit_usd}`;
  } else if (isContractAdd) {
    const addr = pol.contract_address || '';
    summary = pol.label || (addr ? `${addr.slice(0, 8)}…${addr.slice(-4)}` : '');
    if (pol.symbol) summary += ` (${pol.symbol})`;
  } else if (at === 'addressbook_add' || at === 'addressbook_update') {
    summary = pol.nickname || '';
    if (pol.chain) summary += summary ? ` · ${pol.chain}` : pol.chain;
    if (pol.address) summary += summary ? ` · ${pol.address.slice(0, 8)}…${pol.address.slice(-4)}` : pol.address;
  } else {
    const to = ctx.to || approval.to_address;
    const contract = ctx.contract || ctx.program_id;
    const target = to || contract;
    if (target) summary = `${target.slice(0, 8)}…${target.slice(-4)}`;
    if (ctx.method) summary += summary ? ` · ${ctx.method}` : ctx.method;
    if (ctx.chain) summary += summary ? ` · ${ctx.chain}` : ctx.chain;
  }

  return { typeLabel, amount, currency, summary };
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
  const { typeLabel, amount, currency, summary } = parseContext(approval);

  return (
    <button type="button"
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
              <span className="text-[10px] text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 uppercase tracking-wider">
                {typeLabel}
              </span>
              {approval.agent_name && (
                <span className="text-[10px] text-on-surface-variant font-medium px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20">
                  {approval.agent_name}
                </span>
              )}
            </div>

            {(amount || currency) && (
              <p className="text-2xl font-headline font-black text-on-surface tabular-nums mb-1">
                {amount && <span>{Number(amount).toLocaleString()}</span>}
                {currency && <span className="text-base font-bold text-on-surface-variant ml-1">{currency}</span>}
              </p>
            )}

            {summary && (
              <p className="text-xs text-on-surface-variant font-mono truncate">{summary}</p>
            )}

            {approval.memo && (
              <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{approval.memo}</p>
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

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-on-surface">{t('approvals.title')}</h1>
          {approvals.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
              {approvals.length}
            </span>
          )}
        </div>
        <button type="button"
          onClick={() => fetchApprovals(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('approvals.refresh')}
        </button>
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
          <button type="button"
            onClick={() => fetchApprovals()}
            className="px-5 py-2 rounded-xl bg-surface-container-high ghost-border text-sm font-medium text-on-surface hover:border-outline/40 transition-all"
          >
            {t('approval.tryAgain')}
          </button>
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-8 h-8 text-outline mb-3" />
          <p className="text-on-surface font-medium text-sm mb-1">{t('approvals.empty')}</p>
          <p className="text-on-surface-variant text-xs">{t('approvals.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(approval => (
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
