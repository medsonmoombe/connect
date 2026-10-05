import type {
  AIProvider, EvidenceExtractionInput, EvidenceExtractionResult,
} from '../types';
import { AIProviderError } from '../types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;

  constructor(private readonly apiKey: string) {}

  async extractEvidence({
    systemPrompt,
    userPrompt,
    content,
    model,
    maxOutputTokens,
  }: EvidenceExtractionInput): Promise<EvidenceExtractionResult> {
    const parts: object[] = [];

    if (content.kind === 'vision') {
      parts.push({ text: userPrompt });
      for (const img of content.images ?? []) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
      }
    } else {
      // Text content — include the extracted document text explicitly
      parts.push({ text: userPrompt });
      if (content.text) {
        parts.push({ text: `\n\nDOCUMENT CONTENT:\n${content.text}` });
      }
    }

    const t0 = Date.now();
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AIProviderError('PROVIDER_ERROR', `Gemini ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const rawText: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
      const reason = json.candidates?.[0]?.finishReason ?? 'unknown';
      throw new AIProviderError('PROVIDER_ERROR', `Gemini returned empty response (finishReason: ${reason})`);
    }

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
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: Date.now() - t0,
      },
    };
  }
}
