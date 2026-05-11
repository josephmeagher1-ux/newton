import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ToolCall, ToolDef } from '../providers/types';
import type { LLMProvider } from '../providers/types';
import { getTool } from '../tools';
import { getDb } from '../storage/db';
import type { Message } from '../storage/db';

type StoredMessage = Message & { threadId: string };

interface UseChatOptions {
  provider: LLMProvider;
  systemPrompt: string;
  tools?: ToolDef[];
  threadId: string;
  onToolConfirm: (proposal: { tool: string; preview: string }) => Promise<boolean>;
}

interface ChatState {
  messages: StoredMessage[];
  streaming: boolean;
  error: string | null;
}

export function useChat(options: UseChatOptions) {
  const [state, setState] = useState<ChatState>({ messages: [], streaming: false, error: null });
  const abortRef = useRef<AbortController | null>(null);
  const maxRounds = 5;

  const loadHistory = useCallback(async () => {
    const db = await getDb();
    const msgs = await db.getAllFromIndex('messages', 'by-thread', options.threadId);
    setState(s => ({ ...s, messages: msgs }));
  }, [options.threadId]);

  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    setState(s => ({ ...s, streaming: true, error: null }));
    const db = await getDb();

    const userMsg: Message & { threadId: string } = {
      id: crypto.randomUUID(),
      threadId: options.threadId,
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    await db.put('messages', userMsg);
    setState(s => ({ ...s, messages: [...s.messages, userMsg] }));

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: options.systemPrompt },
      ...state.messages.map(m => ({ role: m.role, content: m.content } as ChatMessage)),
      {
        role: 'user' as const,
        content: imageBase64
          ? [{ type: 'text' as const, text: content }, { type: 'image_url' as const, image_url: { url: imageBase64 } }]
          : content,
      },
    ];

    let rounds = 0;
    while (rounds < maxRounds) {
      rounds++;
      let assistantContent = '';
      const toolCalls: ToolCall[] = [];
      const toolCallArgs: Map<number, string> = new Map();

      for await (const chunk of options.provider.chat({
        messages: chatMessages,
        tools: options.tools,
        stream: true,
      })) {
        if (chunk.type === 'content' && chunk.content) {
          assistantContent += chunk.content;
          setState(s => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant' && !last.toolCalls) {
              msgs[msgs.length - 1] = { ...last, content: assistantContent };
            } else {
              msgs.push({
                id: crypto.randomUUID(),
                threadId: options.threadId,
                role: 'assistant',
                content: assistantContent,
                createdAt: Date.now(),
              });
            }
            return { ...s, messages: msgs };
          });
        }

        if (chunk.type === 'tool_call_start' && chunk.toolCall) {
          const idx = chunk.toolCallIndex ?? 0;
          toolCalls[idx] = chunk.toolCall as ToolCall;
          toolCallArgs.set(idx, chunk.toolCall.function?.arguments ?? '');
        }

        if (chunk.type === 'tool_call_delta' && chunk.toolCall?.function?.arguments) {
          const idx = chunk.toolCallIndex ?? 0;
          const current = toolCallArgs.get(idx) ?? '';
          toolCallArgs.set(idx, current + chunk.toolCall.function.arguments);
        }

        if (chunk.type === 'error') {
          setState(s => ({ ...s, streaming: false, error: chunk.error ?? 'Unknown error' }));
          return;
        }
      }

      // Finalize tool call arguments
      for (const [idx, args] of toolCallArgs) {
        if (toolCalls[idx]) {
          toolCalls[idx]!.function.arguments = args;
        }
      }

      // Save assistant message
      const assistantMsg: Message & { threadId: string } = {
        id: crypto.randomUUID(),
        threadId: options.threadId,
        role: 'assistant',
        content: assistantContent,
        toolCalls: toolCalls.length > 0 ? toolCalls.map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })) : undefined,
        createdAt: Date.now(),
      };
      await db.put('messages', assistantMsg);

      if (toolCalls.length === 0) break;

      // Execute tool calls
      chatMessages.push({
        role: 'assistant',
        content: assistantContent || '',
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (!tc) continue;
        const tool = getTool(tc.function.name);
        let result = '{"error": "Unknown tool"}';

        if (tool) {
          try {
            const args = JSON.parse(tc.function.arguments || '{}');
            const res = await tool.execute(args, {
              threadId: options.threadId,
              confirm: options.onToolConfirm,
            });
            result = res.content;
          } catch (e) {
            result = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
          }
        }

        chatMessages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });

        const toolMsg: Message & { threadId: string } = {
          id: crypto.randomUUID(),
          threadId: options.threadId,
          role: 'tool',
          content: result,
          toolCallId: tc.id,
          createdAt: Date.now(),
        };
        await db.put('messages', toolMsg);
        setState(s => ({ ...s, messages: [...s.messages, toolMsg] }));
      }
    }

    setState(s => ({ ...s, streaming: false }));
  }, [options, state.messages]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState(s => ({ ...s, streaming: false }));
  }, []);

  return { ...state, sendMessage, loadHistory, abort };
}
