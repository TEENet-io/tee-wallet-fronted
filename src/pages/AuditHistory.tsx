import { useState, useEffect, useCallback } from 'react';
import { History, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { AuditLog } from '../types';

// ---------------------------------------------------------------------------
// Action filter config
// ---------------------------------------------------------------------------

interface ActionOption {
  value: string;
  label: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'wallet_create', label: 'Wallet Create' },
  { value: 'wallet_delete', label: 'Wallet Delete' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'sign', label: 'Sign' },
  { value: 'policy_update', label: 'Policy Update' },
  { value: 'approval_approve', label: 'Approve' },
  { value: 'approval_reject', label: 'Reject' },
  { value: 'contract_call', label: 'Contract Call' },
  { value: 'approve_token', label: 'Token Approve' },
  { value: 'revoke_approval', label: 'Revoke Approval' },
  { value: 'apikey_generate', label: 'API Key Generate' },
  { value: 'apikey_revoke', label: 'API Key Revoke' },
  { value: 'wrap_sol', label: 'Wrap SOL' },
  { value: 'unwrap_sol', label: 'Unwrap wSOL' },
];

// ---------------------------------------------------------------------------
// Badge colour mapping
// ---------------------------------------------------------------------------

interface BadgeStyle {
  bg: string;
  border: string;
  text: string;
}

function badgeStyle(action: string): BadgeStyle {
  if (action === 'login') return { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400' };
  if (action === 'wallet_create') return { bg: 'bg-green-500/10', border: 'border-green-500/25', text: 'text-green-400' };
  if (action === 'wallet_delete') return { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400' };
  if (action === 'transfer') return { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400' };
  if (action === 'sign') return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', text: 'text-indigo-400' };
  if (action === 'policy_update') return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', text: 'text-yellow-400' };
  if (action === 'approval_approve') return { bg: 'bg-green-500/10', border: 'border-green-500/25', text: 'text-green-400' };
  if (action === 'approval_reject') return { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400' };
  if (action === 'contract_call') return { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-400' };
  if (action === 'approve_token') return { bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', text: 'text-cyan-400' };
  if (action === 'revoke_approval') return { bg: 'bg-rose-500/10', border: 'border-rose-500/25', text: 'text-rose-400' };
  if (action === 'apikey_generate') return { bg: 'bg-teal-500/10', border: 'border-teal-500/25', text: 'text-teal-400' };
  if (action === 'apikey_revoke') return { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400' };
  if (action === 'wrap_sol') return { bg: 'bg-violet-500/10', border: 'border-violet-500/25', text: 'text-violet-400' };
  if (action === 'unwrap_sol') return { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/25', text: 'text-fuchsia-400' };
  return { bg: 'bg-slate-500/10', border: 'border-slate-500/25', text: 'text-slate-400' };
}

function actionLabel(action: string): string {
  return ACTION_OPTIONS.find(o => o.value === action)?.label ?? action.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ActionBadgeProps {
  action: string;
}

function ActionBadge({ action }: ActionBadgeProps) {
  const s = badgeStyle(action);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.12em] whitespace-nowrap ${s.bg} ${s.border} ${s.text}`}
    >
      {actionLabel(action)}
    </span>
  );
}

interface LogRowProps {
  key?: string | number;
  log: AuditLog;
}

function LogRow({ log }: LogRowProps) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 group hover:bg-surface-container-high/50 transition-colors duration-150 rounded-xl">
      {/* Badge */}
      <div className="pt-0.5 shrink-0">
        <ActionBadge action={log.action} />
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {log.detail ? (
          <p className="text-sm text-on-surface leading-snug break-words">{log.detail}</p>
        ) : (
          <p className="text-sm text-on-surface-variant italic">No detail recorded</p>
        )}
      </div>

      {/* Right meta */}
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-xs text-on-surface-variant tabular-nums">
          {new Date(log.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
        {log.ip && (
          <p className="text-[11px] text-slate-500 font-mono">{log.ip}</p>
        )}
      </div>
    </div>
  );
}

function LogRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="h-6 w-24 rounded-full bg-surface-container-high shimmer shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded-lg bg-surface-container-high shimmer w-3/4" />
        <div className="h-3 rounded-lg bg-surface-container-high shimmer w-1/2" />
      </div>
      <div className="shrink-0 space-y-1">
        <div className="h-3 rounded-lg bg-surface-container-high shimmer w-28" />
        <div className="h-3 rounded-lg bg-surface-container-high shimmer w-16 ml-auto" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function AuditHistory() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;

  const fetchLogs = useCallback(async (p: number, action: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const qs = `page=${p}&limit=${PAGE_SIZE}${action ? `&action=${action}` : ''}`;
    const res = await api<{ logs: AuditLog[]; total?: number }>(`/api/audit/logs?${qs}`);

    if (res.success && Array.isArray(res.logs)) {
      setLogs(res.logs);
      setTotal(res.total ?? null);
    } else {
      setError(res.error || 'Failed to load audit logs');
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  // Fetch whenever page or filter changes
  useEffect(() => {
    fetchLogs(page, actionFilter);
  }, [fetchLogs, page, actionFilter]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const handleRefresh = () => fetchLogs(page, actionFilter, true);

  const canPrev = page > 1;
  const canNext = totalPages !== null ? page < totalPages : logs.length === PAGE_SIZE;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <History className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Audit History</h1>
          </div>
          <p className="text-on-surface-variant text-sm">
            A tamper-evident log of all actions performed in this account.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high ghost-border text-on-surface-variant hover:text-on-surface hover:border-outline/40 transition-all duration-200 text-sm font-medium disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        <div className="relative">
          <select
            value={actionFilter}
            onChange={e => handleFilterChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-surface-container-low ghost-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer hover:border-outline/40 transition-colors"
          >
            {ACTION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-surface-container">
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
        </div>

        {total !== null && (
          <span className="text-xs text-slate-500 ml-1">{total.toLocaleString()} total entries</span>
        )}
      </div>

      {/* Log panel */}
      <div className="rounded-2xl bg-surface-container-low ghost-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-outline-variant/10">
            {[...Array(8)].map((_, i) => (
              <LogRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-error" />
            </div>
            <p className="text-on-surface font-semibold mb-1">Failed to load logs</p>
            <p className="text-on-surface-variant text-sm mb-5">{error}</p>
            <button
              onClick={() => fetchLogs(page, actionFilter)}
              className="px-5 py-2 rounded-xl bg-surface-container-high ghost-border text-sm font-medium text-on-surface hover:border-outline/40 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high ghost-border flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-on-surface font-semibold mb-1">No log entries</p>
            <p className="text-on-surface-variant text-sm">
              {actionFilter
                ? `No "${actionLabel(actionFilter)}" events found.`
                : 'No audit events have been recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10 p-2">
            {logs.map(log => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && logs.length > 0 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {totalPages !== null
              ? `Page ${page} of ${totalPages}`
              : `Page ${page}`}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!canPrev || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-low ghost-border text-sm font-medium text-on-surface-variant hover:text-on-surface hover:border-outline/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!canNext || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-low ghost-border text-sm font-medium text-on-surface-variant hover:text-on-surface hover:border-outline/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
