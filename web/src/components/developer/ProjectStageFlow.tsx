'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import type { Project } from '@/types';

/* ─── Stage definitions ─────────────────────────────────────────────────── */

export interface StageDefinition {
  id: string;
  label: string;
  description: string;
  developerAction: string;
  aiAction: string;
  output: string;
  outputIcon: keyof typeof Icons;
  isComplete: (project: Project) => boolean;
  isActive: (project: Project) => boolean;
  cta?: { label: string; href: (p: Project) => string };
}

const STAGES: StageDefinition[] = [
  {
    id: 'registration',
    label: 'Registration',
    description: 'Account created and company profile verified by the platform.',
    developerAction: 'Create profile',
    aiAction: 'Validate user & company',
    output: 'User Account',
    outputIcon: 'user',
    isComplete: () => true,
    isActive: () => false,
  },
  {
    id: 'project-creation',
    label: 'Project Creation',
    description: 'Enter all project details — technology, location, size, and capital structure.',
    developerAction: 'Enter project data',
    aiAction: 'Check completeness',
    output: 'Draft Project',
    outputIcon: 'folder',
    isComplete: (p) =>
      (p.name?.length ?? 0) >= 3 &&
      !!p.technology_type &&
      (p.project_size_mw ?? 0) > 0 &&
      (p.capital_required ?? 0) > 0,
    isActive: (p) => !p.status || p.status === 'draft',
    cta: { label: 'Edit Project', href: (p) => `/developer/submit?edit=${p.id}` },
  },
  {
    id: 'documentation',
    label: 'Documentation',
    description: 'Upload required documents — feasibility study, financial model, permits.',
    developerAction: 'Upload files',
    aiAction: 'Detect missing items',
    output: 'Gap Report',
    outputIcon: 'fileText',
    isComplete: (p) => (p.documents?.length ?? 0) > 0,
    isActive: (p) => p.status === 'draft' && (p.documents?.length ?? 0) === 0,
    cta: { label: 'Upload Documents', href: (p) => `/projects/${p.id}` },
  },
  {
    id: 'gap-resolution',
    label: 'Gap Resolution',
    description: 'AI analyses your documents and scores your project. Hire consultants to fill gaps.',
    developerAction: 'Hire consultants',
    aiAction: 'Recalculate readiness score',
    output: 'Improved Readiness',
    outputIcon: 'shieldCheck',
    isComplete: (p) => (p.scores?.capital_readiness_score ?? 0) > 0,
    isActive: (p) =>
      p.status === 'scoring' ||
      p.status === 'scoring_retry' ||
      p.status === 'pending_live',
    cta: { label: 'View Gap Analysis', href: (p) => `/projects/${p.id}/gaps` },
  },
  {
    id: 'financing',
    label: 'Financing',
    description: 'Project goes live on the marketplace. Matched investors express interest.',
    developerAction: 'Submit to investors',
    aiAction: 'Match investment criteria',
    output: 'Investment Opportunities',
    outputIcon: 'dollarSign',
    isComplete: (p) =>
      p.status === 'live' || p.status === 'deactivated' || p.status === 'archived',
    isActive: (p) => p.status === 'live',
    cta: { label: 'View Matches', href: (p) => `/developer/find-partners?project=${encodeURIComponent(p.id)}` },
  },
  {
    id: 'construction',
    label: 'Construction',
    description: 'Select an EPC contractor. Platform verifies capability and facilitates engagement.',
    developerAction: 'Select EPC / Operator',
    aiAction: 'Verify capability',
    output: 'EPC / Operator Match',
    outputIcon: 'cpu',
    isComplete: (p) => p.status === 'deactivated' || p.status === 'archived',
    isActive: (p) => p.status === 'live',
  },
];

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface ProjectStageFlowProps {
  project: Project;
  className?: string;
  compact?: boolean;
}

type StageState = 'done' | 'active' | 'upcoming';

function getStageState(stage: StageDefinition, project: Project): StageState {
  if (stage.isComplete(project)) return 'done';
  if (stage.isActive(project)) return 'active';
  return 'upcoming';
}

/* ─── Compact dot track (sidebar widget) ───────────────────────────────── */

function CompactDot({ state }: { state: StageState }) {
  return (
    <span className={cn(
      'size-2.5 rounded-full border-2 shrink-0 transition-all duration-300',
      state === 'done'     && 'bg-emerald-500 border-emerald-500',
      state === 'active'   && 'bg-primary border-primary ring-2 ring-primary/20 animate-pulse',
      state === 'upcoming' && 'bg-white border-slate-300',
    )} />
  );
}

/* ─── Full stage row ────────────────────────────────────────────────────── */

