import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // Yerel Inter (çevrimdışı çalışır, dış istek yok)
import './popup.css';
import { initThemeSync } from '../store/themeSync';
import PopupApp from './PopupApp';

initThemeSync(); // İlk boyamadan önce: yanlış temada yanıp sönmeyi önler

const container = document.getElementById('root');
if (!container) throw new Error('#root elementi bulunamadı.');

createRoot(container).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);