/** Ağaçtaki "Tümü" (kök) düğümünün bırakma hedefi kimliği. */
export const ROOT_DROP_ID = '__root__';

/** Ağaçtan sürüklenen klasör için HTML5 DnD türü. */
export const DND_FOLDER_MIME = 'application/x-tabflow-folder';

/** Açık sekmeler listesinden sürüklenen sekme için HTML5 DnD türü. */
export const DND_OPEN_TAB_MIME = 'application/x-tabflow-open-tab';

/** Açık sekmenin kaydedilebilir özeti (useTabManager'daki OpenTab ile aynı şekil). */
interface DraggedOpenTab {
  id: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  pinned: boolean;
  active: boolean;
}

/**
 * Bu belgede başlatılmış (sürmekte olan) açık sekme sürüklemesi. Özel MIME türünü herhangi bir web sayfası da
 * ayarlayabilir; bu yüzden bırakılan veriye değil, yalnızca burada başlatılan sürüklemeye güvenilir.
 */
let activeOpenTabDrag: DraggedOpenTab | null = null;

export function beginOpenTabDrag(tab: DraggedOpenTab): void {
  activeOpenTabDrag = tab;
}

export function endOpenTabDrag(): void {
  activeOpenTabDrag = null;
}

/** Bırakılan açık sekmeyi döndürür; sürükleme bu belgede başlamadıysa null (dışarıdan gelen veri yok sayılır). */
export function readOpenTabDrop<T extends DraggedOpenTab>(dataTransfer: DataTransfer): T | null {
  const raw = dataTransfer.getData(DND_OPEN_TAB_MIME);
  if (!raw || !activeOpenTabDrag) return null;
  try {
    const id = (JSON.parse(raw) as { id?: unknown } | null)?.id;
    return id === activeOpenTabDrag.id ? (activeOpenTabDrag as T) : null;
  } catch {
    return null;
  }
}
