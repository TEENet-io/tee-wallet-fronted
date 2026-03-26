import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import type { AuditLog } from '../types';

// Action filter options
interface ActionOption { value: string; labelKey: string }

const ACTION_OPTIONS: ActionOption[] = [
  { value: '', labelKey: 'history.action.all' },
  { value: 'login', labelKey: 'history.action.login' },
  { value: 'wallet_create', labelKey: 'history.action.walletCreate' },
  { value: 'wallet_delete', labelKey: 'history.action.walletDelete' },
  { value: 'transfer', labelKey: 'history.action.transfer' },
  { value: 'sign', labelKey: 'history.action.sign' },
  { value: 'policy_update', labelKey: 'history.action.policyUpdate' },
  { value: 'approval_approve', labelKey: 'history.action.approve' },
  { value: 'approval_reject', labelKey: 'history.action.reject' },
  { value: 'contract_add', labelKey: 'history.action.contractAdd' },
  { value: 'contract_update', labelKey: 'history.action.contractUpdate' },
  { value: 'contract_call', labelKey: 'history.action.contractCall' },
  { value: 'approve_token', labelKey: 'history.action.tokenApprove' },
  { value: 'revoke_approval', labelKey: 'history.action.revokeApproval' },
  { value: 'apikey_generate', labelKey: 'history.action.apikeyGenerate' },
  { value: 'apikey_revoke', labelKey: 'history.action.apikeyRevoke' },
  { value: 'wrap_sol', labelKey: 'history.action.wrapSol' },
  { value: 'unwrap_sol', labelKey: 'history.action.unwrapSol' },
];

// Dot color by action type
function dotColor(action: string): string {
  if (action === 'login') return 'bg-blue-400';
  if (action.startsWith('wallet_create') || action === 'contract_add') return 'bg-green-400';
  if (action.startsWith('wallet_delete') || action === 'apikey_revoke') return 'bg-red-400';
  if (action === 'transfer') return 'bg-purple-400';
  if (action === 'policy_update' || action === 'contract_update') return 'bg-amber-400';
  if (action.startsWith('approval_')) return 'bg-cyan-400';
  if (action === 'apikey_generate') return 'bg-teal-400';
  return 'bg-on-surface-variant';
}

// Parse JSON details into a summary string
function detailSummary(details?: string): string | null {
  if (!details) return null;
  try {
    const obj = JSON.parse(details);
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    // Pick the most useful field
    const priority = ['label', 'chain', 'address', 'prefix', 'amount', 'contract_address'];
    for (const key of priority) {
      if (obj[key]) return `${key}: ${String(obj[key])}`;
    }
    return `${entries[0][0]}: ${String(entries[0][1])}`;
  } catch {
    return details.length > 60 ? details.slice(0, 60) + '…' : details;
  }
}

// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function AuditHistory() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;

  function getActionLabel(action: string): string {
    const opt = ACTION_OPTIONS.find(o => o.value === action);
    if (opt) return t(opt.labelKey);
    return action.replace(/_/g, ' ');
  }

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
      setError(res.error || t('history.loadError'));
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchLogs(page, actionFilter);
  }, [fetchLogs, page, actionFilter]);

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const canPrev = page > 1;
  const canNext = totalPages !== null ? page < totalPages : logs.length === PAGE_SIZE;

  // Group logs by date
  const grouped = logs.reduce<Record<string, AuditLog[]>>((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-on-surface">{t('history.title')}</h1>
        <button
          onClick={() => fetchLogs(page, actionFilter, true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('history.refresh')}
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={actionFilter}
            onChange={e => handleFilterChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-surface-container border border-outline-variant/15 text-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer transition-colors"
          >
            {ACTION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-surface-container">
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
        </div>
        {total !== null && (
          <span className="text-xs text-on-surface-variant">{total} {t('history.totalEntries')}</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-surface-container-high shimmer mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-surface-container-high shimmer" />
                <div className="h-3 w-48 rounded bg-surface-container-high shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-on-surface-variant text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchLogs(page, actionFilter)}
            className="text-sm text-primary hover:underline"
          >
            {t('approval.tryAgain')}
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-on-surface-variant text-sm">{t('history.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(grouped) as [string, AuditLog[]][]).map(([date, dateLogs]) => (
            <div key={date}>
              {/* Date header */}
              <p className="text-xs font-medium text-on-surface-variant mb-3 uppercase tracking-wider">{date}</p>

              {/* Timeline */}
              <div className="space-y-0">
                {dateLogs.map(log => {
                  const isExpanded = expandedId === String(log.id);
                  const summary = detailSummary(log.details);
                  let fullDetails: [string, unknown][] = [];
                  if (isExpanded && log.details) {
                    try { fullDetails = Object.entries(JSON.parse(log.details)); } catch { /* skip */ }
                  }

                  return (
                    <button
                      key={log.id}
                      onClick={() => setExpandedId(isExpanded ? null : String(log.id))}
                      className="w-full text-left flex gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high/50 transition-colors group"
                    >
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1.5 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${dotColor(log.action)}`} />
                        <div className="w-px flex-1 bg-outline-variant/15 mt-1" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-on-surface capitalize">
                            {getActionLabel(log.action)}
                          </span>
                          {log.status && log.status !== 'success' && (
                            <span className="text-[10px] font-bold text-error uppercase">{log.status}</span>
                          )}
                          <span className="ml-auto text-[11px] text-on-surface-variant tabular-nums whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString(undefined, {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Summary line */}
                        {summary && !isExpanded && (
                          <p className="text-xs text-on-surface-variant font-mono truncate mt-0.5">{summary}</p>
                        )}

                        {/* Expanded details */}
                        {isExpanded && fullDetails.length > 0 && (
                          <div className="mt-2 space-y-1 bg-surface-container rounded-lg p-3">
                            {fullDetails.map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs">
                                <span className="text-on-surface-variant shrink-0 w-24 text-right">{k}</span>
                                <span className="text-on-surface font-mono break-all">{String(v)}</span>
                              </div>
                            ))}
                            {log.auth_mode && (
                              <div className="flex gap-2 text-xs">
                                <span className="text-on-surface-variant shrink-0 w-24 text-right">auth</span>
                                <span className="text-on-surface font-mono">{log.auth_mode}</span>
                              </div>
                            )}
                            {log.ip && (
                              <div className="flex gap-2 text-xs">
                                <span className="text-on-surface-variant shrink-0 w-24 text-right">ip</span>
                                <span className="text-on-surface font-mono">{log.ip}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && logs.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-on-surface-variant">
            {totalPages !== null ? `${page} / ${totalPages}` : `${t('history.page')} ${page}`}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!canNext}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
