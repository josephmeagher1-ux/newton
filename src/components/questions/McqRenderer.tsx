import { useState } from 'react';
import type { McqSingleQuestion, McqMultiQuestion } from '../../lib/question-schemas';

interface McqProps {
  question: McqSingleQuestion | McqMultiQuestion;
  onSubmit: (answer: number | number[]) => void;
  disabled?: boolean;
}

export function McqRenderer({ question, onSubmit, disabled }: McqProps) {
  const isMulti = question.modality === 'mcq_multi';
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (idx: number) => {
    if (disabled) return;
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
      );
    } else {
      setSelected([idx]);
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0) return;
    onSubmit(isMulti ? selected : selected[0]!);
  };

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <div className="space-y-2">
        {question.options.map((opt, idx) => {
          const active = selected.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              disabled={disabled}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                active
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-border bg-surface text-fg hover:border-muted'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              <span className="font-mono text-sm text-muted mr-3">{opt.label}</span>
              {opt.text}
            </button>
          );
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || selected.length === 0}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        {isMulti ? 'Submit Selection' : 'Submit'}
      </button>
    </div>
  );
}
