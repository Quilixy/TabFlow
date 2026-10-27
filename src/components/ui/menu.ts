import type { FolderRef } from '../../types';
import type { RestoreMode } from '../../utils/restore';
import { t } from '../../i18n';

export type MenuEntry =
  | { type?: 'item'; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { type: 'heading'; label: string }
  | { type: 'separator' };

/** Klasör listesini "hedef seç" menü satırlarına çevirir. */
export function folderTargets(
  folders: FolderRef[],
  onSelect: (folder: FolderRef) => void,
  excludeId?: string,
): MenuEntry[] {
  return folders
    .filter((f) => f.id !== excludeId)
    .map((f) => ({ label: f.name, onSelect: () => onSelect(f) }));
}

/**
 * Bir klasörü açma seçenekleri (tüm menülerde aynı): bu pencerede, alt klasörlerle, sekme grubu, yeni pencere.
 * Grup ve pencere seçenekleri alt klasörlerdeki sekmeleri de kapsar (klasörün bütünü açılır).
 */
export function restoreEntries(
  ownTabs: number,
  subtreeTabs: number,
  disabled: boolean,
  onRestore: (recursive: boolean, mode: RestoreMode) => void,
): MenuEntry[] {
  const nested = subtreeTabs > ownTabs;
  const entries: MenuEntry[] = [
    { label: t('restoreMenu.own', { n: ownTabs }), onSelect: () => onRestore(false, 'tabs'), disabled: disabled || ownTabs === 0 },
  ];
  if (nested) {
    entries.push({ label: t('restoreMenu.withSubfolders', { n: subtreeTabs }), onSelect: () => onRestore(true, 'tabs'), disabled });
  }
  const all = disabled || subtreeTabs === 0;
  entries.push(
    { label: t('restoreMenu.group'), onSelect: () => onRestore(nested, 'group'), disabled: all },
    { label: t('restoreMenu.window'), onSelect: () => onRestore(nested, 'window'), disabled: all },
  );
  return entries;
}
