'use client';

import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { InfoHint } from '@/components/ui/InfoHint';

interface YesNoFieldProps {
  id?: string;
  label: string;
  description?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
}

/**
 * Segmented Yes / No control from the submission-wizard wireframe: a bordered
 * segmented group where the active option fills deep green with an inline
 * check / cross icon. Keyboard accessible.
 */
export function YesNoField({
  id,
  label,
  description,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
  yesLabel = 'Yes',
  noLabel = 'No',
}: YesNoFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 ml-0.5">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold text-[#5C6B61] uppercase tracking-wide"
        >
          {label}
          {required && <span className="text-[#C63A2B] font-bold ml-0.5">*</span>}
        </label>
        {description && <InfoHint text={description} />}
      </div>

      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        className="inline-flex gap-[3px] p-[3px] border border-dashed border-transparent"
      >
        <div
          className="inline-flex gap-[3px] p-[3px] border border-[#D3DED5] bg-white transition-colors"
        >
          {[
            { option: true as const, label: yesLabel, icon: Icons.check },
            { option: false as const, label: noLabel, icon: Icons.x },
          ].map((opt) => {
            const selected = value === opt.option;
            const Icon = opt.icon;
            return (
              <button
                key={String(opt.option)}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(opt.option)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border transition-all select-none',
                  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-g-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  selected
                    ? 'bg-g-900 border-g-900 text-white'
                    : 'text-[#5C6B61] border-transparent hover:bg-g-soft hover:text-g-800',
                )}
              >
                <Icon className={cn('size-3.5', selected ? 'opacity-80' : 'opacity-75')} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-[12px] font-medium text-[#B23A28] ml-0.5 flex items-center gap-1.5 mt-0.5">
          <Icons.alertTriangle className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}