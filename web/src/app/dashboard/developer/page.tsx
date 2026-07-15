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

export default function DeveloperDashboardPage() {
  return <DeveloperDashboard />;
}

function DeveloperDashboard() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTabState] = useState(initialTab);
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
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (user?.company_id) {
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
    }
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    async function fetchAllMatches() {
      if (projects.length > 0) {
        setLoadingMatches(true);
        try {
          const [tMatches, cMatches] = await Promise.all([
            matchingApi.getTechnicalMatches(projects[0].id),
            matchingApi.getCapitalMatches(projects[0].id)
          ]);
          setTechMatches(tMatches.data || []);
          setCapMatches(cMatches.data || []);
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

  const totalCapital = projects.reduce((acc, p) => acc + (p.capital_required || 0), 0);
  const avgReadiness = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length)
    : 0;
  const totalCapacity = projects.reduce((acc, p) => acc + p.project_size_mw, 0);

  return (
    <div className="space-y-8">
      <>
          {/* ── Welcome Section ──────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="dash-section-label mb-1">Developer Overview</p>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Here's what's happening with your portfolio.
              </p>
            </div>
            <div className="flex gap-2.5">
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
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
              user?.is_org_admin && "lg:grid-cols-5"
            )}>
              <StatCard label="Total Projects" value={projects.length.toString()} trend={projects.length > 0 ? { label: 'Active in portfolio' } : undefined} icon={Icons.folder} />
              <StatCard label="Capital Required" value={`$${(totalCapital / 1000000).toFixed(1)}M`} trend={{ label: 'Across all stages' }} icon={Icons.dollarSign} />
              <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In milestone room' }} icon={Icons.messageSquare} />
              <StatCard label="Avg. Readiness" value={projects.length > 0 ? `${avgReadiness}/100` : 'N/A'} trend={{ label: 'Institutional grade' }} icon={Icons.shieldCheck} />
              {user?.is_org_admin && (
                <button
                  onClick={() => setReviewDrawerOpen(true)}
                  className="dash-card flex flex-col items-start gap-3 p-4 text-left hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="dash-section-label text-amber-600">Pending Review</span>
                    <Icons.eye className="size-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">{pendingReviewProjects.length}</p>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {pendingReviewProjects.length === 0 ? 'All caught up' : `Project${pendingReviewProjects.length !== 1 ? 's' : ''} awaiting review`}
                  </span>
                </button>
              )}
            </div>
          )}
        </>

      <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'dashboard' && (
              <>
                <div className="flex items-center justify-between mb-2 px-2">
                  <div>
                    <p className="dash-section-label mb-0.5">Active Pipeline</p>
                    <h3 className="text-sm font-semibold text-slate-900">Priority Projects</h3>
                  </div>
                  <button onClick={() => setActiveTab('projects')} className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary hover:underline">View All</button>
                </div>
                {loadingProjects ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                    <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-sm font-bold text-text-muted">Loading projects...</p>
                  </div>
                ) : projects.length > 0 ? (
                  projects.slice(0, 3).map((project) => (
                    <ProjectCard key={project.id} id={project.id} name={project.name}
                      capacity={`${project.project_size_mw} MW`}
                      location={`${project.location_country}${project.location_region ? `, ${project.location_region}` : ''}`}
                      capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                      stage={project.project_stage} score={project.scores?.capital_readiness_score || 0} />
                  ))
                ) : (
                  <EmptyState icon="folder" title="No Projects Found" description="You haven't registered any infrastructure projects yet. Get started by creating your first one." actionLabel="Create Project" actionHref="/dashboard/developer/submit" />
                )}
              </>
            )}

            {activeTab === 'projects' && (
              <>
                <div className="flex items-center justify-between mb-2 px-2">
                  <h2 className="text-xl font-bold text-text-main">Project Portfolio</h2>
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{projects.length} Total</span>
                </div>
                {loadingProjects ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                    <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-sm font-bold text-text-muted">Loading projects...</p>
                  </div>
                ) : projects.length > 0 ? (
                  projects.map((project) => (
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
                  ))
                ) : (
                  <EmptyState icon="folder" title="No Projects Found" description="You haven't registered any infrastructure projects yet. Get started by creating your first one." actionLabel="Create Project" actionHref="/dashboard/developer/submit" />
                )}
              </>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Portfolio Performance</h2>
                    <p className="text-slate-500 font-medium">Real-time engagement intelligence across all your projects.</p>
                  </div>
                  <Button className="bg-slate-900 text-white rounded-xl h-12 px-6 font-bold shadow-xl" onClick={() => window.print()}>
                    <Icons.download className="size-4 mr-2" /> Export Portfolio Report
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Market Exposure</p>
                    <p className="text-3xl font-extrabold text-slate-900">${(totalCapital / 1000000).toFixed(0)}M</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Interests</p>
                    <p className="text-3xl font-extrabold text-primary">{engagements.length}</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Capacity</p>
                    <p className="text-3xl font-extrabold text-slate-900">{totalCapacity} MW</p>
                  </div>
                  <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Average Readiness</p>
                    <p className="text-3xl font-extrabold text-green-400">{avgReadiness}%</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Active Project Intelligence</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{projects.length} PROJECTS TRACKED</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {projects.map((p) => (
                      <div key={p.id} className="p-8 hover:bg-slate-50/50 transition-all group flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="size-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                            <Icons.zap className="size-6" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h4>
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{p.technology_type} • {p.project_size_mw} MW</span>
                              <div className="flex items-center gap-1"><div className="size-1.5 rounded-full bg-green-500" /><span className="text-[10px] font-bold text-green-600 uppercase">Live</span></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-12">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Readiness</p>
                            <span className="text-sm font-bold text-primary">{p.scores?.capital_readiness_score || 0}%</span>
                          </div>
                          <Link href={`/projects/${p.id}/analytics`}>
                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary h-12 w-12 transition-all">
                              <Icons.arrowUpRight className="size-6" />
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
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-2 px-2">
                  <h2 className="text-xl font-bold text-text-main">Centralized Data Room</h2>
                  <Button variant="outline" size="sm" className="rounded-xl border-gray-200" onClick={() => { if (projects.length > 0) router.push(`/projects/${projects[0].id}`); else alert('Please create a project first to access the Data Room.'); }}>
                    <Icons.plus className="size-4 mr-2" /> Upload Document
                  </Button>
                </div>
                <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-gray-200">
                  <div className="size-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                    <Icons.shieldCheck className="size-8" />
                  </div>
                  <h3 className="text-xl font-bold text-text-main mb-2">Secure Repository</h3>
                  <p className="text-sm text-text-muted mb-8 max-w-md mx-auto">Manage all your project documents, NDAs, and technical studies in one institutional-grade secure environment.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-soft">
                      <Icons.fileText className="size-6 text-primary mb-4" />
                      <h4 className="text-sm font-bold text-text-main mb-1 uppercase tracking-widest">Active NDAs</h4>
                      <p className="text-xs text-text-muted font-medium">Manage signed agreements</p>
                    </div>
                    <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-soft">
                      <Icons.briefcase className="size-6 text-primary mb-4" />
                      <h4 className="text-sm font-bold text-text-main mb-1 uppercase tracking-widest">Technical</h4>
                      <p className="text-xs text-text-muted font-medium">Upload project files</p>
                    </div>
                    <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-soft">
                      <Icons.pieChart className="size-6 text-primary mb-4" />
                      <h4 className="text-sm font-bold text-text-main mb-1 uppercase tracking-widest">Financials</h4>
                      <p className="text-xs text-text-muted font-medium">Financial models</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-2 px-2">
                  <h2 className="text-xl font-bold text-text-main">Engagement Inbox</h2>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{engagements.length} Active Engagements</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {loadingEngagements ? (
                      <div className="p-8 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-primary" /></div>
                    ) : engagements.length > 0 ? (
                      engagements.map((eng) => (
                        <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                          <div className={cn("p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-6", eng.status === 'INTRO_SENT' && "bg-primary/5")}>
                            <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-100", eng.status === 'INTRO_SENT' ? "bg-white text-primary" : "bg-gray-50 text-text-muted")}>
                              <Icons.messageSquare className="size-5" />
                            </div>
                            <div className="flex-grow">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-bold text-text-main">{eng.project?.name || 'Project'}</h4>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{new Date(eng.updated_at || eng.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-xs text-text-muted font-medium leading-relaxed max-w-2xl">Milestone: {getStateLabel(eng.status)}</p>
                            </div>
                            {eng.status === 'INTRO_SENT' && <div className="size-2 rounded-full bg-primary mt-2" />}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="p-12 text-center text-sm text-text-muted italic">No active engagements yet. Express interest in matches to start.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'find-partners' && (
              <div className="space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Institutional Capital Matches</h2>
                    <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{capMatches.length} Matches</span>
                  </div>
                  {loadingMatches ? (
                    <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                      <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                      <p className="text-sm font-bold text-text-muted">Analyzing investment criteria...</p>
                    </div>
                  ) : capMatches.length > 0 ? (
                    <div className="grid gap-6">
                      {capMatches.map((match) => (
                        <div key={match.id} className="p-8 rounded-2xl bg-white border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex gap-5">
                              <div className="size-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black">{match.capital_partner?.company?.name?.substring(0, 2).toUpperCase()}</div>
                              <div>
                                <h4 className="text-xl font-bold text-text-main mb-1">{match.capital_partner?.company?.name}</h4>
                                <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><Icons.dollarSign className="size-3.5" />Verified Fund</span>
                                  <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3.5" />{match.capital_partner?.geographic_focus?.join(', ')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-10">
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Compatibility</p>
                                <p className="text-xl font-extrabold text-blue-600">{match.compatibility_score}%</p>
                              </div>
                              <Button className="h-12 px-8 bg-blue-600 text-white font-bold rounded-2xl" onClick={() => alert(`Intro request sent to ${match.capital_partner?.company?.name}`)}>Request Intro</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="search" title="No Capital Matches" description="Try improving your project readiness score to attract more institutional investors." actionLabel="View Readiness Report" actionHref={`/projects/${projects[0]?.id}`} />
                  )}
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Qualified Technical Partners</h2>
                    <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{techMatches.length} Matches</span>
                  </div>
                  {loadingMatches ? (
                    <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                      <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                      <p className="text-sm font-bold text-text-muted">Analyzing technical requirements...</p>
                    </div>
                  ) : techMatches.length > 0 ? (
                    <div className="grid gap-6">
                      {techMatches.map((match) => (
                        <div key={match.id} className="p-8 rounded-2xl bg-white border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex gap-5">
                              <div className="size-16 rounded-2xl bg-slate-50 flex items-center justify-center text-primary font-black">{match.technical_partner?.company?.name?.substring(0, 2).toUpperCase()}</div>
                              <div>
                                <h4 className="text-xl font-bold text-text-main mb-1">{match.technical_partner?.company?.name}</h4>
                                <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><Icons.zap className="size-3.5" />{match.technical_partner?.total_mw_delivered} MW Delivered</span>
                                  <span className="flex items-center gap-1.5"><Icons.checkCircle2 className="size-3.5" />EPC Verified</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-10">
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Match Score</p>
                                <p className="text-xl font-extrabold text-primary">{match.compatibility_score}%</p>
                              </div>
                              <Button className="h-12 px-8 bg-text-main text-white font-bold rounded-2xl" onClick={() => alert(`Proposal request simulated for ${match.technical_partner?.company?.name}`)}>Request Proposal</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="settings" title="No Technical Partners Found" description="We couldn't find any technical partners matching your project requirements." actionLabel="Adjust Requirements" actionHref={`/projects/${projects[0]?.id}`} />
                  )}
                </div>
              </div>
            )}


           </div>

           <div className="space-y-8">
            <div className="p-8 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Icons.shieldCheck className="size-6 text-white" />
                  <h3 className="text-lg font-bold">Data Room Security</h3>
                </div>
                <p className="text-sm font-medium text-white/90 mb-6 leading-relaxed">Your project documents are protected by institutional-grade encryption and access control.</p>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest bg-white/10 border border-white/10 p-4 rounded-xl">
                  <span>Pending Requests</span>
                  <span className="size-6 rounded-full bg-white text-primary flex items-center justify-center font-bold shadow-lg">3</span>
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{project.project_size_mw} MW</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{project.location_country}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{project.project_stage?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Capital</p>
                      <p className="text-sm font-bold text-slate-900">${(project.capital_required / 1000000).toFixed(1)}M</p>
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

function ProjectCard({ id, name, capacity, location, capital, stage, score, showDelete, onDelete }: { id: string, name: string, capacity: string, location: string, capital: string, stage: string, score: number, showDelete?: boolean, onDelete?: () => void }) {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex gap-4">
          <div className="size-14 rounded-2xl bg-background flex flex-col items-center justify-center text-primary border border-gray-100">
            <Icons.zap className="size-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{name}</h4>
            <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-wider">
              <span className="flex items-center gap-1"><Icons.zap className="size-3" />{capacity}</span>
              <span className="flex items-center gap-1"><Icons.mapPin className="size-3" />{location}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Capital Required</p>
            <p className="text-sm font-bold text-text-main">{capital}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Score</p>
            <div className="flex items-center gap-2">
              <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden"><div className="bg-primary h-full" style={{ width: `${score}%` }} /></div>
              <span className="text-sm font-bold text-primary">{score}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showDelete && <Button size="icon" variant="ghost" onClick={onDelete} className="rounded-xl hover:bg-error/10 hover:text-error h-10 w-10"><Icons.trash className="size-4" /></Button>}
            <Link href={`/projects/${id}`}>
              <Button size="icon" variant="ghost" className="rounded-xl hover:bg-primary/10 hover:text-primary h-10 w-10"><Icons.chevronRight className="size-5" /></Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
