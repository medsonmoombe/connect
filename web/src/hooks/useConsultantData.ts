'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { companiesApi, matchingApi } from '@/services/api';
import { apiClient } from '@/lib/api-client';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, ConsultantProfile, Company, EngagementStatus } from '@/types';
import { describeError, SectionErrorMap } from '@/lib/section-errors';

export interface ConsultantSections {
  engagements?: boolean;
  marketplace?: boolean;
  matches?: boolean;
  autoRunMatching?: boolean;
}

/**
 * Data layer for the standalone Consultant portal pages.
 * Each page declares which sections it needs; the hook loads exactly those
 * on mount (pages are independent, so navigating always fetches fresh data).
 */
export function useConsultantData(sections: ConsultantSections = {}) {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);
  const [consultantProfileId, setConsultantProfileId] = useState<string | null>(null);
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
        companiesApi.getById(user.company_id),
      ]);
      setEngagements(engData || []);
      if (companyRes.data) setCompany(companyRes.data);

      const { data: profileData } = await supabase
        .from('consultants').select('*')
        .eq('company_id', user.company_id).maybeSingle();
      if (profileData) {
        setConsultantProfile(profileData as ConsultantProfile);
        setConsultantProfileId(profileData.id);
      }
    } catch (e) {
      console.error('Consultant engagements fetch error:', e);
      setSectionError('engagements', describeError(e));
    } finally {
      setLoadingEngagements(false);
    }
  }, [user, setSectionError]);

  const fetchMarketplace = useCallback(async () => {
    if (!user) return;
    setLoadingMarketplace(true);
    setSectionError('marketplace', null);
    try {
      const { data: projects, error } = await supabase
        .from('projects').select('*, company:companies(name)')
        .is('deleted_at', null)
        .in('project_stage', ['CONCEPT', 'PRE_FEASIBILITY', 'FULL_FEASIBILITY'])
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      setMarketplaceProjects((projects || []) as Project[]);
    } catch (e) {
      console.error('Consultant marketplace fetch error:', e);
      setSectionError('marketplace', describeError(e));
    } finally {
      setLoadingMarketplace(false);
    }
  }, [user, setSectionError]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingMatches(true);
    setSectionError('matches', null);
    try {
      const res = await matchingApi.getMatchesForConsultant();
      if (res.data) setMatches(res.data);
    } catch (e) {
      console.error('Consultant matches fetch error:', e);
      setSectionError('matches', describeError(e));
    } finally {
      setLoadingMatches(false);
    }
  }, [user, setSectionError]);

  const runMatchingEngine = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient.post<{ data: any }>('/matching/run', { run_for_partner: true });
    } catch (e) {
      console.error('Consultant matching engine error:', e);
    }
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

  const engagedProjectMap = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of engagements) {
      if (e.project_id && !map[e.project_id]) map[e.project_id] = e;
    }
    return map;
  }, [engagements]);

  const matchScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of matches) {
      if (m.project_id && m.compatibility_score !== undefined) {
        map[m.project_id] = m.compatibility_score;
      }
    }
    return map;
  }, [matches]);

  const handleEngagementStatusChange = useCallback(async (engagementId: string, newStatus: EngagementStatus) => {
    await engagementService.updateStatus(engagementId, newStatus);
    setEngagements(prev => prev.map(e => e.id === engagementId ? { ...e, status: newStatus } : e));
  }, []);

  return {
    loading,
    user,
    engagements,
    activeEngagements,
    engagedProjectMap,
    marketplaceProjects,
    matches,
    matchScoreMap,
    consultantProfile,
    consultantProfileId,
    company,
    loadingEngagements,
    loadingMarketplace,
    loadingMatches,
    errors,
    clearErrors,
    runMatchingEngine,
    fetchEngagements,
    fetchMarketplace,
    fetchMatches,
    forceRefresh,
    handleEngagementStatusChange,
  };
}
