'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { engagementService } from '@/lib/engagement';
import { matchingApi } from '@/services/api';
import { Project, Engagement } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { cn } from '@/lib/utils';
import { getStateLabel } from '@/lib/engagement';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { Drawer } from '@/components/ui/drawer';
import { DataRoomTab } from '@/components/investor/DataRoomTab';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

export default function DeveloperDashboardPage() {
  return <DeveloperDashboard />;
}

function DeveloperDashboard() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'dashboard') === 'engagements' ? 'messages' : searchParams.get('tab') || 'dashboard';
  const { unreadByEngagement } = useUnreadMessages();
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  const [techMatches, setTechMatches] = useState<any[]>([]);
  const [capMatches, setCapMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [pendingReviewProjects, setPendingReviewProjects] = useState<Project[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);

  const router = useRouter();
  const { user, loading } = useAuth();

  const setActiveTab = useCallback((tab: string) => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    router.push(newUrl);
  }, [router]);

  useEffect(() => {
    async function fetchData() {
      if (!user?.company_id) {
        setLoadingProjects(false);
        setLoadingEngagements(false);
        setLoadingPending(false);
        return;
      }
      try {
        const [projData, engData, pendingData] = await Promise.all([
          projectService.getDeveloperProjects(user.company_id),
          engagementService.getCompanyEngagements(user.company_id),
          projectService.getPendingInternalReview().catch(() => []),
        ]);
        setProjects(projData);
        setEngagements(engData);
        setPendingReviewProjects(pendingData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoadingProjects(false);
        setLoadingEngagements(false);
        setLoadingPending(false);
      }
    }
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    async function fetchAllMatches() {
      if (projects.length > 0) {
        setLoadingMatches(true);
        try {
          const response = await matchingApi.getProjectMatches(projects[0].id);
          setTechMatches(response.data?.technical || []);
          setCapMatches(response.data?.capital || []);
        } catch (error) {
          console.error('Error fetching matches:', error);
        } finally {
          setLoadingMatches(false);
        }
      }
    }
    if (activeTab === 'find-partners' && projects.length > 0) fetchAllMatches();
  }, [activeTab, projects]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LeafLoader size={100} />
      </div>
    );
  }

  if (!user.company_id) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-slate-600 font-medium">Your account is not linked to a company yet.</p>
          <Link href="/onboarding">
            <Button className="h-9 px-6 rounded-xl">Complete Onboarding</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalCapital = projects.reduce((acc, p) => acc + (p.capital_required || 0), 0);
  const avgReadiness = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length)
    : 0;
  const totalCapacity = projects.reduce((acc, p) => acc + p.project_size_mw, 0);
  const totalDocs = projects.reduce((acc, p) => acc + (p.documents?.length ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* ── Welcome Section ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="dash-section-label mb-1">Developer Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight truncate">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Here's what's happening with your portfolio.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button variant="outline" className="h-9 px-4 rounded-xl" icon={<Icons.download />} onClick={() => window.print()}>
            Export
          </Button>
          <Link href="/dashboard/developer/submit">
            <Button className="h-9 px-4 rounded-xl" icon={<Icons.plus />}>
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────── */}
      {loadingProjects ? (
        <KpiBarSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Projects" value={projects.length.toString()} trend={projects.length > 0 ? { label: 'Active in portfolio' } : undefined} icon={Icons.folder} />
          <StatCard label="Capital Required" value={`$${(totalCapital / 1000000).toFixed(1)}M`} trend={{ label: 'Across all stages' }} icon={Icons.dollarSign} />
          <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In milestone room' }} icon={Icons.messageSquare} />
          <StatCard label="Avg. Readiness" value={projects.length > 0 ? `${avgReadiness}/100` : 'N/A'} trend={{ label: 'Institutional grade' }} icon={Icons.shieldCheck} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'dashboard' && (
            <>
              <div className="flex items-center justify-between mb-2 px-2">
                <div>
                  <p className="dash-section-label mb-0.5">Active Pipeline</p>
                  <h3 className="text-sm font-semibold text-slate-900">Priority Projects</h3>
                </div>
                <button onClick={() => setActiveTab('projects')} className="text-[11px] font-bold  tracking-[0.1em] text-primary hover:underline shrink-0">View All</button>
              </div>
              {loadingProjects ? (
                <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                  <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                  <p className="text-sm font-bold text-text-muted">Loading projects...</p>
                </div>
              ) : projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.slice(0, 3).map((project) => (
                    <ProjectCard key={project.id} id={project.id} name={project.name}
                      capacity={`${project.project_size_mw} MW`}
                      location={`${project.location_country}${project.location_region ? `, ${project.location_region}` : ''}`}
                      capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                      stage={project.project_stage} score={project.scores?.capital_readiness_score || 0} />
                  ))}
                </div>
              ) : (
                <EmptyState icon="folder" title="No Projects Found" description="You haven't registered any infrastructure projects yet. Get started by creating your first one." actionLabel="Create Project" actionHref="/dashboard/developer/submit" />
              )}
            </>
          )}

          {activeTab === 'projects' && (
            <>
              <div className="flex items-center justify-between mb-2 px-2">
                <h2 className="text-lg font-bold text-text-main">Project Portfolio</h2>
                <span className="text-xs font-bold  tracking-widest text-text-muted shrink-0">{projects.length} Total</span>
              </div>
              {loadingProjects ? (
                <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                  <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                  <p className="text-sm font-bold text-text-muted">Loading projects...</p>
                </div>
              ) : projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} id={project.id} name={project.name}
                      capacity={`${project.project_size_mw} MW`}
                      location={`${project.location_country}${project.location_region ? `, ${project.location_region}` : ''}`}
                      capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                      stage={project.project_stage} score={project.scores?.capital_readiness_score || 0}
                      showDelete onDelete={async () => {
                        if (confirm('Are you sure you want to delete this project?')) {
                          try { await projectService.deleteProject(project.id); setProjects(projects.filter(p => p.id !== project.id)); } catch { alert('Failed to delete project'); }
                        }
                      }} />
                  ))}
                </div>
              ) : (
                <EmptyState icon="folder" title="No Projects Found" description="You haven't registered any infrastructure projects yet. Get started by creating your first one." actionLabel="Create Project" actionHref="/dashboard/developer/submit" />
              )}
            </>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="min-w-0">
                  <p className="dash-section-label mb-0.5">Portfolio Intelligence</p>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Portfolio Performance</h2>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">Real-time engagement intelligence across all your projects.</p>
                </div>
                <Button className="h-9 px-4 rounded-xl shrink-0" icon={<Icons.download />} onClick={() => window.print()}>
                  Export Report
                </Button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-soft min-w-0">
                  <p className="text-[10px] font-bold text-slate-400  tracking-widest mb-2 truncate">Market Exposure</p>
                  <p className="text-2xl font-extrabold text-slate-900 truncate">${(totalCapital / 1000000).toFixed(0)}M</p>
                </div>
                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-soft min-w-0">
                  <p className="text-[10px] font-bold text-slate-400  tracking-widest mb-2 truncate">Active Interests</p>
                  <p className="text-2xl font-extrabold text-primary truncate">{engagements.length}</p>
                </div>
                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-soft min-w-0">
                  <p className="text-[10px] font-bold text-slate-400  tracking-widest mb-2 truncate">Total Capacity</p>
                  <p className="text-2xl font-extrabold text-slate-900 truncate">{totalCapacity} MW</p>
                </div>
                <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-soft min-w-0">
                  <p className="text-[10px] font-bold text-slate-500  tracking-widest mb-2 truncate">Avg. Readiness</p>
                  <p className="text-2xl font-extrabold text-green-400 truncate">{avgReadiness}%</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-50 flex items-center justify-between gap-3 bg-slate-50/30">
                  <h3 className="text-xs font-bold text-slate-900  tracking-widest truncate">Active Project Intelligence</h3>
                  <span className="text-[10px] font-bold text-slate-400  shrink-0">{projects.length} tracked</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {projects.map((p) => (
                    <div key={p.id} className="p-5 hover:bg-slate-50/50 transition-all group flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="size-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                          <Icons.zap className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 mb-1 truncate">{p.name}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[10px] font-bold text-slate-400  tracking-tight whitespace-nowrap">{p.technology_type} · {p.project_size_mw} MW</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="size-1.5 rounded-full bg-green-500" />
                              <span className="text-[10px] font-bold text-green-600 ">Live</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[9px] font-bold text-slate-400  tracking-widest mb-0.5">Readiness</p>
                          <span className="text-sm font-bold text-primary whitespace-nowrap">{p.scores?.capital_readiness_score || 0}%</span>
                        </div>
                        <Link href={`/projects/${p.id}/analytics`}>
                          <Button variant="ghost" size="icon" className="rounded-lg hover:bg-primary/10 hover:text-primary size-9 transition-all">
                            <Icons.arrowUpRight className="size-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dataroom' && (
            <DataRoomTab projects={projects} loading={loadingProjects} />
          )}

          {activeTab === 'messages' && (
            <MessagesTab
              engagements={engagements}
              loading={loadingEngagements}
              unreadByEngagement={unreadByEngagement}
            />
          )}

          {activeTab === 'inbound' && (
            <InboundInterestTab projects={projects} engagements={engagements} loading={loadingEngagements} />
          )}

          {activeTab === 'find-partners' && (
            <div className="space-y-10">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 mb-2 px-2">
                  <h2 className="text-lg font-bold text-text-main">Institutional Capital Matches</h2>
                  <span className="text-xs font-bold  tracking-widest text-text-muted shrink-0">{capMatches.length} Matches</span>
                </div>
                {loadingMatches ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                    <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-sm font-bold text-text-muted">Analyzing investment criteria...</p>
                  </div>
                ) : capMatches.length > 0 ? (
                  <div className="grid gap-3">
                    {capMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        initials={match.capital_partner?.company?.name?.substring(0, 2).to()}
                        name={match.capital_partner?.company?.name}
                        metaLeft="Verified Fund"
                        metaLeftIcon={<Icons.dollarSign className="size-3.5" />}
                        metaRight={match.capital_partner?.geographic_focus?.join(', ')}
                        metaRightIcon={<Icons.mapPin className="size-3.5" />}
                        score={match.compatibility_score}
                        scoreLabel="Compatibility"
                        avatarClass="bg-blue-50 text-blue-600"
                        scoreClass="text-blue-600"
                        actionLabel="Request Intro"
                        actionClass="bg-blue-600 hover:bg-blue-700 text-white"
                        onAction={async () => {
                          try {
                            const eng = await engagementService.requestIntroduction(projects[0]?.id, match.capital_partner_id, 'CAPITAL');
                            if (eng?.id) router.push(`/dashboard/engagements/${eng.id}`);
                          } catch (err: any) {
                            console.error(err);
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="search" title="No Capital Matches" description="Try improving your project readiness score to attract more institutional investors." actionLabel="View Readiness Report" actionHref={`/projects/${projects[0]?.id}`} />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 mb-2 px-2">
                  <h2 className="text-lg font-bold text-text-main">Qualified Technical Partners</h2>
                  <span className="text-xs font-bold  tracking-widest text-text-muted shrink-0">{techMatches.length} Matches</span>
                </div>
                {loadingMatches ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                    <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-sm font-bold text-text-muted">Analyzing technical requirements...</p>
                  </div>
                ) : techMatches.length > 0 ? (
                  <div className="grid gap-3">
                    {techMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        initials={match.technical_partner?.company?.name?.substring(0, 2).to()}
                        name={match.technical_partner?.company?.name}
                        metaLeft={`${match.technical_partner?.total_mw_delivered} MW Delivered`}
                        metaLeftIcon={<Icons.zap className="size-3.5" />}
                        metaRight="EPC Verified"
                        metaRightIcon={<Icons.checkCircle2 className="size-3.5" />}
                        score={match.compatibility_score}
                        scoreLabel="Match Score"
                        avatarClass="bg-slate-50 text-primary"
                        scoreClass="text-primary"
                        actionLabel="Request Proposal"
                        actionClass="bg-slate-900 hover:bg-slate-800 text-white"
                        onAction={async () => {
                          try {
                            const eng = await engagementService.requestIntroduction(projects[0]?.id, match.technical_partner_id, 'TECHNICAL');
                            if (eng?.id) router.push(`/dashboard/engagements/${eng.id}`);
                          } catch (err: any) {
                            console.error(err);
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="settings" title="No Technical Partners Found" description="We couldn't find any technical partners matching your project requirements." actionLabel="Adjust Requirements" actionHref={`/projects/${projects[0]?.id}`} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-primary text-white shadow-soft relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-5">
                <Icons.shieldCheck className="size-5 text-white shrink-0" />
                <h3 className="text-base font-bold">Data Room Security</h3>
              </div>
              <p className="text-sm font-medium text-white/90 mb-5 leading-relaxed">Your project documents are protected by institutional-grade encryption and access control.</p>
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold  tracking-widest bg-white/10 border border-white/10 p-3.5 rounded-xl">
                <span className="truncate">Total Documents</span>
                <span className="size-6 rounded-full bg-white text-primary flex items-center justify-center font-bold shrink-0">{totalDocs}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Review Drawer ──────────────────────────────── */}
      <Drawer
        open={reviewDrawerOpen}
        onClose={() => setReviewDrawerOpen(false)}
        title="Pending Internal Review"
        description={`${pendingReviewProjects.length} project${pendingReviewProjects.length !== 1 ? 's' : ''} awaiting your review`}
        size="xl"
      >
        {loadingPending ? (
          <div className="p-12 text-center">
            <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-sm font-bold text-slate-500">Loading projects...</p>
          </div>
        ) : pendingReviewProjects.length > 0 ? (
          <div className="space-y-3">
            {pendingReviewProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}?review=1`}
                onClick={() => setReviewDrawerOpen(false)}
                className="block p-4 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <Icons.eye className="size-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{project.name}</h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400  whitespace-nowrap">{project.project_size_mw} MW</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] font-bold text-slate-400  truncate">{project.location_country}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] font-bold text-slate-400  whitespace-nowrap">{project.project_stage?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold text-slate-400  tracking-widest mb-0.5">Capital</p>
                      <p className="text-sm font-bold text-slate-900 whitespace-nowrap">${(project.capital_required / 1000000).toFixed(1)}M</p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
                      <Icons.chevronRight className="size-4 text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icons.check className="size-7 text-emerald-400" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">All caught up</h4>
            <p className="text-sm text-slate-500 font-medium">No projects pending your internal review.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ── Match card (capital & technical partners) ───────────────────────────────
function MatchCard({
  initials,
  name,
  metaLeft,
  metaLeftIcon,
  metaRight,
  metaRightIcon,
  score,
  scoreLabel,
  avatarClass,
  scoreClass,
  actionLabel,
  actionClass,
  onAction,
}: {
  initials?: string;
  name?: string;
  metaLeft?: string;
  metaLeftIcon: React.ReactNode;
  metaRight?: string;
  metaRightIcon: React.ReactNode;
  score: number;
  scoreLabel: string;
  avatarClass: string;
  scoreClass: string;
  actionLabel: string;
  actionClass: string;
  onAction: () => void;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-soft hover:shadow-md transition-all group">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className={cn('size-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0', avatarClass)}>
            {initials}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-text-main mb-1 truncate">{name}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-text-muted  tracking-wider">
              {metaLeft && (
                <span className="flex items-center gap-1 shrink-0">
                  {metaLeftIcon}
                  {metaLeft}
                </span>
              )}
              {metaRight && (
                <span className="flex items-center gap-1 min-w-0">
                  {metaRightIcon}
                  <span className="truncate">{metaRight}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
          <div className="text-left sm:text-right">
            <p className="text-[9px] font-bold  tracking-widest text-text-muted mb-0.5">{scoreLabel}</p>
            <p className={cn('text-base font-extrabold whitespace-nowrap', scoreClass)}>{score}%</p>
          </div>
          <Button className={cn('h-9 px-4 rounded-xl text-xs font-bold shrink-0', actionClass)} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Status colour map shared by InboundInterestTab ──────────────────────────
const INBOUND_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTRO_SENT:        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  INTRO_ACCEPTED:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-100' },
  NDA_SIGNED:        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-100' },
  DUE_DILIGENCE:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
  TERM_SHEET:        { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-100' },
  CONTRACT_SIGNED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100' },
  CLOSED:            { bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-200' },
  DROPPED:           { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100' },
};

const INITIAL_PROJECT_COUNT = 5;

function InboundInterestTab({
  projects,
  engagements,
  loading,
}: {
  projects: Project[];
  engagements: Engagement[];
  loading: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-100">
        <Icons.spinner className="size-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!projects.length) {
    return (
      <EmptyState
        icon="folder"
        title="No Projects Yet"
        description="Create a project to start receiving interest from capital and technical partners."
        actionLabel="Create Project"
        actionHref="/dashboard/developer/submit"
      />
    );
  }

  const byProject = projects
    .map(project => ({
      project,
      projectEngagements: engagements.filter(e => e.project_id === project.id),
    }))
    .filter(({ projectEngagements }) => projectEngagements.length > 0)
    .sort((a, b) => {
      const aLatest = Math.max(...a.projectEngagements.map(e => new Date(e.updated_at || e.created_at).getTime()));
      const bLatest = Math.max(...b.projectEngagements.map(e => new Date(e.updated_at || e.created_at).getTime()));
      return bLatest - aLatest;
    });

  const visible = showAll ? byProject : byProject.slice(0, INITIAL_PROJECT_COUNT);
  const hasMore = byProject.length > INITIAL_PROJECT_COUNT;

  const totalInterest     = engagements.length;
  const pendingAcceptance = engagements.filter(e => e.status === 'INTRO_SENT').length;
  const inProgress        = engagements.filter(e => !['INTRO_SENT', 'DROPPED', 'CLOSED'].includes(e.status)).length;
  const closedCount       = engagements.filter(e => e.status === 'CLOSED').length;

  const kpis = [
    { label: 'Total Interest',     value: totalInterest,     icon: <Icons.users className="size-4" />,          color: 'text-slate-900', iconBg: 'bg-slate-100' },
    { label: 'Pending Acceptance', value: pendingAcceptance, icon: <Icons.clock className="size-4" />,          color: 'text-blue-600',  iconBg: 'bg-blue-50' },
    { label: 'In Progress',        value: inProgress,        icon: <Icons.clock className="size-4" />,     color: 'text-amber-600', iconBg: 'bg-amber-50' },
    { label: 'Closed Deals',       value: closedCount,       icon: <Icons.checkCircle2 className="size-4" />,   color: 'text-green-600', iconBg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <p className="dash-section-label mb-0.5">Partner Activity</p>
          <h3 className="text-sm font-semibold text-slate-900">Inbound Interest</h3>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon, color, iconBg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 flex items-center gap-3 min-w-0">
            <div className={cn('size-9 rounded-xl flex items-center justify-center shrink-0', iconBg, color)}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className={cn('text-xl font-black leading-none truncate', color)}>{value}</p>
              <p className="text-[9px] font-bold text-slate-400  tracking-widest mt-1 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {byProject.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Icons.users className="size-8 mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700 mb-1">No Interest Yet</h4>
          <p className="text-xs text-slate-400 font-medium">Partners will appear here once they express interest in your projects.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {visible.map(({ project, projectEngagements }) => {
              const activeCount = projectEngagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED').length;
              return (
                <div key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                  {/* Project header */}
                  <div className="p-5 border-b border-slate-50 flex items-center justify-between gap-4 bg-slate-50/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icons.zap className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/projects/${project.id}`} className="text-sm font-bold text-slate-900 hover:text-primary transition-colors truncate block">
                          {project.name}
                        </Link>
                        <p className="text-[10px] font-bold text-slate-400  tracking-widest mt-0.5 truncate">
                          {project.technology_type} · {project.project_size_mw} MW · {project.location_country}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-black text-slate-400  tracking-widest hidden sm:inline whitespace-nowrap">
                        {projectEngagements.length} interested
                      </span>
                      {activeCount > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black  tracking-wider whitespace-nowrap">
                          {activeCount} active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Engagement rows */}
                  <div className="divide-y divide-slate-50">
                    {projectEngagements.map(eng => {
                      const c = INBOUND_STATUS_COLORS[eng.status] ?? INBOUND_STATUS_COLORS.INTRO_SENT;
                      return (
                        <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                          <div className="p-4 hover:bg-slate-50/60 transition-colors cursor-pointer flex items-center gap-4 group">
                            <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-base">
                              {eng.counterparty_type === 'CAPITAL' ? '💰' : '🔧'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold text-slate-700  tracking-widest shrink-0">
                                  {eng.counterparty_type === 'CAPITAL' ? 'Capital Partner' : 'Technical Partner'}
                                </span>
                                <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black  tracking-wider border shrink-0', c.bg, c.text, c.border)}>
                                  {getStateLabel(eng.status)}
                                </span>
                                {eng.status === 'INTRO_SENT' && (
                                  <span className="size-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-slate-400  tracking-widest">
                                Updated {new Date(eng.updated_at || eng.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {eng.status === 'INTRO_SENT' && (
                                <span className="hidden sm:inline-block px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black  tracking-wider border border-blue-100 whitespace-nowrap">
                                  Action Required
                                </span>
                              )}
                              <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setShowAll(!showAll)}
                className="h-9 px-5 rounded-xl text-[11px] font-bold  tracking-[0.1em] text-primary border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                {showAll ? 'Show Less' : `View More (${byProject.length - INITIAL_PROJECT_COUNT})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({
  id,
  name,
  capacity,
  location,
  capital,
  stage,
  score,
  showDelete,
  onDelete,
}: {
  id: string;
  name: string;
  capacity: string;
  location: string;
  capital: string;
  stage: string;
  score: number;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@placeholder.com';
  const scoreLow = score > 0 && score < 40;

  return (
    <div className="p-5 rounded-2xl bg-surface border border-gray-100 shadow-soft hover:shadow-md transition-all group">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Identity */}
        <div className="flex gap-3 min-w-0 lg:flex-1">
          <div className="size-11 rounded-xl bg-background flex items-center justify-center text-primary border border-gray-100 shrink-0">
            <Icons.zap className="size-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-text-main mb-1 group-hover:text-primary transition-colors truncate">
              {name}
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-text-muted  tracking-wider">
              <span className="flex items-center gap-1 shrink-0">
                <Icons.zap className="size-3" />
                {capacity}
              </span>
              <span className="flex items-center gap-1 min-w-0">
                <Icons.mapPin className="size-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
              {stage && (
                <span className="px-1.5 py-0.5 rounded bg-background text-[9px] font-black tracking-wider shrink-0">
                  {stage.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats + actions */}
        <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0">
          <div className="text-left lg:text-right">
            <p className="text-[9px] font-bold text-text-muted  tracking-wider mb-1">
              Capital Required
            </p>
            <p className="text-sm font-bold text-text-main whitespace-nowrap">{capital}</p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-[9px] font-bold text-text-muted  tracking-wider mb-1">
              Score
            </p>
            <div className="flex items-center gap-2">
              <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden shrink-0">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    scoreLow ? "bg-error" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-sm font-bold whitespace-nowrap",
                  scoreLow ? "text-error" : "text-primary"
                )}
              >
                {score}%
              </span>
            </div>
            {scoreLow && (
              <a
                href={`mailto:${supportEmail}`}
                className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-error/80 hover:text-error transition-colors"
              >
                <Icons.alertTriangle className="size-2.5" />
                Needs improvement
              </a>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {showDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="rounded-lg hover:bg-error/10 hover:text-error size-9"
              >
                <Icons.trash className="size-4" />
              </Button>
            )}
            <Link href={`/projects/${id}`}>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-lg hover:bg-primary/10 hover:text-primary size-9"
              >
                <Icons.chevronRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const ENGAGEMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INTRO_SENT:        { label: 'Intro Sent',     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  INTRO_ACCEPTED:    { label: 'Accepted',        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  NDA_SIGNED:        { label: 'NDA Signed',      color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
  DUE_DILIGENCE:     { label: 'Due Diligence',   color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  TERM_SHEET:        { label: 'Term Sheet',      color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
  CONTRACT_SIGNED:   { label: 'Contract Signed', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { label: 'Committed',       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CLOSED:            { label: 'Closed',          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  DROPPED:           { label: 'Dropped',         color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
};

const INITIAL_MESSAGE_COUNT = 5;

function MessagesTab({ engagements, loading, unreadByEngagement }: { engagements: Engagement[]; loading: boolean; unreadByEngagement?: Record<string, number> }) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...engagements].sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  );

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_MESSAGE_COUNT);
  const hasMore = sorted.length > INITIAL_MESSAGE_COUNT;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2 px-2">
          <h2 className="text-lg font-bold text-text-main">Engagement Inbox</h2>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
          <div className="p-12 text-center">
            <Icons.spinner className="size-6 animate-spin mx-auto text-primary mb-3" />
            <p className="text-xs font-bold text-text-muted  tracking-widest">Loading engagements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <p className="dash-section-label mb-0.5">Engagement Inbox</p>
          <h3 className="text-sm font-semibold text-slate-900">Recent Messages</h3>
        </div>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] font-bold  tracking-[0.1em] text-primary hover:underline shrink-0"
          >
            {showAll ? 'Show Less' : `View All (${sorted.length})`}
          </button>
        )}
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-3">
          {visible.map((eng) => {
            const st = ENGAGEMENT_STATUS_CONFIG[eng.status] || ENGAGEMENT_STATUS_CONFIG.INTRO_SENT;
            const isNew = eng.status === 'INTRO_SENT';
            const unread = unreadByEngagement?.[eng.id] ?? 0;
         const date = new Date(eng.updated_at || eng.created_at);
const now = new Date();

// Compare calendar dates, not raw elapsed hours, so a date from
// "yesterday at 11:58pm" doesn't get treated as "today" just because
// less than 24 hours have technically passed.
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = Math.round(
  (startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24)
);

const timeLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;
            return (
              <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                <div className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group",
                  "bg-white border-gray-100 shadow-soft hover:shadow-md hover:border-primary/20",
                  isNew && "ring-1 ring-primary/10 bg-primary/[0.02] my-2"
                )}>
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={cn(
                      "size-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                      isNew
                        ? "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white"
                        : "bg-gray-50 text-text-muted border-gray-100 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20"
                    )}>
                      <Icons.messageSquare className="size-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1">
                        <h4 className="text-sm font-bold text-text-main truncate group-hover:text-primary transition-colors flex items-center gap-2">
                          {eng.project?.name || 'Project'}
                          {unread > 0 && (
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold  tracking-wider border whitespace-nowrap",
                            st.bg, st.color, st.border
                          )}>
                            <span className="size-1 rounded-full bg-current" />
                            {st.label}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted  tracking-widest whitespace-nowrap">{timeLabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted font-medium">
                        <span className="truncate">{eng.counterparty_type === 'CAPITAL' ? 'Capital Partner' : 'Technical Partner'}</span>
                        <span className="text-slate-300 shrink-0">·</span>
                        <span className="shrink-0">{new Date(eng.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <Icons.chevronRight className="size-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icons.messageSquare className="size-6 text-slate-300" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 mb-1">No Engagements Yet</h4>
          <p className="text-xs text-slate-400 font-medium">Your engagement conversations will appear here.</p>
        </div>
      )}
    </div>
  );
}
