import type { ChatChunk, ChatRequest, LLMProvider } from './types';
import { getSetting } from './settings-helper';

const BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';

export interface DeepSeekModel {
  id: string;
  owned_by: string;
}

export async function fetchDeepSeekModels(): Promise<DeepSeekModel[]> {
  const apiKey = await getSetting<string>('api_key_deepseek');
  if (!apiKey) return [];

  const resp = await fetch(`${BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!resp.ok) return [];

  const json = await resp.json();
  return (json.data ?? []) as DeepSeekModel[];
}

export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';

  async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await getSetting<string>('api_key_deepseek');
    if (!apiKey) {
      yield { type: 'error', error: 'DeepSeek API key not configured' };
      return;
    }

    const model = (await getSetting<string>('deepseek_model')) || DEFAULT_MODEL;

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
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      yield { type: 'error', error: `DeepSeek API ${response.status}: ${text}` };
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
