'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';
import { Icons } from './icons';

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success' | 'default' | 'outline';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  loading?: boolean;
  children?: React.ReactNode;
}

const variantConfig: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  btnClasses: string;
  accentFrom: string;
  accentVia: string;
  accentTo: string;
}> = {
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    Icon: Icons.trash,
    btnClasses: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20',
    accentFrom: 'from-red-600',
    accentVia: 'via-red-400',
    accentTo: 'to-red-600',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: Icons.alertTriangle,
    btnClasses: 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20',
    accentFrom: 'from-amber-600',
    accentVia: 'via-amber-400',
    accentTo: 'to-amber-600',
  },
  info: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    Icon: Icons.info,
    btnClasses: 'bg-[#052e1a] text-white hover:bg-[#041f12] shadow-sm shadow-[#052e1a]/20',
    accentFrom: 'from-green-600',
    accentVia: 'via-emerald-400',
    accentTo: 'to-green-600',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    Icon: Icons.check,
    btnClasses: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    accentFrom: 'from-emerald-600',
    accentVia: 'via-emerald-400',
    accentTo: 'to-emerald-600',
  },
  default: {
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-700',
    Icon: Icons.shield,
    btnClasses: 'bg-[#052e1a] text-white hover:bg-[#041f12] shadow-sm shadow-[#052e1a]/20',
    accentFrom: 'from-green-700',
    accentVia: 'via-green-500',
    accentTo: 'to-green-700',
  },
  outline: {
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-600',
    Icon: Icons.shield,
    btnClasses: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    accentFrom: 'from-slate-600',
    accentVia: 'via-slate-400',
    accentTo: 'to-slate-600',
  },
};

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, loading]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!visible) return null;

  // Map legacy variants to new ones
  let mappedVariant: ConfirmVariant = confirmVariant === 'default' || confirmVariant === 'outline'
    ? 'info'
    : confirmVariant;
  // Auto-upgrade 'info' to 'success' for positive action labels
  if (mappedVariant === 'info' && /^(approve|activate|enable|accept|confirm|save)/i.test(confirmLabel)) {
    mappedVariant = 'success';
  }
  const cfg = variantConfig[mappedVariant];
  const { Icon } = cfg;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop — matches landing page dark overlays */}
      <div
        onClick={loading ? undefined : onClose}
        className={`absolute inset-0 bg-[#041f12]/70 backdrop-blur-sm transition-opacity duration-200 ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Dialog — sharp, no rounded-none, matches IntelligenceSection mock dashboard */}
      <div
        className={`relative w-full max-w-md bg-white overflow-hidden
          transition-all duration-200 origin-center
          ${animating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}
        `}
      >
        {/* Top accent bar — identical to IntelligenceSection mock dashboard */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cfg.accentFrom} ${cfg.accentVia} ${cfg.accentTo}`} />

        {/* Content */}
        <div className="p-7 pb-5">
          {/* Icon + Title row */}
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 ${cfg.iconBg} flex items-center justify-center border ${cfg.iconBg === 'bg-emerald-50' ? 'border-emerald-100' : cfg.iconBg === 'bg-red-50' ? 'border-red-100' : 'border-amber-100'}`}>
              <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">{title}</h3>
              <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Optional children */}
          {children && (
            <div className="mt-5 pl-14">
              {children}
            </div>
          )}
        </div>

        {/* Footer — clean, no rounded corners on dialog */}
        <div className="px-7 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-10 text-[13px] font-semibold border-slate-200"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className={`flex-1 h-10 text-[13px] font-semibold ${cfg.btnClasses}`}
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
