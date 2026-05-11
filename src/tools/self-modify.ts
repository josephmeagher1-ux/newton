import { registerTool, type ToolContext, type ToolResult } from './registry';
import { saveCssPatch, saveStartupJs, removePatch, listPatches } from '../lib/app-patches';

registerTool({
  name: 'patch_css',
  description: 'Inject persistent CSS into the app. The CSS is saved to IndexedDB and re-applied on every app launch. Use this to restyle the app, add animations, change colours, or modify layout. Provide an id to update an existing patch.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Unique patch ID (e.g. "custom-theme", "bigger-fonts")' },
      css: { type: 'string', description: 'CSS source code' },
    },
    required: ['id', 'css'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const id = args.id as string;
    const css = args.css as string;
    const approved = await ctx.confirm({ tool: 'patch_css', preview: css });
    if (!approved) return { ok: false, content: 'User declined' };
    await saveCssPatch(id, css);
    return { ok: true, content: `CSS patch "${id}" applied and saved. It will persist across reloads.` };
  },
});

registerTool({
  name: 'patch_startup',
  description: 'Register JavaScript that runs once on every app startup. Saved to IndexedDB. Use for adding global event listeners, modifying app behaviour, or initialising custom features. Runs in the global scope (not sandboxed) — has full DOM access.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Unique patch ID' },
      code: { type: 'string', description: 'JavaScript source (runs at startup in global scope)' },
    },
    required: ['id', 'code'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const id = args.id as string;
    const code = args.code as string;
    const approved = await ctx.confirm({ tool: 'patch_startup', preview: code });
    if (!approved) return { ok: false, content: 'User declined' };
    await saveStartupJs(id, code);
    return { ok: true, content: `Startup patch "${id}" saved. It will run on next app load.` };
  },
});

registerTool({
  name: 'list_patches',
  description: 'List all persistent patches (CSS, startup JS, dynamic components) currently stored. Returns their IDs, types, and creation dates.',
  risk: 'read',
  parameters: { type: 'object', properties: {} },
  async execute(): Promise<ToolResult> {
    const patches = await listPatches();
    if (patches.length === 0) return { ok: true, content: 'No patches installed.' };
    const lines = patches.map(p =>
      `${p.type} | ${p.id} | ${new Date(p.createdAt).toLocaleDateString()}`
    );
    return { ok: true, content: `Patches (${patches.length}):\n${lines.join('\n')}` };
  },
});

registerTool({
  name: 'remove_patch',
  description: 'Remove a persistent patch by ID. Removes it from IndexedDB and (for CSS) from the current page.',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Patch ID to remove' },
    },
    required: ['id'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const id = args.id as string;
    const approved = await ctx.confirm({ tool: 'remove_patch', preview: `Remove patch: ${id}` });
    if (!approved) return { ok: false, content: 'User declined' };
    await removePatch(id);
    return { ok: true, content: `Patch "${id}" removed.` };
  },
});

registerTool({
  name: 'read_source',
  description: 'Read the current HTML source of the app page, or fetch a specific built asset. Use this to understand the current app structure before modifying it.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: ['html', 'styles', 'dom_tree'],
        description: 'What to read: "html" for full page HTML, "styles" for computed CSS variables, "dom_tree" for a simplified DOM outline',
      },
    },
    required: ['target'],
  },
  async execute(args): Promise<ToolResult> {
    const target = args.target as string;

    if (target === 'html') {
      return { ok: true, content: document.documentElement.outerHTML.slice(0, 8000) };
    }

    if (target === 'styles') {
      const root = getComputedStyle(document.documentElement);
      const vars = [
        'bg', 'fg', 'muted', 'border', 'surface', 'surface-hover', 'accent', 'grade-red', 'grade-green',
      ].map(name => `--color-${name}: ${root.getPropertyValue(`--color-${name}`).trim()}`);
      const theme = document.documentElement.className || '(no theme class)';
      return { ok: true, content: `Theme class: ${theme}\n${vars.join('\n')}` };
    }

    if (target === 'dom_tree') {
      const walk = (el: Element, depth: number): string => {
        if (depth > 4) return '';
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? `.${el.className.split(' ').slice(0, 3).join('.')}`
          : '';
        const children = Array.from(el.children)
          .map(c => walk(c, depth + 1))
          .filter(Boolean)
          .join('\n');
        const indent = '  '.repeat(depth);
        return `${indent}<${tag}${id}${cls}>${children ? '\n' + children : ''}`;
      };
      const tree = walk(document.body, 0);
      return { ok: true, content: tree.slice(0, 6000) };
    }

    return { ok: false, content: 'Unknown target' };
  },
});
