'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { engagementService } from '@/lib/engagement';
import { supabase } from '@/lib/supabase';
import { companiesApi } from '@/services/api';
import { Project, Engagement, PowerTrader, Company } from '@/types';
import { describeError, SectionErrorMap } from '@/lib/section-errors';

export interface TraderSections {
  engagements?: boolean;
  marketplace?: boolean;
  matches?: boolean;
}

export interface TraderProfileData {
  license_type: string;
  max_offtake_capacity_mw: number;
  preferred_technology_types: string[];
  regions_of_interest: string[];
  min_ppa_duration_years: number;
  credit_rating_equivalent: string;
}

export const EMPTY_TRADER_PROFILE: TraderProfileData = {
  license_type: 'TRADING', max_offtake_capacity_mw: 0,
  preferred_technology_types: [], regions_of_interest: [],
  min_ppa_duration_years: 0, credit_rating_equivalent: '',
};

/**
 * Data layer for the standalone Power Trader portal pages.
 * Each page declares which sections it needs; the hook loads exactly those
 * on mount (pages are independent, so navigating always fetches fresh data).
 */
export function useTraderData(sections: TraderSections = {}) {
  const { user, loading } = useAuth();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [marketplaceProjects, setMarketplaceProjects] = useState<Project[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [traderProfile, setTraderProfile] = useState<TraderProfileData | null>(null);
  const [traderId, setTraderId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

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

      const { data: profile } = await supabase
        .from('power_traders').select('*')
        .eq('company_id', user.company_id).maybeSingle();
      if (profile) {
        setTraderProfile({
          license_type: profile.license_type || 'TRADING',
          max_offtake_capacity_mw: profile.max_offtake_capacity_mw || 0,
          preferred_technology_types: profile.preferred_technology_types || [],
          regions_of_interest: profile.regions_of_interest || [],
          min_ppa_duration_years: profile.min_ppa_duration_years || 0,
          credit_rating_equivalent: profile.credit_rating_equivalent || '',
        });
        setTraderId(profile.id);
      }
    } catch (e) {
      console.error('Trader engagements fetch error:', e);
      setSectionError('engagements', describeError(e));
    } finally { setLoadingEngagements(false); }
  }, [user, setSectionError]);

  const fetchMarketplace = useCallback(async () => {
    if (!user) return;
    setLoadingMarketplace(true);
    setSectionError('marketplace', null);
    try {
      const res = await fetch('/api/matches/trader?limit=100');
      const json = await res.json();
      if (!res.ok) throw new Error(`Marketplace request failed (${res.status})`);
      const projects = (json.data || [])
        .map((match: any) => match.project)
        .filter(Boolean);
      setMarketplaceProjects(projects as Project[]);
    } catch (e) {
      console.error('Trader marketplace fetch error:', e);
      setSectionError('marketplace', describeError(e));
    } finally { setLoadingMarketplace(false); }
  }, [user, setSectionError]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingMatches(true);
    setSectionError('matches', null);
    try {
      const res = await fetch('/api/matches/trader?limit=100');
      const json = await res.json();
      if (!res.ok) throw new Error(`Matches request failed (${res.status})`);
      setMatches(json.data || []);
    } catch (e) {
      console.error('Trader matches fetch error:', e);
      setSectionError('matches', describeError(e));
    } finally { setLoadingMatches(false); }
  }, [user, setSectionError]);

  useEffect(() => {
    if (!user || loading) return;
    if (sections.engagements) fetchEngagements();
    if (sections.marketplace) fetchMarketplace();
    if (sections.matches) fetchMatches();
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

  return {
    loading,
    user,
    engagements,
    activeEngagements,
    engagedProjectMap,
    marketplaceProjects,
    matches,
    matchScoreMap,
    traderProfile: traderProfile ?? EMPTY_TRADER_PROFILE,
    hasTraderProfile: !!traderProfile,
    traderId,
    company,
    loadingEngagements,
    loadingMarketplace,
    loadingMatches,
    errors,
    clearErrors,
    fetchEngagements,
    fetchMarketplace,
    fetchMatches,
    forceRefresh,
  };
}
