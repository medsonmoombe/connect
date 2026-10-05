import type {
  AIProvider, EvidenceExtractionInput, EvidenceExtractionResult,
} from '../types';
import { AIProviderError } from '../types';

const API = 'https://api.deepseek.com/chat/completions';

export class DeepSeekProvider implements AIProvider {
  readonly id = 'deepseek' as const;

  constructor(private readonly apiKey: string) {}

  async extractEvidence({
    systemPrompt,
    userPrompt,
    content,
    model,
    maxOutputTokens,
  }: EvidenceExtractionInput): Promise<EvidenceExtractionResult> {
    if (content.kind === 'vision') {
      throw new AIProviderError(
        'UNSUPPORTED_CONTENT',
        'DeepSeek vision is not enabled — scanned/image documents are skipped for this provider',
      );
    }

    const t0 = Date.now();
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AIProviderError('PROVIDER_ERROR', `DeepSeek ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const rawText: string = json.choices?.[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/,(\s*[}\]])/g, '$1');
      parsed = JSON.parse(cleaned);
    }

    return {
      raw: parsed,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - t0,
      },
    };
  }
}
