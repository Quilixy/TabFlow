import type { WorkspaceMap } from '../types';
import { foldText, normalizeQuery, tabMatches } from './search';
import { compareSiblings, pathLabel } from './workspaceTree';

/** Adres çubuğu önerisinin içeriği bir klasörse bu önekle başlar (aksi halde sekmenin adresidir). */
export const FOLDER_CONTENT_PREFIX = 'tabflow-folder:';
export const MAX_SUGGESTIONS = 6;
const MAX_FOLDER_SUGGESTIONS = 2;

export interface OmniboxSuggestion {
  /** Seçilince "girilen" değer: sekme adresi ya da klasör içeriği. */
  content: string;
  /** Chrome'un XML biçimi: <match>, <dim>, <url> etiketleri; metin kaçışlanmış olmalı. */
  description: string;
}

/** Öneri açıklamaları XML'dir: kullanıcı metni kaçışlanmalı (aksi halde öneri hiç görünmez). */
export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);

/**
 * Adres çubuğunda "tf <arama>" için öneriler: önce adı eşleşen klasörler (en fazla iki), sonra eşleşen sekmeler.
 * Aynı adres birden çok klasördeyse bir kez önerilir.
 */
export function omniboxSuggestions(map: WorkspaceMap, text: string, limit = MAX_SUGGESTIONS): OmniboxSuggestion[] {
  const query = normalizeQuery(text);
  if (query === '') return [];
  const folders = Object.values(map).sort(compareSiblings);
  const suggestions: OmniboxSuggestion[] = [];

  for (const folder of folders) {
    if (suggestions.length >= Math.min(limit, MAX_FOLDER_SUGGESTIONS)) break;
    if (!foldText(folder.name).includes(query)) continue;
    suggestions.push({
      content: FOLDER_CONTENT_PREFIX + folder.id,
      description: `<match>${escapeXml(pathLabel(map, folder.id))}</match> <dim>· ${folder.tabs.length}</dim>`,
    });
  }

  const seen = new Set<string>();
  for (const folder of folders) {
    for (const tab of folder.tabs) {
      if (suggestions.length >= limit) return suggestions;
      if (seen.has(tab.url) || !tabMatches(tab, query)) continue;
      seen.add(tab.url);
      suggestions.push({
        content: tab.url,
        description: `${escapeXml(tab.title)} <dim>— ${escapeXml(pathLabel(map, folder.id))}</dim> <url>${escapeXml(tab.url)}</url>`,
      });
    }
  }
  return suggestions;
}

/** Seçilen öneri bir klasörse kimliği; değilse null. */
export const folderIdFromContent = (content: string): string | null =>
  content.startsWith(FOLDER_CONTENT_PREFIX) ? content.slice(FOLDER_CONTENT_PREFIX.length) : null;
