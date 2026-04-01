import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Terminal, Bot, KeyRound, Radio, Ban,
  LogOut, Trash2, Fingerprint, Copy, Check,
  Link2, ChevronDown, ChevronUp, Plus, X,
  UserPlus, Pencil, BookUser, Search, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from './ConfirmDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { useWallets } from '../contexts/WalletContext';
import type { APIKey, ChainConfig, AddressBookEntry } from '../types';

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
  const [keyLabel, setKeyLabel] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);

  // Rename state
  const [renamingPrefix, setRenamingPrefix] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState('');

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
  // Address Book state
  // ---------------------------------------------------------------------------
  const [abEntries, setAbEntries] = useState<AddressBookEntry[]>([]);
  const [abLoading, setAbLoading] = useState(true);
  const [abSearch, setAbSearch] = useState('');
  const [showAbForm, setShowAbForm] = useState(false);
  const [abEditId, setAbEditId] = useState<number | null>(null);
  const [abNickname, setAbNickname] = useState('');
  const [abChain, setAbChain] = useState('');
  const [abAddress, setAbAddress] = useState('');
  const [abMemo, setAbMemo] = useState('');
  const [abSaving, setAbSaving] = useState(false);
  const [abDeletingId, setAbDeletingId] = useState<number | null>(null);

  const chainNames = Object.keys(chainsMap);

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
  // Address Book handlers
  // ---------------------------------------------------------------------------
  const loadAbEntries = useCallback(async () => {
    setAbLoading(true);
    const res = await api<{ entries: AddressBookEntry[] }>('/api/addressbook');
    if (res.success && Array.isArray(res.entries)) setAbEntries(res.entries);
    setAbLoading(false);
  }, []);

  useEffect(() => { loadAbEntries(); }, [loadAbEntries]);

  function openAbAdd() {
    setAbEditId(null);
    setAbNickname('');
    setAbChain(chainNames[0] ?? '');
    setAbAddress('');
    setAbMemo('');
    setShowAbForm(true);
  }

  function openAbEdit(entry: AddressBookEntry) {
    setAbEditId(entry.id);
    setAbNickname(entry.nickname);
    setAbChain(entry.chain);
    setAbAddress(entry.address);
    setAbMemo(entry.memo ?? '');
    setShowAbForm(true);
  }

  async function handleAbSave(e: FormEvent) {
    e.preventDefault();
    if (!abNickname.trim() || !abAddress.trim() || (!abEditId && !abChain)) return;
    setAbSaving(true);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) { setAbSaving(false); return; }
      const isEdit = abEditId !== null;
      const body: Record<string, unknown> = {
        ...passkeyBody,
        nickname: abNickname.trim().toLowerCase(),
        address: abAddress.trim(),
        memo: abMemo.trim() || undefined,
      };
      if (!isEdit) body.chain = abChain;
      const res = await api(isEdit ? `/api/addressbook/${abEditId}` : '/api/addressbook', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      if (res.success) {
        toast(isEdit ? t('addressBook.updated') : t('addressBook.saved'), 'success');
        setShowAbForm(false);
        await loadAbEntries();
      } else {
        toast((res as { error?: string }).error ?? t('addressBook.saveFail'), 'error');
      }
    } finally { setAbSaving(false); }
  }

  async function handleAbDelete(entry: AddressBookEntry) {
    const ok = await confirm({
      title: t('addressBook.delete'),
      message: `${t('addressBook.confirmDelete')}\n\n${entry.nickname} (${entry.chain})`,
      confirmText: t('addressBook.delete'),
      danger: true,
    });
    if (!ok) return;
    setAbDeletingId(entry.id);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) { setAbDeletingId(null); return; }
      const res = await api(`/api/addressbook/${entry.id}`, { method: 'DELETE', body: JSON.stringify(passkeyBody) });
      if (res.success) {
        toast(t('addressBook.deleted'), 'success');
        setAbEntries(prev => prev.filter(e => e.id !== entry.id));
      } else {
        toast((res as { error?: string }).error ?? t('addressBook.deleteFail'), 'error');
      }
    } finally { setAbDeletingId(null); }
  }

  const abFiltered = abSearch ? abEntries.filter(e => e.nickname.includes(abSearch.toLowerCase())) : abEntries;

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
        { method: 'POST', body: JSON.stringify({ ...passkeyBody, label: keyLabel.trim() || undefined }) },
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

      setKeyLabel('');
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
  // Rename API key
  // ---------------------------------------------------------------------------
  function startRename(key: APIKey) {
    setRenamingPrefix(key.prefix);
    setRenameLabel(key.label || '');
  }

  async function commitRename(prefix: string) {
    const trimmed = renameLabel.trim();
    if (!trimmed) { setRenamingPrefix(null); return; }

    const res = await api('/api/auth/apikey', {
      method: 'PATCH',
      body: JSON.stringify({ prefix, label: trimmed }),
    });
    if (res.success) {
      toast(t('settings.renameSuccess'), 'success');
      await loadKeys();
    } else {
      toast((res as { error?: string }).error || 'Rename failed', 'error');
    }
    setRenamingPrefix(null);
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
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-on-surface">{t('settings.title')}</h1>
        </div>

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
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-on-surface">{t('settings.apiKeys')}</h2>
            <p className="text-xs text-on-surface-variant">{t('settings.apiKeysDesc')}</p>
          </div>

          {/* Generate new key with optional label */}
          <div className="flex items-center gap-2">
            <input
              value={keyLabel}
              onChange={e => setKeyLabel(e.target.value)}
              placeholder={t('settings.keyLabelPlaceholder')}
              className="flex-1 bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary transition-colors"
              disabled={generating}
            />
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Fingerprint className="w-4 h-4" />
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
                    {renamingPrefix === key.prefix ? (
                      <div className="mb-2">
                        <input
                          autoFocus
                          value={renameLabel}
                          onChange={e => setRenameLabel(e.target.value)}
                          onBlur={() => commitRename(key.prefix)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(key.prefix);
                            if (e.key === 'Escape') setRenamingPrefix(null);
                          }}
                          className="w-full bg-transparent border-b border-primary text-on-surface text-sm font-semibold outline-none py-0.5"
                          placeholder="Label"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-semibold text-on-surface truncate">
                          {key.label || key.prefix}
                        </h3>
                        <button
                          onClick={() => startRename(key)}
                          className="shrink-0 w-5 h-5 flex items-center justify-center text-outline hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                          title={t('settings.rename')}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
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
        {/* Address Book Section                                                */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">
                {t('addressBook.title')}
              </h2>
              <p className="text-sm text-slate-500">{t('addressBook.subtitle')}</p>
            </div>
            <button
              onClick={() => { showAbForm ? setShowAbForm(false) : openAbAdd(); }}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors"
            >
              {showAbForm ? (
                <><ChevronUp className="w-4 h-4" />{t('common.cancel')}</>
              ) : (
                <><Plus className="w-4 h-4" />{t('addressBook.add')}</>
              )}
            </button>
          </div>

          {/* Add/Edit form */}
          {showAbForm && (
            <form onSubmit={handleAbSave} className="p-5 rounded-2xl bg-surface-container-low ghost-border space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">{t('addressBook.nickname')}</label>
                  <input required value={abNickname} onChange={e => setAbNickname(e.target.value)} placeholder={t('addressBook.nicknamePlaceholder')}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">{t('addressBook.chain')}</label>
                  <select value={abChain} onChange={e => setAbChain(e.target.value)} disabled={abEditId !== null}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface border border-transparent focus:border-primary/40 focus:outline-none transition-colors disabled:opacity-50">
                    {chainNames.map(name => <option key={name} value={name}>{chainsMap[name]?.label ?? name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">{t('addressBook.address')}</label>
                  <input required value={abAddress} onChange={e => setAbAddress(e.target.value)} placeholder={t('addressBook.addressPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface font-mono placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">{t('addressBook.memo')}</label>
                  <input value={abMemo} onChange={e => setAbMemo(e.target.value)} placeholder={t('addressBook.memoPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container text-sm text-on-surface placeholder:text-slate-600 border border-transparent focus:border-primary/40 focus:outline-none transition-colors" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowAbForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-on-surface transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={abSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl primary-gradient text-on-primary-container text-sm font-semibold glow-primary hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100">
                  <Fingerprint className="w-4 h-4" />
                  {abSaving ? t('settings.verifying') : t('addressBook.save')}
                </button>
              </div>
            </form>
          )}

          {/* Search */}
          {abEntries.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input type="text" value={abSearch} onChange={e => setAbSearch(e.target.value)} placeholder={t('addressBook.search')}
                className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant/20 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors" />
            </div>
          )}

          {/* List */}
          {abLoading ? (
            <div className="flex items-center justify-center py-8 text-on-surface-variant">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : abFiltered.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">{t('addressBook.empty')}</p>
          ) : (
            <div className="space-y-3">
              {abFiltered.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-surface-container-low ghost-border hover:bg-surface-container transition-colors group">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
                      <BookUser className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-on-surface">{entry.nickname}</span>
                        <span className="text-xs text-slate-500 bg-surface-container-high px-1.5 py-0.5 rounded">
                          {chainsMap[entry.chain]?.label ?? entry.chain}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate">{entry.address}</p>
                      {entry.memo && <p className="text-xs text-outline truncate">{entry.memo}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openAbEdit(entry)} title={t('addressBook.edit')}
                      className="p-2 text-slate-500 hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleAbDelete(entry)} disabled={abDeletingId === entry.id} title={t('addressBook.delete')}
                      className="p-2 text-slate-500 hover:text-error transition-colors disabled:opacity-40">
                      {abDeletingId === entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
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

      </div>
    </>
  );
}
