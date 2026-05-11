import { transform } from 'sucrase';
import { registerTool, type ToolContext, type ToolResult } from './registry';
import { getDb, generateId } from '../storage/db';

registerTool({
  name: 'render_in_app',
  description: 'Mount an AI-generated React component into the app. Provide self-contained TSX source. Available scope: React, useState, useEffect. Tailwind classes available. Source is shown for review before mounting.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Component name' },
      source: { type: 'string', description: 'Self-contained TSX component source' },
      subject: { type: 'string', description: 'Subject category (e.g. maths, languages)' },
    },
    required: ['name', 'source'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const source = args.source as string;
    const name = args.name as string;
    const subject = (args.subject as string) || 'general';

    const approved = await ctx.confirm({ tool: 'render_in_app', preview: source });
    if (!approved) return { ok: false, content: 'User declined' };

    try {
      const { code } = transform(source, {
        transforms: ['typescript', 'jsx'],
        jsxRuntime: 'classic',
        production: true,
      });

      const db = await getDb();
      const id = generateId();
      await db.put('dynamic_components', {
        id,
        subject,
        name,
        sourceTsx: source,
        createdAt: Date.now(),
      });

      return {
        ok: true,
        content: JSON.stringify({ componentId: id, transpiledCode: code }),
      };
    } catch (e) {
      return { ok: false, content: `Transpilation error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
});
