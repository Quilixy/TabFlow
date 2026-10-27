import { diffSyncedState, pickSyncedState } from '../utils/uiSync';
import { applyTheme } from '../utils/theme';
import { UI_STORAGE_KEY, useUiStore } from './useUiStore';
import { resolveLanguage, setLanguage } from '../i18n';
import { LANGUAGE_KEY } from '../storage/keys';

/**
 * Kayıtlı tema ve dil ayarlarını uygular; ayar ve sistem teması değişimlerini izler.
 * Ayrıca başka bir pencerede (ör. popup) yapılan ayar değişikliklerini canlı olarak bu pencereye taşır.
 */
export function initThemeSync(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let lastKey = '';
  const apply = (force = false) => {
    const { theme, accent, animation, pack, decor } = useUiStore.getState();
    // Store her değişimde (sürükleme vurgusu, arama yazımı…) bildirir: tema alanları değişmediyse dokunma.
    const key = [theme, accent, animation, pack, decor, media.matches].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    applyTheme({ theme, accent, animation, pack, decor }, media.matches);
  };
  apply(true);
  useUiStore.subscribe(() => apply());

  let lastLanguage = '';
  const applyLanguage = () => {
    const lang = resolveLanguage(useUiStore.getState().language);
    if (lang === lastLanguage) return;
    lastLanguage = lang;
    setLanguage(lang);
    // Arka plandaki sağ tık menüsü ve rozetler aynı dili kullansın (localStorage'a erişemezler).
    void chrome.storage?.local.set({ [LANGUAGE_KEY]: lang }).catch(() => undefined);
  };
  applyLanguage();
  useUiStore.subscribe(applyLanguage);
  media.addEventListener('change', () => apply());

  // `storage` olayı yalnızca DİĞER belgelerde tetiklenir. Yine de yalnızca gerçekten değişen alanlar uygulanır:
  // aynı değerleri yazmak persist'i yeniden yazdırır ve iki pencere birbirini sonsuza dek tetiklerdi.
  window.addEventListener('storage', (e) => {
    if (e.key !== UI_STORAGE_KEY) return;
    const patch = diffSyncedState(useUiStore.getState(), pickSyncedState(e.newValue));
    if (patch) useUiStore.setState(patch);
  });
}
