export type ModalityId =
  | 'mcq_single'
  | 'mcq_multi'
  | 'true_false'
  | 'typed_short'
  | 'typed_extended'
  | 'fill_blank'
  | 'cloze'
  | 'matching'
  | 'ordering'
  | 'categorisation'
  | 'hotspot'
  | 'diagram_label'
  | 'handwritten'
  | 'graph_sketch'
  | 'code_write'
  | 'flashcard'
  | 'socratic';

export interface ModalityDef {
  id: ModalityId;
  name: string;
  description: string;
  inputType: 'select' | 'type' | 'draw' | 'drag' | 'tap' | 'code' | 'chat';
  gradeComplexity: 'auto' | 'llm' | 'vision';
  suitedSubjects: string[];
  weight: number;
}

export const MODALITIES: Record<ModalityId, ModalityDef> = {
  mcq_single: {
    id: 'mcq_single',
    name: 'Multiple Choice',
    description: 'Select one correct answer from 4 options',
    inputType: 'select',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 1.0,
  },
  mcq_multi: {
    id: 'mcq_multi',
    name: 'Multi-Select',
    description: 'Select all correct answers from options',
    inputType: 'select',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 0.7,
  },
  true_false: {
    id: 'true_false',
    name: 'True or False',
    description: 'Decide if a statement is true or false',
    inputType: 'select',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 0.5,
  },
  typed_short: {
    id: 'typed_short',
    name: 'Short Answer',
    description: 'Type a brief answer (1-50 words)',
    inputType: 'type',
    gradeComplexity: 'llm',
    suitedSubjects: ['*'],
    weight: 0.9,
  },
  typed_extended: {
    id: 'typed_extended',
    name: 'Extended Response',
    description: 'Write a detailed answer or essay (200+ words)',
    inputType: 'type',
    gradeComplexity: 'llm',
    suitedSubjects: ['history', 'english', 'philosophy', 'politics', 'sociology', 'economics', 'law', 'religious_studies', 'psychology', 'geography'],
    weight: 0.6,
  },
  fill_blank: {
    id: 'fill_blank',
    name: 'Fill in the Blank',
    description: 'Complete a sentence by filling missing words',
    inputType: 'type',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 0.8,
  },
  cloze: {
    id: 'cloze',
    name: 'Cloze Passage',
    description: 'Fill multiple blanks in a passage',
    inputType: 'type',
    gradeComplexity: 'auto',
    suitedSubjects: ['languages', 'english', 'biology', 'chemistry', 'history'],
    weight: 0.6,
  },
  matching: {
    id: 'matching',
    name: 'Matching Pairs',
    description: 'Match items from two columns',
    inputType: 'drag',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 0.7,
  },
  ordering: {
    id: 'ordering',
    name: 'Ordering',
    description: 'Arrange items in the correct sequence',
    inputType: 'drag',
    gradeComplexity: 'auto',
    suitedSubjects: ['history', 'biology', 'chemistry', 'maths', 'physics', 'computer_science'],
    weight: 0.6,
  },
  categorisation: {
    id: 'categorisation',
    name: 'Categorisation',
    description: 'Sort items into the correct categories',
    inputType: 'drag',
    gradeComplexity: 'auto',
    suitedSubjects: ['biology', 'chemistry', 'physics', 'history', 'geography', 'languages', 'economics'],
    weight: 0.5,
  },
  hotspot: {
    id: 'hotspot',
    name: 'Tap the Spot',
    description: 'Tap the correct region on an image or diagram',
    inputType: 'tap',
    gradeComplexity: 'auto',
    suitedSubjects: ['biology', 'geography', 'history', 'physics', 'chemistry'],
    weight: 0.5,
  },
  diagram_label: {
    id: 'diagram_label',
    name: 'Label the Diagram',
    description: 'Place labels on a diagram',
    inputType: 'tap',
    gradeComplexity: 'auto',
    suitedSubjects: ['biology', 'chemistry', 'physics', 'geography', 'design_technology'],
    weight: 0.6,
  },
  handwritten: {
    id: 'handwritten',
    name: 'Handwritten Working',
    description: 'Write your answer with a stylus — graded by AI vision',
    inputType: 'draw',
    gradeComplexity: 'vision',
    suitedSubjects: ['maths', 'further_maths', 'physics', 'chemistry', 'languages'],
    weight: 0.9,
  },
  graph_sketch: {
    id: 'graph_sketch',
    name: 'Graph Sketch',
    description: 'Sketch a graph or plot points on axes',
    inputType: 'draw',
    gradeComplexity: 'vision',
    suitedSubjects: ['maths', 'physics', 'economics', 'chemistry', 'biology'],
    weight: 0.4,
  },
  code_write: {
    id: 'code_write',
    name: 'Write Code',
    description: 'Write code to solve the problem',
    inputType: 'code',
    gradeComplexity: 'llm',
    suitedSubjects: ['computer_science', 'maths', 'physics'],
    weight: 0.7,
  },
  flashcard: {
    id: 'flashcard',
    name: 'Flashcard Recall',
    description: 'Think of the answer, then reveal to check',
    inputType: 'select',
    gradeComplexity: 'auto',
    suitedSubjects: ['*'],
    weight: 0.4,
  },
  socratic: {
    id: 'socratic',
    name: 'Guided Discussion',
    description: 'The AI asks follow-up questions based on your responses',
    inputType: 'chat',
    gradeComplexity: 'llm',
    suitedSubjects: ['philosophy', 'english', 'history', 'politics', 'religious_studies', 'psychology', 'economics'],
    weight: 0.3,
  },
};

