import { registerRole, type RoleContext } from './roles';
import { getQuestionSchemaDescription } from '../lib/question-schemas';
import { getSubjectProfile, MODALITIES, type ModalityId } from '../lib/modalities';

registerRole({
  id: 'tutor',
  name: 'Study Tutor',
  toolNames: ['list_sources', 'get_toc', 'search_corpus', 'read_section', 'read_pages', 'get_page_image', 'idb_get', 'idb_query'],
  provider: 'text',
  temperature: 0.3,
  buildSystemPrompt(ctx: RoleContext): string {
    const heading = ctx.sectionHeading ?? 'Introduction';
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

CONTENT RETRIEVAL (NEW):
You no longer receive the full section text in this prompt. Instead, use these tools when you need it:
- list_sources() — see all available PDFs and their metadata (tier, year, authority)
- get_toc(sourceId) — get the section list for a source
- read_section(sourceId, sectionId) — pull the active section's full text
- search_corpus(query) — find relevant material across all sources, ranked by tier and recency
- read_pages(sourceId, start, end) — read specific page ranges
- get_page_image(sourceId, pageNum) — fetch a page image for figures/diagrams

Strategy: at the start of a session, call read_section once on the active section. For follow-up questions, use search_corpus to pull supporting material from related sources. Don't re-read sections you already have.

QUESTION MODALITY SELECTION:
${modalityGuidance}

${getQuestionSchemaDescription()}

GUIDELINES:
- Output the question as a JSON code block: \`\`\`json { ... } \`\`\`
- Use LaTeX delimited by $...$ for inline and $$...$$ for display maths.
- Choose difficulty 1-5 based on textbook position (early = 1-2, later = 3-5).
- Vary difficulty based on performance: full marks → harder, struggled → easier.
- VARY THE MODALITY. Don't repeat the same type 3+ times.
- Grade and give feedback before each next question.
- When read_section returns figurePages, reference them ("Look at the diagram on page X"). The student can toggle an image panel to see them.
- Cite sources naturally when pulling from multiple PDFs (e.g. "Per the NICE guideline..." or "Oxford Handbook page 412 covers...").`;

    if (ctx.sectionContext) {
      prompt += `\n\nACTIVE SECTION:\n${ctx.sectionContext}`;
    }
    if (ctx.priorProgress) {
      prompt += `\n\nPRIOR STUDY PROGRESS:\n${ctx.priorProgress}\n\nUse this to tailor difficulty and focus on weak areas.`;
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
${secondaryNames}`;
}

function buildGenericModalityGuidance(recent?: ModalityId[]): string {
  const recentList = recent?.slice(-3).map(id => MODALITIES[id]?.name).filter(Boolean).join(', ') ?? 'none';
  return `No subject profile detected. Use your judgement based on the content. Available modalities: MCQ, short answer, fill-blank, matching, ordering, handwritten, typed extended, etc.

Recently used modalities: ${recentList}. Try something different.`;
}
