'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, PowerTrader, Company } from '@/types';
import { companiesApi } from '@/services/api';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';

export default function TraderDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [traderProfile, setTraderProfile] = useState<PowerTrader | null>(null);
  const [traderId, setTraderId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>({
    license_type: 'TRADING', max_offtake_capacity_mw: 0,
    preferred_technology_types: [], regions_of_interest: [],
    min_ppa_duration_years: 0, credit_rating_equivalent: '',
  });

  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'POWER_TRADER' && user.role !== 'ADMIN') router.push('/dashboard');
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
          const { data: profileData } = await supabase
            .from('power_traders').select('*, company:companies(*)')
            .eq('company_id', user.company_id).maybeSingle();
          setEngagements(engData);
          if (profileData) {
            setTraderProfile(profileData);
            setTraderId(profileData.id);
            setProfileData({
              license_type: profileData.license_type || 'TRADING',
              max_offtake_capacity_mw: profileData.max_offtake_capacity_mw || 0,
              preferred_technology_types: profileData.preferred_technology_types || [],
              regions_of_interest: profileData.regions_of_interest || [],
              min_ppa_duration_years: profileData.min_ppa_duration_years || 0,
              credit_rating_equivalent: profileData.credit_rating_equivalent || '',
            });
          }
          if (companyRes.data) setCompany(companyRes.data);
        } catch (error) { console.error('Error fetching trader dashboard data:', error); }
        finally { setLoadingData(false); }
      }
    }
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    async function fetchMarketplace() {
      if (activeTab !== 'marketplace' && activeTab !== 'dashboard') return;
      setLoadingMarketplace(true);
      try {
        const { data: projects } = await supabase
          .from('projects').select('*')
          .is('deleted_at', null)
          .in('project_stage', ['RFP', 'CONSTRUCTION'])
          .order('created_at', { ascending: false });
        setMarketplaceProjects((projects || []) as Project[]);
      } catch (error) { console.error('Error fetching marketplace:', error); }
      finally { setLoadingMarketplace(false); }
    }
    if (user) fetchMarketplace();
  }, [user, activeTab]);

  if (loading || !user) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><LeafLoader size={100} /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ── Welcome Section ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Power Trader Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Here is your offtake pipeline.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className="h-9 px-4 rounded-xl" icon={<Icons.settings />} onClick={() => setActiveTab('profile')}>
            Partner Profile
          </Button>
          <Button className="h-9 px-4 rounded-xl" icon={<Icons.search />} onClick={() => setActiveTab('marketplace')}>
            Browse Projects
          </Button>
        </div>
      </div>

        {activeTab === 'dashboard' && (
          <>
            {loadingData ? (
              <KpiBarSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <StatCard label="Contracted Capacity" value={`${traderProfile?.max_offtake_capacity_mw || 0} MW`} trend={{ label: 'Lifetime Capacity' }} icon={Icons.zap} />
                <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In procurement pipeline' }} icon={Icons.messageSquare} />
                <StatCard label="License Type" value={traderProfile?.license_type || 'N/A'} trend={{ label: 'Current License' }} icon={Icons.shieldCheck} />
                <StatCard label="Credit Rating" value={traderProfile?.credit_rating_equivalent || 'N/A'} trend={{ label: 'PPA Security Rating' }} icon={Icons.shieldCheck} />
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xl font-bold text-text-main">New Opportunities</h2>
                  <button onClick={() => setActiveTab('marketplace')} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">Explore Marketplace</button>
                </div>
                {loadingMarketplace ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100"><Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" /><p className="text-sm font-bold text-text-muted">Loading opportunities...</p></div>
                ) : marketplaceProjects.length > 0 ? (
                  <div className="grid gap-6">
                    {marketplaceProjects.slice(0, 2).map(project => (
                      <div key={project.id} className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex gap-5">
                            <div className="size-16 rounded-2xl bg-background flex flex-col items-center justify-center text-primary border border-gray-100 shadow-sm group-hover:border-primary/30 transition-colors"><Icons.zap className="size-8" /></div>
                            <div>
                              <h4 className="text-xl font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{project.name}</h4>
                              <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3.5" />{project.location_country}</span>
                                <span className="flex items-center gap-1.5"><Icons.layers className="size-3.5" />{project.project_size_mw} MW</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Status</p>
                              <p className="text-sm font-bold text-text-main">{project.project_stage.replace('_', ' ')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Readiness</p>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-primary">{project.scores?.capital_readiness_score || 0}%</span>
                                <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="bg-primary h-full" style={{ width: `${project.scores?.capital_readiness_score || 0}%` }} /></div>
                              </div>
                            </div>
                            <Link href={`/projects/${project.id}`}>
                              <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-primary/10 hover:text-primary h-12 w-12 transition-all"><Icons.chevronRight className="size-6" /></Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="search" title="No Opportunities Found" description="No projects with offtake agreements available right now." />
                )}
              </div>

              <div className="space-y-8">
                <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                  <h3 className="text-lg font-bold text-text-main mb-6">Regions of Interest</h3>
                  <div className="space-y-4">
                    {traderProfile?.regions_of_interest && traderProfile.regions_of_interest.length > 0 ? (
                      traderProfile.regions_of_interest.map((region: string) => (
                        <div key={region} className="flex items-center justify-between p-3 rounded-xl bg-background border border-gray-50">
                          <span className="text-xs font-bold text-text-main uppercase tracking-wider">{region}</span>
                          <Icons.checkCircle2 className="size-4 text-green-500" />
                        </div>
                      ))
                    ) : <p className="text-xs text-text-muted italic">No regions configured yet.</p>}
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                  <div className="relative z-10">
                    <Icons.shieldCheck className="size-8 mb-6" />
                    <h3 className="text-xl font-bold mb-2">Credit Rating</h3>
                    <p className="text-3xl font-black mb-4">{traderProfile?.credit_rating_equivalent || 'N/A'}</p>
                    <p className="text-xs font-medium text-white/80 leading-relaxed">Verified rating for power purchase agreement security.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'marketplace' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-text-main">Project Marketplace</h2>
            {loadingMarketplace ? (
              <KpiBarSkeleton />
            ) : marketplaceProjects.length > 0 ? (
              <div className="grid gap-6">
                {marketplaceProjects.map(project => (
                  <div key={project.id} className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex gap-5">
                        <div className="size-16 rounded-2xl bg-background flex flex-col items-center justify-center text-primary border border-gray-100 shadow-sm group-hover:border-primary/30 transition-colors"><Icons.zap className="size-8" /></div>
                        <div>
                          <h4 className="text-xl font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{project.name}</h4>
                          <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3.5" />{project.location_country}</span>
                            <span className="flex items-center gap-1.5"><Icons.layers className="size-3.5" />{project.project_size_mw} MW</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-10">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Status</p>
                          <p className="text-sm font-bold text-text-main">{project.project_stage.replace('_', ' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Readiness</p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-primary">{project.scores?.capital_readiness_score || 0}%</span>
                            <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="bg-primary h-full" style={{ width: `${project.scores?.capital_readiness_score || 0}%` }} /></div>
                          </div>
                        </div>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-primary/10 hover:text-primary h-12 w-12 transition-all"><Icons.chevronRight className="size-6" /></Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="search" title="No Projects Available" description="No projects with offtake agreements available right now." actionLabel="Refresh" onAction={() => window.location.reload()} />
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-text-main">Project Portfolio</h2>
            {engagements.length > 0 ? (
              <div className="grid gap-6">
                {engagements.map(eng => (
                  <div key={eng.id} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                    <div><h4 className="font-bold">{eng.project?.name}</h4><p className="text-sm text-text-muted">{eng.status}</p></div>
                    <Link href={`/dashboard/engagements/${eng.id}`}><Button variant="outline">View Engagement</Button></Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="briefcase" title="Active Engagements" description="You don't have any active engagements in progress. Start by exploring the marketplace." actionLabel="Explore Marketplace" onAction={() => setActiveTab('marketplace')} />
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-text-main">Communications</h2>
            {engagements.length > 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{engagements.length} Active Engagements</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {engagements.map((eng) => (
                    <Link key={eng.id} href={`/dashboard/engagements/${eng.id}`}>
                      <div className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-6">
                        <div className="size-10 rounded-xl bg-gray-50 flex items-center justify-center text-text-muted shrink-0 border border-gray-100"><Icons.messageSquare className="size-5" /></div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-bold text-text-main">{eng.project?.name || 'Project'}</h4>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{new Date(eng.updated_at || eng.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-text-muted font-medium">Milestone: {eng.status}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon="messageSquare" title="No Messages" description="Start an engagement to begin communicating with partners." />}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <EmptyState icon="pieChart" title="Reports Coming Soon" description="Trading performance reports and analytics will be available here once you have active engagements." />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Trader Profile</h2>
                {company?.is_new_company_with_experienced_team && (
                  <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full flex items-center gap-1.5 border border-green-200">
                    <Icons.shieldCheck className="size-3" /> Experienced Leadership
                  </div>
                )}
              </div>
              <Button onClick={async () => {
                if (!user?.company_id) return;
                setUpdatingProfile(true);
                try {
                  if (!traderId) {
                    const { data: created } = await supabase.from('power_traders').insert({ company_id: user.company_id, ...profileData }).select().single();
                    setTraderId(created?.id || null);
                  } else {
                    const { error } = await supabase.from('power_traders').update(profileData).eq('id', traderId);
                    if (error) throw error;
                  }
                  alert('Profile updated successfully');
                } catch { alert('Failed to update profile'); }
                finally { setUpdatingProfile(false); }
              }} disabled={updatingProfile} className="bg-primary text-white rounded-xl h-12 px-8 font-bold shadow-lg">
                {updatingProfile ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />} Save Changes
              </Button>
            </div>
            <div className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-soft space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">License Type</label>
                  <select className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.license_type} onChange={(e) => setProfileData({ ...profileData, license_type: e.target.value })}>
                    <option value="TRADING">Trading</option>
                    <option value="BROKERAGE">Brokerage</option>
                    <option value="MARKET_MAKER">Market Maker</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Offtake Capacity (MW)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.max_offtake_capacity_mw} onChange={(e) => setProfileData({ ...profileData, max_offtake_capacity_mw: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min PPA Duration (Years)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.min_ppa_duration_years} onChange={(e) => setProfileData({ ...profileData, min_ppa_duration_years: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Credit Rating Equivalent</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.credit_rating_equivalent} onChange={(e) => setProfileData({ ...profileData, credit_rating_equivalent: e.target.value })} placeholder="e.g. A-, BBB+" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preferred Technology Types (Comma separated)</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.preferred_technology_types?.join(', ')} onChange={(e) => setProfileData({ ...profileData, preferred_technology_types: e.target.value.split(',').map(s => s.trim()) })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Regions of Interest (Comma separated)</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.regions_of_interest?.join(', ')} onChange={(e) => setProfileData({ ...profileData, regions_of_interest: e.target.value.split(',').map(s => s.trim()) })} />
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
