'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function DeveloperDashboardPage() {
  return <DeveloperDashboard />;
}

function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  const [techMatches, setTechMatches] = useState<any[]>([]);
  const [capMatches, setCapMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (user?.company_id) {
        try {
          const [projData, engData] = await Promise.all([
            projectService.getDeveloperProjects(user.company_id),
            engagementService.getCompanyEngagements(user.company_id),
          ]);
          setProjects(projData);
          setEngagements(engData);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          setLoadingProjects(false);
          setLoadingEngagements(false);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Projects" value={projects.length.toString()} trend={projects.length > 0 ? { label: 'Active in portfolio' } : undefined} icon={Icons.folder} />
              <StatCard label="Capital Required" value={`$${(totalCapital / 1000000).toFixed(1)}M`} trend={{ label: 'Across all stages' }} icon={Icons.dollarSign} />
              <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In milestone room' }} icon={Icons.messageSquare} />
              <StatCard label="Avg. Readiness" value={projects.length > 0 ? `${avgReadiness}/100` : 'N/A'} trend={{ label: 'Institutional grade' }} icon={Icons.shieldCheck} />
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
