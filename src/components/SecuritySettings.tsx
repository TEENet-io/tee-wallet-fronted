import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Bot, KeyRound, Radio, Ban, ShieldCheck, MapPinOff,
  History, Laptop, Smartphone, LogOut, Trash2, Fingerprint, Copy, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from './ConfirmDialog';
import type { APIKey } from '../types';

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

interface SecuritySettingsProps {
  onNavigateHome: () => void;
}

export default function SecuritySettings({ onNavigateHome }: SecuritySettingsProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [keys, setKeys] = useState<APIKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  // Stores the newly generated plaintext key — only shown once after generation.
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);

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
        toast(res.error || 'Failed to load API keys', 'error');
      }
    } finally {
      setKeysLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  // ---------------------------------------------------------------------------
  // Generate new key
  // ---------------------------------------------------------------------------
  async function handleGenerateKey() {
    setGenerating(true);
    setNewKey(null);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api<{ key?: string; keys?: APIKey[] }>(
        '/api/auth/apikey/generate',
        { method: 'POST', body: JSON.stringify(passkeyBody) },
      );

      if (!res.success) {
        toast(res.error || 'Failed to generate key', 'error');
        return;
      }

      // The plaintext key is only returned once at generation time.
      if (res.key) setNewKey(res.key);

      // Refresh the list — either from the response or via a fresh fetch.
      if (Array.isArray(res.keys)) {
        setKeys(res.keys);
      } else {
        await loadKeys();
      }

      toast('New API key generated. Copy it now — it will not be shown again.', 'success', 8000);
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke a key
  // ---------------------------------------------------------------------------
  async function handleRevokeKey(key: APIKey) {
    const ok = await confirm({
      title: 'Revoke API Key',
      message: `Revoke key ending in ${key.prefix}?\n\nAny agent using this key will immediately lose access. This cannot be undone.`,
      confirmText: 'Revoke Key',
      danger: true,
    });
    if (!ok) return;

    setRevokingId(key.id);
    try {
      const passkeyBody = await auth.getFreshPasskeyCredential();
      if (!passkeyBody) return;

      const res = await api('/api/auth/apikey', {
        method: 'DELETE',
        body: JSON.stringify({ ...passkeyBody, key_id: key.id }),
      });

      if (!res.success) {
        toast(res.error || 'Failed to revoke key', 'error');
        return;
      }

      toast('API key revoked', 'success');
      // Optimistically mark as revoked in local state, then reload.
      setKeys(prev =>
        prev.map(k => k.id === key.id ? { ...k, status: 'revoked' as const } : k),
      );
      await loadKeys();
    } finally {
      setRevokingId(null);
    }
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
      title: 'Delete Account',
      message: 'This will permanently erase your account, all wallets, API keys, and transaction history.\n\nThis action is irreversible.',
      confirmText: 'Delete Account',
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
  // Copy new key to clipboard
  // ---------------------------------------------------------------------------
  async function handleCopyNewKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Security & API Control
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl">
              Manage your autonomous observer's gateway. Control permissions, revoke access,
              and monitor active sessions across the neural network.
            </p>
          </div>
        </section>

        {/* One-time new key banner */}
        {newKey && (
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-secondary/10 border border-secondary/30">
            <div className="space-y-1 min-w-0">
              <p className="text-xs text-secondary uppercase tracking-widest font-bold">
                New Key — Copy Now
              </p>
              <code className="block text-sm text-on-surface break-all font-mono">{newKey}</code>
              <p className="text-xs text-slate-500">
                This key will not be shown again once you leave this page.
              </p>
            </div>
            <button
              onClick={handleCopyNewKey}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/20 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {/* API Management Section */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">API Keys</h2>
              <p className="text-sm text-slate-500">
                Programmatic access for external autonomous modules.
              </p>
            </div>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="group flex items-center gap-2 px-6 py-3 primary-gradient rounded-xl text-on-primary-container font-semibold glow-primary hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            >
              <Fingerprint className="w-5 h-5" />
              {generating ? 'Verifying…' : 'Generate New Key'}
            </button>
          </div>

          {/* Key Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {keysLoading && keys.length === 0 ? (
              // Skeleton placeholders — preserve bento grid shape
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
                No API keys yet. Generate one to get started.
              </div>
            ) : (
              keys.map((key, index) => {
                const isActive = key.status === 'active';
                const isRevoking = revokingId === key.id;
                const Icon = keyIcon(index);

                return isActive ? (
                  /* Active key card */
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
                        title="Revoke Key"
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
                      <span>Created {timeAgo(key.created_at)}</span>
                      <span className="flex items-center gap-1 text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                        Active
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Revoked key card */
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
                      <span>Revoked {timeAgo(key.created_at)}</span>
                      <span className="flex items-center gap-1 text-error">
                        Inactive
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Security Policies & Session Management Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Active Policies */}
          <div className="space-y-6 lg:col-span-7">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">
                Active Policies
              </h2>
              <p className="text-sm text-slate-500">
                Automatic enforcement rules for your agent.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl ghost-border">
                <div className="flex items-center gap-4">
                  <ShieldCheck className="w-6 h-6 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      Strict Signature Enforcement
                    </p>
                    <p className="text-xs text-slate-500">
                      Requires multi-sig for any outbound transaction &gt; 1 ETH
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded">
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl ghost-border">
                <div className="flex items-center gap-4">
                  <MapPinOff className="w-6 h-6 text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      Geofencing: EEA Only
                    </p>
                    <p className="text-xs text-slate-500">
                      Restricts node access to European Economic Area IPs
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded">
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl ghost-border">
                <div className="flex items-center gap-4">
                  <History className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">
                      Dynamic Key Rotation
                    </p>
                    <p className="text-xs text-slate-500">
                      Rotate primary session keys every 72 hours
                    </p>
                  </div>
                </div>
                <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors">
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Session Management */}
          <div className="space-y-6 lg:col-span-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-semibold text-on-surface">
                Session Management
              </h2>
              <p className="text-sm text-slate-500">
                Current active access points to this vault.
              </p>
            </div>

            <div className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="w-6 h-6 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">MacBook Pro 16" — London, UK</p>
                    <p className="text-xs text-secondary">Current Session</p>
                  </div>
                </div>
                <button className="text-xs font-bold text-slate-500 hover:text-error transition-colors">
                  Terminate
                </button>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-6 h-6 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">iPhone 15 Pro — Paris, FR</p>
                    <p className="text-xs text-slate-500">Last active 4 hours ago</p>
                  </div>
                </div>
                <button className="text-xs font-bold text-slate-500 hover:text-error transition-colors">
                  Terminate
                </button>
              </div>

              <div className="p-6 bg-error/5 flex flex-col gap-4">
                <p className="text-xs text-error/80 uppercase tracking-widest font-bold">
                  Danger Zone
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleLogoutGlobal}
                    disabled={dangerLoading}
                    className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-medium text-on-surface hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="w-4 h-4" />
                    {dangerLoading ? 'Working…' : 'Logout Global'}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={dangerLoading}
                    className="px-4 py-2 rounded-lg border border-error/20 text-sm font-medium text-error hover:bg-error/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Aesthetic Data Scan Decorative */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent relative mt-12">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-surface text-[10px] text-slate-600 uppercase tracking-[0.4em] font-bold">
            End Neural Stream
          </div>
        </div>
      </div>
    </>
  );
}
