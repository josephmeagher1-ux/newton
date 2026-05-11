import { useState } from 'react';
import type { CategorisationQuestion } from '../../lib/question-schemas';

interface Props {
  question: CategorisationQuestion;
  onSubmit: (assignments: Record<string, string>) => void;
  disabled?: boolean;
}

export function CategorisationRenderer({ question, onSubmit, disabled }: Props) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const unassigned = question.items.filter((it) => !(it.id in assignments));

  const handleItemTap = (itemId: string) => {
    if (disabled) return;
    setActiveItem(itemId);
  };

  const handleCategoryTap = (categoryId: string) => {
    if (disabled || !activeItem) return;
    setAssignments((prev) => ({ ...prev, [activeItem]: categoryId }));
    setActiveItem(null);
  };

  const handleSubmit = () => {
    onSubmit(assignments);
  };

  return (
    <div className="space-y-3">
      <p className="text-fg font-medium">{question.stem}</p>

      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unassigned.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemTap(item.id)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                activeItem === item.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface hover:border-muted'
              }`}
            >
              {item.text}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {question.categories.map((cat) => {
          const assigned = question.items.filter((it) => assignments[it.id] === cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryTap(cat.id)}
              disabled={disabled || !activeItem}
              className={`p-3 rounded-xl border min-h-[80px] text-left transition-colors ${
                activeItem ? 'border-accent/50 hover:bg-accent/5' : 'border-border'
              }`}
            >
              <span className="text-xs font-medium text-muted uppercase">{cat.name}</span>
              <div className="mt-2 flex flex-wrap gap-1">
                {assigned.map((it) => (
                  <span key={it.id} className="text-xs px-2 py-0.5 rounded bg-surface-hover text-fg">
                    {it.text}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || Object.keys(assignments).length === 0}
        className="mt-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
