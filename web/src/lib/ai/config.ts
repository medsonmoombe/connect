import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderId } from './types';
import { AIProviderError } from './types';

export interface AIConfig {
  activeProvider: ProviderId;
  activeModel: string;
  promptVersion: number;
  confidenceThreshold: number;
  maxCharsPerDoc: number;
  platformMonthlyBudgetUsd: number;
}

let cache: { cfg: AIConfig; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAIConfig(sb: SupabaseClient): Promise<AIConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.cfg;

  const { data, error } = await sb
    .from('ai_provider_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    throw new AIProviderError('PROVIDER_ERROR', 'AI config unavailable — check ai_provider_config table');
  }

  cache = {
    cfg: {
      activeProvider: data.active_provider as ProviderId,
      activeModel: data.active_model,
      promptVersion: data.prompt_version,
      confidenceThreshold: Number(data.confidence_threshold),
      maxCharsPerDoc: data.max_chars_per_doc,
      platformMonthlyBudgetUsd: Number(data.platform_monthly_budget_usd),
    },
    at: Date.now(),
  };
  return cache.cfg;
}

export function invalidateAIConfigCache(): void {
  cache = null;
}
