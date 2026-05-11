import type { ChatChunk, ChatRequest, LLMProvider, ContentPart } from './types';
import { getSetting } from './settings-helper';

const BASE_URL = 'https://api.anthropic.com/v1';
const MODEL = 'claude-sonnet-4-5-20241022';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await getSetting<string>('api_key_anthropic');
    if (!apiKey) {
      yield { type: 'error', error: 'Anthropic API key not configured' };
      return;
    }

    const systemMsg = req.messages.find(m => m.role === 'system');
    const messages = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: this.formatContent(m.content),
      }));

    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: req.maxTokens ?? 8192,
      stream: true,
    };

    if (systemMsg) body.system = typeof systemMsg.content === 'string' ? systemMsg.content : '';

    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      yield { type: 'error', error: `Anthropic API ${response.status}: ${text}` };
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
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { type: 'content', content: parsed.delta.text };
          } else if (parsed.type === 'message_stop') {
            yield { type: 'done' };
            return;
          }
        } catch {
          // skip
        }
      }
    }

    yield { type: 'done' };
  }

  private formatContent(content: string | ContentPart[]): unknown {
    if (typeof content === 'string') return content;
    return content.map(part => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      if (part.type === 'image_url') {
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          const [meta, data] = url.split(',');
          const mediaType = meta?.split(':')[1]?.split(';')[0] ?? 'image/png';
          return {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          };
        }
        return { type: 'image', source: { type: 'url', url } };
      }
      return part;
    });
  }
}
