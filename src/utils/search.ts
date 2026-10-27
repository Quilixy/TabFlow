import type { SavedTab, Workspace } from '../types';

/**
 * Aramada karşılaştırma biçimi: Türkçe küçük harf (İ→i, I→ı), aksanlar atılır ve ı→i.
 * Böylece "istanbul" "İSTANBUL"u, "isik" "Işık"ı, "sarki" "Şarkı"yı bulur.
 */
export const foldText = (value: string): string =>
  value.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');

export const normalizeQuery = (raw: string): string => foldText(raw.trim());

/** `query` normalizeQuery'den geçmiş olmalı. */
export function tabMatches(tab: Pick<SavedTab, 'title' | 'url'>, query: string): boolean {
  return foldText(tab.title).includes(query) || foldText(tab.url).includes(query);
}

export function workspaceMatches(workspace: Workspace, query: string): boolean {
  if (query === '') return true;
  return foldText(workspace.name).includes(query) || workspace.tabs.some((t) => tabMatches(t, query));
}
