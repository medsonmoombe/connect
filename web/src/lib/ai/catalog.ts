import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderId, ProviderModel } from './types';
import { AIProviderError } from './types';

/**
 * The `ai_model_catalog` table is the single source of truth for which models
 * exist, what they cost, and how much they accept. Providers deliberately do
 * not carry their own model lists — when a vendor retires a model (for example
 * Gemini 2.0 Flash-Lite in June 2026) only this table and its migration change.
 */

interface CatalogRow {
  provider: string;
  model: string;
  label: string;
  input_per_1m: number | string;
  output_per_1m: number | string;
  supports_vision: boolean;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  enabled: boolean;
}

/** Defaults for rows created before the token-limit columns existed. */
const DEFAULT_MAX_INPUT_TOKENS = 128_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;

export function toProviderModel(row: CatalogRow): ProviderModel {
  return {
    id: row.model,
    label: row.label,
    inputPer1M: Number(row.input_per_1m),
    outputPer1M: Number(row.output_per_1m),
    vision: row.supports_vision,
    maxInputTokens: row.max_input_tokens ?? DEFAULT_MAX_INPUT_TOKENS,
    maxOutputTokens: row.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    enabled: row.enabled,
  };
}

/**
 * Resolve one usable model for a provider. Throws when the model is unknown or
 * has been disabled, which is how a shut-down vendor model surfaces as a clear
 * configuration error instead of a 404 from the provider API.
 */
export async function getCatalogModel(
  sb: SupabaseClient,
  provider: ProviderId,
  model: string,
): Promise<ProviderModel> {
  const { data, error } = await sb
    .from('ai_model_catalog')
    .select('*')
    .eq('provider', provider)
    .eq('model', model)
    .maybeSingle();

  if (error) {
    throw new AIProviderError('PROVIDER_ERROR', `ai_model_catalog lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new AIProviderError(
      'PROVIDER_ERROR',
      `Unknown model "${model}" for provider "${provider}" — add it to ai_model_catalog`,
    );
  }
  if (!data.enabled) {
    throw new AIProviderError(
      'PROVIDER_ERROR',
      `Model "${model}" is disabled in ai_model_catalog (likely retired by the vendor)`,
    );
  }

  return toProviderModel(data as CatalogRow);
}

/**
 * Resolve the model a job should run on, preferring the configured one.
 *
 * If the configured model has been disabled (vendor retirement, or a stale
 * ai_provider_config row) we fall back to the provider's next enabled model
 * rather than failing the job — a stranded project stuck in `scoring` is worse
 * than running one tier up, and the switch is logged loudly. Throws only when
 * the provider has no usable model at all.
 */
export async function resolveModel(
  sb: SupabaseClient,
  provider: ProviderId,
  preferredModel: string,
): Promise<ProviderModel> {
  const enabled = (await listCatalogModels(sb, provider)).filter((m) => m.enabled);

  const preferred = enabled.find((m) => m.id === preferredModel);
  if (preferred) return preferred;

  if (enabled.length === 0) {
    throw new AIProviderError(
      'PROVIDER_ERROR',
      `No enabled models in ai_model_catalog for provider "${provider}"`,
    );
  }

  console.warn(
    `[AI Catalog] Configured model "${preferredModel}" is unavailable for provider ` +
    `"${provider}" — falling back to "${enabled[0].id}". Update ai_provider_config.`,
  );
  return enabled[0];
}

/** Every catalog entry for a provider, enabled rows first. */
export async function listCatalogModels(
  sb: SupabaseClient,
  provider?: ProviderId,
): Promise<ProviderModel[]> {
  let query = sb.from('ai_model_catalog').select('*');
  if (provider) query = query.eq('provider', provider);

  const { data, error } = await query
    .order('provider')
    .order('enabled', { ascending: false });

  if (error) {
    throw new AIProviderError('PROVIDER_ERROR', `ai_model_catalog lookup failed: ${error.message}`);
  }
  return (data ?? []).map((row) => toProviderModel(row as CatalogRow));
}

/** Price a call from the catalog row that produced it. */
export function estimateCost(
  model: Pick<ProviderModel, 'inputPer1M' | 'outputPer1M'>,
  usage: { inputTokens: number; outputTokens: number },
): number {
  return (
    (usage.inputTokens / 1e6) * model.inputPer1M +
    (usage.outputTokens / 1e6) * model.outputPer1M
  );
}
