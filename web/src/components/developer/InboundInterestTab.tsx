'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Project, Engagement, EngagementStatus } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getStateLabel } from '@/lib/engagement';
import { getCounterpartyLabel } from '@/lib/role-labels';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { engagementService } from '@/lib/engagement';
import { EmptyState } from '@/components/ui/empty-state';

type ViewMode = 'list' | 'kanban';

interface ProjectGroup {
  project: Project;
  projectEngagements: Engagement[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTRO_SENT:        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  INTRO_ACCEPTED:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
  NDA_SIGNED:        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200'  },
  DUE_DILIGENCE:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  TERM_SHEET:        { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  CONTRACT_SIGNED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CAPITAL_COMMITTED: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'   },
  CLOSED:            { bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-200'   },
  DROPPED:           { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
};

const INITIAL_PROJECT_COUNT = 5;

function SectionHeader({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Partner Activity</p>
        <h3 className="text-sm font-semibold text-slate-900">Inbound Interest by Project</h3>
      </div>
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-none p-1 shrink-0">
        {(['list', 'kanban'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[10px] font-bold tracking-widest transition-all capitalize',
              viewMode === mode
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {mode === 'list' ? (
              <Icons.layoutDashboard className="size-3" aria-hidden />
            ) : (
              <Icons.layers className="size-3" aria-hidden />
            )}
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

function EngagementRow({ eng }: { eng: Engagement }) {
  const c = STATUS_COLORS[eng.status] ?? STATUS_COLORS.INTRO_SENT;
  const needsAction = eng.status === 'INTRO_SENT';
  const updatedDate = new Date(eng.updated_at ?? eng.created_at).toLocaleDateString();

  return (
    <Link href={`/engagements/${eng.id}`}>
      <div className="px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer flex items-center gap-4 group border-b border-slate-100 last:border-0">
        <div className={cn(
          'size-9 rounded-none flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
          eng.counterparty_type === 'CAPITAL' ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'
        )}>
          {eng.counterparty_type === 'CAPITAL' ? (
            <Icons.dollarSign className="size-4 text-amber-600" />
          ) : (
            <Icons.wrench className="size-4 text-blue-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-700 tracking-wider shrink-0">
              {getCounterpartyLabel(eng.counterparty_type)}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-none text-[9px] font-black tracking-wider border shrink-0',
                c.bg, c.text, c.border
              )}
            >
              {getStateLabel(eng.status)}
            </span>
            {needsAction && <span className="size-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
          </div>
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider">Updated {updatedDate}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {needsAction && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-none bg-blue-50 text-blue-700 text-[10px] font-black tracking-wider border border-blue-200 whitespace-nowrap">
              Action required
            </span>
          )}
          <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-green-800 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function ProjectBlock({ project, projectEngagements }: ProjectGroup) {
  const activeCount = projectEngagements.filter((e) => !['DROPPED', 'CLOSED'].includes(e.status)).length;

  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      {/* Dark green project header */}
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-none bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Icons.zap className="size-4 text-g-700" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="text-sm font-bold text-black hover:text-g-700 transition-colors truncate block"
            >
              {project.name}
            </Link>
            <p className="text-[10px] font-semibold text-slate-400 tracking-wider mt-0.5 truncate">
              {project.technology_type?.replace(/_/g, ' ')} · {project.project_size_mw} MW · {project.location_country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider hidden sm:inline whitespace-nowrap">
            {projectEngagements.length} interested
          </span>
          {activeCount > 0 && (
            <span className="px-2.5 py-1 rounded-none bg-white/10 border border-white/15 text-[10px] font-bold text-g-700 tracking-wider whitespace-nowrap">
              {activeCount} active
            </span>
          )}
        </div>
      </div>
      {/* Engagement rows */}
      <div>
        {projectEngagements.map((eng) => (
          <EngagementRow key={eng.id} eng={eng} />
        ))}
      </div>
    </div>
  );
}

function ShowMoreButton({
  showAll,
  total,
  shown,
  onToggle,
}: {
  showAll: boolean;
  total: number;
  shown: number;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'h-9 px-5 rounded-none text-[11px] font-bold tracking-[0.1em]',
          'text-green-800 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors'
        )}
      >
        {showAll ? 'Show less' : `View more (${total - shown})`}
      </button>
    </div>
  );
}

function ListView({ byProject }: { byProject: ProjectGroup[] }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? byProject : byProject.slice(0, INITIAL_PROJECT_COUNT);
  const hasMore = byProject.length > INITIAL_PROJECT_COUNT;

  return (
    <div className="space-y-4">
      {visible.map((group) => (
        <ProjectBlock key={group.project.id} {...group} />
      ))}
      {hasMore && (
        <ShowMoreButton
          showAll={showAll}
          total={byProject.length}
          shown={INITIAL_PROJECT_COUNT}
          onToggle={() => setShowAll((v) => !v)}
        />
      )}
    </div>
  );
}

export function InboundInterestTab({
  projects,
  engagements,
  loading,
}: {
  projects: Project[];
  engagements: Engagement[];
  loading: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  if (loading) {
    return (
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] py-8 flex items-center justify-center">
        <Icons.spinner className="size-5 animate-spin text-green-800" />
      </div>
    );
  }

  if (!projects.length) {
    return (
      <EmptyState
        icon="folder"
        title="No projects yet"
        description="Create a project to start receiving interest from capital and technical partners."
        actionLabel="Create project"
        actionHref="/developer/submit"
      />
    );
  }

  const byProject: ProjectGroup[] = projects
    .map((project) => ({
      project,
      projectEngagements: engagements.filter((e) => e.project_id === project.id),
    }))
    .filter(({ projectEngagements }) => projectEngagements.length > 0)
    .sort((a, b) => {
      const latest = (group: ProjectGroup) =>
        Math.max(...group.projectEngagements.map((e) => new Date(e.updated_at ?? e.created_at).getTime()));
      return latest(b) - latest(a);
    });

  return (
    <div className="space-y-5">
      <SectionHeader viewMode={viewMode} onViewModeChange={setViewMode} />
      {byProject.length === 0 ? (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] py-14 flex flex-col items-center text-center">
          <div className="size-14 bg-slate-50 rounded-none flex items-center justify-center mb-4 border border-slate-200">
            <Icons.users className="size-6 text-slate-300" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 mb-1.5">No interest yet</h4>
          <p className="text-xs text-slate-400 font-medium max-w-[220px] leading-relaxed">
            Partners will appear here once they express interest in your projects.
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          engagements={engagements}
          onStatusChange={async (id: string, newStatus: EngagementStatus) => {
            await engagementService.updateStatus(id, newStatus);
          }}
        />
      ) : (
        <ListView byProject={byProject} />
      )}
    </div>
  );
}
