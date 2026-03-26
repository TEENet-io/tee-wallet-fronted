import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Terminal, Bot, KeyRound, Radio, Ban,
  LogOut, Trash2, Fingerprint, Copy, Check,
  Link2, ChevronDown, ChevronUp, Plus, X,
  UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from './ConfirmDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { useWallets } from '../contexts/WalletContext';
import type { APIKey, ChainConfig } from '../types';

// Maps a key index to one of the decorative icons used in the original design.
const KEY_ICONS = [Terminal, Bot, Radio, KeyRound];

function keyIcon(index: number) {
  const Icon = KEY_ICONS[index % KEY_ICONS.length];
  return Icon;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

// Masks a raw API key, preserving the last 4 characters.
function maskKey(raw: string): string {
  if (raw.length <= 4) return raw;
  const suffix = raw.slice(-4);
  return `oc_live_••••••••${suffix}`;
}

// Truncate long URLs for display.
function truncateUrl(url: string, maxLen = 48): string {
  if (url.length <= maxLen) return url;
  return `${url.slice(0, maxLen)}…`;
}

interface InviteResult {
  register_url: string;
  invite_token: string;
  expires_at: string;
}

interface SecuritySettingsProps {
  onNavigateHome: () => void;
}

export default function SecuritySettings({ onNavigateHome }: SecuritySettingsProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { t } = useLanguage();
  const { chainsMap, loadChains } = useWallets();

  const [keys, setKeys] = useState<APIKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  // Stores the newly generated plaintext key — only shown once after generation.
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Chain Manager state
  // ---------------------------------------------------------------------------
  const [showAddChain, setShowAddChain] = useState(false);
  const [chainName, setChainName] = useState('');
  const [chainLabel, setChainLabel] = useState('');
  const [chainCurrency, setChainCurrency] = useState('');
  const [chainRpc, setChainRpc] = useState('');
  const [chainIdVal, setChainIdVal] = useState('');
  const [addingChain, setAddingChain] = useState(false);
  const [deletingChain, setDeletingChain] = useState<string | null>(null);

  // Derive the list of custom chains from the context map.
  const customChains = (Object.values(chainsMap) as (ChainConfig & { custom?: boolean })[]).filter(
    c => c.custom === true || c.is_custom === true,
  );

  // ---------------------------------------------------------------------------
  // Invite User state
  // ---------------------------------------------------------------------------
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('86400');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [copiedInviteToken, setCopiedInviteToken] = useState(false);

  // ---------------------------------------------------------------------------
  // Load API keys on mount
  // ---------------------------------------------------------------------------
  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const res = await api<{ keys: APIKey[] }>('/api/auth/apikey/list');
      if (res.success && Array.isArray(res.keys)) {
        setKeys(res.keys);
      } else {
        toast(res.error || t('settings.keysLoadError'), 'error');
      }
    } finally {
      setKeysLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  // ---------------------------------------------------------------------------
  // Generate new API key
  // ---------------------------------------------------------------------------
  async function handleGenerateKey() {
    setGenerating(true);
    setNewKey(null);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api<{ api_key?: string; keys?: APIKey[] }>(
        '/api/auth/apikey/generate',
        { method: 'POST', body: JSON.stringify(passkeyBody) },
      );

      if (!res.success) {
        toast(res.error || t('settings.generateFail'), 'error');
        return;
      }

      if (res.api_key) setNewKey(res.api_key);

      if (Array.isArray(res.keys)) {
        setKeys(res.keys);
      } else {
        await loadKeys();
      }

      toast(t('settings.generateSuccess'), 'success', 8000);
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke a key
  // ---------------------------------------------------------------------------
  async function handleRevokeKey(key: APIKey) {
    const ok = await confirm({
      title: t('settings.revokeTitle'),
      message: `${t('settings.revokeMessagePrefix')} ${key.prefix}?\n\n${t('settings.revokeConfirm')}`,
      confirmText: t('settings.revokeBtn'),
      danger: true,
    });
    if (!ok) return;

    setRevokingId(key.id);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api(`/api/auth/apikey?prefix=${encodeURIComponent(key.prefix)}`, {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });

      if (!res.success) {
        toast(res.error || t('settings.revokeFail'), 'error');
        return;
      }

      toast(t('settings.revokeSuccess'), 'success');
      setKeys(prev =>
        prev.map(k => k.id === key.id ? { ...k, status: 'revoked' as const } : k),
      );
      await loadKeys();
    } finally {
      setRevokingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Chain Manager — add chain
  // ---------------------------------------------------------------------------
  async function handleAddChain(e: FormEvent) {
    e.preventDefault();
    setAddingChain(true);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api('/api/chains', {
        method: 'POST',
        body: JSON.stringify({
          ...passkeyBody,
          name: chainName.trim(),
          label: chainLabel.trim(),
          currency: chainCurrency.trim(),
          rpc_url: chainRpc.trim(),
          chain_id: chainIdVal ? Number(chainIdVal) : undefined,
        }),
      });

      if (!res.success) {
        toast(res.error || t('settings.chainAdded'), 'error');
        return;
      }

      toast(t('settings.chainAdded'), 'success');
      setChainName('');
      setChainLabel('');
      setChainCurrency('');
      setChainRpc('');
      setChainIdVal('');
      setShowAddChain(false);
      await loadChains();
    } finally {
      setAddingChain(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Chain Manager — delete chain
  // ---------------------------------------------------------------------------
  async function handleDeleteChain(chain: ChainConfig) {
    const ok = await confirm({
      title: t('settings.chainDeleteConfirm'),
      message: t('settings.chainDeleteConfirm'),
      confirmText: t('wallets.deleteBtn'),
      danger: true,
    });
    if (!ok) return;

    setDeletingChain(chain.name);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api(`/api/chains/${chain.name}`, {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });

      if (!res.success) {
        toast(res.error || t('settings.chainDeleted'), 'error');
        return;
      }

      toast(t('settings.chainDeleted'), 'success');
      await loadChains();
    } finally {
      setDeletingChain(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Invite User — generate invite
  // ---------------------------------------------------------------------------
  async function handleGenerateInvite(e: FormEvent) {
    e.preventDefault();
    setGeneratingInvite(true);
    setInviteResult(null);
    try {
      const res = await api<{ register_url?: string; invite_token?: string; expires_at?: string }>(
        '/api/auth/invite',
        {
          method: 'POST',
          body: JSON.stringify({
            display_name: inviteDisplayName.trim(),
            expires_in_seconds: inviteExpiry ? Number(inviteExpiry) : 86400,
          }),
        },
      );

      if (!res.success || !res.register_url || !res.invite_token) {
        toast(res.error || t('settings.inviteSuccess'), 'error');
        return;
      }

      setInviteResult({
        register_url: res.register_url,
        invite_token: res.invite_token,
        expires_at: res.expires_at ?? '',
      });
      toast(t('settings.inviteSuccess'), 'success');
      setShowInviteForm(false);
      setInviteDisplayName('');
      setInviteExpiry('86400');
    } finally {
      setGeneratingInvite(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Copy helpers
  // ---------------------------------------------------------------------------
  async function handleCopyNewKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyInviteUrl() {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.register_url);
    setCopiedInviteUrl(true);
    setTimeout(() => setCopiedInviteUrl(false), 2000);
  }

  async function handleCopyInviteToken() {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.invite_token);
    setCopiedInviteToken(true);
    setTimeout(() => setCopiedInviteToken(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Danger zone
  // ---------------------------------------------------------------------------
  async function handleLogoutGlobal() {
    setDangerLoading(true);
    try {
      await auth.logout();
      onNavigateHome();
    } finally {
      setDangerLoading(false);
    }
  }

  async function handleDeleteAccount() {
    const ok = await confirm({
      title: t('settings.deleteTitle'),
      message: t('settings.deleteConfirm'),
      confirmText: t('settings.deleteAccount'),
      danger: true,
    });
    if (!ok) return;

    setDangerLoading(true);
    try {
      const deleted = await auth.deleteAccount();
      if (deleted) onNavigateHome();
    } finally {
      setDangerLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <ConfirmDialog />

      <div className="animate-in fade-in duration-500 space-y-12">
        {/* Hero Section */}
        <section className="gap-6">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-on-surface">
              {t('settings.title')}
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl">
              {t('settings.subtitle')}
            </p>
          </div>
        </section>

        {/* One-time new key banner */}
        {newKey && (
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-secondary/10 border border-secondary/30">
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-secondary uppercase tracking-widest font-bold">
                {t('settings.newKey')}
              </p>
              <code className="block text-sm text-on-surface break-all font-mono">{newKey}</code>
              <p className="text-xs text-slate-500">
                {t('settings.newKeyWarning')}
              </p>
            </div>
            <button
              onClick={handleCopyNewKey}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/20 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t('settings.copied') : t('settings.copy')}
            </button>
          </div>
        )}

        {/* API Management Section */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">{t('settings.apiKeys')}</h2>
              <p className="text-sm text-slate-500">
                {t('settings.apiKeysDesc')}
              </p>
            </div>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="group flex items-center gap-2 px-6 py-3 primary-gradient rounded-xl text-on-primary-container font-semibold glow-primary hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            >
              <Fingerprint className="w-5 h-5" />
              {generating ? t('settings.verifying') : t('settings.generateKey')}
            </button>
          </div>

          {/* Key Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {keysLoading && keys.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-container-low p-6 rounded-2xl ghost-border animate-pulse"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-xl bg-surface-container-high w-12 h-12" />
                    <div className="w-8 h-8 rounded-lg bg-surface-container-high" />
                  </div>
                  <div className="h-4 bg-surface-container-high rounded w-3/4 mb-2" />
                  <div className="h-5 bg-surface-container-high rounded w-1/2" />
                  <div className="mt-6 flex justify-between">
                    <div className="h-3 bg-surface-container-high rounded w-1/3" />
                    <div className="h-3 bg-surface-container-high rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : keys.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                {t('settings.noKeys')}
              </div>
            ) : (
              keys.map((key, index) => {
                const isActive = !key.status || key.status === 'active';
                const isRevoking = revokingId === key.id;
                const Icon = keyIcon(index);

                return isActive ? (
                  <div
                    key={key.id}
                    className="bg-surface-container-low p-6 rounded-2xl ghost-border hover:bg-surface-container transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-xl bg-surface-container-high">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <button
                        onClick={() => handleRevokeKey(key)}
                        disabled={isRevoking}
                        className="text-slate-500 hover:text-error transition-colors p-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={t('settings.revokeTitle')}
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                    </div>
                    <h3 className="font-semibold text-on-surface mb-1 truncate">
                      {key.prefix}
                    </h3>
                    <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                      {maskKey(key.prefix)}
                    </code>
                    <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                      <span>{t('common.created')} {timeAgo(key.created_at)}</span>
                      <span className="flex items-center gap-1 text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                        {t('settings.active')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={key.id}
                    className="bg-surface-container-lowest/50 p-6 rounded-2xl ghost-border opacity-60"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-xl bg-surface-container-high">
                        <KeyRound className="w-6 h-6 text-slate-500" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-400 mb-1 truncate">
                      {key.prefix}
                    </h3>
                    <code className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                      {maskKey(key.prefix)}
                    </code>
                    <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                      <span>{t('common.revoked')} {timeAgo(key.created_at)}</span>
                      <span className="flex items-center gap-1 text-error">
                        {t('settings.inactive')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Chain Manager Section                                               */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">
                {t('settings.chains')}
              </h2>
              <p className="text-sm text-slate-500">{t('settings.chainsDesc')}</p>
            </div>
            <button
              onClick={() => setShowAddChain(prev => !prev)}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors"
            >
              {showAddChain ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('common.cancel')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('settings.addChain')}
                </>
              )}
            </button>
          </div>

          {/* Add chain inline form */}
          {showAddChain && (
            <form
              onSubmit={handleAddChain}
              className="p-5 rounded-2xl bg-surface-container-low ghost-border space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.chainName')}
                  </label>
                  <input
                    required
                    value={chainName}
                    onChange={e => setChainName(e.target.value)}
                    placeholder="my-chain"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.chainLabel')}
                  </label>
                  <input
                    required
                    value={chainLabel}
                    onChange={e => setChainLabel(e.target.value)}
                    placeholder="My Chain"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.chainCurrency')}
                  </label>
                  <input
                    required
                    value={chainCurrency}
                    onChange={e => setChainCurrency(e.target.value)}
                    placeholder="ETH"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.chainId')}
                  </label>
                  <input
                    value={chainIdVal}
                    onChange={e => setChainIdVal(e.target.value)}
                    placeholder="1337"
                    type="number"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.chainRpc')}
                  </label>
                  <input
                    required
                    value={chainRpc}
                    onChange={e => setChainRpc(e.target.value)}
                    placeholder="https://rpc.example.com"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddChain(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-on-surface transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addingChain}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl primary-gradient text-on-primary-container text-sm font-semibold glow-primary hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <Fingerprint className="w-4 h-4" />
                  {addingChain ? t('settings.verifying') : t('settings.addChain')}
                </button>
              </div>
            </form>
          )}

          {/* Custom chains list */}
          {customChains.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">
              {t('settings.noCustomChains')}
            </p>
          ) : (
            <div className="space-y-3">
              {customChains.map(chain => (
                <div
                  key={chain.name}
                  className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-surface-container-low ghost-border hover:bg-surface-container transition-colors group"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-2.5 rounded-xl bg-surface-container-high flex-shrink-0">
                      <Link2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-on-surface">{chain.label}</span>
                        <code className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {chain.name}
                        </code>
                        <span className="text-xs text-slate-500 bg-surface-container-high px-1.5 py-0.5 rounded">
                          {chain.currency}
                        </span>
                        {chain.chain_id !== undefined && (
                          <span className="text-xs text-slate-500">
                            #{chain.chain_id}
                          </span>
                        )}
                      </div>
                      {chain.rpc_url && (
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {truncateUrl(chain.rpc_url)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteChain(chain)}
                    disabled={deletingChain === chain.name}
                    className="flex-shrink-0 p-2 text-slate-500 hover:text-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t('settings.chainDeleteConfirm')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Invite User Section                                                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">
                {t('settings.invite')}
              </h2>
              <p className="text-sm text-slate-500">{t('settings.inviteDesc')}</p>
            </div>
            <button
              onClick={() => {
                setShowInviteForm(prev => !prev);
                setInviteResult(null);
              }}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors"
            >
              {showInviteForm ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('common.cancel')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {t('settings.invite')}
                </>
              )}
            </button>
          </div>

          {/* Invite form */}
          {showInviteForm && (
            <form
              onSubmit={handleGenerateInvite}
              className="p-5 rounded-2xl bg-surface-container-low ghost-border space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.inviteDisplayName')}
                  </label>
                  <input
                    required
                    value={inviteDisplayName}
                    onChange={e => setInviteDisplayName(e.target.value)}
                    placeholder="Alice"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {t('settings.inviteExpiry')}
                  </label>
                  <input
                    value={inviteExpiry}
                    onChange={e => setInviteExpiry(e.target.value)}
                    placeholder="86400"
                    type="number"
                    min="60"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-on-surface transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl primary-gradient text-on-primary-container text-sm font-semibold glow-primary hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <UserPlus className="w-4 h-4" />
                  {generatingInvite ? t('settings.verifying') : t('settings.inviteGenerate')}
                </button>
              </div>
            </form>
          )}

          {/* Invite result banner */}
          {inviteResult && (
            <div className="p-5 rounded-2xl bg-secondary/10 border border-secondary/30 space-y-4">
              <p className="text-xs text-secondary uppercase tracking-widest font-bold">
                {t('settings.inviteSuccess')}
              </p>

              {/* Register URL */}
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  {t('settings.inviteUrl')}
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs text-on-surface break-all font-mono bg-surface-container px-3 py-2 rounded-lg min-w-0">
                    {inviteResult.register_url}
                  </code>
                  <button
                    onClick={handleCopyInviteUrl}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/20 text-secondary text-xs font-semibold hover:bg-secondary/30 transition-colors"
                  >
                    {copiedInviteUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedInviteUrl ? t('settings.copied') : t('settings.copy')}
                  </button>
                </div>
              </div>

              {/* Invite token */}
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  {t('settings.inviteToken')}
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs text-on-surface break-all font-mono bg-surface-container px-3 py-2 rounded-lg min-w-0">
                    {inviteResult.invite_token}
                  </code>
                  <button
                    onClick={handleCopyInviteToken}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/20 text-secondary text-xs font-semibold hover:bg-secondary/30 transition-colors"
                  >
                    {copiedInviteToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedInviteToken ? t('settings.copied') : t('settings.copy')}
                  </button>
                </div>
              </div>

              {/* Expires at */}
              {inviteResult.expires_at && (
                <p className="text-xs text-slate-500">
                  {t('settings.inviteExpires')}: {new Date(inviteResult.expires_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="space-y-4">
          <div className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden">
            <div className="p-6 bg-error/5 flex flex-col gap-4">
              <p className="text-xs text-error/80 uppercase tracking-widest font-bold">
                {t('settings.dangerZone')}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleLogoutGlobal}
                  disabled={dangerLoading}
                  className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-medium text-on-surface hover:bg-surface-variant transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-4 h-4" />
                  {dangerLoading ? t('settings.working') : t('settings.logoutGlobal')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={dangerLoading}
                  className="px-4 py-2 rounded-lg border border-error/20 text-sm font-medium text-error hover:bg-error/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('settings.deleteAccount')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Aesthetic Data Scan Decorative */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent relative mt-12">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-surface text-[10px] text-slate-600 uppercase tracking-[0.4em] font-bold">
            {t('settings.endStream')}
          </div>
        </div>
      </div>
    </>
  );
}
