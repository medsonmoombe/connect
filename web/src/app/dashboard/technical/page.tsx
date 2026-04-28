'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement, TechnicalPartner } from '@/types';
import { onboardingApi } from '@/services/api';
import { EmptyState } from '@/components/ui/empty-state';

export default function TechnicalDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicalPartner | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchData() {
      if (user?.company_id) {
        setLoadingData(true);
        try {
          // In a real app, we'd have a specific endpoint for technical profile
          // For now, we'll try to get the company's engagements
          const engData = await engagementService.getCompanyEngagements(user.company_id);
          setEngagements(engData);
          
          // Mocking technical profile data for the dashboard metrics
          setTechProfile({
            id: 'mock-id',
            company_id: user.company_id,
            service_categories: ['EPC', 'O&M', 'Engineering Design'],
            sector_experience: ['Solar PV', 'Wind'],
            min_mw_capacity: 5,
            max_mw_capacity: 100,
            regions_operated: ['Zambia', 'Kenya', 'Nigeria'],
            annual_delivery_capacity_mw: 250,
            total_mw_delivered: 1240,
            largest_project_mw: 85,
            average_delivery_time_months: 14,
            bonding_capacity: 50000000,
            delivery_models: ['Turnkey', 'EPC+F']
          });
        } catch (error) {
          console.error('Error fetching technical dashboard data:', error);
        } finally {
          setLoadingData(false);
        }
      }
    }

    if (user) {
      fetchData();
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
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-13">Technical Portal</p>
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
            badge={2}
          />
          <SidebarItem 
            icon={<Icons.fileText className="size-5" />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-6 rounded-2xl bg-slate-900 text-white mb-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-white/60">Safety Record</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-3xl font-black text-white">0.00</span>
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5">LTIR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Compliant</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-2">
            <div className="size-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-200">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.full_name || 'Tech'}`} alt="User" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-text-main leading-none">{user.full_name || 'Partner'}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Technical Partner</p>
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
        <div className="max-w-6xl mx-auto min-h-screen pb-20">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">Technical Dashboard</h1>
              <p className="text-text-muted font-medium">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}. Here is your engineering pipeline.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-12 px-6 rounded-xl border-gray-200 font-bold text-text-main hover:bg-gray-50"
              >
                <Icons.settings className="size-4 mr-2" />
                Partner Profile
              </Button>
              <Button className="h-12 px-6 bg-primary text-primary-content hover:bg-primary/90 font-bold rounded-xl shadow-lg transition-all flex gap-2">
                <Icons.search className="size-5" />
                Browse Projects
              </Button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <StatCard
                  label="Total Delivered"
                  value={`${techProfile?.total_mw_delivered || 0} MW`}
                  subValue="Lifetime Capacity"
                />
                <StatCard
                  label="Active Engagements"
                  value={engagements.length.toString()}
                  subValue="In procurement pipeline"
                />
                <StatCard 
                  label="Annual Capacity" 
                  value={`${techProfile?.annual_delivery_capacity_mw || 0} MW`} 
                  subValue="Current Year Target" 
                />
                <StatCard
                  label="Avg. Delivery"
                  value={`${techProfile?.average_delivery_time_months || 0} Mo.`}
                  subValue="Concept to Go-Live"
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Section */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold text-text-main">New Opportunities</h2>
                    <button onClick={() => setActiveTab('marketplace')} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">
                      Explore Marketplace
                    </button>
                  </div>

                  <div className="grid gap-6">
                    <OpportunityCard 
                      name="Solana West Phase II"
                      location="Copperbelt, Zambia"
                      size="40 MW"
                      type="Solar PV + BESS"
                      readiness={92}
                      status="RFP Stage"
                    />
                    <OpportunityCard 
                      name="Rift Valley Hydro"
                      location="Nairobi, Kenya"
                      size="15 MW"
                      type="Small Hydro"
                      readiness={78}
                      status="Pre-FEED"
                    />
                  </div>
                </div>

                {/* Sidebar Widgets */}
                <div className="space-y-8">
                  <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                    <h3 className="text-lg font-bold text-text-main mb-6">Service Coverage</h3>
                    <div className="space-y-4">
                      {techProfile?.service_categories.map(service => (
                        <div key={service} className="flex items-center justify-between p-3 rounded-xl bg-background border border-gray-50">
                          <span className="text-xs font-bold text-text-main uppercase tracking-wider">{service}</span>
                          <Icons.checkCircle2 className="size-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 rounded-[32px] bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                    <div className="relative z-10">
                      <Icons.shieldCheck className="size-8 mb-6" />
                      <h3 className="text-xl font-bold mb-2">Bonding Capacity</h3>
                      <p className="text-3xl font-black mb-4">${(techProfile?.bonding_capacity || 0 / 1000000).toFixed(0)}M</p>
                      <p className="text-xs font-medium text-white/80 leading-relaxed">
                        Verified institutional backing for large-scale EPC contracts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'marketplace' && (
            <div className="space-y-8">
               <h2 className="text-2xl font-bold text-text-main">Project Marketplace</h2>
               <EmptyState 
                  icon="search"
                  title="Search Projects"
                  description="Find developers looking for EPC, O&M, or Technical Advisory partners across Sub-Saharan Africa."
                  actionLabel="Browse All"
               />
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="space-y-8">
               <h2 className="text-2xl font-bold text-text-main">Project Portfolio</h2>
               {engagements.length > 0 ? (
                 <div className="grid gap-6">
                    {/* Implementation for portfolio list if needed */}
                 </div>
               ) : (
                 <EmptyState 
                    icon="briefcase"
                    title="Active Engagements"
                    description="You don't have any active engagements in progress. Start by exploring the marketplace to find new engineering contracts."
                    actionLabel="Explore Marketplace"
                    onAction={() => setActiveTab('marketplace')}
                 />
               )}
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

function StatCard({ label, value, subValue }: { label: string, value: string, subValue: string }) {
  return (
    <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-4">{label}</p>
      <h4 className="text-3xl font-black text-text-main mb-2 tracking-tighter">{value}</h4>
      <p className="text-xs font-bold text-primary uppercase tracking-wider">{subValue}</p>
    </div>
  );
}

function OpportunityCard({ name, location, size, type, readiness, status }: { name: string, location: string, size: string, type: string, readiness: number, status: string }) {
  return (
    <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex gap-5">
          <div className="size-16 rounded-2xl bg-background flex flex-col items-center justify-center text-primary border border-gray-100 shadow-sm group-hover:border-primary/30 transition-colors">
            <Icons.zap className="size-8" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{name}</h4>
            <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3.5" />{location}</span>
              <span className="flex items-center gap-1.5"><Icons.layers className="size-3.5" />{size}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Status</p>
            <p className="text-sm font-bold text-text-main">{status}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Readiness</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">{readiness}%</span>
              <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${readiness}%` }} />
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-primary/10 hover:text-primary h-12 w-12 transition-all">
            <Icons.chevronRight className="size-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
