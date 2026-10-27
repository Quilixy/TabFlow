import { LAST_FOLDER_KEY, TRASH_KEY, WORKSPACES_KEY } from '../storage/keys';
import { readKey, updateKey } from '../storage/kv';
import { takeSnapshotIfDue } from '../storage/snapshotStore';
import type { PageInfo } from '../types';
import { contextMenuItems, folderIdFromMenuItem } from '../utils/contextMenu';
import { toOpenTab } from '../utils/tabs';
import { normalizeTrash, pruneTrash } from '../utils/trash';
import { isHttpUrl } from '../utils/url';
import { normalizeWorkspaces } from '../utils/workspaceTree';
import { flashBadge, readWorkspaces, resolveLastFolder, savePageToFolder } from './saveFromBrowser';

// Tüm dinleyiciler en üst düzeyde ve eşzamanlı kaydedilir: MV3 service worker bir olayla uyandığında
// dinleyicinin hazır olması gerekir.

// ---- Tam ekran uygulama ----------------------------------------------------------
// Tam ekran uygulama manifest'te options_ui (open_in_tab) olarak tanımlı:
// openOptionsPage() zaten açık olan sekmeyi öne getirir, yoksa yenisini açar.
const openApp = () => {
  chrome.runtime.openOptionsPage().catch((e) => console.error('[TabFlow] tam ekran açılamadı.', e));
};

// ---- Sağ tık menüsü: "TabFlow'a kaydet → klasör" ------------------------------------
let menuSignature = '';
let menuTimer: ReturnType<typeof setTimeout> | undefined;
/** Kurulumlar sıraya girer: üst üste binen iki kurulum aynı kimlikle öğe yaratıp hata verirdi. */
let menuQueue: Promise<void> = Promise.resolve();

function rebuildMenus(force = false): Promise<void> {
  const run = menuQueue.then(() => rebuildMenusNow(force));
  menuQueue = run.catch(() => undefined);
  return run;
}

/** create/removeAll hataları geri çağrıda okunmazsa Chrome "Unchecked runtime.lastError" yazar. */
const logMenuError = () => {
  const error = chrome.runtime.lastError;
  if (error) console.warn('[TabFlow] menü öğesi oluşturulamadı:', error.message);
};

/** Menüyü klasörlere göre yeniden kurar; içerik değişmediyse dokunmaz (kart sürüklemek de depoya yazar). */
async function rebuildMenusNow(force: boolean): Promise<void> {
  const [map, lastFolderId] = await Promise.all([readWorkspaces(), readKey<string | null>(LAST_FOLDER_KEY, null)]);
  const items = contextMenuItems(map, lastFolderId);
  const signature = JSON.stringify(items);
  if (!force && signature === menuSignature) return;
  menuSignature = '';

  await chrome.contextMenus.removeAll();
  for (const item of items) {
    // Tür tanımı ayıracı (separator) başlıksız kabul etmiyor; API ise kabul eder.
    chrome.contextMenus.create({
      ...item,
      contexts: ['page', 'link'],
      // Yalnızca web sayfaları ve web bağlantıları kaydedilebilir.
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    } as chrome.contextMenus.CreateProperties, logMenuError);
  }
  menuSignature = signature;
}

function scheduleMenuRebuild() {
  clearTimeout(menuTimer);
  menuTimer = setTimeout(() => {
    rebuildMenus().catch((e) => console.error('[TabFlow] menü kurulamadı.', e));
  }, 400);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const folderId = folderIdFromMenuItem(String(info.menuItemId));
  if (folderId === null) return;

  void (async () => {
    // "Son kullanılan" öğesi kimliği bilinmeyen bir hedefi gösterir: tıklama anında çöz.
    const target = folderId === '' ? await resolveLastFolder(await readWorkspaces()) : folderId;
    if (!target) {
      flashBadge(tab?.id, '!', '#dc2626', 'TabFlow: önce bir klasör oluştur');
      return;
    }

    let page: PageInfo | null = null;
    if (info.linkUrl) {
      // Bağlantıya sağ tık: sayfanın kendisi değil, bağlantının hedefi kaydedilir.
      if (isHttpUrl(info.linkUrl)) {
        const title = info.selectionText?.trim() || info.linkUrl;
        page = { url: info.linkUrl, title, favIconUrl: null, pinned: false };
      }
    } else if (tab) {
      page = toOpenTab(tab);
    }
    if (!page) {
      flashBadge(tab?.id, '!', '#dc2626', 'TabFlow: yalnızca web sayfaları kaydedilebilir');
      return;
    }
    await savePageToFolder(target, page, tab?.id);
  })();
});

// ---- Kısayollar ----------------------------------------------------------------------
async function saveActiveTabToLastFolder(): Promise<void> {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const page = active ? toOpenTab(active) : null;
  if (!page) {
    flashBadge(active?.id, '!', '#dc2626', 'TabFlow: bu sayfa kaydedilemez (yalnızca web sayfaları)');
    return;
  }
  const target = await resolveLastFolder(await readWorkspaces());
  if (!target) {
    flashBadge(active.id, '!', '#dc2626', 'TabFlow: önce bir klasör oluştur');
    return;
  }
  await savePageToFolder(target, page, active.id);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-app') openApp();
  if (command === 'save-to-last-folder') {
    saveActiveTabToLastFolder().catch((e) => console.error('[TabFlow] kısayolla kaydedilemedi.', e));
  }
});

// ---- Otomatik yedek ve çöp kutusu bakımı ------------------------------------------------
async function maintenance(): Promise<void> {
  const now = Date.now();
  await takeSnapshotIfDue(await readWorkspaces(), now);
  await updateKey<unknown>(TRASH_KEY, [], (raw) => {
    const entries = normalizeTrash(raw);
    const pruned = pruneTrash(entries, now);
    return pruned === entries ? raw : pruned;
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const change = changes[WORKSPACES_KEY];
  if (change) {
    // Günlük yedek: değişiklikten ÖNCEKİ hal saklanır; yedeği tetikleyen değişiklik hatalıysa bile geri dönülebilir.
    if (change.oldValue !== undefined) {
      takeSnapshotIfDue(normalizeWorkspaces(change.oldValue), Date.now()).catch((e) =>
        console.error('[TabFlow] otomatik yedek alınamadı.', e),
      );
    }
    scheduleMenuRebuild();
  }
  if (changes[LAST_FOLDER_KEY]) scheduleMenuRebuild();
});

const onLaunch = () => {
  rebuildMenus(true).catch((e) => console.error('[TabFlow] menü kurulamadı.', e));
  maintenance().catch((e) => console.error('[TabFlow] bakım yapılamadı.', e));
};
chrome.runtime.onInstalled.addListener(onLaunch);
chrome.runtime.onStartup.addListener(onLaunch);

