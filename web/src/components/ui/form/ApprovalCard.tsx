'use client';

import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';

type BadgeState = 'not-held' | 'proof-required' | 'proof-attached';

const BADGE_STYLES: Record<BadgeState, { text: string; cls: string }> = {
  'not-held': {
    text: 'Not held',
    cls: 'text-[#7C897F] border-[#DCE4DD] bg-[#F6F8F6]',
  },
  'proof-required': {
    text: 'Proof required',
    cls: 'text-[#8A5A0B] border-[#E7CE8C] bg-[#FBF2D8]',
  },
  'proof-attached': {
    text: 'Proof attached',
    cls: 'text-[#1F6B41] border-[#BFDCC9] bg-[#E4F2E8]',
  },
};

interface ApprovalCardProps {
  checked: boolean;
  title: string;
  index?: string;
  badge: BadgeState;
  error?: string;
  disabled?: boolean;
  onCheckChange: (checked: boolean) => void;
  children?: React.ReactNode;
  uploading?: boolean;
  uploadProgress?: number;
  className?: string;
}

/**
 * Regulatory-approval card from the wireframe: a bordered card with an
 * inset left bar, a checkbox head (number + title + state badge) and an
 * optional proof body. The inset bar reflects the state:
 *   • not-held → neutral grey
 *   • proof-required → amber
 *   • proof-attached → green
 */
export function ApprovalCard({
  checked,
  title,
  index,
  badge,
  error,
  disabled = false,
  onCheckChange,
  children,
  uploading = false,
  uploadProgress,
  className,
}: ApprovalCardProps) {
  const state: BadgeState = !checked ? 'not-held' : badge === 'proof-attached' ? 'proof-attached' : 'proof-required';
  const badgeMeta = BADGE_STYLES[state];

  return (
    <div
      className={cn(
        "border border-[#E3EAE4] bg-white transition-colors",
        className,
      )}
      style={{ boxShadow: `inset 3px 0 0 ${state === 'not-held' ? '#E3EAE4' : state === 'proof-required' ? '#E4B54C' : '#2E7D4F'}` }}
    >
      {/* Head: checkbox + title + badge */}
      <div className="flex items-center gap-3 px-4 py-3">
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0 relative">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => {
              console.log(`[ApprovalCard] "${title}" checkbox changed → checked: ${e.target.checked}`);
              onCheckChange(e.target.checked);
            }}
            className="sr-only"
          />
          <span className={cn(
            "w-[18px] h-[18px] shrink-0 border-[1.5px] grid place-items-center transition-all",
            checked
              ? "bg-g-900 border-g-900"
              : "border-[#A7B7AB] bg-white",
          )}>
            <Icons.check className={cn(
              "size-[11px] text-white transition-all",
              checked ? "opacity-100 scale-100" : "opacity-0 scale-75",
            )} />
          </span>
          <span className="flex items-center gap-2 min-w-0">
            {index && (
              <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-[#8B998F] shrink-0">{index}</span>
            )}
            <span className="text-[13.5px] font-semibold text-[#17251C] truncate">{title}</span>
          </span>
        </label>
        <span className={cn(
          "shrink-0 font-mono text-[9.5px] font-semibold tracking-[0.13em] uppercase px-2 py-1 border",
          badgeMeta.cls,
        )}>
          {badgeMeta.text}
        </span>
      </div>

      {/* Body */}
      {checked && children && (
        <div className="px-4 pb-4 pt-2">
          {children}
        </div>
      )}

      {/* Progress bar during upload */}
      {uploading && typeof uploadProgress === 'number' && (
        <div className="h-[2px] bg-black/5">
          <div
            className="h-full transition-[width] duration-100 linear"
            style={{ width: `${Math.min(uploadProgress, 100)}%`, background: '#D9A93F' }}
          />
        </div>
      )}

      {error && (
        <p className="px-4 pb-3 text-[12px] font-medium text-[#B23A28] flex items-center gap-1.5">
          <Icons.alertTriangle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}