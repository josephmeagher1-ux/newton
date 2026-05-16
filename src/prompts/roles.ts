import type { ToolDef } from '../providers/types';
import type { TaskType } from '../providers/registry';
import { getToolDefs, getAllTools } from '../tools';

export interface RoleContext {
  sectionHeading?: string;
  pageText?: string;
  subjectId?: string;
  recentModalities?: string[];
  questionJson?: string;
  userAnswer?: string;
  sectionContext?: string;
  markScheme?: string;
  extractedText?: string;
  priorProgress?: string;
  sourceId?: string;
  sectionId?: string;
  sourcesSummary?: string;
  scenarioBrief?: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  buildSystemPrompt: (ctx: RoleContext) => string;
  toolNames: string[] | 'all';
  provider: TaskType;
  temperature?: number;
  maxTokens?: number;
}

const roles = new Map<string, RoleConfig>();

export function registerRole(role: RoleConfig): void {
  roles.set(role.id, role);
}

export function getRole(id: string): RoleConfig | undefined {
  return roles.get(id);
}

export function getRoleToolDefs(role: RoleConfig): ToolDef[] {
  if (role.toolNames === 'all') return getToolDefs();

  const allTools = getAllTools();
  const allowed = new Set(role.toolNames);
  return allTools
    .filter(t => allowed.has(t.name))
    .map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
}
