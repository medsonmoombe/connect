export interface AiProvider {
  generateContent(model: string, prompt: string | string[], config?: AiGenerationConfig): Promise<string>;
  generateContentWithFiles(model: string, prompt: string, fileParts: { inlineData: { data: string; mimeType: string } }[], config?: AiGenerationConfig): Promise<string>;
}

export interface AiGenerationConfig {
  temperature?: number;
  responseMimeType?: string;
  tools?: any[];
}

class GoogleAiProvider implements AiProvider {
  async generateContent(model: string, prompt: string | string[], config: AiGenerationConfig = {}): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature: config.temperature ?? 0.1,
      },
      tools: config.tools,
    });

    const prompts = Array.isArray(prompt) ? prompt : [prompt];
    const result = await geminiModel.generateContent(prompts);
    return result.response.text();
  }

  async generateContentWithFiles(model: string, prompt: string, fileParts: { inlineData: { data: string; mimeType: string } }[], config: AiGenerationConfig = {}): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: config.responseMimeType,
        temperature: config.temperature ?? 0.1,
      },
      tools: config.tools,
    });

    // Gemini needs the prompt as a string, then file parts as separate content parts
    const contents = [{ text: prompt }, ...fileParts.map(fp => ({ inlineData: fp.inlineData }))];
    const result = await geminiModel.generateContent(contents);
    return result.response.text();
  }
}

let aiProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (!aiProvider) {
    aiProvider = new GoogleAiProvider();
  }
  return aiProvider;
}

export function setAiProvider(provider: AiProvider): void {
  aiProvider = provider;
}
