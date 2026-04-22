'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { projectsApi } from '@/services/api';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement, CapitalMatchResult } from '@/types';
import { getStateLabel } from '@/lib/engagement';
import { EmptyState } from '@/components/ui/empty-state';

export default function InvestorDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [portfolioEngagements, setPortfolioEngagements] = useState<Engagement[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchMarketplace() {
      setLoadingMarketplace(true);
      try {
        const response = await projectsApi.getAdminAll();
        if (response.data) {
          setMarketplaceProjects(response.data);
        }
      } catch (error) {
        console.error('Error fetching marketplace:', error);
      } finally {
        setLoadingMarketplace(false);
      }
    }

    async function fetchPortfolio() {
      if (user?.company_id) {
        setLoadingPortfolio(true);
        try {
          const engData = await engagementService.getCompanyEngagements(user.company_id);
          setPortfolioEngagements(engData);
        } catch (error) {
          console.error('Error fetching portfolio:', error);
        } finally {
          setLoadingPortfolio(false);
        }
      }
    }

    if (user) {
      if (activeTab === 'dashboard' || activeTab === 'marketplace') fetchMarketplace();
      if (activeTab === 'dashboard' || activeTab === 'portfolio') fetchPortfolio();
    }
  }, [user, activeTab]);

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
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-13">Investor Portal</p>
        </div>

        <nav className="flex-grow px-4 space-y-2">
          <SidebarItem 
            icon={<Icons.layoutDashboard className="size-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem 
            icon={<Icons.search className="size-5" />} 
            label="Marketplace" 
            active={activeTab === 'marketplace'} 
            onClick={() => setActiveTab('marketplace')}
          />
          <SidebarItem 
            icon={<Icons.briefcase className="size-5" />} 
            label="Portfolio" 
            active={activeTab === 'portfolio'} 
            onClick={() => setActiveTab('portfolio')}
          />
          <SidebarItem 
            icon={<Icons.messageSquare className="size-5" />} 
            label="Messages" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')}
            badge={portfolioEngagements.length > 0 ? portfolioEngagements.length : undefined}
          />
          <SidebarItem 
            icon={<Icons.fileText className="size-5" />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-6 rounded-2xl bg-primary text-white border border-primary/20 mb-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-white/80">Portfolio Health</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-3xl font-black text-white">$450M</span>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1.5">Deployed</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden border border-white/10">
                <div className="bg-white h-full w-[65%] shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-200">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || 'Investor'}`} alt="User" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-text-main leading-none">{user.full_name || 'Investor'}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Capital Partner</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-slate-100"
              title="Logout"
            >
              <Icons.logOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">
                {activeTab === 'dashboard' ? 'Investor Overview' : 
                 activeTab === 'marketplace' ? 'Project Marketplace' :
                 activeTab === 'portfolio' ? 'Active Portfolio' :
                 activeTab === 'messages' ? 'Communications' : 'Investment Reports'}
              </h1>
              <p className="text-text-muted font-medium">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}.</p>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Hero Highlight */}
              <div className="relative p-12 rounded-[40px] bg-slate-900 text-white overflow-hidden mb-12 shadow-2xl group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4 group-hover:bg-primary/30 transition-all duration-1000" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />
                
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-green-400 border border-green-500/20 mb-8">
                    <Icons.zap className="size-3.5 fill-green-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Insight</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-[1.1]">New Opportunities <br /><span className="text-primary-light">Found for You.</span></h2>
                  <p className="text-lg text-slate-400 font-medium leading-relaxed mb-10">
                    We've identified {marketplaceProjects.length} high-potential projects matching your investment criteria.
                  </p>
                  <div className="flex gap-4">
                    <Button onClick={() => setActiveTab('marketplace')} className="h-14 px-10 bg-primary text-white font-black rounded-2xl hover:scale-105 hover:shadow-xl hover:shadow-primary/20 transition-all">
                      Review Matches
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-8 px-2">
                <h2 className="text-xl font-bold text-text-main">Top Opportunities</h2>
                <button onClick={() => setActiveTab('marketplace')} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">
                  View All Marketplace
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-12">
                {loadingMarketplace ? (
                  <div className="col-span-2 p-12 text-center bg-surface rounded-3xl"><Icons.spinner className="size-8 animate-spin mx-auto text-primary" /></div>
                ) : marketplaceProjects.length > 0 ? (
                  marketplaceProjects.slice(0, 4).map(project => (
                    <OpportunityCard 
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      location={project.location_country}
                      capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                      readiness={project.scores?.capital_readiness_score || 0}
                      irr="15-18%"
                      tags={[project.technology_type, project.project_stage.replace('_', ' ')]}
                    />
                  ))
                ) : (
                  <EmptyState 
                    icon="search"
                    title="No Projects Available"
                    description="We're currently vetting new energy infrastructure projects. Check back soon for institutional-grade opportunities."
                    actionLabel="Refresh Feed"
                    onAction={() => window.location.reload()}
                  />
                )}
              </div>
            </>
          )}

          {activeTab === 'marketplace' && (
            <div className="space-y-8">
               <div className="grid md:grid-cols-2 gap-8">
                {loadingMarketplace ? (
                  <div className="col-span-2 p-12 text-center bg-surface rounded-3xl"><Icons.spinner className="size-8 animate-spin mx-auto text-primary" /></div>
                ) : marketplaceProjects.length > 0 ? (
                  marketplaceProjects.map(project => (
                    <OpportunityCard 
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      location={project.location_country}
                      capital={`$${(project.capital_required / 1000000).toFixed(1)}M`}
                      readiness={project.scores?.capital_readiness_score || 0}
                      irr="15-18%"
                      tags={[project.technology_type, project.project_stage.replace('_', ' ')]}
                    />
                  ))
                ) : (
                  <div className="col-span-2">
                    <EmptyState 
                      icon="search"
                      title="Marketplace Empty"
                      description="No projects matching your current investment criteria were found in the global marketplace."
                      actionLabel="Clear Filters"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="space-y-8">
               <div className="grid gap-6">
                {loadingPortfolio ? (
                   <div className="p-12 text-center bg-surface rounded-3xl"><Icons.spinner className="size-8 animate-spin mx-auto text-primary" /></div>
                ) : portfolioEngagements.length > 0 ? (
                  portfolioEngagements.map(eng => (
                    <div key={eng.id} className="p-6 rounded-[32px] bg-white border border-gray-100 shadow-soft flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="size-14 rounded-2xl bg-slate-50 flex items-center justify-center text-primary">
                          <Icons.zap className="size-7" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-text-main">{eng.project?.name}</h4>
                          <p className="text-xs font-bold text-text-muted uppercase tracking-widest mt-1">
                            Status: <span className="text-primary">{getStateLabel(eng.status)}</span>
                          </p>
                        </div>
                      </div>
                      <Link href={`/dashboard/engagements/${eng.id}`}>
                        <Button variant="outline" className="rounded-xl border-gray-200">
                          Milestone Room
                        </Button>
                      </Link>
                    </div>
                  ))
                ) : (
                  <EmptyState 
                    icon="briefcase"
                    title="Portfolio Empty"
                    description="You haven't committed to any projects yet. Start by exploring the marketplace to find your first investment."
                    actionLabel="Explore Marketplace"
                    onAction={() => setActiveTab('marketplace')}
                  />
                )}
               </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-8">
              <div className="bg-white border border-gray-100 rounded-[32px] shadow-soft overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                   <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{portfolioEngagements.length} Active Conversations</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {loadingPortfolio ? (
                    <div className="p-8 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-primary" /></div>
                  ) : portfolioEngagements.length > 0 ? (
                    portfolioEngagements.map((eng) => (
                      <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                        <div className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-6">
                          <div className="size-10 rounded-xl bg-gray-50 flex items-center justify-center text-text-muted shrink-0 border border-gray-100">
                            <Icons.messageSquare className="size-5" />
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-bold text-text-main">{eng.project?.name}</h4>
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                {new Date(eng.updated_at || eng.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted font-medium">Last activity: {getStateLabel(eng.status)}</p>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-12 text-center text-sm text-text-muted italic">No active conversations.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
               <div className="grid md:grid-cols-2 gap-8">
                  <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-soft">
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest mb-8 flex items-center gap-2">
                      <Icons.pieChart className="size-4 text-primary" />
                      Sector Distribution
                    </h3>
                    <div className="h-64 flex items-center justify-center border-4 border-slate-50 rounded-full w-64 mx-auto relative">
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-3xl font-black text-slate-900">100%</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solar Focus</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-soft">
                    <h3 className="text-sm font-black text-text-main uppercase tracking-widest mb-8 flex items-center gap-2">
                      <Icons.lineChart className="size-4 text-primary" />
                      Capital Exposure
                    </h3>
                    <div className="space-y-6">
                      <div className="h-40 flex items-end justify-between gap-2 px-4">
                        {[40, 70, 45, 90, 65, 80].map((h, i) => (
                          <div key={i} className="flex-grow bg-primary/20 rounded-t-lg relative group">
                            <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }}></div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
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
        <span className="size-5 rounded-full bg-primary text-[10px] font-black text-white flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function OpportunityCard({ id, name, location, capital, readiness, irr, tags }: { id: string, name: string, location: string, capital: string, readiness: number, irr: string, tags: string[] }) {
  return (
    <div className="p-8 rounded-[40px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-text-main mb-2 group-hover:text-primary transition-colors">{name}</h3>
          <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
            <Icons.mapPin className="size-3" />
            {location}
          </div>
        </div>
        <div className="size-10 rounded-full border border-gray-100 flex items-center justify-center text-text-muted hover:text-primary cursor-pointer transition-colors">
          <Icons.bookmark className="size-4" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 py-6 border-y border-gray-50">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Capital Req.</p>
          <p className="text-sm font-bold text-text-main">{capital}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Target IRR</p>
          <p className="text-sm font-bold text-primary">{irr}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Readiness</p>
          <p className="text-sm font-bold text-text-main">{readiness}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-lg bg-background text-[10px] font-bold text-text-muted uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
        <Link href={`/projects/${id}`}>
          <Button className="h-10 px-6 rounded-xl bg-text-main text-white font-bold text-xs hover:bg-text-main/90 transition-all">
            Review Deal
          </Button>
        </Link>
      </div>
    </div>
  );
}
