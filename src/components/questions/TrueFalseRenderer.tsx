import { useState } from 'react';
import type { TrueFalseQuestion } from '../../lib/question-schemas';

interface Props {
  question: TrueFalseQuestion;
  onSubmit: (answer: boolean) => void;
  disabled?: boolean;
}

export function TrueFalseRenderer({ question, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<boolean | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.statement}</p>
      <div className="flex gap-3">
        {([true, false] as const).map((val) => (
          <button
            key={String(val)}
            onClick={() => !disabled && setSelected(val)}
            disabled={disabled}
            className={`flex-1 py-3 rounded-xl border text-center font-medium transition-colors ${
              selected === val
                ? 'border-accent bg-accent/10 text-fg'
                : 'border-border bg-surface text-muted hover:border-muted'
            } ${disabled ? 'opacity-60' : ''}`}
          >
            {val ? 'True' : 'False'}
          </button>
        ))}
      </div>
      <button
        onClick={() => selected !== null && onSubmit(selected)}
        disabled={disabled || selected === null}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
