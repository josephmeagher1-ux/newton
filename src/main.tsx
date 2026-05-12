import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getSetting } from './providers/settings-helper';
import { loadAppPatches } from './lib/app-patches';
import './prompts';

getSetting<string>('theme').then((theme) => {
  if (theme && theme !== 'system') {
    document.documentElement.classList.add(`theme-${theme}`);
  }
});

loadAppPatches();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
