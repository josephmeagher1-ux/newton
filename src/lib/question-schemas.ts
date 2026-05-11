import type { ModalityId } from './modalities';

export interface BaseQuestion {
  modality: ModalityId;
  stem: string;
  marks?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeEstimateSeconds?: number;
}

export interface McqSingleQuestion extends BaseQuestion {
  modality: 'mcq_single';
  options: { label: string; text: string }[];
  correctIndex: number;
  explanation: string;
}

export interface McqMultiQuestion extends BaseQuestion {
  modality: 'mcq_multi';
  options: { label: string; text: string }[];
  correctIndices: number[];
  explanation: string;
}

export interface TrueFalseQuestion extends BaseQuestion {
  modality: 'true_false';
  statement: string;
  correct: boolean;
  explanation: string;
}

export interface TypedShortQuestion extends BaseQuestion {
  modality: 'typed_short';
  acceptableAnswers: string[];
  markScheme?: MarkSchemeEntry[];
}

export interface TypedExtendedQuestion extends BaseQuestion {
  modality: 'typed_extended';
  wordLimit?: { min: number; max: number };
  markScheme: MarkSchemeEntry[];
  rubric: string;
}

export interface FillBlankQuestion extends BaseQuestion {
  modality: 'fill_blank';
  textBefore: string;
  textAfter: string;
  acceptableAnswers: string[];
  caseSensitive?: boolean;
}

export interface ClozeQuestion extends BaseQuestion {
  modality: 'cloze';
  passage: string;
  blanks: { index: number; acceptableAnswers: string[] }[];
}

export interface MatchingQuestion extends BaseQuestion {
  modality: 'matching';
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
  correctPairs: { leftId: string; rightId: string }[];
}

export interface OrderingQuestion extends BaseQuestion {
  modality: 'ordering';
  items: { id: string; text: string }[];
  correctOrder: string[];
}

export interface CategorisationQuestion extends BaseQuestion {
  modality: 'categorisation';
  categories: { id: string; name: string }[];
  items: { id: string; text: string; categoryId: string }[];
}

export interface HotspotQuestion extends BaseQuestion {
  modality: 'hotspot';
  imageDescription: string;
  imageSvg?: string;
  target: { x: number; y: number; radiusFraction: number };
  hint?: string;
}

export interface DiagramLabelQuestion extends BaseQuestion {
  modality: 'diagram_label';
  imageDescription: string;
  imageSvg?: string;
  labels: { id: string; correctText: string; x: number; y: number }[];
}

export interface HandwrittenQuestion extends BaseQuestion {
  modality: 'handwritten';
  markScheme: MarkSchemeEntry[];
  commonMistakes: string[];
}

export interface GraphSketchQuestion extends BaseQuestion {
  modality: 'graph_sketch';
  axisLabels: { x: string; y: string };
  description: string;
  keyFeatures: string[];
}

export interface CodeWriteQuestion extends BaseQuestion {
  modality: 'code_write';
  language: string;
  starterCode?: string;
  testCases: { input: string; expectedOutput: string }[];
  markScheme: MarkSchemeEntry[];
}

export interface FlashcardQuestion extends BaseQuestion {
  modality: 'flashcard';
  front: string;
  back: string;
}

export interface SocraticQuestion extends BaseQuestion {
  modality: 'socratic';
  openingQuestion: string;
  guidingPoints: string[];
  desiredInsights: string[];
}

export interface MarkSchemeEntry {
  markType: 'M' | 'A' | 'B';
  marks: number;
  criterion: string;
}

export type Question =
  | McqSingleQuestion
  | McqMultiQuestion
  | TrueFalseQuestion
  | TypedShortQuestion
  | TypedExtendedQuestion
  | FillBlankQuestion
  | ClozeQuestion
  | MatchingQuestion
  | OrderingQuestion
  | CategorisationQuestion
  | HotspotQuestion
  | DiagramLabelQuestion
  | HandwrittenQuestion
  | GraphSketchQuestion
  | CodeWriteQuestion
  | FlashcardQuestion
  | SocraticQuestion;

export function getQuestionSchemaDescription(): string {
  return `You can generate questions in any of these modalities. Choose the most appropriate based on the subject, topic, and recent history. Vary the modality to keep sessions engaging — don't repeat the same type 3 times in a row unless the topic demands it.

MODALITY SCHEMAS:

"mcq_single": { modality, stem, options: [{label, text}], correctIndex, explanation, marks, difficulty(1-5) }
"mcq_multi": { modality, stem, options: [{label, text}], correctIndices: [int], explanation, marks, difficulty }
"true_false": { modality, statement, correct: bool, explanation, difficulty }
"typed_short": { modality, stem, acceptableAnswers: [string], markScheme?: [{markType, marks, criterion}], difficulty }
"typed_extended": { modality, stem, wordLimit?: {min, max}, markScheme: [{markType, marks, criterion}], rubric, difficulty }
"fill_blank": { modality, stem, textBefore, textAfter, acceptableAnswers: [string], difficulty }
"cloze": { modality, stem, passage (use ___ for blanks), blanks: [{index, acceptableAnswers}], difficulty }
"matching": { modality, stem, left: [{id, text}], right: [{id, text}], correctPairs: [{leftId, rightId}], difficulty }
"ordering": { modality, stem, items: [{id, text}] (shuffled), correctOrder: [id], difficulty }
"categorisation": { modality, stem, categories: [{id, name}], items: [{id, text, categoryId}], difficulty }
"hotspot": { modality, stem, imageDescription, imageSvg?, target: {x(0-1), y(0-1), radiusFraction}, difficulty }
"diagram_label": { modality, stem, imageDescription, imageSvg?, labels: [{id, correctText, x(0-1), y(0-1)}], difficulty }
"handwritten": { modality, stem, markScheme: [{markType, marks, criterion}], commonMistakes: [string], difficulty }
"graph_sketch": { modality, stem, axisLabels: {x, y}, description, keyFeatures: [string], difficulty }
"code_write": { modality, stem, language, starterCode?, testCases: [{input, expectedOutput}], markScheme, difficulty }
"flashcard": { modality, front, back, difficulty }
"socratic": { modality, openingQuestion, guidingPoints: [string], desiredInsights: [string], difficulty }`;
}
