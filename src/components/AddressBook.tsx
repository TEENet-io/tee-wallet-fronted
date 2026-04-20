// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { ArrowLeft, BookUser, Plus, Pencil, Trash2, Loader2, Search, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from './ConfirmDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { useWallets } from '../contexts/WalletContext';
import type { AddressBookEntry } from '../types';

function truncateAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

interface AddressBookProps {
  onBack: () => void;
}

export default function AddressBook({ onBack }: AddressBookProps) {
  const { getFreshPasskeyCredential } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { t } = useLanguage();
  const { chainsMap } = useWallets();

  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formNickname, setFormNickname] = useState('');
  const [formChain, setFormChain] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const chainNames = Object.keys(chainsMap);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await api<{ entries: AddressBookEntry[] }>('/api/addressbook');
    if (res.success && Array.isArray(res.entries)) {
      setEntries(res.entries);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  function openAdd() {
    setEditingId(null);
    setFormNickname('');
    setFormChain(chainNames[0] ?? '');
    setFormAddress('');
    setFormMemo('');
    setShowForm(true);
  }

  function openEdit(entry: AddressBookEntry) {
    setEditingId(entry.id);
    setFormNickname(entry.nickname);
    setFormChain(entry.chain);
    setFormAddress(entry.address);
    setFormMemo(entry.memo ?? '');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!formNickname.trim()) { toast(t('addressBook.nicknameRequired'), 'error'); return; }
    if (!formAddress.trim()) { toast(t('addressBook.addressRequired'), 'error'); return; }
    if (!formChain) { toast(t('addressBook.chainRequired'), 'error'); return; }

    setSaving(true);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setSaving(false); return; }

      const isEdit = editingId !== null;
      const body: Record<string, unknown> = {
        ...passkeyBody,
        nickname: formNickname.trim().toLowerCase(),
        address: formAddress.trim(),
        memo: formMemo.trim() || undefined,
      };
      if (!isEdit) body.chain = formChain;

      const res = await api(
        isEdit ? `/api/addressbook/${editingId}` : '/api/addressbook',
        { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) },
      );

      if (res.success) {
        toast(isEdit ? t('addressBook.updated') : t('addressBook.saved'), 'success');
        closeForm();
        await fetchEntries();
      } else {
        toast((res as { error?: string }).error ?? t('addressBook.saveFail'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: AddressBookEntry) {
    const ok = await confirm({
      title: t('addressBook.delete'),
      message: `${t('addressBook.confirmDelete')}\n\n${entry.nickname} (${entry.chain})`,
      confirmText: t('addressBook.delete'),
      danger: true,
    });
    if (!ok) return;

    setDeletingId(entry.id);
    try {
      const passkeyBody = await getFreshPasskeyCredential();
      if (!passkeyBody) { setDeletingId(null); return; }

      const res = await api(`/api/addressbook/${entry.id}`, {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });
      if (res.success) {
        toast(t('addressBook.deleted'), 'success');
        setEntries(prev => prev.filter(e => e.id !== entry.id));
      } else {
        toast((res as { error?: string }).error ?? t('addressBook.deleteFail'), 'error');
      }
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = search
    ? entries.filter(e => e.nickname.includes(search.toLowerCase()))
    : entries;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <ConfirmDialog />

      {/* Back */}
      <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {t('addressBook.back')}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookUser className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-on-surface">{t('addressBook.title')}</h1>
          {entries.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
              {entries.length}
            </span>
          )}
        </div>
        <button type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addressBook.add')}
        </button>
      </div>

      {/* Search */}
      {entries.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('addressBook.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container border border-outline-variant/20 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-surface-container-low rounded-2xl ghost-border p-5 space-y-4">
          <p className="font-semibold text-on-surface text-sm">
            {editingId !== null ? t('addressBook.edit') : t('addressBook.add')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">{t('addressBook.nickname')}</label>
              <input
                value={formNickname}
                onChange={e => setFormNickname(e.target.value)}
                placeholder={t('addressBook.nicknamePlaceholder')}
                className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">{t('addressBook.chain')}</label>
              <select
                value={formChain}
                onChange={e => setFormChain(e.target.value)}
                disabled={editingId !== null}
                className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              >
                {chainNames.map(name => (
                  <option key={name} value={name}>{chainsMap[name]?.label ?? name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">{t('addressBook.address')}</label>
            <input
              value={formAddress}
              onChange={e => setFormAddress(e.target.value)}
              placeholder={t('addressBook.addressPlaceholder')}
              className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface font-mono placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">{t('addressBook.memo')}</label>
            <input
              value={formMemo}
              onChange={e => setFormMemo(e.target.value)}
              placeholder={t('addressBook.memoPlaceholder')}
              className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium border border-outline-variant/20 hover:bg-surface-container-highest hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('addressBook.save')}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-8 h-8 text-outline mb-3" />
          <p className="text-on-surface font-medium text-sm mb-1">{t('addressBook.empty')}</p>
          <p className="text-on-surface-variant text-xs">{t('addressBook.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const isDeleting = deletingId === entry.id;
            return (
              <div key={entry.id} className="bg-surface-container-low rounded-2xl ghost-border p-4 flex items-center gap-4 group hover:border-outline/40 transition-all">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookUser className="w-5 h-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-headline font-bold text-on-surface text-sm">{entry.nickname}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20 text-on-surface-variant">
                      {chainsMap[entry.chain]?.label ?? entry.chain}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant font-mono truncate">{truncateAddr(entry.address)}</p>
                  {entry.memo && <p className="text-xs text-outline mt-0.5 truncate">{entry.memo}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button type="button"
                    onClick={() => openEdit(entry)}
                    title={t('addressBook.edit')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button"
                    onClick={() => handleDelete(entry)}
                    disabled={isDeleting}
                    title={t('addressBook.delete')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-error/10 transition-all disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
