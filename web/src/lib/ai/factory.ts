import type { AIProvider, ProviderId } from './types';
import { AIProviderError } from './types';
import { GeminiProvider } from './providers/gemini';
import { MistralProvider } from './providers/mistral';
import { DeepSeekProvider } from './providers/deepseek';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new AIProviderError('PROVIDER_ERROR', `${key} is not set in environment`);
  return v;
}

export function createProvider(id: ProviderId): AIProvider {
  switch (id) {
    case 'gemini':   return new GeminiProvider(requireEnv('GEMINI_API_KEY'));
    case 'mistral':  return new MistralProvider(requireEnv('MISTRAL_API_KEY'));
    case 'deepseek': return new DeepSeekProvider(requireEnv('DEEPSEEK_API_KEY'));
    default:
      throw new AIProviderError('PROVIDER_ERROR', `Unknown provider: ${id}`);
  }
}
