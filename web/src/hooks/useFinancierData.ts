'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, matchingApi } from '@/services/api';
import { apiClient } from '@/lib/api-client';
import { engagementService } from '@/lib/engagement';
import { Project, Engagement, CapitalPartner, ProjectBookmark, EngagementStatus } from '@/types';
import { describeError, SectionErrorMap } from '@/lib/section-errors';

export interface FinancierSections {
  projects?: boolean;
  engagements?: boolean;
  matches?: boolean;
  bookmarks?: boolean;
  autoRunMatching?: boolean;
}

/**
 * Data layer for the standalone Financier portal pages.
 * Each page declares which sections it needs; the hook loads exactly those
 * on mount (pages are independent, so navigating always fetches fresh data).
 */
export function useFinancierData(sections: FinancierSections = {}) {
  const { user, loading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [capProfile, setCapProfile] = useState<CapitalPartner | null>(null);
  const [capitalPartnerId, setCapitalPartnerId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<ProjectBookmark[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingEngagements, setLoadingEngagements] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  // Per-section error messages (null = OK) so pages can show a retry banner
  // instead of an empty list that looks like "no data".
  const [errors, setErrors] = useState<SectionErrorMap>({});
  const clearErrors = useCallback(() => setErrors({}), []);
  const setSectionError = useCallback(
    (section: string, message: string | null) => setErrors(prev => ({ ...prev, [section]: message })),
    []
  );


  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    setSectionError('projects', null);
    try {
      const res = await projectsApi.getMarketplace();
      if (res.data) setProjects(res.data);
    } catch (e) {
      console.error('Marketplace fetch error:', e);
      setSectionError('projects', describeError(e));
    } finally { setLoadingProjects(false); }
  }, [user, setSectionError]);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setLoadingBookmarks(true);
    setSectionError('bookmarks', null);
    try {
      const res = await fetch('/api/projects/bookmarks');
      const json = await res.json();
      if (!res.ok) throw new Error(`Bookmarks request failed (${res.status})`);
      const data: ProjectBookmark[] = json.data ?? [];
      setBookmarks(data);
      setBookmarkedIds(new Set(data.map((b: ProjectBookmark) => b.project_id)));
    } catch (e) {
      console.error('Bookmarks fetch error:', e);
      setSectionError('bookmarks', describeError(e));
    } finally { setLoadingBookmarks(false); }
  }, [user, setSectionError]);

  const fetchEngagements = useCallback(async () => {
    if (!user?.company_id) return;
    setLoadingEngagements(true);
    setSectionError('engagements', null);
    try {
      const data = await engagementService.getCompanyEngagements(user.company_id);
      setEngagements(data || []);

      // Capital partner profile + id ride along on the engagements fetch
      const { supabase } = await import('@/lib/supabase');
      const { data: partnerData } = await supabase
        .from('capital_partners').select('*, company:companies(*)')
        .eq('company_id', user.company_id).maybeSingle();
      if (partnerData) {
        setCapProfile(partnerData);
        setCapitalPartnerId(partnerData.id);
      }
    } catch (e) {
      console.error('Engagements fetch error:', e);
      setSectionError('engagements', describeError(e));
    } finally { setLoadingEngagements(false); }
  }, [user, setSectionError]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingMatches(true);
    setSectionError('matches', null);
    try {
      const res = await matchingApi.getMatchesForPartner();
      if (res.data) setMatches(res.data);
    } catch (e) {
      console.error('Matches fetch error:', e);
      setSectionError('matches', describeError(e));
    } finally { setLoadingMatches(false); }
  }, [user, setSectionError]);

  const runMatchingEngine = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient.post<{ data: any }>('/matching/run', { run_for_partner: true });
    } catch (e) { console.error('Matching engine error:', e); }
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    if (sections.projects) fetchProjects();
    if (sections.bookmarks) fetchBookmarks();
    if (sections.engagements) fetchEngagements();
    if (sections.matches) {
      // Perf: matches are PERSISTED by the matching engine — a plain read
      // serves them. Re-running the engine on every mount burned CPU at
      // scale; the explicit "Re-run matching" button (runMatchingEngine)
      // and admin/cron runs are the only compute triggers now.
      fetchMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const handleBookmarkToggle = useCallback((projectId: string, bookmarked: boolean) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (bookmarked) next.add(projectId); else next.delete(projectId);
      return next;
    });
    if (!bookmarked) {
      setBookmarks(prev => prev.filter(b => b.project_id !== projectId));
    }
  }, []);

  const handleProfileSaved = useCallback((data: any, id: string | null) => {
    setCapProfile(data);
    if (id) setCapitalPartnerId(id);
  }, []);

  const handleEngagementStatusChange = useCallback(async (engagementId: string, newStatus: EngagementStatus) => {
    await engagementService.updateStatus(engagementId, newStatus);
    setEngagements(prev => prev.map(e => e.id === engagementId ? { ...e, status: newStatus } : e));
  }, []);

  const forceRefresh = useCallback(async () => {
    await Promise.all([
      sections.projects ? fetchProjects() : Promise.resolve(),
      sections.engagements ? fetchEngagements() : Promise.resolve(),
      sections.matches ? fetchMatches() : Promise.resolve(),
      sections.bookmarks ? fetchBookmarks() : Promise.resolve(),
    ]);
  }, [sections, fetchProjects, fetchEngagements, fetchMatches, fetchBookmarks]);

  const matchScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matches) {
      if (m.project_id && m.compatibility_score !== undefined) {
        map[m.project_id] = m.compatibility_score;
      }
    }
    return map;
  }, [matches]);

  return {
    loading,
    user,
    projects,
    engagements,
    matches,
    capProfile,
    capitalPartnerId,
    bookmarks,
    bookmarkedIds,
    loadingProjects,
    loadingEngagements,
    loadingMatches,
    loadingBookmarks,
    matchScoreMap,
    errors,
    clearErrors,
    runMatchingEngine,
    handleBookmarkToggle,
    handleProfileSaved,
    handleEngagementStatusChange,
    forceRefresh,
    fetchProjects,
    fetchBookmarks,
  };
}
