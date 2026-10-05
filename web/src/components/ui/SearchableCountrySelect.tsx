'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { COUNTRIES, AFRICAN_COUNTRIES, findCountry } from '@/lib/countries';

interface SearchableCountrySelectProps {
  /** The current value. Stored as the full country name (e.g. "Zambia"). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Show the "Show all / Show African only" toggle. Default true. */
  showGroupToggle?: boolean;
}

function highlightMatch(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <b className="font-bold text-g-800">
        {text.slice(idx, idx + q.length)}
      </b>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * SearchableCountrySelect — a type-ahead combobox matching the submission
 * wizard wireframe: a field input with a leading search icon and a chevron
 * toggle, opening a bordered dropdown list with highlighted matches.
 *
 * Stores the full country name (e.g. "Zambia") as the value. `findCountry`
 * is the canonical way to look up a country from any stored form.
 */
export function SearchableCountrySelect({
  value,
  onChange,
  placeholder = 'Search country…',
  label,
  helperText,
  error,
  disabled,
  required,
  className,
  showGroupToggle = true,
}: SearchableCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedCountry = useMemo(() => findCountry(value), [value]);

  // Source list: African suggestions first, then "all countries" once the
  // user has either typed or clicked "Show all".
  const source = useMemo(() => {
    if (showAll || search.length > 0) return COUNTRIES;
    return AFRICAN_COUNTRIES;
  }, [showAll, search]);

  const filtered = useMemo(() => {
    if (!search.trim()) return source;
    const q = search.trim().toLowerCase();
    return source.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.code.toLowerCase().startsWith(q)
    );
  }, [source, search]);

  // Click-outside to close
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Auto-focus the search input on open
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Scroll the highlighted option into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlighted}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const choose = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setSearch('');
      setHighlighted(0);
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[highlighted];
      if (pick) choose(pick.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      setHighlighted(0);
    }
  };

  const showAllEnabled = showAll || search.length > 0;
  const showToggle = showGroupToggle && !search;

  return (
    <div className={cn('space-y-1.5', className)} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-semibold text-[#5C6B61] uppercase tracking-wide ml-0.5">
          {label}
          {required && <span className="text-[#C63A2B] font-bold ml-0.5">*</span>}
        </label>
      )}
      {helperText && <p className="text-[11.5px] text-[#8B998F] font-normal mt-1.5 ml-0.5">{helperText}</p>}

      <div className="relative">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#93A399] pointer-events-none z-10" />

        <input
          ref={inputRef}
          type="text"
          readOnly={!disabled && false}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? 'csc-listbox' : undefined}
          aria-autocomplete="list"
          placeholder={value || placeholder}
          value={open ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onClick={() => !disabled && setOpen((o) => !o)}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className={cn(
            'w-full h-11 pl-9 pr-9 rounded-none border bg-field text-sm text-[#17251C] appearance-none',
            'transition-colors focus:outline-none',
            open ? 'border-g-700 bg-white shadow-[0_0_0_3px_rgba(27,94,58,0.12)]' : 'border-[#D3DED5] hover:border-[#B9C8BC]',
            error && 'border-verm-line bg-verm-soft shadow-[0_0_0_3px_rgba(198,58,43,0.08)]',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-100',
            value && !open ? 'text-slate-900' : 'text-slate-700',
          )}
        />

        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle country list"
          onClick={() => !disabled && setOpen((o) => !o)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 grid place-items-center text-[#7C897F] hover:text-[#17251C]"
        >
          <Icons.chevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>

        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear country"
            title="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 size-6 grid place-items-center text-[#A2B1A6] hover:text-[#17251C]"
          >
            <Icons.x className="size-3" />
          </button>
        )}

        {open && (
<div
              className="absolute z-50 mt-1.5 w-full bg-white border border-[#D3DED5] shadow-[0_16px_34px_-12px_rgba(18,43,28,0.28)]"
              role="listbox"
              id="csc-listbox"
            >
            <div className="p-2 border-b border-[#E3EAE4]">
              <div className="relative">
                <Icons.search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#93A399]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlighted(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Type a country…"
                  className="w-full h-8 pl-8 pr-2 rounded-none border border-[#D3DED5] bg-field text-[13.5px] font-medium focus:outline-none focus:border-g-700"
                />
              </div>
            </div>

            {showToggle && (
              <div className="px-3 py-1.5 border-b border-[#E3EAE4] bg-[#F4FAF5] flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em]">
                <span className="text-[#5C6B61] font-mono">
                  {showAllEnabled ? 'All countries' : 'Suggested · African Union'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAll((s) => !s);
                    setHighlighted(0);
                  }}
                  className="text-g-700 hover:text-g-800 normal-case tracking-normal text-[11px] font-semibold"
                >
                  {showAllEnabled ? 'Show African only' : 'Show all countries'}
                </button>
              </div>
            )}

            <div ref={listRef} className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3.5 py-3 text-[12.5px] text-[#5C6B61]">
                  No countries match &ldquo;{search}&rdquo;
                </div>
              ) : (
                filtered.map((c, i) => {
                  const isSelected = value === c.name;
                  const isHighlighted = i === highlighted;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-idx={i}
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => choose(c.name)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors',
                        'border-b border-[#F0F4F0] last:border-b-0',
                        isHighlighted ? 'bg-g-soft' : '',
                        isSelected ? 'text-g-900 font-semibold' : 'text-[#33413A] hover:bg-g-soft',
                      )}
                    >
                      <span className="text-[10px] font-bold text-[#8B998F] w-6 tabular-nums">{c.code}</span>
                      <span className="flex-1">{highlightMatch(c.name, search)}</span>
                      {isSelected && <Icons.check className="size-3.5 text-g-700" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-3.5 py-1.5 border-t border-[#E3EAE4] bg-[#F4FAF5] text-[10px] font-medium text-[#8B998F] font-mono tracking-wide">
              {filtered.length} of {COUNTRIES.length} countries
              {selectedCountry && <> · Selected: {selectedCountry.code}</>}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12px] font-medium text-[#B23A28] ml-0.5 flex items-center gap-1.5 mt-1.5">
          <Icons.alertTriangle className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}