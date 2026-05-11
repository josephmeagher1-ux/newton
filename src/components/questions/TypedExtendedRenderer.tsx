import { useState } from 'react';
import type { TypedExtendedQuestion } from '../../lib/question-schemas';

interface Props {
  question: TypedExtendedQuestion;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function TypedExtendedRenderer({ question, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const limit = question.wordLimit;

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      {question.rubric && (
        <p className="text-sm text-muted">{question.rubric}</p>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={8}
        placeholder="Write your response..."
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-fg placeholder:text-muted/50 outline-none focus:border-accent resize-y min-h-[120px]"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {wordCount} words{limit ? ` (${limit.min}–${limit.max} target)` : ''}
        </span>
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={disabled || !value.trim()}
          className="px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
