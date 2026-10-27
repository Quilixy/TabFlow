import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // Yerel Inter (çevrimdışı çalışır, dış istek yok)
import '../popup/popup.css';
import { initThemeSync } from '../store/themeSync';
import { LanguageRoot } from '../components/LanguageRoot';
import PopupApp from '../popup/PopupApp';

initThemeSync(); // İlk boyamadan önce: yanlış temada yanıp sönmeyi önler

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found.');

// Yan panel popup'la aynı arayüzü kullanır; yalnızca pencere boyunca uzanır ve açık kalır.
createRoot(container).render(
  <StrictMode>
    <LanguageRoot>
      <PopupApp layout="panel" />
    </LanguageRoot>
  </StrictMode>,
);
