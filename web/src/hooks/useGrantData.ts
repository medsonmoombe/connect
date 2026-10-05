'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, Company } from '@/types';
import { describeError, SectionErrorMap } from '@/lib/section-errors';

export interface GrantSections {
  engagements?: boolean;
  matches?: boolean;
  autoRunMatching?: boolean;
}

export interface GrantProfileData {
  grant_types: string[];
  min_grant_size: number;
  max_grant_size: number;
  focus_sectors: string[];
  geographic_focus: string[];
  eligibility_criteria: string;
  application_process: string;
  typical_timeline_months: number;
}

export const EMPTY_GRANT_PROFILE: GrantProfileData = {
  grant_types: [], min_grant_size: 0, max_grant_size: 0,
  focus_sectors: [], geographic_focus: [],
  eligibility_criteria: '', application_process: '', typical_timeline_months: 0,
};

/**
 * Data layer for the standalone Grant Provider portal pages.
 * Each page declares which sections it needs; the hook loads exactly those
 * on mount (pages are independent, so navigating always fetches fresh data).
 */
export function useGrantData(sections: GrantSections = {}) {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [grantProfile, setGrantProfile] = useState<GrantProfileData | null>(null);
  const [grantProviderId, setGrantProviderId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const [loadingEngagements, setLoadingEngagements] = useState(false);
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
        supabase.from('companies').select('*').eq('id', user.company_id).maybeSingle(),
      ]);
      setEngagements(engData || []);
      if (companyRes.data) setCompany(companyRes.data as Company);

      const { data: profile } = await supabase
        .from('grant_providers').select('*')
        .eq('company_id', user.company_id).maybeSingle();
      if (profile) {
        setGrantProfile({
          grant_types: profile.grant_types || [],
          min_grant_size: profile.min_grant_size || 0,
          max_grant_size: profile.max_grant_size || 0,
          focus_sectors: profile.focus_sectors || [],
          geographic_focus: profile.geographic_focus || [],
          eligibility_criteria: profile.eligibility_criteria || '',
          application_process: profile.application_process || '',
          typical_timeline_months: profile.typical_timeline_months || 0,
        });
        setGrantProviderId(profile.id);
      }
    } catch (e) {
      console.error('Grant engagements fetch error:', e);
      setSectionError('engagements', describeError(e));
    } finally { setLoadingEngagements(false); }
  }, [user, setSectionError]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingMatches(true);
    setSectionError('matches', null);
    try {
      // Grant providers are capital partners — use the capital matches endpoint,
      // which reads grant_match_results when the company has a grant_providers row.
      const res = await apiClient.get<{ data: any[] }>('/matches/capital');
      setMatches(res.data ?? []);
    } catch (e) {
      console.error('Grant matches fetch error:', e);
      setSectionError('matches', describeError(e));
    } finally { setLoadingMatches(false); }
  }, [user, setSectionError]);

  const runMatchingEngine = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient.post<{ data: any }>('/matching/run', { run_for_partner: true });
    } catch (e: any) {
      // Grant providers may not have a capital_partners row yet — not fatal
      console.warn('Grant matching run skipped:', e?.message ?? e);
    }
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    if (sections.engagements) fetchEngagements();
    if (sections.matches) {
      // Perf: read persisted matches; the engine only runs on explicit re-run.
      fetchMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const forceRefresh = useCallback(async () => {
    await Promise.all([
      sections.engagements ? fetchEngagements() : Promise.resolve(),
      // Pull-only refresh: re-fetch rows; users trigger the engine via the
      // explicit re-run buttons when they want fresh scores.
      sections.matches ? fetchMatches() : Promise.resolve(),
    ]);
  }, [sections, fetchEngagements, fetchMatches, runMatchingEngine]);

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

  return {
    loading,
    user,
    engagements,
    activeEngagements,
    engagedProjectMap,
    matches,
    grantProfile: grantProfile ?? EMPTY_GRANT_PROFILE,
    hasGrantProfile: !!grantProfile,
    grantProviderId,
    company,
    loadingEngagements,
    loadingMatches,
    errors,
    clearErrors,
    runMatchingEngine,
    fetchEngagements,
    fetchMatches,
    forceRefresh,
  };
}
