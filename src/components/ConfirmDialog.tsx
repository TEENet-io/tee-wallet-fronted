// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, useCallback } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

let resolvePromise: ((value: boolean) => void) | null = null;

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});

  const confirm = useCallback((opts: ConfirmOptions = {}): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolvePromise = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setOpen(false);
    resolvePromise?.(result);
    resolvePromise = null;
  }, []);

  const ConfirmDialogComponent = () => {
    if (!open) return null;
    const { title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = true } = options;
    return (
      <div
        className="fixed inset-0 bg-black/75 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={() => handleClose(false)}
      >
        <div
          className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            {danger
              ? <AlertTriangle className="w-6 h-6 text-error" />
              : <HelpCircle className="w-6 h-6 text-primary" />
            }
            <h3 className="font-headline font-bold text-lg text-on-surface">{title}</h3>
          </div>
          {message && (
            <p className="text-sm text-on-surface-variant mb-6 whitespace-pre-line">{message}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button"
              onClick={() => handleClose(false)}
              className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-variant transition-colors"
            >
              Cancel
            </button>
            <button type="button"
              onClick={() => handleClose(true)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                danger
                  ? 'bg-error/20 text-error border border-error/30 hover:bg-error/30'
                  : 'primary-gradient text-white hover:opacity-90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
