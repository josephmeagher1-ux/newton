import { useState } from 'react';
import type { FillBlankQuestion } from '../../lib/question-schemas';

interface Props {
  question: FillBlankQuestion;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function FillBlankRenderer({ question, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <div className="flex items-center gap-2 flex-wrap text-fg">
        <span>{question.textBefore}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="bg-surface border-b-2 border-accent px-3 py-1 text-center min-w-[120px] outline-none"
          placeholder="..."
        />
        <span>{question.textAfter}</span>
      </div>
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
