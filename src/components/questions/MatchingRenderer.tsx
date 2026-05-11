import { useState } from 'react';
import type { MatchingQuestion } from '../../lib/question-schemas';

interface Props {
  question: MatchingQuestion;
  onSubmit: (pairs: { leftId: string; rightId: string }[]) => void;
  disabled?: boolean;
}

export function MatchingRenderer({ question, onSubmit, disabled }: Props) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  const handleLeftTap = (leftId: string) => {
    if (disabled) return;
    setActiveLeft(leftId);
  };

  const handleRightTap = (rightId: string) => {
    if (disabled || !activeLeft) return;
    setPairs((prev) => ({ ...prev, [activeLeft]: rightId }));
    setActiveLeft(null);
  };

  const handleSubmit = () => {
    const result = Object.entries(pairs).map(([leftId, rightId]) => ({ leftId, rightId }));
    onSubmit(result);
  };

  const pairedRightIds = new Set(Object.values(pairs));

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {question.left.map((item) => {
            const isPaired = item.id in pairs;
            const isActive = activeLeft === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleLeftTap(item.id)}
                disabled={disabled}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? 'border-accent bg-accent/10'
                    : isPaired
                      ? 'border-grade-green/50 bg-grade-green/5'
                      : 'border-border bg-surface hover:border-muted'
                }`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {question.right.map((item) => {
            const isPaired = pairedRightIds.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleRightTap(item.id)}
                disabled={disabled || !activeLeft}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isPaired
                    ? 'border-grade-green/50 bg-grade-green/5'
                    : activeLeft
                      ? 'border-border bg-surface hover:border-accent'
                      : 'border-border bg-surface'
                }`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || Object.keys(pairs).length === 0}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit Matches
      </button>
    </div>
  );
}
