'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';

interface DropdownMenuProps {
  children: ReactNode; // trigger element
  items: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
  }>;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ children, items, align = 'right', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const MENU_HEIGHT = items.length * 36 + 8;
  const [pos, setPos] = useState<{ top: number; right: number; origin: string }>({
    top: 0,
    right: 0,
    origin: 'top',
  });

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < MENU_HEIGHT;
      setPos({
        top: openUp ? rect.top - MENU_HEIGHT : rect.bottom + 4,
        right: window.innerWidth - rect.right,
        origin: openUp ? 'bottom' : 'top',
      });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={cn(
          'p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors',
          className
        )}
      >
        {children}
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            transformOrigin: pos.origin,
          }}
          className={cn(
            'w-44 bg-white border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.12)] py-1 animate-in fade-in duration-150',
            align === 'left' && ' right-0'
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <div
                  key={i}
                  className="mx-2 my-1 h-px bg-slate-100"
                />
              );
            }
            return (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  item.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {item.icon && (
                  <span className="shrink-0">{item.icon}</span>
                )}
                {item.label}
              </button>
            );
          })
          }
        </div>
      )}
    </>
  );
}
