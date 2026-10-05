'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { matchingApi } from '@/services/api';
import { apiClient } from '@/lib/api-client';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, TechnicalPartner, Company, EngagementStatus } from '@/types';
import { describeError, SectionErrorMap } from '@/lib/section-errors';

export interface TechnicalSections {
  engagements?: boolean;
  marketplace?: boolean;
  matches?: boolean;
  autoRunMatching?: boolean;
}

/**
 * Data layer for the standalone Technical Partner portal pages.
 * Each page declares which sections it needs; the hook loads exactly those
 * on mount (pages are independent, so navigating always fetches fresh data).
 */
export function useTechnicalData(sections: TechnicalSections = {}) {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [techProfile, setTechProfile] = useState<TechnicalPartner | null>(null);
  const [technicalPartnerId, setTechnicalPartnerId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [matches, setMatches] = useState<any[]>([]);

  const [loadingEngagements, setLoadingEngagements] = useState(false);
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Per-section error messages (null = OK) so pages can show a retry banner
  // instead of an empty list that looks like "no data".
  const [errors, setErrors] = useState<SectionErrorMap>({});
  const clearErrors = useCallback(() => setErrors({}), []);
  const setSectionError = useCallback(
    (section: string, message: string | null) => setErrors(prev => ({ ...prev, [section]: message })),
    []
  );


  const fetchEngagements = useCallback(async () => {
    if (!user?.company_id) return;
    setLoadingEngagements(true);
    setSectionError('engagements', null);
    try {
      const [engData, companyRes] = await Promise.all([
        engagementService.getCompanyEngagements(user.company_id),
        (await import('@/services/api')).companiesApi.getById(user.company_id),
      ]);
      setEngagements(engData);
      if (companyRes.data) setCompany(companyRes.data);

      const { data: partnerData } = await supabase
        .from('technical_partners').select('*, company:companies(*)')
        .eq('company_id', user.company_id).maybeSingle();
      if (partnerData) {
        setTechProfile(partnerData);
        setTechnicalPartnerId(partnerData.id);
      }
    } catch (e) {
      console.error('Engagements fetch error:', e);
      setSectionError('engagements', describeError(e));
    } finally { setLoadingEngagements(false); }
  }, [user, setSectionError]);

  const fetchMarketplace = useCallback(async () => {
    if (!user) return;
    setLoadingMarketplace(true);
    setSectionError('marketplace', null);
    try {
      const { data: projects } = await supabase
        .from('projects').select('*, company:companies(name)')
        .is('deleted_at', null)
        .in('project_stage', ['FULL_FEASIBILITY', 'REGULATORY_APPROVAL', 'FINANCIAL_CLOSE', 'CONSTRUCTION'])
        .order('created_at', { ascending: false });
      setMarketplaceProjects((projects || []) as Project[]);
    } catch (e) {
      console.error('Marketplace fetch error:', e);
      setSectionError('marketplace', describeError(e));
    } finally { setLoadingMarketplace(false); }
  }, [user, setSectionError]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingMatches(true);
    setSectionError('matches', null);
    try {
      const res = await matchingApi.getMatchesForTechnicalPartner();
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
    if (sections.engagements) fetchEngagements();
    if (sections.marketplace) fetchMarketplace();
    if (sections.matches) {
      // Perf: read persisted matches; the engine only runs on explicit re-run.
      fetchMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const handleProfileSaved = useCallback((data: TechnicalPartner, id: string | null) => {
    setTechProfile(data);
    if (id) setTechnicalPartnerId(id);
  }, []);

  const handleEngagementStatusChange = useCallback(async (engagementId: string, newStatus: EngagementStatus) => {
    await engagementService.updateStatus(engagementId, newStatus);
    setEngagements(prev => prev.map(e => e.id === engagementId ? { ...e, status: newStatus } : e));
  }, []);

  const forceRefresh = useCallback(async () => {
    await Promise.all([
      sections.engagements ? fetchEngagements() : Promise.resolve(),
      sections.marketplace ? fetchMarketplace() : Promise.resolve(),
      sections.matches ? fetchMatches() : Promise.resolve(),
    ]);
  }, [sections, fetchEngagements, fetchMarketplace, fetchMatches]);

  const activeEngagements = useMemo(
    () => engagements.filter(e => !['CLOSED', 'DROPPED'].includes(e.status)),
    [engagements]
  );

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
    engagements,
    activeEngagements,
    marketplaceProjects,
    techProfile,
    technicalPartnerId,
    company,
    matches,
    matchScoreMap,
    loadingEngagements,
    loadingMarketplace,
    loadingMatches,
    errors,
    clearErrors,
    runMatchingEngine,
    fetchMatches,
    fetchEngagements,
    fetchMarketplace,
    handleProfileSaved,
    handleEngagementStatusChange,
    forceRefresh,
  };
}
