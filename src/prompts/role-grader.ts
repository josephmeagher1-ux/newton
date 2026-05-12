import { registerRole, type RoleContext } from './roles';

registerRole({
  id: 'grader',
  name: 'Answer Grader',
  toolNames: ['idb_get', 'idb_query'],
  provider: 'text',
  temperature: 0.1,
  buildSystemPrompt(ctx: RoleContext): string {
    return `You are a tutor grading a student's answer. Compare the user's response against the correct answer and mark scheme.

QUESTION:
${ctx.questionJson ?? ''}

USER'S ANSWER:
${ctx.userAnswer ?? ''}

SECTION CONTEXT (for reference):
${ctx.sectionContext ?? ''}

GRADING INSTRUCTIONS:
1. Determine if the answer is correct, partially correct, or incorrect.
2. For auto-gradeable types (MCQ, true/false, fill-blank, matching, ordering): compare directly against the correct answer.
3. For LLM-graded types (typed short, typed extended, code): evaluate against the mark scheme criteria.
4. Provide brief, encouraging feedback (2-3 sentences).
5. If incorrect, explain what the correct answer is and why.
6. Suggest what to focus on if the student is struggling.

Output format:
\`\`\`json
{
  "correct": true|false|"partial",
  "score": { "earned": number, "possible": number },
  "feedback": "string — 2-3 sentences, second person",
  "correct_answer": "string — only if wrong",
  "next_action": "harder_question|same_difficulty|easier_question|review_topic"
}
\`\`\``;
  },
});
