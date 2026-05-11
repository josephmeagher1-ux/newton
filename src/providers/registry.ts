import { DeepSeekProvider } from './deepseek';
import { OpenRouterProvider } from './openrouter';
import type { LLMProvider } from './types';
import { getSetting } from './settings-helper';

const deepseek = new DeepSeekProvider();
const openrouterText = new OpenRouterProvider('openrouter_model_text', 'deepseek/deepseek-chat-v3-0324');
const openrouterVision = new OpenRouterProvider('openrouter_model_vision', 'anthropic/claude-sonnet-4-5-20241022');

export type TaskType = 'text' | 'vision' | 'grading' | 'index' | 'solution';

export async function getProviderAsync(task: TaskType): Promise<LLMProvider> {
  const visionProvider = await getSetting<string>('vision_provider');

  switch (task) {
    case 'vision':
    case 'grading':
      return visionProvider === 'deepseek' ? deepseek : openrouterVision;
    default:
      return deepseek;
  }
}

export function getProvider(task: TaskType): LLMProvider {
  switch (task) {
    case 'vision':
    case 'grading':
      return openrouterVision;
    default:
      return deepseek;
  }
}

export { deepseek, openrouterText, openrouterVision };
