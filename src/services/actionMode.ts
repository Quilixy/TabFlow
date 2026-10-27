import { ACTION_MODE_KEY } from '../storage/keys';

/**
 * Araç çubuğu simgesine tıklayınca ne açılır: açılır pencere (popup) ya da tarayıcının yan paneli.
 * Popup'taki "Yan panelde aç" yan panel moduna, paneldeki "Açılır pencereye dön" popup moduna geçirir.
 * Seçim depoda tutulur; service worker her açılışta yeniden uygular (simge ayarı oturumlar arasında kalmayabilir).
 */
export type ActionMode = 'popup' | 'panel';

export const isActionMode = (value: unknown): value is ActionMode => value === 'popup' || value === 'panel';

/** Manifest'teki popup sayfası (derlenmiş yol). */
const popupPath = (): string => chrome.runtime.getManifest().action?.default_popup ?? '';

/** Simgenin davranışını uygular: panel modunda popup kaldırılır ve tıklama yan paneli açar. */
export async function applyActionMode(mode: ActionMode): Promise<void> {
  await chrome.action.setPopup({ popup: mode === 'panel' ? '' : popupPath() });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'panel' });
}

export async function setActionMode(mode: ActionMode): Promise<void> {
  await chrome.storage.local.set({ [ACTION_MODE_KEY]: mode });
  await applyActionMode(mode);
}

/** Yan paneli kapatır: Chrome 141+ sidePanel.close; daha eskilerde panel sayfası kendini kapatır. */
export async function closeSidePanel(windowId: number): Promise<void> {
  try {
    if (typeof chrome.sidePanel.close === 'function') {
      await chrome.sidePanel.close({ windowId });
      return;
    }
  } catch {
    // Kapatılamadı (ör. sekmeye özel panel): sayfanın kendisini kapatmayı dene.
  }
  window.close();
}
