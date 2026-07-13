'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import LeafLoader from '@/components/ui/electric-loader';
import { cn } from '@/lib/utils';
import { projectsApi, capitalPartnersApi } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement, CapitalPartner } from '@/types';
import { ACCEPTED_TECHNICAL_STATUSES, getStateLabel } from '@/lib/engagement';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { KpiBarSkeleton } from '@/components/ui/skeleton';

export default function InvestorDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [portfolioEngagements, setPortfolioEngagements] = useState<Engagement[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [capProfile, setCapProfile] = useState<CapitalPartner | null>(null);
  const [capitalPartnerId, setCapitalPartnerId] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileData, setProfileData] = useState<any>({
    preferred_structures: [], min_ticket_size: 0, max_ticket_size: 0,
    risk_tolerance: 'MEDIUM', geographic_focus: [], sector_focus: [],
    preferred_project_stage: [], preferred_capital_structure: [], expected_return_profile: '',
  });

  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchMarketplace() {
      setMarketplaceProjects([]);
      setLoadingMarketplace(true);
      try {
        const response = await projectsApi.getAdminAll();
        if (response.data) {
          const projectsWithBuilders = await Promise.all(response.data.map(async (p) => {
            const { data: epcEngagement } = await supabase
              .from('engagements').select('counterparty_id').eq('project_id', p.id)
              .eq('counterparty_type', 'TECHNICAL').in('status', ACCEPTED_TECHNICAL_STATUSES).maybeSingle();
            if (epcEngagement) {
              const { data: techPartner } = await supabase
                .from('technical_partners').select('*, company:companies(*)')
                .eq('company_id', epcEngagement.counterparty_id).maybeSingle();
              return { ...p, builder_partner_name: techPartner?.company?.name };
            }
            return p;
          }));
          setMarketplaceProjects(projectsWithBuilders as Project[]);
        }
      } catch (error) { console.error('Error fetching marketplace:', error); }
      finally { setLoadingMarketplace(false); }
    }

    async function fetchPortfolio() {
      if (user?.company_id) {
        setLoadingPortfolio(true);
        try {
          const engData = await engagementService.getCompanyEngagements(user.company_id);
          const { data: partnerData } = await supabase
            .from('capital_partners').select('*, company:companies(*)')
            .eq('company_id', user.company_id).maybeSingle();
          setPortfolioEngagements(engData);
          if (partnerData) {
            setCapProfile(partnerData);
            setCapitalPartnerId(partnerData.id);
            setProfileData({
              preferred_structures: partnerData.preferred_structures || [],
              min_ticket_size: partnerData.min_ticket_size || 0,
              max_ticket_size: partnerData.max_ticket_size || 0,
              risk_tolerance: partnerData.risk_tolerance || 'MEDIUM',
              geographic_focus: partnerData.geographic_focus || [],
              sector_focus: partnerData.sector_focus || [],
              preferred_project_stage: partnerData.preferred_project_stage || [],
              preferred_capital_structure: partnerData.preferred_capital_structure || [],
              expected_return_profile: partnerData.expected_return_profile || '',
            });
          }
        } catch (error) { console.error('Error fetching portfolio:', error); }
        finally { setLoadingPortfolio(false); }
      }
    }
    if (user) {
      if (activeTab === 'dashboard' || activeTab === 'marketplace') fetchMarketplace();
      if (activeTab === 'dashboard' || activeTab === 'portfolio' || activeTab === 'profile') fetchPortfolio();
    }
  }, [user, activeTab]);

  if (loading || !user) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><LeafLoader size={100} /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ── Welcome Section ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Capital Partner Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {activeTab === 'dashboard' ? 'Investment pipeline and opportunities at a glance.' : activeTab === 'marketplace' ? 'Browse projects matching your criteria.' : activeTab === 'portfolio' ? 'Your active engagements.' : activeTab === 'messages' ? 'Communications hub.' : activeTab === 'profile' ? 'Manage your investment profile.' : 'Performance reports.'}
          </p>
        </div>
      </div>

        {activeTab === 'dashboard' && (
          <>
            <div className="relative p-12 rounded-[40px] bg-slate-900 text-white overflow-hidden mb-12 shadow-2xl group">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4 group-hover:bg-primary/30 transition-all duration-1000" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4" />
              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-green-400 border border-green-500/20 mb-8">
                  <Icons.zap className="size-3.5 fill-green-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Institutional Insight</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-[1.1]">New Opportunities <br /><span className="text-primary-light">Found for You.</span></h2>
                <p className="text-lg text-slate-400 font-medium leading-relaxed mb-10">We've identified {marketplaceProjects.length} high-potential projects matching your investment criteria.</p>
                <Button onClick={() => setActiveTab('marketplace')} className="h-14 px-10 bg-primary text-white font-black rounded-2xl hover:scale-105 hover:shadow-xl hover:shadow-primary/20 transition-all">Review Matches</Button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-8 px-2">
              <h2 className="text-xl font-bold text-text-main">Top Opportunities</h2>
              <button onClick={() => setActiveTab('marketplace')} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">View All Marketplace</button>
            </div>

            {loadingMarketplace ? (
              <KpiBarSkeleton />
            ) : marketplaceProjects.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                {marketplaceProjects.slice(0, 4).map(project => (
                  <OpportunityCard key={project.id} id={project.id} name={project.name} location={project.location_country}
                    capital={`$${(project.capital_required / 1000000).toFixed(1)}M`} readiness={project.scores?.capital_readiness_score || 0}
                    tags={[project.technology_type, project.project_stage.replace('_', ' ')]} builderPartner={(project as any).builder_partner_name} />
                ))}
              </div>
            ) : (
              <EmptyState icon="search" title="No Projects Available" description="We're currently vetting new energy infrastructure projects. Check back soon for institutional-grade opportunities." actionLabel="Refresh Feed" onAction={() => window.location.reload()} />
            )}
          </>
        )}

        {activeTab === 'marketplace' && (
          <div className="space-y-8">
            {loadingMarketplace ? (
              <KpiBarSkeleton />
            ) : marketplaceProjects.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-8">
                {marketplaceProjects.map(project => (
                  <OpportunityCard key={project.id} id={project.id} name={project.name} location={project.location_country}
                    capital={`$${(project.capital_required / 1000000).toFixed(1)}M`} readiness={project.scores?.capital_readiness_score || 0}
                    tags={[project.technology_type, project.project_stage.replace('_', ' ')]} builderPartner={(project as any).builder_partner_name} />
                ))}
              </div>
            ) : (
              <EmptyState icon="search" title="Marketplace Empty" description="No projects matching your current investment criteria were found in the global marketplace." actionLabel="Clear Filters" onAction={() => window.location.reload()} />
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-8">
            {loadingPortfolio ? (
              <div className="p-12 text-center bg-surface rounded-3xl"><Icons.spinner className="size-8 animate-spin mx-auto text-primary" /></div>
            ) : portfolioEngagements.length > 0 ? (
              <div className="grid gap-6">
                {portfolioEngagements.map(eng => (
                  <div key={eng.id} className="p-6 rounded-[32px] bg-white border border-gray-100 shadow-soft flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="size-14 rounded-2xl bg-slate-50 flex items-center justify-center text-primary"><Icons.zap className="size-7" /></div>
                      <div>
                        <h4 className="text-lg font-bold text-text-main">{eng.project?.name}</h4>
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mt-1">Status: <span className="text-primary">{getStateLabel(eng.status)}</span></p>
                      </div>
                    </div>
                    <Link href={`/dashboard/engagements/${eng.id}`}><Button variant="outline" className="rounded-xl border-gray-200">Milestone Room</Button></Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="briefcase" title="Portfolio Empty" description="You haven't committed to any projects yet. Start by exploring the marketplace to find your first investment." actionLabel="Explore Marketplace" onAction={() => setActiveTab('marketplace')} />
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Investment Profile</h2>
              <Button onClick={async () => {
                if (!user?.company_id) return;
                setUpdatingProfile(true);
                try {
                  if (!capitalPartnerId) {
                    const { data: createdPartner } = await supabase.from('capital_partners').insert({ company_id: user.company_id, ...profileData }).select().single();
                    setCapitalPartnerId(createdPartner?.id || null);
                  } else { await capitalPartnersApi.update(capitalPartnerId, profileData); }
                  alert('Profile updated successfully');
                } catch { alert('Failed to update profile'); }
                finally { setUpdatingProfile(false); }
              }} disabled={updatingProfile} className="bg-primary text-white rounded-xl h-12 px-8 font-bold shadow-lg">
                {updatingProfile ? <Icons.spinner className="size-4 animate-spin mr-2" /> : <Icons.check className="size-4 mr-2" />} Save Preferences
              </Button>
            </div>
            <div className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-soft space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Ticket Size ($)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.min_ticket_size} onChange={(e) => setProfileData({ ...profileData, min_ticket_size: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Ticket Size ($)</label>
                  <input type="number" className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.max_ticket_size} onChange={(e) => setProfileData({ ...profileData, max_ticket_size: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expected Return Profile</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm focus:outline-none" value={profileData.expected_return_profile} onChange={(e) => setProfileData({ ...profileData, expected_return_profile: e.target.value })} placeholder="e.g. 15-20% IRR" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preferred Structures</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.preferred_structures?.join(', ')} onChange={(e) => setProfileData({ ...profileData, preferred_structures: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preferred Capital Structure</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.preferred_capital_structure?.join(', ')} onChange={(e) => setProfileData({ ...profileData, preferred_capital_structure: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preferred Project Stages</label>
                <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.preferred_project_stage?.join(', ')} onChange={(e) => setProfileData({ ...profileData, preferred_project_stage: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sector Focus (Comma separated)</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.sector_focus?.join(', ')} onChange={(e) => setProfileData({ ...profileData, sector_focus: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Geographic Focus</label>
                  <input className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50/30 text-sm" value={profileData.geographic_focus?.join(', ')} onChange={(e) => setProfileData({ ...profileData, geographic_focus: e.target.value.split(',').map(s => s.trim()) })} />
                </div>
              </div>
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
                        <div className="size-10 rounded-xl bg-gray-50 flex items-center justify-center text-text-muted shrink-0 border border-gray-100"><Icons.messageSquare className="size-5" /></div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-bold text-text-main">{eng.project?.name}</h4>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{new Date(eng.updated_at || eng.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-text-muted font-medium">Last activity: {getStateLabel(eng.status)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : <div className="p-12 text-center text-sm text-text-muted italic">No active conversations.</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <EmptyState icon="pieChart" title="Reports Coming Soon" description="Investment reports and analytics will be available here once you have active portfolio engagements." />
          </div>
        )}
    </div>
  );
}

function OpportunityCard({ id, name, location, capital, readiness, tags, builderPartner }: { id: string, name: string, location: string, capital: string, readiness: number, tags: string[], builderPartner?: string }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  return (
    <div className="p-8 rounded-[40px] bg-surface border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-text-main group-hover:text-primary transition-colors">{name}</h3>
            {builderPartner && (
              <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded border border-blue-100 flex items-center gap-1">
                <Icons.hardHat className="size-2.5" /> Builder: {builderPartner}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider"><Icons.mapPin className="size-3" />{location}</div>
        </div>
        <div className={cn("size-10 rounded-full border border-gray-100 flex items-center justify-center cursor-pointer transition-colors", isBookmarked ? "text-primary bg-primary/10 border-primary/20" : "text-text-muted hover:text-primary")} onClick={() => { setIsBookmarked(!isBookmarked); if (!isBookmarked) alert("Project saved to watchlist"); }}>
          <Icons.bookmark className={cn("size-4", isBookmarked && "fill-current")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mb-8 py-6 border-y border-gray-50">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Capital Req.</p>
          <p className="text-sm font-bold text-text-main">{capital}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Readiness</p>
          <p className="text-sm font-bold text-primary">{readiness}%</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tags.map(tag => <span key={tag} className="px-3 py-1 rounded-lg bg-background text-[10px] font-bold text-text-muted uppercase tracking-wider">{tag}</span>)}
        </div>
        <Link href={`/projects/${id}`}><Button className="h-10 px-6 rounded-xl bg-text-main text-white font-bold text-xs hover:bg-text-main/90 transition-all">Review Deal</Button></Link>
      </div>
    </div>
  );
}
