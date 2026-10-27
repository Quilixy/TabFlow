import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // Yerel Inter (çevrimdışı çalışır, dış istek yok)
import './app.css';
import { initThemeSync } from '../store/themeSync';
import FullApp from './FullApp';
import { LanguageRoot } from '../components/LanguageRoot';

initThemeSync(); // İlk boyamadan önce: yanlış temada yanıp sönmeyi önler

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found.');

createRoot(container).render(
  <StrictMode>
    <LanguageRoot>
      <FullApp />
    </LanguageRoot>
  </StrictMode>,
);