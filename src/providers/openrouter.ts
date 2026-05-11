import type { ChatChunk, ChatRequest, LLMProvider } from './types';
import { getSetting } from './settings-helper';

const BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  modelSettingKey: string;
  fallbackModel: string;

  constructor(modelSettingKey: string, fallbackModel: string) {
    this.modelSettingKey = modelSettingKey;
    this.fallbackModel = fallbackModel;
  }

  async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await getSetting<string>('api_key_openrouter');
    if (!apiKey) {
      yield { type: 'error', error: 'OpenRouter API key not configured — add it in Settings' };
      return;
    }

    const model = (await getSetting<string>(this.modelSettingKey)) || this.fallbackModel;

    const body: Record<string, unknown> = {
      model,
      messages: req.messages,
      stream: true,
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 16384,
    };

    if (req.tools?.length) body.tools = req.tools;
    if (req.jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Newton Study',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      yield { type: 'error', error: `OpenRouter ${response.status}: ${text}` };
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (delta.content) {
            yield { type: 'content', content: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                yield {
                  type: 'tool_call_start',
                  toolCallIndex: tc.index,
                  toolCall: {
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.function.name, arguments: '' },
                  },
                };
              }
              if (tc.function?.arguments) {
                yield {
                  type: 'tool_call_delta',
                  toolCallIndex: tc.index,
                  toolCall: {
                    function: { name: '', arguments: tc.function.arguments },
                  },
                };
              }
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    yield { type: 'done' };
  }
}

export interface OpenRouterUsage {
  totalUsd: number;
  limitUsd: number | null;
  rateLimitRequests: number | null;
  rateLimitInterval: string | null;
}

export async function fetchOpenRouterUsage(): Promise<OpenRouterUsage | null> {
  const apiKey = await getSetting<string>('api_key_openrouter');
  if (!apiKey) return null;

  const resp = await fetch(`${BASE_URL}/auth/key`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  const d = json.data;
  return {
    totalUsd: d.usage ?? 0,
    limitUsd: d.limit ?? null,
    rateLimitRequests: d.rate_limit?.requests ?? null,
    rateLimitInterval: d.rate_limit?.interval ?? null,
  };
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  promptPricing: number;
  completionPricing: number;
  supportsImages: boolean;
  supportsTools: boolean;
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const resp = await fetch(`${BASE_URL}/models`);
  if (!resp.ok) return [];

  const json = await resp.json();
  return (json.data ?? []).map((m: Record<string, unknown>) => {
    const pricing = m.pricing as Record<string, string> | undefined;
    const arch = m.architecture as Record<string, unknown> | undefined;
    const modality = (arch?.modality ?? '') as string;
    const supported = (m.supported_parameters ?? []) as string[];
    return {
      id: m.id as string,
      name: (m.name as string) || (m.id as string),
      contextLength: (m.context_length as number) || 0,
      promptPricing: parseFloat(pricing?.prompt ?? '0') * 1_000_000,
      completionPricing: parseFloat(pricing?.completion ?? '0') * 1_000_000,
      supportsImages: modality.includes('image'),
      supportsTools: supported.includes('tools'),
    };
  });
}
