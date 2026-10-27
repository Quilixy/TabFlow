import { t } from '../i18n';
import { openAppAtFolder } from '../services/navigation';
import { readWorkspaceMap } from '../storage/workspaceStore';
import type { WorkspaceMap } from '../types';
import { folderIdFromContent, omniboxSuggestions } from '../utils/omnibox';
import { isHttpUrl } from '../utils/url';

/**
 * Adres çubuğunda "tf <arama>": kayıtlı sekmeler ve klasörler öneri olarak çıkar. Sekme seçilince sayfa açılır,
 * klasör seçilince tam ekran uygulama o klasörde açılır.
 */

// Her tuş vuruşunda tüm klasörleri okumamak için bellekte tutulur; klasörler değişince boşaltılır.
let cache: WorkspaceMap | null = null;

export function invalidateOmniboxCache(): void {
  cache = null;
}

async function workspaces(): Promise<WorkspaceMap> {
  cache ??= await readWorkspaceMap();
  return cache;
}

async function openUrl(url: string, disposition: `${chrome.omnibox.OnInputEnteredDisposition}`): Promise<void> {
  if (disposition === 'currentTab') await chrome.tabs.update({ url });
  else await chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
}

async function handleEntered(text: string, disposition: `${chrome.omnibox.OnInputEnteredDisposition}`): Promise<void> {
  // Öneri seçilmeden Enter'a basıldıysa ilk öneri kullanılır; hiçbiri yoksa uygulama açılır.
  const isChoice = folderIdFromContent(text) !== null || isHttpUrl(text);
  const content = isChoice ? text : omniboxSuggestions(await workspaces(), text, 1)[0]?.content;
  if (!content) return openAppAtFolder();
  const folderId = folderIdFromContent(content);
  if (folderId) return openAppAtFolder(folderId);
  if (isHttpUrl(content)) await openUrl(content, disposition);
}

/** Dinleyicileri kaydeder (service worker'ın en üst düzeyinde, eşzamanlı çağrılmalı). */
export function setupOmnibox(languageReady: Promise<unknown>): void {
  chrome.omnibox.onInputStarted.addListener(() => {
    void languageReady.then(() => chrome.omnibox.setDefaultSuggestion({ description: t('omnibox.default') }));
  });
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    languageReady
      .then(workspaces)
      .then((map) => suggest(omniboxSuggestions(map, text)))
      .catch((e) => console.error('[TabFlow] öneriler hazırlanamadı.', e));
  });
  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    handleEntered(text, disposition).catch((e) => console.error('[TabFlow] adres çubuğundan açılamadı.', e));
  });
}
