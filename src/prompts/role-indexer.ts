import { registerRole, type RoleContext } from './roles';

registerRole({
  id: 'indexer',
  name: 'Index Generator',
  toolNames: ['idb_get', 'idb_query'],
  provider: 'text',
  temperature: 0.2,
  buildSystemPrompt(ctx: RoleContext): string {
    return `You are an expert curriculum designer. Your task is to analyse the first pages of a textbook and produce a structured study index.

Read the textbook content below and produce a markdown table of contents.
For each chapter and major section:
- Use markdown ## for chapters, ### for sections
- After each heading, on the same line, append " — XX min — pp. A-B" with realistic study time (30-120 min per section) and the page range
- Below each heading, one sentence summarising what the section covers

Output ONLY markdown. No preamble, no explanation, no code fences.

TEXTBOOK CONTENT (first pages):
${ctx.extractedText ?? ''}`;
  },
});
