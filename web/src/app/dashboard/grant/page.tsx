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
import { Project, Engagement, Company } from '@/types';
import { companiesApi } from '@/services/api';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';
import { getStateLabel } from '@/lib/engagement';

interface GrantProfile {
  id: string;
  company_id: string;
  grant_types: string[];
  min_grant_size: number;
  max_grant_size: number;
  focus_sectors: string[];
  geographic_focus: string[];
  disbursement_criteria: string;
}

export default function GrantProviderDashboard() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [grantProfile, setGrantProfile] = useState<GrantProfile | null>(null);
  const [grantProfileId, setGrantProfileId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>({
    grant_types: [], min_grant_size: 0, max_grant_size: 0,
    focus_sectors: [], geographic_focus: [], disbursement_criteria: '',
  });

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
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'GRANT_PROVIDER' && user.role !== 'ADMIN') router.push('/dashboard');
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
            .from('grant_providers').select('*')
            .eq('company_id', user.company_id).maybeSingle();
          setEngagements(engData);
          if (profileData) {
            setGrantProfile(profileData);
            setGrantProfileId(profileData.id);
            setProfileData({
              grant_types: profileData.grant_types || [],
              min_grant_size: profileData.min_grant_size || 0,
              max_grant_size: profileData.max_grant_size || 0,
              focus_sectors: profileData.focus_sectors || [],
              geographic_focus: profileData.geographic_focus || [],
              disbursement_criteria: profileData.disbursement_criteria || '',
            });
          }
          if (companyRes.data) setCompany(companyRes.data);
        } catch (error) { console.error('Error fetching grant dashboard data:', error); }
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
          .in('project_stage', ['FEED', 'RFP'])
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
          <p className="dash-section-label mb-1">Grant Provider Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Discover and fund impactful energy projects.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className="h-9 px-4 rounded-xl" icon={<Icons.settings />} onClick={() => setActiveTab('profile')}>
            Grant Profile
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
                <StatCard label="Active Engagements" value={engagements.length.toString()} trend={{ label: 'In funding pipeline' }} icon={Icons.messageSquare} />
                <StatCard label="Focus Sectors" value={`${profileData.focus_sectors?.length || 0}`} trend={{ label: 'Configured sectors' }} icon={Icons.layers} />
                <StatCard label="Geographic Reach" value={`${profileData.geographic_focus?.length || 0}`} trend={{ label: 'Target regions' }} icon={Icons.globe} />
                <StatCard label="Grant Range" value={profileData.max_grant_size > 0 ? `$${(profileData.min_grant_size / 1000).toFixed(0)}K-$${(profileData.max_grant_size / 1000000).toFixed(1)}M` : 'Not Set'} trend={{ label: 'Per project' }} icon={Icons.dollarSign} />
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xl font-bold text-text-main">Projects Seeking Grants</h2>
                  <button onClick={() => setActiveTab('marketplace')} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">View All</button>
                </div>
                {loadingMarketplace ? (
                  <div className="p-12 text-center bg-surface rounded-2xl border border-gray-100"><Icons.spinner className="size-8 animate-spin mx-auto text-primary mb-4" /><p className="text-sm font-bold text-text-muted">Loading projects...</p></div>
                ) : marketplaceProjects.length > 0 ? (
                  <div className="grid gap-6">
                    {marketplaceProjects.slice(0, 3).map(project => (
                      <div key={project.id} className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex gap-5">
                            <div className="size-16 rounded-2xl bg-green-50 flex flex-col items-center justify-center text-green-600 border border-green-100 shadow-sm"><Icons.sun className="size-8" /></div>
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
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Capital Needed</p>
                              <p className="text-sm font-bold text-primary">${(project.capital_required / 1000000).toFixed(1)}M</p>
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
                  <EmptyState icon="search" title="No Projects Found" description="No projects seeking grant funding are available right now. Check back soon." />
                )}
              </div>

              <div className="space-y-8">
                <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                  <h3 className="text-lg font-bold text-text-main mb-6">Focus Sectors</h3>
                  <div className="space-y-4">
                    {profileData.focus_sectors?.length > 0 ? (
                      profileData.focus_sectors.map((sector: string) => (
                        <div key={sector} className="flex items-center justify-between p-3 rounded-xl bg-background border border-gray-50">
                          <span className="text-xs font-bold text-text-main uppercase tracking-wider">{sector}</span>
                          <Icons.checkCircle2 className="size-4 text-green-500" />
                        </div>
                      ))
                    ) : <p className="text-xs text-text-muted italic">No sectors configured yet.</p>}
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-green-600 text-white shadow-xl shadow-green-600/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                  <div className="relative z-10">
                    <Icons.globe className="size-8 mb-6" />
                    <h3 className="text-xl font-bold mb-2">Geographic Focus</h3>
                    <p className="text-3xl font-black mb-4">{profileData.geographic_focus?.length || 0} Regions</p>
                    <p className="text-xs font-medium text-white/80 leading-relaxed">Target regions for grant disbursement across Sub-Saharan Africa.</p>
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
                        <div className="size-16 rounded-2xl bg-green-50 flex flex-col items-center justify-center text-green-600 border border-green-100 shadow-sm"><Icons.sun className="size-8" /></div>
                        <div>
                          <h4 className="text-xl font-bold text-text-main mb-1 group-hover:text-primary transition-colors">{project.name}</h4>
                          <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3.5" />{project.location_country}</span>
                            <span className="flex items-center gap-1.5"><Icons.layers className="size-3.5" />{project.project_size_mw} MW</span>
                            <span className="flex items-center gap-1.5"><Icons.zap className="size-3.5" />{project.technology_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-10">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Capital Needed</p>
                          <p className="text-sm font-bold text-primary">${(project.capital_required / 1000000).toFixed(1)}M</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Stage</p>
                          <p className="text-sm font-bold text-text-main">{project.project_stage.replace('_', ' ')}</p>
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
              <EmptyState icon="search" title="No Projects Available" description="No projects seeking grant funding are available right now." actionLabel="Refresh" onAction={() => window.location.reload()} />
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-text-main">Funded Projects</h2>
            {engagements.length > 0 ? (
              <div className="grid gap-6">
                {engagements.map(eng => (
                  <div key={eng.id} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">{eng.project?.name}</h4>
                      <p className="text-sm text-text-muted">Status: {getStateLabel(eng.status)}</p>
                    </div>
                    <Link href={`/dashboard/engagements/${eng.id}`}><Button variant="outline">View Engagement</Button></Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="briefcase" title="No Funded Projects" description="You haven't funded any projects yet. Start by exploring the marketplace." actionLabel="Explore Marketplace" onAction={() => setActiveTab('marketplace')} />
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
                          <p className="text-xs text-text-muted font-medium">Status: {getStateLabel(eng.status)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon="messageSquare" title="No Messages" description="Start an engagement to begin communicating with project developers." />}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <EmptyState icon="pieChart" title="Reports Coming Soon" description="Grant disbursement reports and impact analytics will be available here once you have active engagements." />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Grant Profile</h2>
              <Button onClick={async () => {
                if (!user?.company_id) return;
                setUpdatingProfile(true);
                try {
                  if (!grantProfileId) {
                    const { data: created } = await supabase.from('grant_providers').insert({ company_id: user.company_id, ...profileData }).select().single();
                    setGrantProfileId(created?.id || null);
                  } else {
                    const { error } = await supabase.from('grant_providers').update(profileData).eq('id', grantProfileId);
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Grant Size ($)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.min_grant_size} onChange={(e) => setProfileData({ ...profileData, min_grant_size: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Grant Size ($)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.max_grant_size} onChange={(e) => setProfileData({ ...profileData, max_grant_size: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Disbursement Criteria</label>
                <textarea className="w-full h-24 p-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none" value={profileData.disbursement_criteria} onChange={(e) => setProfileData({ ...profileData, disbursement_criteria: e.target.value })} placeholder="Describe your grant disbursement criteria..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grant Types (Comma separated)</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.grant_types?.join(', ')} onChange={(e) => setProfileData({ ...profileData, grant_types: e.target.value.split(',').map(s => s.trim()) })} placeholder="e.g. Technical Assistance, Feasibility Study, Capacity Building" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Focus Sectors (Comma separated)</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.focus_sectors?.join(', ')} onChange={(e) => setProfileData({ ...profileData, focus_sectors: e.target.value.split(',').map(s => s.trim()) })} placeholder="e.g. Solar, Wind, Hydro" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Geographic Focus (Comma separated)</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.geographic_focus?.join(', ')} onChange={(e) => setProfileData({ ...profileData, geographic_focus: e.target.value.split(',').map(s => s.trim()) })} placeholder="e.g. Zambia, Kenya, Nigeria" />
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
