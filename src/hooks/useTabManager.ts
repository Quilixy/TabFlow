import { useCallback, useMemo } from 'react';
import type { PageInfo } from '../types';
import { toOpenTab, type OpenTab } from '../utils/tabs';

export { resolveRestorableUrl, toOpenTab, type OpenTab } from '../utils/tabs';
export { EAGER_TAB_LIMIT } from '../services/restoreService';

export class TabManagerError extends Error {
  readonly originalError?: unknown;
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'TabManagerError';
    this.originalError = originalError;
  }
}

const LANDING_URL = 'chrome://newtab/';

async function getCurrentWindowId(): Promise<number> {
  const win = await chrome.windows.getCurrent();
  if (win.id === undefined) throw new Error('Aktif pencere bulunamadı.');
  return win.id;
}

/**
 * Aktif penceredeki geri yüklenebilir sekmeleri okur. Saf okuma, sık tetiklenen yenilemelerde güvenle kullanılır.
 * skipped: kaydedilemeyen (http(s) olmayan: chrome://, file:// vb.) sekme sayısı.
 */
export async function queryOpenTabsDetailed(options?: {
  includePinned?: boolean;
}): Promise<{ tabs: OpenTab[]; skipped: number }> {
  const includePinned = options?.includePinned ?? false;
  const windowId = await getCurrentWindowId();
  const all = await chrome.tabs.query({ windowId });
  const own = chrome.runtime.getURL('');
  const tabs: OpenTab[] = [];
  let skipped = 0;
  for (const tab of all) {
    if (!includePinned && tab.pinned) continue;
    const openTab = toOpenTab(tab);
    if (openTab) tabs.push(openTab);
    // TabFlow'un kendi sayfası (tam ekran uygulama) "kaydedilemedi" sayılmaz.
    else if (!(tab.url || tab.pendingUrl || '').startsWith(own)) skipped++;
  }
  return { tabs, skipped };
}

export async function queryOpenTabs(options?: { includePinned?: boolean }): Promise<OpenTab[]> {
  return (await queryOpenTabsDetailed(options)).tabs;
}

/**
 * Sekmeyi kimliğiyle tarayıcıdan yeniden okur. Sürükle-bırakla gelen "açık sekme" verisi başka bir sayfadan da
 * gelebilir (özel MIME türünü herhangi bir site ayarlayabilir); bu yüzden verideki URL/başlığa değil, yalnızca
 * kimliğe güvenilir. Sekme yoksa veya kaydedilemiyorsa null.
 */
export async function resolveOpenTabById(id: unknown): Promise<OpenTab | null> {
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  try {
    const [tab, windowId] = await Promise.all([chrome.tabs.get(id), getCurrentWindowId()]);
    // Yalnızca bu penceredeki sekmeler (açık sekmeler listesi de yalnızca bunları gösterir).
    return tab.windowId === windowId ? toOpenTab(tab) : null;
  } catch {
    return null;
  }
}

/**
 * Aktif penceredeki aktif sekmeyi döndürür; yalnızca o sekmeyi sorgular (tüm sekmeleri çekmez).
 * Yüklenmekte olan sekmede pendingUrl da kabul edilir. Kaydedilemeyen sayfalarda (chrome://, boş sekme vb.)
 * anlaşılır bir hata fırlatır.
 */
export async function queryActiveTab(): Promise<OpenTab> {
  const windowId = await getCurrentWindowId();
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  const openTab = tab ? toOpenTab(tab) : null;
  if (!openTab) throw new Error('Bu sayfa kaydedilemez (yalnızca web sayfaları kaydedilir).');
  return openTab;
}

export function useTabManager() {
  // Hata çağırana fırlatılır ve arayüz tarafından gösterilir; burada ayrıca durum tutulmaz
  // (tutulsaydı kapatılan hata bandı aynı iletiyle geri gelirdi).
  const run = useCallback(async <T>(context: string, task: () => Promise<T>): Promise<T> => {
    try {
      return await task();
    } catch (e) {
      console.error(`[TabFlow] ${context}`, e);
      throw e instanceof TabManagerError ? e : new TabManagerError(context, e);
    }
  }, []);

  /** Aktif penceredeki geri yüklenebilir sekmeleri döndürür. */
  const getOpenTabs = useCallback(
    (options?: { includePinned?: boolean }) =>
      run('Açık sekmeler okunamadı.', () => queryOpenTabsDetailed(options)),
    [run],
  );

  /**
   * Verilen sekmeleri kapatır ve hâlâ açık kalanların sayısını döndürür (0: hepsi kapandı). Pencerenin tüm
   * sekmeleri kapanacaksa önce boş bir sekme açar; aksi halde pencere (son pencereyse tüm Chrome) kapanır.
   */
  const closeTabs = useCallback(
    (tabIds: number[]) =>
      run('Sekmeler kapatılamadı.', async () => {
        if (tabIds.length === 0) return 0;
        const windowId = await getCurrentWindowId();
        const closing = new Set(tabIds);
        const windowTabs = await chrome.tabs.query({ windowId });
        const wouldEmptyWindow = windowTabs.every((t) => t.id !== undefined && closing.has(t.id));
        if (wouldEmptyWindow) {
          await chrome.tabs.create({ windowId, url: LANDING_URL, active: false });
        }

        const results = await Promise.allSettled(tabIds.map((id) => chrome.tabs.remove(id)));
        if (!results.some((r) => r.status === 'rejected')) return 0;
        // Reddedilenlerin bir kısmı zaten kapanmış olabilir ("No tab with id"): gerçekten açık kalanları say.
        const remaining = new Set((await chrome.tabs.query({ windowId })).map((t) => t.id));
        const stillOpen = tabIds.filter((id) => remaining.has(id)).length;
        if (stillOpen > 0) console.warn(`[TabFlow] ${stillOpen} sekme kapatılamadı.`);
        return stillOpen;
      }),
    [run],
  );

  /** Tek bir sekmeyi popup'ı kapatmadan arka planda açar. */
  const openSingleTab = useCallback(
    (tab: PageInfo) =>
      run('Sekme açılamadı.', async () => {
        const windowId = await getCurrentWindowId();
        await chrome.tabs.create({
          windowId,
          url: tab.url,
          pinned: tab.pinned,
          active: false,
        });
      }),
    [run],
  );

  const activateTab = useCallback(
    (tabId: number) =>
      run('Sekme etkinleştirilemedi.', async () => {
        await chrome.tabs.update(tabId, { active: true });
      }),
    [run],
  );

  return useMemo(
    () => ({ getOpenTabs, closeTabs, openSingleTab, activateTab }),
    [getOpenTabs, closeTabs, openSingleTab, activateTab],
  );
}