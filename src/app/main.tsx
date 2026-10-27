import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // Yerel Inter (çevrimdışı çalışır, dış istek yok)
import './app.css';
import { initThemeSync } from '../store/themeSync';
import FullApp from './FullApp';

initThemeSync(); // İlk boyamadan önce: yanlış temada yanıp sönmeyi önler

const container = document.getElementById('root');
if (!container) throw new Error('#root elementi bulunamadı.');

createRoot(container).render(
  <StrictMode>
    <FullApp />
  </StrictMode>,
);