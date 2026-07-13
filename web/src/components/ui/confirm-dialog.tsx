'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';
import { Icons } from './icons';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'danger' | 'outline';
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
  children,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(open);
  const [animating, setAnimating] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, loading]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={loading ? undefined : onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Dialog */}
      <div
        className={`
          relative w-full max-w-md bg-white rounded-2xl shadow-2xl
          transition-all duration-200 origin-center
          ${animating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
      >
        <div className="p-6">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
          {children}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-xl font-bold"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'danger' : confirmVariant === 'outline' ? 'outline' : 'default'}
            className="flex-1 h-10 rounded-xl font-bold"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
