'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, PowerTrader, Company } from '@/types';
import { onboardingApi, companiesApi } from '@/services/api';
import { EmptyState } from '@/components/ui/empty-state';

export default function TechnicalDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [techProfile, setTechProfile] = useState<PowerTrader | null>(null);
  const [technicalPartnerId, setTechnicalPartnerId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  const [profileData, setProfileData] = useState<any>({
    license_type: 'TRADING',
    max_offtake_capacity_mw: 0,
    preferred_technology_types: [],
    regions_of_interest: [],
    min_ppa_duration_years: 0,
    credit_rating_equivalent: '',
  });

  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'POWER_TRADER' && user.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchData() {
      if (user?.company_id) {
        setLoadingData(true);
        try {
          const [engData, companyRes] = await Promise.all([
            engagementService.getCompanyEngagements(user.company_id),
            companiesApi.getById(user.company_id)
          ]);
          const { data: partnerData } = await supabase
            .from('power_traders')
            .select('*, company:companies(*)')
            .eq('company_id', user.company_id)
            .maybeSingle();
          
          setEngagements(engData);
          
          if (partnerData) {
            setTechProfile(partnerData);
            setTechnicalPartnerId(partnerData.id);
            setProfileData({
              license_type: partnerData.license_type || 'TRADING',
              max_offtake_capacity_mw: partnerData.max_offtake_capacity_mw || 0,
              preferred_technology_types: partnerData.preferred_technology_types || [],
              regions_of_interest: partnerData.regions_of_interest || [],
              min_ppa_duration_years: partnerData.min_ppa_duration_years || 0,
              credit_rating_equivalent: partnerData.credit_rating_equivalent || '',
            });
          }

          if (companyRes.data) {
            setCompany(companyRes.data);
          }
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
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 ml-13">Trading Portal</p>
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
          <SidebarItem 
            icon={<Icons.user className="size-5" />} 
            label="Partner Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
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
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">Power Trader</p>
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
              <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-2">Power Trader Dashboard</h1>
              <p className="text-text-muted font-medium">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}. Here is your offtake pipeline.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-12 px-6 rounded-xl border-gray-200 font-bold text-text-main hover:bg-gray-50"
                onClick={() => setActiveTab('profile')}
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
                  label="Contracted Capacity"
                  value={`${techProfile?.max_offtake_capacity_mw || 0} MW`}
                  subValue="Lifetime Capacity"
                />
                <StatCard
                  label="Active Engagements"
                  value={engagements.length.toString()}
                  subValue="In procurement pipeline"
                />
                <StatCard 
                  label="Active PPAs" 
                  value="98%" 
                  subValue="Current Year Target" 
                />
                <StatCard
                  label="PPA Success Rate"
                  value="Active"
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
                    <h3 className="text-lg font-bold text-text-main mb-6">Regions Operated</h3>
                    <div className="space-y-4">
                      {techProfile?.regions_of_interest?.map(region => (
                        <div key={region} className="flex items-center justify-between p-3 rounded-xl bg-background border border-gray-50">
                          <span className="text-xs font-bold text-text-main uppercase tracking-wider">{region}</span>
                          <Icons.checkCircle2 className="size-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 rounded-[32px] bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                    <div className="relative z-10">
                      <Icons.shieldCheck className="size-8 mb-6" />
                      <h3 className="text-xl font-bold mb-2">Credit Rating</h3>
                      <p className="text-3xl font-black mb-4">{techProfile?.credit_rating_equivalent || 'A-'}</p>
                      <p className="text-xs font-medium text-white/80 leading-relaxed">
                        Verified rating for power purchase agreement security.
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
                    {engagements.map(eng => (
                      <div key={eng.id} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">{eng.project?.name}</h4>
                          <p className="text-sm text-text-muted">{eng.status}</p>
                        </div>
                        <Link href={`/dashboard/engagements/${eng.id}`}>
                          <Button variant="outline">View Engagement</Button>
                        </Link>
                      </div>
                    ))}
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

          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Partner Profile</h2>
                  {company?.is_new_company_with_experienced_team && (
                    <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1.5 border border-green-200">
                      <Icons.shieldCheck className="size-3" />
                      Experienced Leadership
                    </div>
                  )}
                </div>
                <Button 
                  onClick={async () => {
                    if (!user?.company_id) return;
                    setUpdatingProfile(true);
                    try {
                      if (!technicalPartnerId) {
                        const { data: createdPartner } = await supabase
                          .from('power_traders')
                          .insert({ company_id: user.company_id, ...profileData })
                          .select()
                          .single();
                        setTechnicalPartnerId(createdPartner?.id || null);
                      } else {
                        const { error } = await supabase
                          .from('power_traders')
                          .update(profileData)
                          .eq('id', technicalPartnerId);
                        if (error) throw error;
                      }
                      alert('Profile updated successfully');
                    } catch (err) {
                      alert('Failed to update profile');
                    } finally {
                      setUpdatingProfile(false);
                    }
                  }} 
                  disabled={updatingProfile}
                  className="bg-primary text-white rounded-xl h-12 px-8 font-bold shadow-lg"
                >
                  {updatingProfile ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />}
                  Save Changes
                </Button>
              </div>

              <div className="grid gap-8">
                <div className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-soft space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Years of Experience</label>
                      <input 
                        type="number"
                        className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                        value={profileData.years_of_experience}
                        onChange={(e) => setProfileData({ ...profileData, years_of_experience: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Project Size (ZMW)</label>
                      <input 
                        type="number"
                        className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                        value={profileData.min_ticket_size_zmw}
                        onChange={(e) => setProfileData({ ...profileData, min_ticket_size_zmw: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Project Size (ZMW)</label>
                      <input 
                        type="number"
                        className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                        value={profileData.max_ticket_size_zmw}
                        onChange={(e) => setProfileData({ ...profileData, max_ticket_size_zmw: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Terms</label>
                    <textarea 
                      className="w-full h-24 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none"
                      value={profileData.payment_terms}
                      onChange={(e) => setProfileData({ ...profileData, payment_terms: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project Type Experience</label>
                    <input 
                      className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                      value={profileData.project_type_experience?.join(', ')}
                      onChange={(e) => setProfileData({ ...profileData, project_type_experience: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Experience Document URL</label>
                    <input 
                      className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                      value={profileData.company_experience_doc_url}
                      onChange={(e) => setProfileData({ ...profileData, company_experience_doc_url: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service Categories (Comma separated)</label>
                      <input 
                        className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                        value={profileData.service_categories?.join(', ')}
                        onChange={(e) => setProfileData({ ...profileData, service_categories: e.target.value.split(',').map(s => s.trim()) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Regions of Operation</label>
                      <input 
                        className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm"
                        value={profileData.regions_operated?.join(', ')}
                        onChange={(e) => setProfileData({ ...profileData, regions_operated: e.target.value.split(',').map(s => s.trim()) })}
                      />
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







