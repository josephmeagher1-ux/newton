import { registerRole, type RoleContext } from './roles';

registerRole({
  id: 'solution',
  name: 'Solution Animator',
  toolNames: [],
  provider: 'solution',
  temperature: 0.2,
  maxTokens: 4096,
  buildSystemPrompt(ctx: RoleContext): string {
    return `You are a maths teacher producing a step-by-step animated worked solution.
Output a JSON object with a "steps" array. Each step has:
- equation: a LaTeX expression representing the maths at this step
- narration: one short sentence in plain English explaining what's happening
- rule_applied: the name of the rule/technique (e.g. "chain rule", "factor out 2")

The sequence should start from the question and end at the final answer. 6-12 steps.
Do not skip algebraic steps a learner might miss.

QUESTION:
${ctx.questionJson ?? ''}

Output format:
{
  "steps": [
    {"equation": "string", "narration": "string", "rule_applied": "string"}
  ],
  "final_answer": "string"
}`;
  },
});
