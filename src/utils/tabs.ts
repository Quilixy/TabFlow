import type { PageInfo } from '../types';
import { isHttpUrl } from './url';

/** Tarayıcıdaki açık bir sekmenin kaydedilebilir özeti. */
export interface OpenTab extends PageInfo {
  id: number;
  active: boolean;
}

export function resolveRestorableUrl(tab: chrome.tabs.Tab): string | null {
  const url = tab.url || tab.pendingUrl;
  return isHttpUrl(url) ? url : null;
}

/**
 * Chrome sekmesini kaydedilebilir özete çevirir; yalnızca http(s) sekmeler (başka şemalar null).
 * Simge yalnızca http(s) adresse saklanır: data: (base64) simgeler tüm haritayı şişirirdi; gösterimde zaten
 * /_favicon/ önbelleği tercih edilir.
 */
export function toOpenTab(tab: chrome.tabs.Tab): OpenTab | null {
  const url = resolveRestorableUrl(tab);
  if (tab.id === undefined || url === null) return null;
  return {
    id: tab.id,
    url,
    title: tab.title?.trim() || url,
    favIconUrl: isHttpUrl(tab.favIconUrl) ? tab.favIconUrl : null,
    pinned: tab.pinned,
    active: tab.active,
  };
}
