'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import PageTitle from '@/components/PageTitle';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  Hero, HeroGhostButton, HeroPill, TabBar, SearchInput,
  EmptyState, TH_CLASS, TD_CLASS, StatusPill, SoftIcon, CountChip,
} from '@/components/ui/kit';
import type { Project } from '@/types';

type ReviewStatus = 'under_review' | 'live' | 'draft' | 'ALL';

type ReviewProject = Project & {
  developer?: { name: string; id: string; country?: string | null; website?: string | null } | null;
  documents?: { id: string; document_type?: string; file_url?: string; storage_path?: string }[] | null;
  scores?: { capital_readiness_score?: number; summary?: string; ai_analysis?: string } | null;
};

function money(value?: number) {
  const n = Number(value || 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export default function AuthorityProjectsPage() {
  const [projects, setProjects] = useState<ReviewProject[]>([]);
  const [status, setStatus] = useState<ReviewStatus>('under_review');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [fetching, setFetching] = useState(true);

  // Debounce the search so we don't hit the API per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadProjects = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams({ status });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/authority/projects?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load projects');
      setProjects(json.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Could not load review queue');
    } finally {
      setFetching(false);
    }
  }, [status, debouncedSearch]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const counts = useMemo(() => ({
    pending: projects.filter(p => p.status === 'under_review').length,
    live: projects.filter(p => p.status === 'live').length,
    returned: projects.filter(p => p.status === 'draft').length,
    total: projects.length,
  }), [projects]);

  // CSV export — regulators archive queue snapshots
  const exportCsv = () => {
    const rows = [
      ['Project', 'Technology', 'Capacity (MW)', 'Developer', 'Country', 'Stage', 'Capital Required (USD)', 'Readiness Score', 'Status', 'Created'],
      ...projects.map(p => [
        p.name,
        p.technology_type ?? '',
        String(p.project_size_mw ?? ''),
        p.developer?.name ?? '',
        (p as any).location_country ?? '',
        (p.project_stage || '').replace(/_/g, ' '),
        String(p.capital_required ?? ''),
        String(p.scores?.capital_readiness_score ?? ''),
        (p.status || '').replace(/_/g, ' '),
        new Date(p.created_at).toISOString().slice(0, 10),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-queue-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Queue exported');
  };

  const heroStats = [
    { value: counts.pending, label: 'Awaiting review' },
    { value: counts.live, label: 'Approved live' },
    { value: counts.returned, label: 'Returned' },
    { value: projects.length, label: 'Total tracked' },
  ];

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <PageTitle title="Project Review" />

      <Hero
        eyebrow="Governance · Review Queue"
        icon={Icons.folder}
        title="Project Review"
        description="Review, approve, or return submitted projects for regulatory compliance."
        actions={
          <>
            <HeroGhostButton onClick={exportCsv} className="px-3" >
              <Icons.download className="size-4" /> CSV
            </HeroGhostButton>
            <HeroGhostButton onClick={loadProjects} className="px-3">
              <Icons.refreshCw className={cn('size-4', fetching && 'animate-spin')} /> Refresh
            </HeroGhostButton>
          </>
        }
        stats={heroStats.map(s => ({
          ...s,
          value: fetching ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20" /> : s.value,
        }))}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <TabBar<ReviewStatus>
          tabs={[
            { id: 'under_review', label: 'Awaiting Review', count: counts.pending },
            { id: 'live', label: 'Approved', count: counts.live },
            { id: 'draft', label: 'Returned', count: counts.returned },
            { id: 'ALL', label: 'All', count: counts.total },
          ]}
          active={status}
          onChange={setStatus}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" className="md:ml-auto md:w-72" />
      </div>

      {/* Table */}
      <SectionCard noHeader bodyClassName="">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={TH_CLASS}>Project</th>
                <th className={TH_CLASS}>Developer</th>
                <th className={TH_CLASS}>Stage</th>
                <th className={TH_CLASS}>Capital</th>
                <th className={TH_CLASS}>Score</th>
                <th className={TH_CLASS}>Status</th>
                <th className={cn(TH_CLASS, 'w-16')} />
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={7} className="px-[22px] py-12 text-center">
                    <Icons.spinner className="mx-auto size-5 animate-spin text-ink-3/50" />
                    <p className="mt-2 text-[13px] font-semibold text-ink-3">Loading review queue…</p>
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon="folder" title="No projects found" sub="Try a different filter or search term." />
                  </td>
                </tr>
              ) : (
                projects.map(project => {
                  const score = project.scores?.capital_readiness_score ?? 0;
                  return (
                    <tr key={project.id} className="transition-colors hover:bg-surface-2">
                      <td className={TD_CLASS}>
                        <p className="max-w-[240px] truncate text-[13.5px] font-semibold text-ink">{project.name}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{project.technology_type} · {project.project_size_mw ?? '—'} MW</p>
                      </td>
                      <td className={TD_CLASS}>
                        <p className="text-[13px] text-ink-2">{project.developer?.name || '—'}</p>
                      </td>
                      <td className={TD_CLASS}>
                        <span className="text-xs font-semibold capitalize text-ink-2">{(project.project_stage || 'concept').replace(/_/g, ' ')}</span>
                      </td>
                      <td className={TD_CLASS}>
                        <span className="text-[13px] font-semibold text-ink">{money(project.capital_required)}</span>
                      </td>
                      <td className={TD_CLASS}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={cn('h-full rounded-full', score >= 70 ? 'bg-brand' : score >= 40 ? 'bg-amber-500' : score > 0 ? 'bg-red-500' : 'bg-line-strong')}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-ink-2">{score}%</span>
                        </div>
                      </td>
                      <td className={TD_CLASS}>
                        <StatusPill status={project.status} />
                      </td>
                      <td className={TD_CLASS}>
                        <Link
                          href={`/authority/projects/${project.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-text transition-colors hover:underline"
                        >
                          Review <Icons.chevronRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  );
}
