#!/usr/bin/env npx tsx
/**
 * Golden test: run real AI provider calls against fixture documents and
 * compare output against expected evidence keys + document types.
 *
 * Usage:
 *   npx tsx web/scripts/golden-test-ai.ts --provider gemini
 *   npx tsx web/scripts/golden-test-ai.ts --provider mistral --model mistral-small-latest
 *
 * Provider and model come from `ai_provider_config` + `ai_model_catalog`, the
 * same source the app uses, so this script can never drift onto a retired
 * model. Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the
 * relevant provider API key in the environment.
 *
 * Place fixture docs in web/golden/docs/ and define cases in web/golden/cases.json.
 * See web/golden/cases.example.json for the schema.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createProvider } from '../src/lib/ai/factory';
import { getAIConfig } from '../src/lib/ai/config';
import { getCatalogModel, listCatalogModels, estimateCost } from '../src/lib/ai/catalog';
import { normalizeDocument } from '../src/lib/ai/document-processing';
import { SYSTEM_PROMPT, buildUserPrompt } from '../src/lib/ai/prompt';
import { evidenceOutputSchema, type ProviderModel } from '../src/lib/ai/types';
import type { ProviderId } from '../src/lib/ai/types';

const GOLDEN_DIR = path.join(process.cwd(), 'golden');
const CASES_FILE = path.join(GOLDEN_DIR, 'cases.json');

const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

interface GoldenCase {
  file: string;
  category: string;
  expect: {
    document_type?: string;
    evidence?: string[];
    min_confidence?: number;
  };
}

/** Resolve the provider + model under test from the same tables the app reads. */
async function resolveTarget(providerArg?: ProviderId, modelArg?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set so the ' +
      'provider/model can be resolved from ai_model_catalog',
    );
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const cfg = await getAIConfig(sb);
  const providerId: ProviderId = providerArg ?? cfg.activeProvider;

  let model: ProviderModel;
  if (modelArg) {
    model = await getCatalogModel(sb, providerId, modelArg);
  } else if (providerId === cfg.activeProvider) {
    model = await getCatalogModel(sb, providerId, cfg.activeModel);
  } else {
    const enabled = (await listCatalogModels(sb, providerId)).find((m) => m.enabled);
    if (!enabled) throw new Error(`No enabled model in ai_model_catalog for provider "${providerId}"`);
    model = enabled;
  }

  return { providerId, model };
}

async function main() {
  const providerArg = process.argv[process.argv.indexOf('--provider') + 1] as ProviderId | undefined;
  const modelIndex = process.argv.indexOf('--model');
  const modelArg = modelIndex === -1 ? undefined : process.argv[modelIndex + 1];

  if (!fs.existsSync(CASES_FILE)) {
    console.error(`No cases file found at ${CASES_FILE}`);
    console.error('Create golden/cases.json — see golden/cases.example.json for the schema.');
    process.exit(1);
  }

  const cases: GoldenCase[] = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
  const { providerId, model } = await resolveTarget(providerArg, modelArg);
  const provider = createProvider(providerId);

  console.log(`\nGolden test · provider=${provider.id} · model=${model.id} (${model.label})\n`);
  console.log(`${'File'.padEnd(45)} Result`);
  console.log('-'.repeat(80));

  let pass = 0;
  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const c of cases) {
    const filePath = path.join(GOLDEN_DIR, c.file);
    const baseName = path.basename(c.file).padEnd(44);

    if (!fs.existsSync(filePath)) {
      console.log(`${baseName} SKIP  (file not found)`);
      continue;
    }

    try {
      const bytes = fs.readFileSync(filePath).buffer;
      const ext = path.extname(c.file).toLowerCase();
      const mimeType = MIME[ext] ?? 'application/pdf';

      const content = await normalizeDocument(
        { bytes, mimeType, name: path.basename(c.file) },
        48_000,
      );

      const res = await provider.extractEvidence({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt({ name: path.basename(c.file), category: c.category }),
        content,
        model: model.id,
        maxOutputTokens: 2000,
      });

      const out = evidenceOutputSchema.parse(res.raw);
      const cost = estimateCost(model, res.usage);
      totalCost += cost;
      totalIn += res.usage.inputTokens;
      totalOut += res.usage.outputTokens;

      const failures: string[] = [];

      if (c.expect.document_type && out.document_type !== c.expect.document_type) {
        failures.push(`type=${out.document_type}≠${c.expect.document_type}`);
      }

      const minConf = c.expect.min_confidence ?? 0.7;
      for (const key of c.expect.evidence ?? []) {
        const ev = out.evidence.find((e) => e.key === key && e.value === true);
        if (!ev) {
          failures.push(`missing key: ${key}`);
        } else if (ev.confidence < minConf) {
          failures.push(`${key} conf=${ev.confidence.toFixed(2)}<${minConf}`);
        }
      }

      if (out.authenticity.assessment === 'suspicious') {
        failures.push(`flagged suspicious: ${out.authenticity.notes.slice(0, 60)}`);
      }

      if (failures.length === 0) {
        pass++;
        console.log(`${baseName} PASS  ($${cost.toFixed(4)}, ${res.usage.inputTokens}in/${res.usage.outputTokens}out)`);
      } else {
        console.log(`${baseName} FAIL  ${failures.join(' · ')}  ($${cost.toFixed(4)})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
      console.log(`${baseName} ERROR ${msg}`);
    }
  }

  console.log('-'.repeat(80));
  console.log(`\n${pass}/${cases.length} passed`);
  console.log(`Tokens: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  if (cases.length > 0) {
    console.log(`Projected per-project (×8 docs): $${((totalCost / cases.length) * 8).toFixed(4)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