export interface SubjectProfile {
  id: string;
  name: string;
  category: string;
  primaryModalities: ModalityId[];
  secondaryModalities: ModalityId[];
  examStyle: string;
}

export const SUBJECT_PROFILES: SubjectProfile[] = [
  {
    id: 'maths', name: 'Mathematics', category: 'mathematics',
    primaryModalities: ['handwritten', 'typed_short', 'mcq_single'],
    secondaryModalities: ['graph_sketch', 'fill_blank', 'ordering', 'matching', 'true_false'],
    examStyle: 'Structured calculation with shown working. M/A/B mark scheme.',
  },
  {
    id: 'further_maths', name: 'Further Mathematics', category: 'mathematics',
    primaryModalities: ['handwritten', 'typed_short'],
    secondaryModalities: ['graph_sketch', 'mcq_single', 'fill_blank'],
    examStyle: 'Advanced proofs and multi-step problems. M/A/B marks.',
  },
  {
    id: 'physics', name: 'Physics', category: 'sciences',
    primaryModalities: ['handwritten', 'typed_short', 'mcq_single'],
    secondaryModalities: ['diagram_label', 'graph_sketch', 'matching', 'fill_blank', 'ordering', 'categorisation'],
    examStyle: 'Calculations with diagrams. MCQ + structured + extended response.',
  },
  {
    id: 'chemistry', name: 'Chemistry', category: 'sciences',
    primaryModalities: ['handwritten', 'typed_short', 'mcq_single'],
    secondaryModalities: ['diagram_label', 'matching', 'categorisation', 'fill_blank', 'ordering'],
    examStyle: 'Calculations, mechanisms, structures. MCQ + structured.',
  },
  {
    id: 'biology', name: 'Biology', category: 'sciences',
    primaryModalities: ['typed_short', 'mcq_single', 'diagram_label'],
    secondaryModalities: ['hotspot', 'matching', 'categorisation', 'cloze', 'fill_blank', 'typed_extended', 'ordering'],
    examStyle: 'Diagram-heavy. MCQ + structured + extended writing.',
  },
  {
    id: 'computer_science', name: 'Computer Science', category: 'technology',
    primaryModalities: ['code_write', 'typed_short', 'mcq_single'],
    secondaryModalities: ['matching', 'ordering', 'true_false', 'fill_blank', 'diagram_label'],
    examStyle: 'Code tracing, algorithm design, short answer, MCQ.',
  },
  {
    id: 'history', name: 'History', category: 'humanities',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['ordering', 'matching', 'hotspot', 'cloze', 'fill_blank', 'true_false', 'socratic'],
    examStyle: 'Source analysis + essay. Extended writing dominant.',
  },
  {
    id: 'english', name: 'English Literature', category: 'humanities',
    primaryModalities: ['typed_extended', 'typed_short'],
    secondaryModalities: ['cloze', 'matching', 'mcq_single', 'fill_blank', 'socratic'],
    examStyle: 'Essay-only. Passage analysis + named text essays.',
  },
  {
    id: 'geography', name: 'Geography', category: 'humanities',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['hotspot', 'diagram_label', 'matching', 'categorisation', 'graph_sketch'],
    examStyle: 'Data response, map work, essays.',
  },
  {
    id: 'economics', name: 'Economics', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['graph_sketch', 'fill_blank', 'matching', 'handwritten', 'true_false'],
    examStyle: 'MCQ + data response + essays. Diagram drawing.',
  },
  {
    id: 'psychology', name: 'Psychology', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['matching', 'true_false', 'fill_blank', 'categorisation'],
    examStyle: 'MCQ + short answer + extended writing.',
  },
  {
    id: 'philosophy', name: 'Philosophy', category: 'humanities',
    primaryModalities: ['typed_extended', 'socratic'],
    secondaryModalities: ['typed_short', 'mcq_single', 'matching', 'cloze'],
    examStyle: 'Essay-based with philosophical argument.',
  },
  {
    id: 'languages', name: 'Modern Languages', category: 'languages',
    primaryModalities: ['fill_blank', 'typed_short', 'cloze'],
    secondaryModalities: ['matching', 'mcq_single', 'typed_extended', 'ordering', 'categorisation', 'true_false'],
    examStyle: 'Listening + reading + writing + speaking. Translation.',
  },
  {
    id: 'sociology', name: 'Sociology', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['matching', 'true_false', 'fill_blank', 'socratic'],
    examStyle: 'Extended writing with source material.',
  },
  {
    id: 'politics', name: 'Politics', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'socratic', 'typed_short'],
    secondaryModalities: ['mcq_single', 'matching', 'true_false', 'fill_blank'],
    examStyle: 'Essay + source analysis.',
  },
  {
    id: 'law', name: 'Law', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['matching', 'fill_blank', 'cloze', 'socratic'],
    examStyle: 'Problem questions + essay questions.',
  },
  {
    id: 'religious_studies', name: 'Religious Studies', category: 'humanities',
    primaryModalities: ['typed_extended', 'typed_short'],
    secondaryModalities: ['mcq_single', 'matching', 'cloze', 'socratic', 'fill_blank'],
    examStyle: 'Essay-based with scholarly references.',
  },
  {
    id: 'business', name: 'Business Studies', category: 'social_sciences',
    primaryModalities: ['typed_extended', 'typed_short', 'mcq_single'],
    secondaryModalities: ['handwritten', 'matching', 'categorisation', 'fill_blank', 'graph_sketch'],
    examStyle: 'Case study + calculation + essay.',
  },
  {
    id: 'design_technology', name: 'Design & Technology', category: 'technology',
    primaryModalities: ['typed_short', 'typed_extended', 'diagram_label'],
    secondaryModalities: ['matching', 'categorisation', 'mcq_single', 'hotspot'],
    examStyle: 'Technical knowledge + design application.',
  },
];

export function getSubjectProfile(subjectId: string): SubjectProfile | undefined {
  return SUBJECT_PROFILES.find(s => s.id === subjectId);
}

export function getDefaultSubject(): SubjectProfile {
  return SUBJECT_PROFILES[0]!;
}
