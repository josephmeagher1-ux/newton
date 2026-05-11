import { DeepSeekProvider } from './deepseek';
import { AnthropicProvider } from './anthropic';
import type { LLMProvider } from './types';

const deepseek = new DeepSeekProvider();
const anthropic = new AnthropicProvider();

export type TaskType = 'text' | 'vision' | 'grading' | 'index' | 'solution';

export function getProvider(task: TaskType): LLMProvider {
  switch (task) {
    case 'vision':
    case 'grading':
      return anthropic;
    default:
      return deepseek;
  }
}

export { deepseek, anthropic };
