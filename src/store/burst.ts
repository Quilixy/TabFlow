import { useUiStore } from './useUiStore';

/**
 * Sakura temasında bir klasörün üzerinde yaprak, Uzay temasında yıldız dağılması oynatır.
 * Klasörün tuvaldeki kartı, yoksa ağaçtaki satırı bulunur; veri güncellenip çizilsin diye kısa beklenir.
 */
export function emitFolderBurst(folderId: string): void {
  const { pack, decor, animation, triggerBurst } = useUiStore.getState();
  if (pack === 'default' || !decor || animation === 'none') return;

  setTimeout(() => {
    const target =
      document.querySelector(`[data-item-id="${CSS.escape(folderId)}"]`) ??
      document.querySelector(`nav [data-drop-folder="${CSS.escape(folderId)}"]`);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    triggerBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, 90);
}
