import { LAST_FOLDER_KEY, WORKSPACES_KEY } from '../storage/keys';
import { readKey, updateKey } from '../storage/kv';
import type { PageInfo, WorkspaceMap } from '../types';
import { appendTab } from '../utils/workspaceOps';
import { normalizeWorkspaces } from '../utils/workspaceTree';

const BADGE_MS = 2500;

/** Araç çubuğu simgesinde kısa geri bildirim (popup açılmadan kaydedildiği için tek görsel işaret budur). */
function flashBadge(tabId: number | undefined, text: string, color: string, title: string) {
  if (tabId === undefined) return;
  void chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => undefined);
  void chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  void chrome.action.setTitle({ tabId, title }).catch(() => undefined);
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
    void chrome.action.setTitle({ tabId, title: 'TabFlow' }).catch(() => undefined);
  }, BADGE_MS);
}

export async function readWorkspaces(): Promise<WorkspaceMap> {
  return normalizeWorkspaces(await readKey<unknown>(WORKSPACES_KEY, {}));
}

/**
 * Sayfayı klasöre ekler (sekme kapatılmaz) ve sonucu simgede gösterir: ✓ eklendi, = zaten vardı, ! hata.
 * `feedbackTabId`: rozetin gösterileceği sekme.
 */
export async function savePageToFolder(folderId: string, page: PageInfo, feedbackTabId?: number): Promise<void> {
  let added = false;
  let folderName = '';
  try {
    await updateKey<unknown>(WORKSPACES_KEY, {}, (raw) => {
      const map = normalizeWorkspaces(raw);
      const result = appendTab(map, folderId, page, Date.now());
      added = result.added;
      folderName = map[folderId].name;
      return result.added ? result.map : raw;
    });
  } catch (e) {
    console.error('[TabFlow] sayfa kaydedilemedi.', e);
    flashBadge(feedbackTabId, '!', '#dc2626', 'TabFlow: sayfa kaydedilemedi');
    return;
  }
  if (added) {
    await chrome.storage.local.set({ [LAST_FOLDER_KEY]: folderId }).catch(() => undefined);
    flashBadge(feedbackTabId, '✓', '#16a34a', `TabFlow: “${folderName}” klasörüne kaydedildi`);
  } else {
    flashBadge(feedbackTabId, '=', '#64748b', `TabFlow: bu sayfa “${folderName}” klasöründe zaten var`);
  }
}

/** Kısayolun hedefi: en son sekme eklenen klasör; o yoksa en son güncellenen klasör. */
export async function resolveLastFolder(map: WorkspaceMap): Promise<string | null> {
  const last = await readKey<string | null>(LAST_FOLDER_KEY, null);
  if (last && map[last]) return last;
  const recent = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return recent?.id ?? null;
}

export { flashBadge };
