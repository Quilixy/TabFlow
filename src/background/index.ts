import { AUTO_EXPORT_KEY, LANGUAGE_KEY, LAST_FOLDER_KEY, TRASH_KEY, WORKSPACES_KEY } from '../storage/keys';
import {
  isWorkspaceChange,
  migrateLegacyWorkspaces,
  readRawWorkspaces,
  revertWorkspaceChanges,
} from '../storage/workspaceStore';
import { readKey, updateKey } from '../storage/kv';
import { isRestoreMessage, restoreFolder, type RestoreReply } from '../services/restoreService';
import { isSnapshotDue, takeSnapshotIfDue } from '../storage/snapshotStore';
import type { PageInfo } from '../types';
import { contextMenuItems, folderIdFromMenuItem } from '../utils/contextMenu';
import { toOpenTab } from '../utils/tabs';
import { normalizeTrash, pruneTrash } from '../utils/trash';
import { isHttpUrl } from '../utils/url';
import { normalizeWorkspaces } from '../utils/workspaceTree';
import { maybeAutoExport } from './autoExport';
import { flashBadge, readWorkspaces, resolveLastFolder, savePageToFolder } from './saveFromBrowser';
import { detectLanguage, LANGUAGES, setLanguage, t, type Lang } from '../i18n';

// Tüm dinleyiciler en üst düzeyde ve eşzamanlı kaydedilir: MV3 service worker bir olayla uyandığında
// dinleyicinin hazır olması gerekir.

// ---- Tam ekran uygulama ----------------------------------------------------------
// Tam ekran uygulama manifest'te options_ui (open_in_tab) olarak tanımlı:
// openOptionsPage() zaten açık olan sekmeyi öne getirir, yoksa yenisini açar.
const openApp = () => {
  chrome.runtime.openOptionsPage().catch((e) => console.error('[TabFlow] tam ekran açılamadı.', e));
};

// ---- Dil: arayüzde seçilen (çözülmüş) dil depoda tutulur; yoksa tarayıcının dili ----------------
const isLang = (value: unknown): value is Lang => (LANGUAGES as readonly unknown[]).includes(value);

async function loadLanguage(): Promise<void> {
  const stored = await readKey<unknown>(LANGUAGE_KEY, null);
  setLanguage(isLang(stored) ? stored : detectLanguage());
}
// Her uyanışta ilk iş: menü ve rozet metinleri doğru dilde olsun.
const languageReady = loadLanguage().catch(() => undefined);

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
  await languageReady;
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
    await languageReady;
    // "Son kullanılan" öğesi kimliği bilinmeyen bir hedefi gösterir: tıklama anında çöz.
    const target = folderId === '' ? await resolveLastFolder(await readWorkspaces()) : folderId;
    if (!target) {
      flashBadge(tab?.id, '!', '#dc2626', t('badge.createFirst'));
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
      flashBadge(tab?.id, '!', '#dc2626', t('badge.webOnly'));
      return;
    }
    await savePageToFolder(target, page, tab?.id);
  })();
});

// ---- Popup'tan gelen "sekmeleri aç" istekleri ---------------------------------------------
// Popup kapanınca (ör. sayfaya tıklanınca) kodu da durur; uzun açma işlemi burada yürür ki yarıda kalmasın.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRestoreMessage(message) || sender.id !== chrome.runtime.id) return false;
  languageReady.then(() => restoreFolder(message)).then(
    (result) => sendResponse({ ok: true, result } satisfies RestoreReply),
    (e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : t('restore.err.tabs') } satisfies RestoreReply),
  );
  return true; // Yanıt eşzamansız gönderilecek
});

// ---- Kısayollar ----------------------------------------------------------------------
async function saveActiveTabToLastFolder(): Promise<void> {
  await languageReady;
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const page = active ? toOpenTab(active) : null;
  if (!page) {
    flashBadge(active?.id, '!', '#dc2626', t('badge.cannotSave'));
    return;
  }
  const target = await resolveLastFolder(await readWorkspaces());
  if (!target) {
    flashBadge(active.id, '!', '#dc2626', t('badge.createFirst'));
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
  await migrateLegacyWorkspaces();
  const now = Date.now();
  await maybeAutoExport(now).catch((e) => console.error('[TabFlow] diske yedek alınamadı.', e));
  await takeSnapshotIfDue(await readWorkspaces(), now);
  await updateKey<unknown>(TRASH_KEY, [], (raw) => {
    const entries = normalizeTrash(raw);
    const pruned = pruneTrash(entries, now);
    return pruned === entries ? raw : pruned;
  });
}

/**
 * Günlük yedek: değişiklikten ÖNCEKİ hal saklanır; yedeği tetikleyen değişiklik hatalıysa bile geri dönülebilir.
 * Önce küçük meta anahtarına bakılır: yedek zamanı değilse tüm klasörler okunmaz.
 */
async function snapshotBeforeChange(changes: Record<string, chrome.storage.StorageChange>): Promise<void> {
  const now = Date.now();
  if (!(await isSnapshotDue(now))) return;
  const before = revertWorkspaceChanges(await readRawWorkspaces(), changes);
  await takeSnapshotIfDue(normalizeWorkspaces(before), now);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (isWorkspaceChange(changes)) {
    snapshotBeforeChange(changes).catch((e) => console.error('[TabFlow] otomatik yedek alınamadı.', e));
    // Tarayıcı günlerce kapatılmadan kullanılıyorsa diske yedek, açılışı beklemeden bir değişiklikle tetiklenir.
    maybeAutoExport().catch((e) => console.error('[TabFlow] diske yedek alınamadı.', e));
    // Eski tek anahtara yazılmış harita (eski sürüm, içe aktarma aracı, test) hemen yeni düzene taşınır.
    if (changes[WORKSPACES_KEY]?.newValue !== undefined) {
      migrateLegacyWorkspaces().catch((e) => console.error('[TabFlow] klasörler taşınamadı.', e));
    }
    scheduleMenuRebuild();
  }
  if (changes[LAST_FOLDER_KEY]) scheduleMenuRebuild();
  // Diske yedek açıldı ya da sıklaştırıldıysa zamanı geldiyse hemen al (kendi lastAt yazımımız tekrar tetiklemez).
  if (changes[AUTO_EXPORT_KEY]) maybeAutoExport().catch((e) => console.error('[TabFlow] diske yedek alınamadı.', e));
  const language = changes[LANGUAGE_KEY]?.newValue;
  if (isLang(language)) {
    setLanguage(language);
    rebuildMenus(true).catch((e) => console.error('[TabFlow] menü kurulamadı.', e));
  }
});

const onLaunch = () => {
  rebuildMenus(true).catch((e) => console.error('[TabFlow] menü kurulamadı.', e));
  maintenance().catch((e) => console.error('[TabFlow] bakım yapılamadı.', e));
};
chrome.runtime.onInstalled.addListener(onLaunch);
chrome.runtime.onStartup.addListener(onLaunch);

