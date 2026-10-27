import { readWorkspaceMap } from '../storage/workspaceStore';
import type { PageInfo } from '../types';
import { tabGroupColor, type RestoreMode, type RestoreResult, type TabGroupColor } from '../utils/restore';
import { toOpenTab } from '../utils/tabs';
import { buildChildrenIndex, collectSubtree } from '../utils/workspaceTree';
import { t } from '../i18n';

/**
 * Klasör sekmelerini açma (bu pencerede / sekme grubu / yeni pencere). React'ten bağımsızdır: tam ekran uygulama
 * doğrudan çağırır; popup ise işi service worker'a yaptırır (popup kapanırsa işlem yarıda kalmasın).
 * Service worker'ın "mevcut penceresi" olmadığı için hedef pencere her zaman açıkça verilir.
 */

/**
 * Bir seferde bu sayıdan fazla sekme açılırken ilk bu kadarı normal yüklenir; kalanlar oluşturulur ama
 * "ertelenir" (discard): sekme çubuğunda görünür, tıklanınca yüklenir. Onlarca sekmenin aynı anda yüklenip
 * RAM'i şişirmesini önler.
 */
export const EAGER_TAB_LIMIT = 10;

/** Adresi yerleşmeyen sekme bu süreden sonra ertelenmez (normal yüklenir). */
const URL_COMMIT_TIMEOUT_MS = 4000;

/**
 * Sekmenin adresi yerleşene (gezinme başlayana) kadar bekler. Henüz adresi olmayan bir sekme ertelenirse (discard)
 * adresini kaybeder ve boş sekme olarak kalır; bu yüzden ertelemeden önce beklenir. Süre dolarsa false.
 */
function waitForCommittedUrl(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(ok);
    };
    const onUpdated = (id: number, _info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (id === tabId && tab.url) finish(true);
    };
    const timer = setTimeout(() => finish(false), URL_COMMIT_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Dinleyici eklenmeden önce yerleşmiş olabilir.
    chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.url) finish(true);
      },
      () => finish(false),
    );
  });
}

async function deferTab(tabId: number): Promise<boolean> {
  if (!(await waitForCommittedUrl(tabId))) return false;
  try {
    await chrome.tabs.discard(tabId);
    return true;
  } catch {
    return false; // Ertelenemedi (ör. çoktan yüklendi ya da etkin): normal yüklenmesine izin ver.
  }
}

/**
 * Sekmeleri SIRAYLA ve arka planda (active: false) açar. Toplamda EAGER_TAB_LIMIT'ten sonrakiler, adresleri
 * yerleşince ertelenir. Açma sırasında hata olursa bu çağrıda açılanları kapatır (yarım iş bırakmaz).
 * `existing`: aynı işlemde daha önce açılmış sekmeler (ertelemenin sayımına girer, hatada onlar da kapanır).
 */
export async function createTabsIn(
  windowId: number,
  tabs: PageInfo[],
  existing: number[] = [],
): Promise<{ ids: number[]; deferred: number }> {
  const ids = [...existing];
  const toDefer: number[] = [];
  try {
    for (const tab of tabs) {
      const created = await chrome.tabs.create({ windowId, url: tab.url, pinned: tab.pinned, active: false });
      if (created.id === undefined) continue;
      ids.push(created.id);
      if (ids.length > EAGER_TAB_LIMIT) toDefer.push(created.id);
    }
  } catch (e) {
    await Promise.allSettled(ids.map((id) => chrome.tabs.remove(id)));
    throw e;
  }
  const results = await Promise.all(toDefer.map(deferTab));
  return { ids, deferred: results.filter(Boolean).length };
}

/** Sekmeleri yeni (öne gelen) bir pencerede açar; ilki pencereyle birlikte oluşur. */
export async function openInNewWindow(tabs: PageInfo[]): Promise<{ ids: number[]; deferred: number }> {
  const [first, ...rest] = tabs;
  if (!first) return { ids: [], deferred: 0 };
  const win = await chrome.windows.create({ url: first.url, focused: true });
  const firstId = win?.tabs?.[0]?.id;
  if (win?.id === undefined || firstId === undefined) throw new Error(t('restore.err.windowCreate'));
  if (first.pinned) await chrome.tabs.update(firstId, { pinned: true });
  return createTabsIn(win.id, rest, [firstId]);
}

/** Sekmeleri adı ve rengi verilen bir sekme grubunda toplar (sabitlenmiş sekmeler gruplanamaz). */
export async function groupTabs(tabIds: number[], title: string, color: TabGroupColor): Promise<number | null> {
  if (tabIds.length === 0) return null;
  const groupId = await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] });
  await chrome.tabGroups.update(groupId, { title, color, collapsed: false });
  return groupId;
}

export interface RestoreRequestOptions {
  folderId: string;
  recursive: boolean;
  mode: RestoreMode;
  /** 'tabs' ve 'group' kiplerinde sekmelerin açılacağı pencere. */
  windowId: number;
  /** İşlem bitince ilk sekmeye geç. */
  activate: boolean;
}

