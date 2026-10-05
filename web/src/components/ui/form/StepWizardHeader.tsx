'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface Step {
  label: string;
}

interface StepWizardHeaderProps {
  step: number;
  totalSteps: number;
  steps: Step[];
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Autosave state: 'off' (idle green), 'saving' (amber pulse), 'saved' (just saved). */
  saveState?: 'off' | 'saving' | 'saved';
  className?: string;
}

/**
 * Dark-green card header for the submission wizard: a top bar with a step
 * pill and autosave indicator, an icon + heading row, and a segmented
 * progress strip at the bottom. Matches the project submission wireframe.
 */
export function StepWizardHeader({
  step,
  totalSteps,
  steps,
  icon,
  title,
  subtitle,
  saveState = 'off',
  className,
}: StepWizardHeaderProps) {
  return (
    <header className={cn('bg-gradient-to-br from-[#0F3520] via-g-900 to-[#154530] px-6 sm:px-10 pt-5 pb-0 overflow-hidden', className)}>
      {/* Top row: pill + autosave */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-white/85 border border-white/28 bg-white/[0.06] px-2.5 py-1">
          Step {step} of {totalSteps}
        </span>
        <span className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.12em] uppercase transition-colors",
          saveState === 'saving' ? 'text-white/85' : 'text-white/55',
        )}>
          <span className={cn(
            "size-1.5 shrink-0",
            saveState === 'saving'
              ? "bg-[#F2C14E] animate-pulse"
              : saveState === 'saved'
                ? "bg-[#86D8A5]"
                : "bg-[#86D8A5]",
          )} />
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved · just now' : 'Autosave on'}
        </span>
      </div>

      {/* Icon + title row */}
      <div className="flex items-start gap-4 mt-6">
        <div className="size-11 shrink-0 grid place-items-center bg-white/[0.08] border border-white/[0.22] text-[#DFF0E4]">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-[22px] font-semibold leading-tight text-white tracking-tight">
            {title}
          </h1>
          <p className="text-[13px] text-white/65 font-medium mt-1 leading-relaxed">{subtitle}</p>
        </div>
      </div>

      {/* Step segments */}
      <nav className="flex gap-2.5 mt-7 -mb-[1px]" aria-label="Progress">
        {steps.map((s, i) => {
          const idx = i + 1;
          const isDone = idx < step;
          const isActive = idx === step;
          return (
            <div key={i} className="flex-1 flex flex-col gap-2.5">
              <div className={cn(
                "h-[3px] transition-colors",
                isDone ? 'bg-[rgba(154,216,176,0.45)]' : isActive ? 'bg-[#9AD8B0]' : 'bg-white/16',
              )} />
              <span className={cn(
                "font-mono text-[9.5px] font-medium tracking-[0.14em] uppercase mb-4",
                isActive ? 'text-white/92' : isDone ? 'text-white/65' : 'text-white/42',
              )}>
                {String(idx).padStart(2, '0')} · {s.label}
              </span>
            </div>
          );
        })}
      </nav>
    </header>
  );
}