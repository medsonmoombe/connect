'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  label,
  required,
  helperText,
  error,
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className={cn('space-y-1.5', className)} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {helperText && <p className="text-[11px] text-slate-400 font-medium mt-0.5 ml-1">{helperText}</p>}

      <div className="relative">
        <button
          type="button"
          onClick={() => { if (!disabled) setOpen(!open); }}
          className={cn(
            'w-full h-10 px-4 pr-10 rounded-none border bg-slate-50 focus:bg-white text-left transition-all text-sm font-medium',
            open ? 'border-green-600 ring-2 ring-green-600/20' : 'border-slate-200',
            error && 'border-red-300',
            disabled && 'opacity-50 cursor-not-allowed',
            value ? 'text-slate-900' : 'text-slate-400'
          )}
          disabled={disabled}
        >
          {value ? selectedLabel : placeholder}
        </button>
        <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-none shadow-lg overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Icons.search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full h-8 pl-8 pr-3 rounded-none border border-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-green-600/20 focus:border-green-600"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-slate-400 font-medium">No results found</p>
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm font-medium transition-colors',
                      value === opt.value
                        ? 'bg-green-50 text-green-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-red-500 font-medium ml-1 flex items-center gap-1">
          <Icons.alertTriangle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}
