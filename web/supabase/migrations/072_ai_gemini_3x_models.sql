-- 072_ai_gemini_3x_models.sql
-- Gemini 2.0 Flash and 2.0 Flash-Lite were shut down on 2026-06-01 and now
-- return 404 NOT_FOUND from the Generative Language API, which broke every AI
-- analysis run. Repoint the catalog and the active model at the current 3.x
-- tier (Flash-Lite stays the cost-optimized default).
--
-- This migration also makes ai_model_catalog the single source of truth for
-- model metadata: token limits move here from the provider classes, so a
-- retired model is a one-row change instead of a code edit in several places.

-- ── Token limits join the catalog ────────────────────────────────────────────
alter table ai_model_catalog
  add column if not exists max_input_tokens  int not null default 128000,
  add column if not exists max_output_tokens int not null default 8192;

-- Preserve the limits the providers used to hardcode
update ai_model_catalog
set max_input_tokens = 1000000, max_output_tokens = 8192
where provider = 'gemini';

update ai_model_catalog
set max_input_tokens = 128000, max_output_tokens = 8192
where provider in ('mistral', 'deepseek');

-- ── Add the current replacement models ───────────────────────────────────────
-- Upsert so re-running keeps prices/limits authoritative.
insert into ai_model_catalog
  (provider, model, label, input_per_1m, output_per_1m, supports_vision, max_input_tokens, max_output_tokens, enabled)
values
  ('gemini', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 0.30, 2.50, true, 1000000, 8192, true),
  ('gemini', 'gemini-3.6-flash',      'Gemini 3.6 Flash',      1.50, 7.50, true, 1000000, 8192, true)
on conflict (provider, model) do update set
  label             = excluded.label,
  input_per_1m      = excluded.input_per_1m,
  output_per_1m     = excluded.output_per_1m,
  supports_vision   = excluded.supports_vision,
  max_input_tokens  = excluded.max_input_tokens,
  max_output_tokens = excluded.max_output_tokens,
  enabled           = excluded.enabled;

-- ── Retire the shut-down models ──────────────────────────────────────────────
-- Rows are kept (and left disabled) so historical usage logs still join.
update ai_model_catalog
set enabled = false
where provider = 'gemini'
  and model in ('gemini-2.0-flash-lite', 'gemini-2.0-flash');

-- ── Repoint the active model ─────────────────────────────────────────────────
-- Future installs default to the cheapest live model
alter table ai_provider_config
  alter column active_model set default 'gemini-3.5-flash-lite';

update ai_provider_config
set active_model = 'gemini-3.5-flash-lite',
    updated_at   = now()
where active_model = 'gemini-2.0-flash-lite';

update ai_provider_config
set active_model = 'gemini-3.6-flash',
    updated_at   = now()
where active_model = 'gemini-2.0-flash';
