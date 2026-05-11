import type { Question } from '../../lib/question-schemas';
import { McqRenderer } from './McqRenderer';
import { TrueFalseRenderer } from './TrueFalseRenderer';
import { TypedShortRenderer } from './TypedShortRenderer';
import { TypedExtendedRenderer } from './TypedExtendedRenderer';
import { FillBlankRenderer } from './FillBlankRenderer';
import { MatchingRenderer } from './MatchingRenderer';
import { OrderingRenderer } from './OrderingRenderer';
import { CategorisationRenderer } from './CategorisationRenderer';
import { FlashcardRenderer } from './FlashcardRenderer';
import { HandwrittenRenderer } from './HandwrittenRenderer';

interface Props {
  question: Question;
  onSubmit: (answer: unknown) => void;
  disabled?: boolean;
}

export function QuestionRenderer({ question, onSubmit, disabled }: Props) {
  switch (question.modality) {
    case 'mcq_single':
    case 'mcq_multi':
      return <McqRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'true_false':
      return <TrueFalseRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'typed_short':
      return <TypedShortRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'typed_extended':
      return <TypedExtendedRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'fill_blank':
      return <FillBlankRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'matching':
      return <MatchingRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'ordering':
      return <OrderingRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'categorisation':
      return <CategorisationRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'flashcard':
      return <FlashcardRenderer question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'handwritten':
    case 'graph_sketch':
      return <HandwrittenRenderer question={question as any} onSubmit={onSubmit as any} disabled={disabled} />;
    case 'cloze':
      return <ClozeInline question={question} onSubmit={onSubmit as any} disabled={disabled} />;
    default:
      return <FallbackRenderer question={question} onSubmit={onSubmit} disabled={disabled} />;
  }
}

import { useState } from 'react';
import type { ClozeQuestion } from '../../lib/question-schemas';

function ClozeInline({ question, onSubmit, disabled }: { question: ClozeQuestion; onSubmit: (answers: string[]) => void; disabled?: boolean }) {
  const [answers, setAnswers] = useState<string[]>(question.blanks.map(() => ''));

  const parts = question.passage.split('___');

  const setAnswer = (idx: number, val: string) => {
    const updated = [...answers];
    updated[idx] = val;
    setAnswers(updated);
  };

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <div className="text-fg leading-relaxed">
        {parts.map((part, idx) => (
          <span key={idx}>
            {part}
            {idx < parts.length - 1 && (
              <input
                type="text"
                value={answers[idx] ?? ''}
                onChange={(e) => setAnswer(idx, e.target.value)}
                disabled={disabled}
                className="inline-block w-24 mx-1 border-b-2 border-accent bg-transparent px-1 text-center outline-none"
              />
            )}
          </span>
        ))}
      </div>
      <button
        onClick={() => onSubmit(answers)}
        disabled={disabled || answers.every((a) => !a.trim())}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}

function FallbackRenderer({ question, onSubmit, disabled }: { question: Question; onSubmit: (answer: unknown) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <p className="text-xs text-muted">({question.modality} — type your answer)</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={4}
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-fg outline-none focus:border-accent resize-y"
        placeholder="Type your answer..."
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        className="px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
