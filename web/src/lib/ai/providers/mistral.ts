import type {
  AIProvider, EvidenceExtractionInput, EvidenceExtractionResult,
} from '../types';
import { AIProviderError } from '../types';

const API = 'https://api.mistral.ai/v1/chat/completions';

export class MistralProvider implements AIProvider {
  readonly id = 'mistral' as const;

  constructor(private readonly apiKey: string) {}

  async extractEvidence({
    systemPrompt,
    userPrompt,
    content,
    model,
    maxOutputTokens,
  }: EvidenceExtractionInput): Promise<EvidenceExtractionResult> {
    const userParts: object[] = [{ type: 'text', text: userPrompt }];

    if (content.kind === 'vision') {
      for (const img of content.images ?? []) {
        userParts.push({
          type: 'image_url',
          image_url: `data:${img.mimeType};base64,${img.base64}`,
        });
      }
    } else if (content.text) {
      // Append extracted document text explicitly
      userParts.push({ type: 'text', text: `\n\nDOCUMENT CONTENT:\n${content.text}` });
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
          { role: 'user', content: userParts },
        ],
        temperature: 0.1,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AIProviderError('PROVIDER_ERROR', `Mistral ${res.status}: ${body.slice(0, 300)}`);
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
