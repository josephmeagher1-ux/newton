import { useState } from 'react';
import type { FlashcardQuestion } from '../../lib/question-schemas';

interface Props {
  question: FlashcardQuestion;
  onSubmit: (selfGrade: 'easy' | 'medium' | 'hard' | 'forgot') => void;
  disabled?: boolean;
}

export function FlashcardRenderer({ question, onSubmit, disabled }: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-4">
      <div
        className="p-6 rounded-2xl border border-border bg-surface min-h-[120px] flex items-center justify-center text-center cursor-pointer"
        onClick={() => !disabled && setRevealed(true)}
      >
        {revealed ? (
          <p className="text-fg">{question.back}</p>
        ) : (
          <p className="text-fg font-medium text-lg">{question.front}</p>
        )}
      </div>

      {!revealed && (
        <button
          onClick={() => setRevealed(true)}
          disabled={disabled}
          className="w-full py-3 rounded-xl border border-border text-sm text-muted hover:text-fg transition-colors"
        >
          Tap to reveal answer
        </button>
      )}

      {revealed && (
        <div className="space-y-2">
          <p className="text-xs text-muted text-center">How did you do?</p>
          <div className="grid grid-cols-4 gap-2">
            {(['forgot', 'hard', 'medium', 'easy'] as const).map((grade) => (
              <button
                key={grade}
                onClick={() => onSubmit(grade)}
                disabled={disabled}
                className={`py-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                  grade === 'forgot'
                    ? 'border-grade-red/30 text-grade-red hover:bg-grade-red/10'
                    : grade === 'easy'
                      ? 'border-grade-green/30 text-grade-green hover:bg-grade-green/10'
                      : 'border-border text-muted hover:text-fg'
                }`}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
