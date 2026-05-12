import { registerRole, type RoleContext } from './roles';
import { getQuestionSchemaDescription } from '../lib/question-schemas';
import { getSubjectProfile, MODALITIES, type ModalityId } from '../lib/modalities';

registerRole({
  id: 'tutor',
  name: 'Study Tutor',
  toolNames: ['idb_get', 'idb_query'],
  provider: 'text',
  temperature: 0.3,
  buildSystemPrompt(ctx: RoleContext): string {
    const heading = ctx.sectionHeading ?? 'Introduction';
    const pageText = ctx.pageText ?? '';
    const profile = ctx.subjectId ? getSubjectProfile(ctx.subjectId) : undefined;
    const recent = ctx.recentModalities as ModalityId[] | undefined;

    const modalityGuidance = profile
      ? buildModalityGuidance(profile.primaryModalities, profile.secondaryModalities, recent)
      : buildGenericModalityGuidance(recent);

    let prompt = `You are a personal tutor. The student has opened section: "${heading}".
${profile ? `Subject: ${profile.name} (${profile.category}). Exam style: ${profile.examStyle}` : ''}

YOUR ROLE:
1. Greet briefly (one sentence, conversational).
2. Give a 3-4 sentence lesson intro — what this section covers and why it matters.
3. Produce a practice question as a JSON object following one of the modality schemas below.
4. After the question JSON, add 2-3 sentences about common mistakes on this topic.

QUESTION MODALITY SELECTION:
${modalityGuidance}

${getQuestionSchemaDescription()}

GUIDELINES:
- Output the question as a JSON code block: \`\`\`json { ... } \`\`\`
- Use LaTeX delimited by $...$ for inline and $$...$$ for display maths in stems and options.
- Choose difficulty 1-5 based on where this falls in the textbook (early chapters = 1-2, later = 3-5).
- For follow-up questions, vary difficulty based on performance: full marks → harder, struggled → easier targeting the gap.
- VARY THE MODALITY. Don't repeat the same type 3+ times unless the topic strictly requires it.
- When the student submits an answer, grade it and provide feedback before the next question.
- If the section content notes pages with figures/diagrams, reference them naturally (e.g. "Look at the diagram on page X"). The student sees these images in a panel they can toggle open.

SECTION CONTENT:
${pageText}`;

    if (ctx.priorProgress) {
      prompt += `\n\nPRIOR STUDY PROGRESS (from previous sessions):\n${ctx.priorProgress}\n\nUse this to tailor difficulty and focus on weak areas. Don't repeat topics the student has mastered unless reviewing.`;
    }

    return prompt;
  },
});

function buildModalityGuidance(
  primary: ModalityId[],
  secondary: ModalityId[],
  recent?: ModalityId[],
): string {
  const recentSet = new Set(recent?.slice(-3) ?? []);

  const primaryNames = primary.map(id => {
    const m = MODALITIES[id];
    const recentFlag = recentSet.has(id) ? ' (used recently — prefer something else)' : '';
    return `  - ${m.name} (${id})${recentFlag}`;
  }).join('\n');

  const secondaryNames = secondary.map(id => {
    const m = MODALITIES[id];
    return `  - ${m.name} (${id})`;
  }).join('\n');

  return `For this subject, prefer these PRIMARY modalities (~70% of questions):
${primaryNames}

Mix in these SECONDARY modalities (~30%) to keep sessions varied:
${secondaryNames}

Selection strategy: weight towards primary modalities but rotate. If the last 2-3 questions used the same modality, switch to a different one even if it means using a secondary modality.`;
}

function buildGenericModalityGuidance(recent?: ModalityId[]): string {
  const recentList = recent?.slice(-3).map(id => MODALITIES[id]?.name).filter(Boolean).join(', ') ?? 'none';
  return `No subject profile detected. Use your judgement based on the content. Available modalities include MCQ, short answer, fill-blank, matching, ordering, handwritten, typed extended, and more. See schemas below.

Recently used modalities: ${recentList}. Try something different.`;
}
