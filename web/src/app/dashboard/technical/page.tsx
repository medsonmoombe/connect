'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, TechnicalPartner, Company } from '@/types';
import { technicalPartnersApi, companiesApi } from '@/services/api';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';

export default function TechnicalDashboard() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTabState] = useState(initialTab);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicalPartner | null>(null);
  const [technicalPartnerId, setTechnicalPartnerId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>({
    service_categories: [], sector_experience: [], min_mw_capacity: 0, max_mw_capacity: 0,
    regions_operated: [], years_of_experience: 0, payment_terms: '',
    min_ticket_size_zmw: 0, max_ticket_size_zmw: 0, project_type_experience: [], company_experience_doc_url: '',
  });

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
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'TECHNICAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
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
            .from('technical_partners').select('*, company:companies(*)')
            .eq('company_id', user.company_id).maybeSingle();
          setEngagements(engData);
          if (partnerData) {
            setTechProfile(partnerData);
            setTechnicalPartnerId(partnerData.id);
            setProfileData({
              service_categories: partnerData.service_categories || [],
              sector_experience: partnerData.sector_experience || [],
              min_mw_capacity: partnerData.min_mw_capacity || 0,
              max_mw_capacity: partnerData.max_mw_capacity || 0,
              regions_operated: partnerData.regions_operated || [],
              years_of_experience: partnerData.years_of_experience || 0,
              payment_terms: partnerData.payment_terms || '',
              min_ticket_size_zmw: partnerData.min_ticket_size_zmw || 0,
              max_ticket_size_zmw: partnerData.max_ticket_size_zmw || 0,
              project_type_experience: partnerData.project_type_experience || [],
              company_experience_doc_url: partnerData.company_experience_doc_url || '',
            });
          }
          if (companyRes.data) setCompany(companyRes.data);
        } catch (error) { console.error('Error fetching technical dashboard data:', error); }
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
          .from('projects').select('*, company:companies(name)')
          .is('deleted_at', null)
          .in('project_stage', ['FEED', 'RFP', 'CONSTRUCTION'])
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
          <p className="dash-section-label mb-1">Technical Partner Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Here is your engineering pipeline.
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

      {/* ── Stats Grid ───────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <>
          {loadingData ? (
            <KpiBarSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Delivered" value={`${techProfile?.total_mw_delivered || 0} MW`} trend={{ label: 'Lifetime Capacity' }} icon={Icons.zap} />
              <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In procurement pipeline' }} icon={Icons.messageSquare} />
              <StatCard label="Annual Capacity" value={`${techProfile?.annual_delivery_capacity_mw || 0} MW`} trend={{ label: 'Current Year Target' }} icon={Icons.barChart} />
              <StatCard label="Avg. Delivery" value={`${techProfile?.average_delivery_time_months || 0} Mo.`} trend={{ label: 'Concept to Go-Live' }} icon={Icons.lineChart} />
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
                  <EmptyState icon="search" title="No Opportunities Found" description="No projects matching your service categories are available right now. Check back soon." />
                )}
              </div>

              <div className="space-y-8">
                <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                  <h3 className="text-lg font-bold text-text-main mb-6">Service Coverage</h3>
                  <div className="space-y-4">
                    {techProfile?.service_categories && techProfile.service_categories.length > 0 ? (
                      techProfile.service_categories.map((service: string) => (
                        <div key={service} className="flex items-center justify-between p-3 rounded-xl bg-background border border-gray-50">
                          <span className="text-xs font-bold text-text-main uppercase tracking-wider">{service}</span>
                          <Icons.checkCircle2 className="size-4 text-green-500" />
                        </div>
                      ))
                    ) : <p className="text-xs text-text-muted italic">No services configured yet.</p>}
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                  <div className="relative z-10">
                    <Icons.shieldCheck className="size-8 mb-6" />
                    <h3 className="text-xl font-bold mb-2">Bonding Capacity</h3>
                    <p className="text-3xl font-black mb-4">${((techProfile?.bonding_capacity || 0) / 1000000).toFixed(0)}M</p>
                    <p className="text-xs font-medium text-white/80 leading-relaxed">Verified institutional backing for large-scale EPC contracts.</p>
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
              <EmptyState icon="search" title="No Projects Available" description="No projects matching your service categories are available right now." actionLabel="Refresh" onAction={() => window.location.reload()} />
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
            <EmptyState icon="pieChart" title="Reports Coming Soon" description="Engineering performance reports and analytics will be available here once you have active engagements." />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Partner Profile</h2>
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
                  if (!technicalPartnerId) {
                    const { data: createdPartner } = await supabase.from('technical_partners').insert({ company_id: user.company_id, ...profileData }).select().single();
                    setTechnicalPartnerId(createdPartner?.id || null);
                  } else { await technicalPartnersApi.update(technicalPartnerId, profileData); }
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Years of Experience</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.years_of_experience} onChange={(e) => setProfileData({ ...profileData, years_of_experience: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Project Size (ZMW)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.min_ticket_size_zmw} onChange={(e) => setProfileData({ ...profileData, min_ticket_size_zmw: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Project Size (ZMW)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.max_ticket_size_zmw} onChange={(e) => setProfileData({ ...profileData, max_ticket_size_zmw: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Terms</label>
                <textarea className="w-full h-24 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none" value={profileData.payment_terms} onChange={(e) => setProfileData({ ...profileData, payment_terms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project Type Experience</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.project_type_experience?.join(', ')} onChange={(e) => setProfileData({ ...profileData, project_type_experience: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Experience Document URL</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.company_experience_doc_url} onChange={(e) => setProfileData({ ...profileData, company_experience_doc_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Service Categories (Comma separated)</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.service_categories?.join(', ')} onChange={(e) => setProfileData({ ...profileData, service_categories: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Regions of Operation</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.regions_operated?.join(', ')} onChange={(e) => setProfileData({ ...profileData, regions_operated: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
