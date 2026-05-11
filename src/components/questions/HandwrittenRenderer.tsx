import { useState } from 'react';
import type { HandwrittenQuestion } from '../../lib/question-schemas';
import { InkCanvas } from '../InkCanvas';

interface Props {
  question: HandwrittenQuestion;
  onSubmit: (imageBlob: Blob) => void;
  disabled?: boolean;
}

export function HandwrittenRenderer({ question, onSubmit, disabled }: Props) {
  const [showCanvas, setShowCanvas] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      {question.marks && (
        <p className="text-xs text-muted">[{question.marks} marks]</p>
      )}
      <button
        onClick={() => setShowCanvas(true)}
        disabled={disabled}
        className="w-full py-4 rounded-xl border border-border bg-surface text-muted hover:text-fg hover:border-accent transition-colors text-sm"
      >
        Open canvas to write your answer
      </button>
      {showCanvas && (
        <InkCanvas
          onSubmit={(blob) => {
            setShowCanvas(false);
            onSubmit(blob);
          }}
          onCancel={() => setShowCanvas(false)}
        />
      )}
    </div>
  );
}
