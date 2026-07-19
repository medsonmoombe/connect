'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LeafLoader from '@/components/ui/electric-loader';
import { projectsApi, matchingApi } from '@/services/api';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement, CapitalPartner } from '@/types';

import { DashboardOverview } from '@/components/investor/DashboardOverview';
import { apiClient } from '@/lib/api-client';
import { MyMatchesTab } from '@/components/investor/MyMatchesTab';
import { MarketplaceTab } from '@/components/investor/MarketplaceTab';
import { PortfolioTab } from '@/components/investor/PortfolioTab';
import { MessagesTab } from '@/components/investor/MessagesTab';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { ProfileTab } from '@/components/investor/ProfileTab';
import { ReportsTab } from '@/components/investor/ReportsTab';
import { BookmarksTab } from '@/components/investor/BookmarksTab';
import { ProjectBookmark } from '@/types';

type TabId = 'dashboard' | 'matches' | 'marketplace' | 'portfolio' | 'messages' | 'reports' | 'profile' | 'bookmarks';

export default function InvestorDashboard() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';
  const { unreadByEngagement } = useUnreadMessages();

  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [capProfile, setCapProfile] = useState<CapitalPartner | null>(null);
  const [capitalPartnerId, setCapitalPartnerId] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<ProjectBookmark[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingEngagements, setLoadingEngagements] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);

  const loadedRef = useRef({ projects: false, engagements: false, matches: false, bookmarks: false });

  const router = useRouter();
  const { user, loading } = useAuth();

  // Auth redirect
  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role !== 'CAPITAL_PARTNER' && user.role !== 'ADMIN') router.push('/dashboard');
    }
  }, [user, loading, router]);

  const setTab = useCallback((tab: TabId) => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const url = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    router.push(url);
  }, [router]);

  // Fetch bookmarks
  const fetchBookmarks = useCallback(async () => {
    if (!user || loadedRef.current.bookmarks) return;
    setLoadingBookmarks(true);
    try {
      const res = await fetch('/api/projects/bookmarks');
      const json = await res.json();
      const data: ProjectBookmark[] = json.data ?? [];
      setBookmarks(data);
      setBookmarkedIds(new Set(data.map((b: ProjectBookmark) => b.project_id)));
      loadedRef.current.bookmarks = true;
    } catch (e) { console.error('Bookmarks fetch error:', e); }
    finally { setLoadingBookmarks(false); }
  }, [user]);

  // Fetch projects (once per session, reused across tabs)
  const fetchProjects = useCallback(async () => {
    if (!user || loadedRef.current.projects) return;
    setLoadingProjects(true);
    try {
      const res = await projectsApi.getMarketplace();
      if (res.data) setProjects(res.data);
      loadedRef.current.projects = true;
    } catch (e) { console.error('Marketplace fetch error:', e); }
    finally { setLoadingProjects(false); }
  }, [user]);

  // Fetch engagements (once per session)
  const fetchEngagements = useCallback(async () => {
    if (!user?.company_id || loadedRef.current.engagements) return;
    setLoadingEngagements(true);
    try {
      const data = await engagementService.getCompanyEngagements(user.company_id);
      setEngagements(data || []);
      console.log('Fetched engagements:', data);

      // Also fetch capital partner profile from engagements context
      const { supabase } = await import('@/lib/supabase');
      const { data: partnerData } = await supabase
        .from('capital_partners').select('*, company:companies(*)')
        .eq('company_id', user.company_id).maybeSingle();
      if (partnerData) {
        setCapProfile(partnerData);
        setCapitalPartnerId(partnerData.id);
      }
      loadedRef.current.engagements = true;
    } catch (e) { console.error('Portfolio fetch error:', e); }
    finally { setLoadingEngagements(false); }
  }, [user]);

  // Fetch match scores (once per session)
  const fetchMatches = useCallback(async () => {
    if (!user || loadedRef.current.matches) return;
    setLoadingMatches(true);
    try {
      const res = await matchingApi.getMatchesForPartner();
      if (res.data) setMatches(res.data);
      loadedRef.current.matches = true;
    } catch (e) { console.error('Matches fetch error:', e); }
    finally { setLoadingMatches(false); }
  }, [user]);

  // Load data on mount and when tab changes
  useEffect(() => {
    if (!user) return;

    // Always load these once
    fetchProjects();
    fetchMatches();
    fetchBookmarks();

    if (['portfolio', 'messages', 'dashboard', 'matches', 'marketplace', 'bookmarks'].includes(activeTab)) {
      fetchEngagements();
    }
    if (activeTab === 'bookmarks') {
      loadedRef.current.bookmarks = false;
      fetchBookmarks();
    }
  }, [user, activeTab, fetchProjects, fetchEngagements, fetchMatches, fetchBookmarks]);

  // Build match score lookup map: projectId -> compatibility_score
  const matchScoreMap = useCallback(() => {
    const map: Record<string, number> = {};
    for (const m of matches) {
      if (m.project_id && m.compatibility_score !== undefined) {
        map[m.project_id] = m.compatibility_score;
      }
    }
    return map;
  }, [matches])();

  const handleBookmarkToggle = useCallback((projectId: string, bookmarked: boolean) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (bookmarked) next.add(projectId); else next.delete(projectId);
      return next;
    });
    if (!bookmarked) {
      setBookmarks(prev => prev.filter(b => b.project_id !== projectId));
    } else {
      // Refetch bookmarks to get full project data
      loadedRef.current.bookmarks = false;
      fetchBookmarks();
    }
  }, [fetchBookmarks]);

  const handleProfileSaved = useCallback((data: any, id: string | null) => {
    setCapProfile(data);
    if (id) setCapitalPartnerId(id);
    loadedRef.current.matches = false;
    loadedRef.current.projects = false;
  }, []);

  const forceRefresh = useCallback(() => {
    loadedRef.current = { projects: false, engagements: false, matches: false, bookmarks: false };
    setLoadingProjects(true);
    setLoadingEngagements(true);
    setLoadingMatches(true);
    fetchProjects();
    fetchEngagements();
    fetchMatches();
  }, [fetchProjects, fetchEngagements, fetchMatches]);

  const handleRunMatching = useCallback(async () => {
    await apiClient.post<{ data: any }>('/matching/run', { run_for_partner: true });
    loadedRef.current.matches = false;
    await fetchMatches();
  }, [fetchMatches]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LeafLoader size={100} />
      </div>
    );
  }

  const tabDescriptions: Record<TabId, string> = {
    dashboard: 'Investment pipeline and opportunities at a glance.',
    matches: 'Your ranked project matches with compatibility scores.',
    marketplace: 'Browse projects matching your criteria.',
    portfolio: 'Your active engagements and deal pipeline.',
    messages: 'Communications hub.',
    reports: 'Performance reports.',
    profile: 'Manage your investment profile.',
    bookmarks: 'Projects you have saved for later.',
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-1">Capital Partner Overview</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">{tabDescriptions[activeTab]}</p>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardOverview
          matches={matches}
          engagementCount={engagements.length}
          loading={loadingProjects || loadingMatches}
          onGoToMatches={() => setTab('matches')}
          onGoToMarketplace={() => setTab('marketplace')}
          onGoToPortfolio={() => setTab('portfolio')}
          onGoToProfile={() => setTab('profile')}
          onRunMatching={handleRunMatching}
        />
      )}

      {activeTab === 'matches' && (
        <MyMatchesTab
          matches={matches}
          engagements={engagements}
          loading={loadingMatches}
          onRefresh={forceRefresh}
          bookmarkedIds={bookmarkedIds}
          onBookmarkToggle={handleBookmarkToggle}
        />
      )}

      {activeTab === 'marketplace' && (
        <MarketplaceTab
          projects={projects}
          matchScores={matchScoreMap}
          engagements={engagements}
          loading={loadingProjects}
          onRefresh={forceRefresh}
          capitalPartnerId={capitalPartnerId}
          bookmarkedIds={bookmarkedIds}
          onBookmarkToggle={handleBookmarkToggle}
        />
      )}

      {activeTab === 'portfolio' && (
        <PortfolioTab
          engagements={engagements}
          loading={loadingEngagements}
          onExplore={() => setTab('marketplace')}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesTab
          engagements={engagements}
          loading={loadingEngagements}
          unreadByEngagement={unreadByEngagement}
        />
      )}

      {activeTab === 'bookmarks' && (
        <BookmarksTab
          bookmarks={bookmarks}
          matchScores={matchScoreMap}
          engagements={engagements}
          loading={loadingBookmarks}
          capitalPartnerId={capitalPartnerId}
          onRemove={(projectId) => handleBookmarkToggle(projectId, false)}
          onExplore={() => setTab('marketplace')}
        />
      )}

      {activeTab === 'reports' && <ReportsTab />}

      {activeTab === 'profile' && user.company_id && (
        <ProfileTab
          capProfile={capProfile}
          capitalPartnerId={capitalPartnerId}
          userId={user.company_id}
          onProfileSaved={handleProfileSaved}
        />
      )}
    </div>
  );
}