function StageRow({
  stage,
  state,
  index,
  total,
  project,
}: {
  stage: StageDefinition;
  state: StageState;
  index: number;
  total: number;
  project: Project;
}) {
  const isLast     = index === total - 1;
  const isDone     = state === 'done';
  const isActive   = state === 'active';
  const isUpcoming = state === 'upcoming';

  return (
    <div className="flex gap-4">
      {/* ── Spine ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          'size-7 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-300',
          isDone     && 'bg-emerald-500 border-emerald-500',
          isActive   && 'bg-primary border-primary ring-3 ring-primary/10',
          isUpcoming && 'bg-white border-slate-200',
        )}>
          {isDone
            ? <Icons.check className="size-3 text-white" />
            : <span className={cn('text-[10px] font-black', isActive ? 'text-white' : 'text-slate-400')}>{index + 1}</span>
          }
        </div>
        {!isLast && (
          <div className={cn('w-px flex-1 min-h-[24px] mt-1', isDone ? 'bg-emerald-200' : 'bg-slate-200')} />
        )}
      </div>

      {/* ── Row content ────────────────────────────────────── */}
      <div className={cn('flex-1 pb-4 min-w-0', isUpcoming && 'opacity-45')}>
        <div className={cn(
          'flex items-center justify-between gap-3 px-4 py-3 rounded-none border transition-all',
          isActive   && 'bg-primary/[0.02] border-primary/20',
          isDone     && 'bg-white border-slate-100',
          isUpcoming && 'bg-white border-slate-100',
        )}>
          {/* Label + output */}
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn(
              'text-sm font-bold truncate',
              isDone     && 'text-slate-400 line-through',
              isActive   && 'text-slate-900',
              isUpcoming && 'text-slate-500',
            )}>
              {stage.label}
            </span>
            <span className={cn(
              'hidden sm:inline text-[10px] font-semibold truncate',
              isDone   ? 'text-emerald-500' : isActive ? 'text-primary' : 'text-slate-400',
            )}>
              → {stage.output}
            </span>
          </div>

          {/* Right side: status badge + optional CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black tracking-wider">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                In Progress
              </span>
            )}
            {isDone && index > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black tracking-wider border border-emerald-100">
                <Icons.check className="size-2.5" /> Done
              </span>
            )}
            {isActive && stage.cta && (
              <Link href={stage.cta.href(project)}>
                <Button size="sm" className="h-7 px-3 rounded-none bg-primary text-white text-[10px] font-bold hover:bg-primary/90">
                  {stage.cta.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary header card ───────────────────────────────────────────────── */

function StageSummaryCard({
  project,
  stagesWithState,
}: {
  project: Project;
  stagesWithState: { stage: StageDefinition; state: StageState }[];
}) {
  const doneCount  = stagesWithState.filter(s => s.state === 'done').length;
  const totalCount = stagesWithState.length;
  const pct        = Math.round((doneCount / totalCount) * 100);
  const activeStage = stagesWithState.find(s => s.state === 'active');
  const nextStage   = stagesWithState.find(s => s.state === 'upcoming');

  const statusColor =
    pct === 100 ? 'text-emerald-600' :
    pct >= 50   ? 'text-primary' :
    'text-amber-600';

  const barColor =
    pct === 100 ? 'bg-emerald-500' :
    pct >= 50   ? 'bg-primary' :
    'bg-amber-500';

  return (
    <div className="dash-card p-4 mb-5">
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative size-14 shrink-0 flex items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke={pct === 100 ? '#22c55e' : pct >= 50 ? '#0b3b24' : '#f59e0b'}
              strokeWidth="5"
              strokeDasharray={138.2}
              strokeDashoffset={138.2 - (138.2 * pct) / 100}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className={cn('absolute text-[13px] font-black leading-none', statusColor)}>{pct}%</span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="dash-section-label mb-0.5">Project Journey</p>
          <p className="text-sm font-bold text-slate-900 truncate">
            {pct === 100 ? 'All stages complete' : activeStage ? `Currently: ${activeStage.stage.label}` : 'Getting started'}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {doneCount}/{totalCount} stages{nextStage ? ` · Next: ${nextStage.stage.label}` : ''}
          </p>
        </div>

        {/* Progress bar — right side */}
        <div className="hidden sm:block w-28 shrink-0">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 text-right">{pct}% complete</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Legend ────────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 pt-2 border-t border-slate-100 mt-2">
      {[
        { state: 'done'    as StageState, label: 'Complete',    dot: 'bg-emerald-500' },
        { state: 'active'  as StageState, label: 'In Progress', dot: 'bg-primary' },
        { state: 'upcoming'as StageState, label: 'Upcoming',    dot: 'bg-slate-300' },
      ].map(({ label, dot }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full shrink-0', dot)} />
          <span className="text-[10px] font-medium text-slate-400">{label}</span>
        </div>
      ))}
      <span className="text-slate-200 hidden sm:inline">·</span>
      <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
        Each stage unlocks the next
      </span>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */

export function ProjectStageFlow({ project, className, compact = false }: ProjectStageFlowProps) {
  const stagesWithState = useMemo(
    () => STAGES.map(s => ({ stage: s, state: getStageState(s, project) })),
    [project],
  );

  const activeIndex  = stagesWithState.findIndex(s => s.state === 'active');
  const currentLabel = activeIndex >= 0 ? STAGES[activeIndex].label : 'Complete';

  /* ── Compact: single dot row ─────────────────────────────── */
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex items-center gap-1.5">
          {stagesWithState.map(({ stage, state }) => (
            <CompactDot key={stage.id} state={state} />
          ))}
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {currentLabel}
        </span>
      </div>
    );
  }

  /* ── Full timeline ───────────────────────────────────────── */
  return (
    <div className={cn('space-y-0', className)}>
      <StageSummaryCard project={project} stagesWithState={stagesWithState} />

      <div className="space-y-0">
        {STAGES.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            state={stagesWithState[i].state}
            index={i}
            total={STAGES.length}
            project={project}
          />
        ))}
      </div>

      <Legend />
    </div>
  );
}
