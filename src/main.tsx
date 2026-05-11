import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getSetting } from './providers/settings-helper';

getSetting<string>('theme').then((theme) => {
  if (theme && theme !== 'system') {
    document.documentElement.classList.add(`theme-${theme}`);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
