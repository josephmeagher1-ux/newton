import { registerTool, type ToolContext, type ToolResult } from './registry';
import { getProvider } from '../providers/registry';
import type { ChatMessage } from '../providers/types';

registerTool({
  name: 'call_model',
  description: 'Call another AI model with a prompt. Useful for sub-tasks like delegating vision grading or generating structured data.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', enum: ['text', 'vision', 'grading'], description: 'Task type determines which model is used' },
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['system', 'user', 'assistant'] },
            content: { type: 'string' },
          },
          required: ['role', 'content'],
        },
        description: 'Messages to send',
      },
      maxTokens: { type: 'number', description: 'Max tokens (default 4096)' },
    },
    required: ['task', 'messages'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const approved = await ctx.confirm({
      tool: 'call_model',
      preview: `Call ${args.task} model with ${(args.messages as unknown[]).length} messages`,
    });
    if (!approved) return { ok: false, content: 'User declined' };

    const provider = getProvider(args.task as 'text' | 'vision' | 'grading');
    const messages = args.messages as ChatMessage[];
    let content = '';

    for await (const chunk of provider.chat({ messages, maxTokens: (args.maxTokens as number) ?? 4096 })) {
      if (chunk.type === 'content' && chunk.content) content += chunk.content;
      if (chunk.type === 'error') return { ok: false, content: chunk.error ?? 'Model error' };
    }

    return { ok: true, content };
  },
});
