import type { ToolDef } from '../providers/types';

export interface ToolContext {
  threadId: string;
  confirm: (proposal: { tool: string; preview: string }) => Promise<boolean>;
}

export interface ToolResult {
  ok: boolean;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  risk: 'read' | 'write' | 'exec';
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

const tools = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function getAllTools(): Tool[] {
  return [...tools.values()];
}

export function getToolDefs(filter?: 'read' | 'write' | 'exec'): ToolDef[] {
  const list = filter
    ? [...tools.values()].filter(t => riskLevel(t.risk) <= riskLevel(filter))
    : [...tools.values()];

  return list.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function riskLevel(risk: 'read' | 'write' | 'exec'): number {
  return risk === 'read' ? 0 : risk === 'write' ? 1 : 2;
}
