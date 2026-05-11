import { executeSandboxed } from './sandbox';
import { registerTool, type ToolContext, type ToolResult } from './registry';
import { getDb } from '../storage/db';

registerTool({
  name: 'run_js',
  description: 'Execute arbitrary async JavaScript in a sandboxed scope. Has access to: storage (get/put/getAll/delete), console, Math, JSON, Date, crypto.randomUUID, setTimeout. Does NOT have access to: window, document, fetch, eval, Function, import.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'JavaScript code to execute (async context)' },
    },
    required: ['code'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const code = args.code as string;
    const approved = await ctx.confirm({ tool: 'run_js', preview: code });
    if (!approved) return { ok: false, content: 'User declined execution' };

    const startTime = Date.now();
    const result = await executeSandboxed(code);
    const durationMs = Date.now() - startTime;

    const db = await getDb();
    await db.add('tool_calls', {
      threadId: ctx.threadId,
      tool: 'run_js',
      input: { code },
      output: result,
      approved: true,
      executedAt: startTime,
      durationMs,
      error: result.error,
    });

    if (!result.ok) {
      return { ok: false, content: `Error: ${result.error}\nLogs: ${result.logs.join('\n')}` };
    }

    const output = [
      result.value !== undefined ? `Result: ${JSON.stringify(result.value)}` : '',
      result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
    ].filter(Boolean).join('\n');

    return { ok: true, content: output || '(no output)' };
  },
});
