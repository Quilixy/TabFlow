import { NAVIGATE_KEY } from '../utils/uiSync';

/**
 * Tam ekran uygulamayı açar (zaten açıksa öne getirir) ve verilen klasöre gitmesini ister. İstek chrome.storage'a
 * yazılır: hem yeni açılan hem açık olan uygulama onu görür. Service worker'dan da çağrılabilir (localStorage yok).
 */
export async function openAppAtFolder(folderId?: string): Promise<void> {
  if (folderId) await chrome.storage.local.set({ [NAVIGATE_KEY]: { id: folderId, at: Date.now() } });
  await chrome.runtime.openOptionsPage();
}
