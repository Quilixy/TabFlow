import type { FolderRef } from '../../types';

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
