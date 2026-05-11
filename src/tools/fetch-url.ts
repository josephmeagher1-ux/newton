import { registerTool, type ToolContext, type ToolResult } from './registry';

const MAX_RESPONSE_KB = 512;

registerTool({
  name: 'fetch_url',
  description: 'Fetch a URL and return the response body as text. Always requires confirmation. Shows the hostname to the user.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method (default GET)' },
      body: { type: 'string', description: 'Request body for POST' },
    },
    required: ['url'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const url = args.url as string;
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return { ok: false, content: 'Invalid URL' };
    }

    const approved = await ctx.confirm({ tool: 'fetch_url', preview: `Fetch ${hostname}` });
    if (!approved) return { ok: false, content: 'User declined' };

    try {
      const resp = await fetch(url, {
        method: (args.method as string) ?? 'GET',
        body: args.body as string | undefined,
      });

      const text = await resp.text();
      const truncated = text.slice(0, MAX_RESPONSE_KB * 1024);
      return {
        ok: resp.ok,
        content: `${resp.status} ${resp.statusText}\n\n${truncated}${text.length > truncated.length ? '\n...(truncated)' : ''}`,
      };
    } catch (e) {
      return { ok: false, content: `Fetch error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
});
