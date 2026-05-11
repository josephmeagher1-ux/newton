import { useState } from 'react';
import type { TypedShortQuestion } from '../../lib/question-schemas';

interface Props {
  question: TypedShortQuestion;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function TypedShortRenderer({ question, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer..."
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-fg placeholder:text-muted/50 outline-none focus:border-accent"
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