/** Kullanıcıya gösterilecek, anlamlı iletisi olan hata (tarayıcı hatalarının ham iletisi gösterilmez). */
class RestoreError extends Error {}

/**
 * Klasörün (isteğe bağlı alt klasörlerle) sekmelerini açar.
 * - 'tabs': verilen pencerede; zaten açık URL'ler atlanır.
 * - 'group': verilen pencerede, klasörün adı ve renginde bir sekme grubu olarak; zaten açık olanlar da gruba alınır.
 *   Sabitlenmiş sekmeler gruplanamaz: grup kipinde sabitlenmeden açılır.
 * - 'window': yeni bir pencerede, hepsi (başka pencerede açık olanlar da).
 */
export async function restoreFolder(options: RestoreRequestOptions): Promise<RestoreResult> {
  const { folderId, recursive, mode, windowId, activate } = options;
  try {
    const current = await readWorkspaceMap();
    const folder = current[folderId];
    if (!folder) throw new RestoreError(t('restore.err.folderMissing'));

    const folders = recursive ? collectSubtree(buildChildrenIndex(current), current, folderId) : [folder];
    // Klasörler arasında tekrar eden URL bir kez açılır.
    const seen = new Set<string>();
    const tabs = folders.flatMap((f) => f.tabs).filter((t) => !seen.has(t.url) && (seen.add(t.url), true));
    if (tabs.length === 0) throw new RestoreError(t('restore.err.noTabs'));

    if (mode === 'window') {
      const { ids, deferred } = await openInNewWindow(tabs);
      return { mode, opened: ids.length, skipped: 0, deferred, grouped: 0 };
    }

    // Yalnızca hedef penceredeki açık sekmeler atlanır: başka pencerede açık olan burada yeniden açılır.
    const open = (await chrome.tabs.query({ windowId })).map(toOpenTab).filter((t) => t !== null);
    const openByUrl = new Map(open.map((t) => [t.url, t]));
    const toOpen = tabs
      .filter((t) => !openByUrl.has(t.url))
      .map((t) => (mode === 'group' ? { ...t, pinned: false } : t));
    const alreadyOpen = tabs.map((t) => openByUrl.get(t.url)).filter((t) => t !== undefined);

    const { ids, deferred } = toOpen.length > 0 ? await createTabsIn(windowId, toOpen) : { ids: [], deferred: 0 };

    let grouped = 0;
    if (mode === 'group') {
      const groupIds = [...alreadyOpen.filter((t) => !t.pinned).map((t) => t.id), ...ids];
      await groupTabs(groupIds, folder.name, tabGroupColor(folder.color));
      grouped = groupIds.length;
    }

    // Hiç yeni sekme açılmadıysa hiçbir şey olmamış gibi görünmesin: zaten açık olan ilkine geç.
    const focusId = ids[0] ?? alreadyOpen[0]?.id;
    if (activate && focusId !== undefined) await chrome.tabs.update(focusId, { active: true });
    return { mode, opened: ids.length, skipped: alreadyOpen.length, deferred, grouped };
  } catch (e) {
    if (e instanceof RestoreError) throw new Error(e.message, { cause: e });
    console.error('[TabFlow] sekmeler açılamadı.', e);
    throw new Error(
      t(mode === 'group' ? 'restore.err.group' : mode === 'window' ? 'restore.err.window' : 'restore.err.tabs'),
      { cause: e },
    );
  }
}

// ---- Popup → service worker mesajı -------------------------------------------------

export const RESTORE_MESSAGE = 'tabflow:restore';

export interface RestoreMessage extends RestoreRequestOptions {
  type: typeof RESTORE_MESSAGE;
}

export type RestoreReply = { ok: true; result: RestoreResult } | { ok: false; error: string };

const MODES: readonly RestoreMode[] = ['tabs', 'group', 'window'];

export function isRestoreMessage(message: unknown): message is RestoreMessage {
  const m = message as Partial<RestoreMessage> | null;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.type === RESTORE_MESSAGE &&
    typeof m.folderId === 'string' &&
    typeof m.recursive === 'boolean' &&
    typeof m.activate === 'boolean' &&
    Number.isInteger(m.windowId) &&
    MODES.includes(m.mode as RestoreMode)
  );
}

/** İşi service worker'a verir; popup kapansa bile sekmeler açılmaya devam eder. */
export async function restoreInBackground(options: RestoreRequestOptions): Promise<RestoreResult> {
  const reply = (await chrome.runtime.sendMessage({ type: RESTORE_MESSAGE, ...options } satisfies RestoreMessage)) as
    | RestoreReply
    | undefined;
  if (!reply) throw new Error(t('restore.err.noReply'));
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}

/** Bu sayfanın penceresi (popup: altındaki tarayıcı penceresi). */
export async function currentWindowId(): Promise<number> {
  const win = await chrome.windows.getCurrent();
  if (win.id === undefined) throw new Error(t('error.noActiveWindow'));
  return win.id;
}
