'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export default function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'DEVELOPER' && user.role !== 'ADMIN') {
        // Redirect if not developer or admin
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchProjects() {
      if (user?.company_id) {
        try {
          const data = await projectService.getDeveloperProjects(user.company_id);
          setProjects(data);
        } catch (error) {
          console.error('Error fetching projects:', error);
        } finally {
          setLoadingProjects(false);
        }
      }
    }

    if (user) {
      fetchProjects();
    }
  }, [user]);

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
            <StatCard label="Active Matches" value="0" subValue="Matches pending" />
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
                    <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-gray-200">
                      <div className="size-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <Icons.folder className="size-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-main mb-2">No Projects Found</h3>
                      <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">You haven't registered any infrastructure projects yet. Get started by creating your first one.</p>
                      <Link href="/dashboard/developer/submit">
                        <Button className="bg-primary text-primary-content font-bold rounded-xl px-6">
                          Create Project
                        </Button>
                      </Link>
                    </div>
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
                    <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-gray-200">
                      <div className="size-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <Icons.folder className="size-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-main mb-2">No Projects Found</h3>
                      <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">You haven't registered any infrastructure projects yet. Get started by creating your first one.</p>
                      <Link href="/dashboard/developer/submit">
                        <Button className="bg-primary text-primary-content font-bold rounded-xl px-6">
                          Create Project
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Portfolio Analytics</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-soft">
                      <h3 className="text-sm font-bold text-text-main uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Icons.zap className="size-4 text-primary" />
                        Capacity Distribution (MW)
                      </h3>
                      <div className="h-64 flex items-end justify-between gap-4 px-4">
                        {projects.length > 0 ? projects.map((p, i) => (
                          <div key={i} className="flex-grow flex flex-col items-center gap-3">
                            <div
                              className="w-full bg-primary rounded-t-xl transition-all duration-1000"
                              style={{ height: `${Math.max((p.project_size_mw / Math.max(...projects.map(p => p.project_size_mw), 1)) * 100, 10)}%` }}
                            ></div>
                            <span className="text-[10px] font-bold text-text-muted truncate max-w-[60px] uppercase tracking-tighter">{p.name}</span>
                          </div>
                        )) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted italic text-sm">No data</div>
                        )}
                      </div>
                    </div>

                    <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-soft">
                      <h3 className="text-sm font-bold text-text-main uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Icons.dollar className="size-4 text-primary" />
                        Capital Requirements
                      </h3>
                      <div className="space-y-6">
                        {projects.length > 0 ? projects.map((p, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                              <span className="text-text-main truncate max-w-[150px]">{p.name}</span>
                              <span className="text-primary">${(p.capital_required / 1000000).toFixed(1)}M</span>
                            </div>
                            <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/40"
                                style={{ width: `${(p.capital_required / projects.reduce((acc, p) => acc + p.capital_required, 0)) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )) : (
                          <div className="w-full h-24 flex items-center justify-center text-text-muted italic text-sm">No data</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dataroom' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h2 className="text-xl font-bold text-text-main">Centralized Data Room</h2>
                    <Button variant="outline" size="sm" className="rounded-xl border-gray-200">
                      <Icons.plus className="size-4 mr-2" /> Upload Document
                    </Button>
                  </div>
                  <div className="p-12 text-center bg-surface rounded-[32px] border border-dashed border-gray-200">
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
                  <div className="bg-white border border-gray-100 rounded-[32px] shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                       <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">3 New Inquiries</span>
                       <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Mark all as read</button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      <EngagementItem
                        title="Connection Request: GreenGrowth Capital"
                        description="Interested in Kafue Solar Park expansion project. Seeking technical specs."
                        time="2h ago"
                        isNew
                      />
                      <EngagementItem
                        title="Document Viewed: Project Helios"
                        description="Nordic Power Fund accessed the Financial Model v4.xlsx."
                        time="5h ago"
                        isNew
                      />
                      <EngagementItem
                        title="System Alert: AI Scoring Update"
                        description="Lusaka South Solar readiness score improved to 92.1% based on new documents."
                        time="Yesterday"
                        isNew
                      />
                      <EngagementItem
                        title="NDA Signed: Silicon Ventures"
                        description="Standard institutional NDA has been countersigned and is now active."
                        time="2 days ago"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Widgets */}
            <div className="space-y-8">
              {/* Notifications / Activity */}
              <div className="p-8 rounded-2xl bg-surface border border-gray-100 shadow-soft">
                <h3 className="text-lg font-bold text-text-main mb-6">Top Investor Matches</h3>
                <div className="space-y-6">
                  <MatchItem 
                    name="GreenGrowth Capital"
                    type="Infrastructure Fund"
                    score={98}
                    tags={["Solar", ">$50M"]}
                  />
                  <MatchItem 
                    name="Nordic Power Fund"
                    type="Sovereign Wealth"
                    score={85}
                    tags={["Hydro", "Africa"]}
                  />
                  <MatchItem 
                    name="Silicon Ventures"
                    type="Venture Capital"
                    score={72}
                    tags={["Wind", "Tech"]}
                  />
                </div>
                <Button variant="outline" className="w-full mt-8 h-12 rounded-xl border-gray-200 text-text-main font-bold hover:bg-gray-50">
                  View All Matches
                </Button>
              </div>

              {/* Data Room Activity */}
              <div className="p-8 rounded-3xl bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Icons.shieldCheck className="size-6 text-white" />
                    <h3 className="text-lg font-bold">Data Room Security</h3>
                  </div>
                  <p className="text-sm font-medium text-white/90 mb-6 leading-relaxed">
                    Your project documents are currently protected by institutional-grade encryption and access control.
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/10 p-4 rounded-2xl">
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
        <span className="size-5 rounded-full bg-primary text-[10px] font-black text-white border border-white/20 flex items-center justify-center shadow-sm">
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
        <div className="size-10 rounded-xl bg-background border border-gray-100 flex items-center justify-center font-black text-text-muted text-xs group-hover:border-primary/50 group-hover:text-primary transition-all">
          {name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-text-main leading-tight">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-xs font-black text-primary">{score}%</div>
        </div>
        <div className="size-8 rounded-full border-2 border-primary/20 flex items-center justify-center p-0.5">
          <div className="size-full rounded-full border-2 border-primary border-t-transparent animate-[spin_3s_linear_infinite]" />
        </div>
      </div>
    </div>
  );
}
