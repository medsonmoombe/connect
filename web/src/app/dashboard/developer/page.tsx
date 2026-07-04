'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { engagementService } from '@/lib/engagement';
import { matchingApi, companiesApi } from '@/services/api';
import { Project, Engagement, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getStateLabel } from '@/lib/engagement';
import { EmptyState } from '@/components/ui/empty-state';

export default function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  const [techMatches, setTechMatches] = useState<any[]>([]);
  const [capMatches, setCapMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: '',
    description: '',
    years_operating: 0,
    annual_turnover: 0,
    subsidiaries: '',
    solar_construction_experience: '',
    operations_experience: ''
  });

  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (user?.company_id) {
        try {
          const [projData, engData, companyData] = await Promise.all([
            projectService.getDeveloperProjects(user.company_id),
            engagementService.getCompanyEngagements(user.company_id),
            companiesApi.getById(user.company_id)
          ]);
          setProjects(projData);
          setEngagements(engData);
          if (companyData.data) {
            setCompany(companyData.data);
            const metadata = (companyData.data as any).metadata || {};
            setProfileData({
              name: companyData.data.name || '',
              description: companyData.data.description || '',
              years_operating: companyData.data.years_operating || 0,
              annual_turnover: metadata.annual_turnover || 0,
              subsidiaries: metadata.subsidiaries || '',
              solar_construction_experience: metadata.solar_construction_experience || '',
              operations_experience: metadata.operations_experience || ''
            });
          }
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          setLoadingProjects(false);
          setLoadingEngagements(false);
        }
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user?.company_id) return;
    setUpdatingProfile(true);
    try {
      await companiesApi.update(user.company_id, {
        name: profileData.name,
        description: profileData.description,
        years_operating: profileData.years_operating,
        metadata: {
          annual_turnover: profileData.annual_turnover,
          subsidiaries: profileData.subsidiaries,
          solar_construction_experience: profileData.solar_construction_experience,
          operations_experience: profileData.operations_experience
        }
      } as any);
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  useEffect(() => {
    async function fetchAllMatches() {
      if (projects.length > 0) {
        setLoadingMatches(true);
        try {
          // Fetch matches for the first project as a default or all
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

    if (activeTab === 'find-partners' && projects.length > 0) {
      fetchAllMatches();
    }
  }, [activeTab, projects]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-surface border-r border-gray-100 flex flex-col h-full z-20">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 text-primary">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-xl font-bold tracking-tight text-text-main leading-none">Afri Connect</span>
          </Link>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-13">Developer Portal</p>
        </div>

        <nav className="flex-grow px-4 space-y-2">
          <SidebarItem 
            icon={<Icons.layoutDashboard className="size-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem 
            icon={<Icons.folder className="size-5" />} 
            label="My Projects" 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')}
          />
          <SidebarItem 
            icon={<Icons.shieldCheck className="size-5" />} 
            label="Data Room" 
            active={activeTab === 'dataroom'} 
            onClick={() => setActiveTab('dataroom')}
          />
          <SidebarItem 
            icon={<Icons.messageSquare className="size-5" />} 
            label="Messages" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')}
            badge={3}
          />
          <SidebarItem 
            icon={<Icons.pieChart className="size-5" />} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
          />
          <SidebarItem 
            icon={<Icons.settings className="size-5" />} 
            label="Find Partners" 
            active={activeTab === 'find-partners'} 
            onClick={() => setActiveTab('find-partners')}
          />
          <SidebarItem 
            icon={<Icons.user className="size-5" />} 
            label="Developer Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-4 rounded-2xl bg-background border border-gray-100 mb-6">
            <p className="text-meta mb-3">System Status</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-main">AI Scoring</span>
              <span className="text-[10px] font-bold text-primary uppercase">Active</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[85%]" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-gray-100 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="User" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-text-main leading-none">{user?.full_name || 'Developer'}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-slate-800"
              title="Logout"
            >
              <Icons.logOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto min-h-screen pb-20">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">Overview</h1>
              <p className="text-text-muted font-medium">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}. Here's what's happening with your portfolio.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-12 px-6 rounded-xl border-gray-200 font-bold text-text-main hover:bg-gray-50"
                onClick={() => {
                  window.print();
                }}
              >
                <Icons.download className="size-4 mr-2" />
                Generate Report
              </Button>
              <Link href="/dashboard/developer/submit">
                <Button className="h-12 px-6 bg-text-main text-white hover:bg-text-main/90 font-bold rounded-xl shadow-lg transition-all flex gap-2">
                  <Icons.plus className="size-5" />
                  Create New Project
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard
              label="Total Projects"
              value={projects.length.toString()}
              subValue={projects.length > 0 ? "Active in portfolio" : "No projects yet"}
            />
            <StatCard
              label="Capital Required"
              value={`$${(projects.reduce((acc, p) => acc + (p.capital_required || 0), 0) / 1000000).toFixed(1)}M`}
              subValue="Across all stages"
            />
            <StatCard label="Active Engagements" value={engagements.length.toString()} subValue="In milestone room" />
            <StatCard
              label="Avg. Readiness"
              value={projects.length > 0 ? `${Math.round(projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length)}/100` : "N/A"}
              subValue="Institutional grade"
              progress={projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length) : 0}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Active Projects List */}
            <div className="lg:col-span-2 space-y-6">
              {activeTab === 'dashboard' && (
                <>
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Priority Projects</h2>
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                    >
                      View All Projects
                    </button>
                  </div>
                  
                  {loadingProjects ? (
                    <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100">
                      <Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" />
                      <p className="text-sm font-bold text-text-muted">Loading projects...</p>
                    </div>
                  ) : projects.length > 0 ? (
                    projects.slice(0, 3).map((project) => (
                      <ProjectCard
                        key={project.id}
                        id={project.id}
                        name={project.name}
                        capacity={`${project.project_size_mw} MW`}
                        location={`${project.location_country}${project.location_region ? `, ${project.location_region}` : ''}`}
                        capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                        stage={project.project_stage}
                        score={project.scores?.capital_readiness_score || 0}
                        matches={0}
                      />
                    ))
                  ) : (
                    <EmptyState 
                      icon="folder"
                      title="No Projects Found"
                      description="You haven't registered any infrastructure projects yet. Get started by creating your first one."
                      actionLabel="Create Project"
                      actionHref="/dashboard/developer/submit"
                    />
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
                      <ProjectCard
                        key={project.id}
                        id={project.id}
                        name={project.name}
                        capacity={`${project.project_size_mw} MW`}
                        location={`${project.location_country}${project.location_region ? `, ${project.location_region}` : ''}`}
                        capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                        stage={project.project_stage}
                        score={project.scores?.capital_readiness_score || 0}
                        matches={0}
                        showDelete
                        onDelete={async () => {
                          if (confirm('Are you sure you want to delete this project?')) {
                            try {
                              await projectService.deleteProject(project.id);
                              setProjects(projects.filter(p => p.id !== project.id));
                            } catch (error) {
                              console.error('Error deleting project:', error);
                              alert('Failed to delete project');
                            }
                          }
                        }}
                      />
                    ))
                  ) : (
                    <EmptyState 
                      icon="folder"
                      title="No Projects Found"
                      description="You haven't registered any infrastructure projects yet. Get started by creating your first one."
                      actionLabel="Create Project"
                      actionHref="/dashboard/developer/submit"
                    />
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
                    <Button 
                      className="bg-slate-900 text-white rounded-xl h-12 px-6 font-bold shadow-xl"
                      onClick={() => window.print()}
                    >
                      <Icons.download className="size-4 mr-2" /> Export Portfolio Report
                    </Button>
                  </div>
                  
                  {/* High Level Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Market Exposure</p>
                      <p className="text-3xl font-extrabold text-slate-900">${(projects.reduce((acc, p) => acc + p.capital_required, 0) / 1000000).toFixed(0)}M</p>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Interests</p>
                      <p className="text-3xl font-extrabold text-primary">{engagements.length}</p>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-soft">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Capacity</p>
                      <p className="text-3xl font-extrabold text-slate-900">{projects.reduce((acc, p) => acc + p.project_size_mw, 0)} MW</p>
                    </div>
                    <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Average Readiness</p>
                      <p className="text-3xl font-extrabold text-green-400">
                        {projects.length > 0 ? (projects.reduce((acc, p) => acc + (p.scores?.capital_readiness_score || 0), 0) / projects.length).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      {/* Project Performance List */}
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
                                    <div className="flex items-center gap-1">
                                      <div className="size-1.5 rounded-full bg-green-500" />
                                      <span className="text-[10px] font-bold text-green-600 uppercase">Live</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-12">
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Investor Interest</p>
                                  <div className="flex items-center gap-2 justify-end">
                                    <Icons.user className="size-3 text-primary" />
                                    <span className="text-sm font-bold text-slate-900">{Math.floor(Math.random() * 20) + 5}</span>
                                  </div>
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

                    <div className="space-y-8">
                      {/* Regional Focus */}
                      <div className="p-8 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-8">Regional Portfolio Weight</h3>
                        <div className="space-y-6">
                          {['Zambia', 'Kenya', 'Nigeria'].map((region, i) => (
                            <div key={region} className="space-y-2">
                              <div className="flex justify-between text-[10px] font-bold uppercase">
                                <span className="text-slate-500">{region}</span>
                                <span className="text-slate-900">{[55, 30, 15][i]}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/40 rounded-full" style={{ width: `${[55, 30, 15][i]}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documentation Health */}
                      <div className="p-8 bg-slate-900 text-white rounded-2xl shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[100px]" />
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">Documentation Health</h3>
                        <div className="flex items-center justify-between mb-8">
                          <div className="size-20 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                            <span className="text-xl font-extrabold">82%</span>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-pulse" />
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-extrabold text-white">42/50</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">FILES VERIFIED</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium uppercase tracking-tight">
                          Higher documentation health directly correlates to faster investor matching.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dataroom' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Centralized Data Room</h2>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl border-gray-200"
                      onClick={() => {
                        if (projects.length > 0) {
                          router.push(`/projects/${projects[0].id}`);
                        } else {
                          alert('Please create a project first to access the Data Room.');
                        }
                      }}
                    >
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
                          <p className="text-xs text-text-muted font-medium">3 Secure Agreements</p>
                       </div>
                       <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-soft">
                          <Icons.briefcase className="size-6 text-primary mb-4" />
                          <h4 className="text-sm font-bold text-text-main mb-1 uppercase tracking-widest">Technical</h4>
                          <p className="text-xs text-text-muted font-medium">12 Project Files</p>
                       </div>
                       <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-soft">
                          <Icons.pieChart className="size-6 text-primary mb-4" />
                          <h4 className="text-sm font-bold text-text-main mb-1 uppercase tracking-widest">Financials</h4>
                          <p className="text-xs text-text-muted font-medium">4 Models Verified</p>
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
                            <EngagementItem
                              title={eng.project?.name || 'Project'}
                              description={`Milestone: ${getStateLabel(eng.status)}`}
                              time={new Date(eng.updated_at || eng.created_at).toLocaleDateString()}
                              isNew={eng.status === 'INTRO_SENT'}
                            />
                          </Link>
                        ))
                      ) : (
                        <div className="p-12 text-center text-sm text-text-muted italic">
                          No active engagements yet. Express interest in matches to start.
                        </div>
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
                                <div className="size-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black">
                                  {match.capital_partner?.company?.name?.substring(0, 2).toUpperCase()}
                                </div>
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
                                <Button 
                                  className="h-12 px-8 bg-blue-600 text-white font-bold rounded-2xl"
                                  onClick={() => alert(`Intro request sent to ${match.capital_partner?.company?.name}`)}
                                >
                                  Request Intro
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState 
                        icon="search"
                        title="No Capital Matches"
                        description="Try improving your project readiness score to attract more institutional investors."
                        actionLabel="View Readiness Report"
                        actionHref={`/projects/${projects[0]?.id}`}
                      />
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
                                <div className="size-16 rounded-2xl bg-slate-50 flex items-center justify-center text-primary font-black">
                                  {match.technical_partner?.company?.name?.substring(0, 2).toUpperCase()}
                                </div>
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
                                <Button 
                                  className="h-12 px-8 bg-text-main text-white font-bold rounded-2xl"
                                  onClick={() => {
                                    alert(`Proposal request simulated for ${match.technical_partner?.company?.name}`);
                                  }}
                                >
                                  Request Proposal
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState 
                        icon="settings"
                        title="No Technical Partners Found"
                        description="We couldn't find any technical partners matching your project requirements."
                        actionLabel="Adjust Requirements"
                        actionHref={`/projects/${projects[0]?.id}`}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8 animate-in fade-in duration-700">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Developer Profile</h2>
                    <Button 
                      onClick={handleUpdateProfile} 
                      disabled={updatingProfile}
                      className="bg-primary text-white rounded-xl h-12 px-8 font-bold shadow-lg"
                    >
                      {updatingProfile ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />}
                      Save Profile
                    </Button>
                  </div>

                  <div className="grid gap-8">
                    <div className="p-8 bg-white border border-slate-100 rounded-2xl shadow-soft space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company Name</Label>
                          <Input 
                            value={profileData.name}
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            className="h-12 rounded-xl border-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time in Existence (Years)</Label>
                          <Input 
                            type="number"
                            value={profileData.years_operating}
                            onChange={(e) => setProfileData({ ...profileData, years_operating: parseInt(e.target.value) || 0 })}
                            className="h-12 rounded-xl border-slate-100"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Developer Profile / Description</Label>
                        <textarea 
                          className="w-full h-32 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={profileData.description}
                          onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                          placeholder="Describe your firm's core focus and history..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className={cn(
                            "text-[10px] font-bold uppercase tracking-widest",
                            profileData.years_operating < 1 ? "text-slate-300" : "text-slate-400"
                          )}>
                            Annual Turnover (USD)
                          </Label>
                          <Input 
                            type="number"
                            disabled={profileData.years_operating < 1}
                            value={profileData.annual_turnover}
                            onChange={(e) => setProfileData({ ...profileData, annual_turnover: parseInt(e.target.value) || 0 })}
                            className={cn(
                              "h-12 rounded-xl border-slate-100",
                              profileData.years_operating < 1 && "bg-slate-50 text-slate-400 cursor-not-allowed"
                            )}
                          />
                          {profileData.years_operating < 1 && (
                            <p className="text-[10px] text-amber-600 font-bold">Turnover field disabled for companies less than 1 year in existence.</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Subsidiaries</Label>
                          <Input 
                            value={profileData.subsidiaries}
                            onChange={(e) => setProfileData({ ...profileData, subsidiaries: e.target.value })}
                            placeholder="List main subsidiaries if any..."
                            className="h-12 rounded-xl border-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Solar Project Construction Experience</Label>
                          <textarea 
                            className="w-full h-24 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={profileData.solar_construction_experience}
                            onChange={(e) => setProfileData({ ...profileData, solar_construction_experience: e.target.value })}
                            placeholder="Detail your track record in solar EPC..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Operations Experience</Label>
                          <textarea 
                            className="w-full h-24 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={profileData.operations_experience}
                            onChange={(e) => setProfileData({ ...profileData, operations_experience: e.target.value })}
                            placeholder="Detail your experience in asset management and O&M..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Widgets */}
            <div className="space-y-8">
              <div className="p-8 rounded-2xl bg-surface border border-gray-100 shadow-soft">
                <h3 className="text-lg font-bold text-text-main mb-6">Top Investor Matches</h3>
                <div className="space-y-6">
                  <MatchItem 
                    name="Infrastructure Fund"
                    type="Equity Partner"
                    score={98}
                    tags={["Solar Focus", ">$50M"]}
                  />
                  <MatchItem 
                    name="Sovereign Wealth"
                    type="Institutional"
                    score={85}
                    tags={["Multi-sector", "Zambia"]}
                  />
                  <MatchItem 
                    name="Venture Capital"
                    type="Active Role"
                    score={72}
                    tags={["Wind", "Kenya"]}
                  />
                </div>
                <Button 
                  onClick={() => setActiveTab('projects')}
                  variant="outline" 
                  className="w-full mt-8 h-12 rounded-xl border-gray-200 text-text-main font-bold hover:bg-gray-50"
                >
                  View My Project Matches
                </Button>
              </div>

              {/* Data Room Activity */}
              <div className="p-8 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Icons.shieldCheck className="size-6 text-white" />
                    <h3 className="text-lg font-bold">Data Room Security</h3>
                  </div>
                  <p className="text-sm font-medium text-white/90 mb-6 leading-relaxed">
                    Your project documents are currently protected by institutional-grade encryption and access control.
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest bg-white/10 border border-white/10 p-4 rounded-xl">
                    <span>Pending Requests</span>
                    <span className="size-6 rounded-full bg-white text-primary flex items-center justify-center font-bold shadow-lg">3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-primary/10 text-primary font-bold shadow-sm" 
          : "text-text-muted hover:bg-gray-50 hover:text-text-main font-medium"
      )}
    >
      <div className={cn("transition-colors", active ? "text-primary" : "group-hover:text-primary")}>
        {icon}
      </div>
      <span className="text-sm flex-grow text-left">{label}</span>
      {badge && (
        <span className="size-5 rounded-full bg-primary text-[10px] font-bold text-white border border-white/20 flex items-center justify-center shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, subValue, progress }: { label: string, value: string, subValue: string, progress?: number }) {
  return (
    <div className="p-6 rounded-2xl bg-surface border border-gray-100 shadow-soft">
      <p className="text-meta mb-4">{label}</p>
      <h4 className="text-3xl font-extrabold text-text-main mb-2 tracking-tight">{value}</h4>
      <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{subValue}</p>
      {progress !== undefined && (
        <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ProjectCard({ id, name, capacity, location, capital, stage, score, matches, showDelete, onDelete }: { id: string, name: string, capacity: string, location: string, capital: string, stage: string, score: number, matches: number, showDelete?: boolean, onDelete?: () => void }) {
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
            <p className="text-meta mb-1">Capital Required</p>
            <p className="text-sm font-bold text-text-main">{capital}</p>
          </div>
          <div className="text-right">
            <p className="text-meta mb-1">Score</p>
            <div className="flex items-center gap-2">
              <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${score}%` }} />
              </div>
              <span className="text-sm font-bold text-primary">{score}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="rounded-xl hover:bg-error/10 hover:text-error h-10 w-10"
              >
                <Icons.trash className="size-4" />
              </Button>
            )}
            <Link href={`/projects/${id}`}>
              <Button size="icon" variant="ghost" className="rounded-xl hover:bg-primary/10 hover:text-primary h-10 w-10">
                <Icons.chevronRight className="size-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngagementItem({ title, description, time, isNew }: { title: string, description: string, time: string, isNew?: boolean }) {
  return (
    <div className={cn(
      "p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-6",
      isNew && "bg-primary/5"
    )}>
      <div className={cn(
        "size-10 rounded-xl flex items-center justify-center shrink-0 border border-gray-100",
        isNew ? "bg-white text-primary" : "bg-gray-50 text-text-muted"
      )}>
        <Icons.messageSquare className="size-5" />
      </div>
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-text-main">{title}</h4>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{time}</span>
        </div>
        <p className="text-xs text-text-muted font-medium leading-relaxed max-w-2xl">{description}</p>
      </div>
      {isNew && <div className="size-2 rounded-full bg-primary mt-2"></div>}
    </div>
  );
}

function MatchItem({ name, type, score, tags }: { name: string, type: string, score: number, tags: string[] }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-background border border-gray-100 flex items-center justify-center font-bold text-text-muted text-xs group-hover:border-primary/50 group-hover:text-primary transition-all">
          {name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-text-main leading-tight">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-xs font-bold text-primary">{score}%</div>
        </div>
        <div className="size-8 rounded-full border-2 border-primary/20 flex items-center justify-center p-0.5">
          <div className="size-full rounded-full border-2 border-primary border-t-transparent animate-[spin_3s_linear_infinite]" />
        </div>
      </div>
    </div>
  );
}

