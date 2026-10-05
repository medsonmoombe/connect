'use client';

import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface AiWorkingOverlayProps {
  title: string;
  subtitle: string;
  steps: string[];
  activeStep: number;
  accent?: 'green' | 'purple';
  hint?: string;
}

export function AiWorkingOverlay({
  title,
  subtitle,
  steps,
  activeStep,
  accent = 'green',
  hint,
}: AiWorkingOverlayProps) {
  const current = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const isGreen = accent === 'green';
  const accentColor = isGreen ? '#0b3b24' : '#7c3aed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm mx-4 bg-white border border-slate-200 shadow-[0_32px_80px_rgba(15,23,42,0.2)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <div className="size-9 bg-white/10 border border-white/15 flex items-center justify-center shrink-0 relative">
            <Icons.cpu className="size-4 text-black" />
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 border-2 border-[#0b3b24] animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-black uppercase tracking-widest">
              {isGreen ? 'AI Analysis' : 'AI Stage Detection'}
            </p>
            <h2 className="text-[14px] font-bold text-black leading-tight truncate">{title}</h2>
          </div>
        </div>

        {/* ── Scanning bar ── */}
        <div className="relative h-1 bg-slate-100 overflow-hidden">
          <div
            className={cn('absolute top-0 h-full w-1/3', isGreen ? 'bg-[#0b3b24]' : 'bg-purple-600')}
            style={{ animation: 'scanBar 1.8s ease-in-out infinite' }}
          />
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4">

          {/* Subtitle */}
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{subtitle}</p>

          {/* Active step callout */}
          <div className={cn(
            'flex items-center gap-3 px-3 py-2.5 border-l-2',
            isGreen ? 'bg-[#0b3b24]/[0.05] border-[#0b3b24]' : 'bg-purple-50 border-purple-500',
          )}>
            <span className={cn(
              'size-4 rounded-full border-2 border-t-transparent block animate-spin shrink-0',
              isGreen ? 'border-[#0b3b24]' : 'border-purple-600',
            )} />
            <span className="text-[12px] font-semibold text-slate-900 truncate">
              {steps[current]}
            </span>
            <span className={cn(
              'ml-auto shrink-0 text-[9px] font-bold uppercase tracking-widest',
              isGreen ? 'text-[#0b3b24]' : 'text-purple-600',
            )}>
              {current + 1}/{steps.length}
            </span>
          </div>

          {/* Compact step list — scrollable, max 3 visible */}
          <div className="space-y-0.5 max-h-[120px] overflow-y-auto no-scrollbar">
            {steps.map((step, i) => {
              const done   = i < current;
              const active = i === current;
              return (
                <div
                  key={step}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-1.5 transition-all duration-200',
                    done && 'opacity-40',
                    !done && !active && 'opacity-20',
                  )}
                >
                  <span className="shrink-0">
                    {done ? (
                      <Icons.check className={cn('size-3', isGreen ? 'text-[#0b3b24]' : 'text-purple-600')} />
                    ) : active ? (
                      <span className={cn('size-3 rounded-full border-2 border-t-transparent block animate-spin', isGreen ? 'border-[#0b3b24]' : 'border-purple-600')} />
                    ) : (
                      <span className="size-3 rounded-full border border-slate-300 block" />
                    )}
                  </span>
                  <span className={cn('text-[11px] truncate', active ? 'font-semibold text-slate-800' : 'font-medium text-slate-400')}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Dots + wait */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={cn('size-1.5 rounded-full', isGreen ? 'bg-[#0b3b24]' : 'bg-purple-500')}
                style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
              />
            ))}
            <span className="ml-2 text-[11px] text-slate-400 font-medium">Please wait…</span>
          </div>
        </div>

        {/* ── Hint footer ── */}
        {hint && (
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50">
            <p className="text-[9px] text-slate-400 font-medium leading-relaxed">{hint}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanBar {
          0%   { left: -33%; }
          100% { left: 133%; }
        }
      `}</style>
    </div>
  );
}
