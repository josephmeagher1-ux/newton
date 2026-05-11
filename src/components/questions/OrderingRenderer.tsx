import { useState } from 'react';
import type { OrderingQuestion } from '../../lib/question-schemas';

interface Props {
  question: OrderingQuestion;
  onSubmit: (order: string[]) => void;
  disabled?: boolean;
}

export function OrderingRenderer({ question, onSubmit, disabled }: Props) {
  const [items, setItems] = useState(question.items);
  const [dragging, setDragging] = useState<number | null>(null);

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (disabled) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved!);
    setItems(updated);
  };

  const handleSubmit = () => {
    onSubmit(items.map((it) => it.id));
  };

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>
      <p className="text-xs text-muted">Tap arrows to reorder</p>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface ${
              dragging === idx ? 'opacity-50' : ''
            }`}
            draggable={!disabled}
            onDragStart={() => setDragging(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null) moveItem(dragging, idx);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
          >
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => idx > 0 && moveItem(idx, idx - 1)}
                disabled={disabled || idx === 0}
                className="text-muted hover:text-fg disabled:opacity-20 text-xs leading-none"
              >
                ▲
              </button>
              <button
                onClick={() => idx < items.length - 1 && moveItem(idx, idx + 1)}
                disabled={disabled || idx === items.length - 1}
                className="text-muted hover:text-fg disabled:opacity-20 text-xs leading-none"
              >
                ▼
              </button>
            </div>
            <span className="font-mono text-xs text-muted w-5">{idx + 1}.</span>
            <span className="text-sm text-fg">{item.text}</span>
          </div>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit Order
      </button>
    </div>
  );
}
