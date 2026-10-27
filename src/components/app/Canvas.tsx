import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type UIEvent,
} from 'react';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useEventCallback } from '../../hooks/useEventCallback';
import type { OpenTab } from '../../hooks/useTabManager';
import { useUiStore } from '../../store/useUiStore';
import type { FolderRef, Point, SavedTab, Workspace, WorkspaceMap } from '../../types';
import {
  arrangeGrid,
  boundsOf,
  DEFAULT_VIEW,
  estimateFolderCardHeight,
  FOLDER_CARD_W,
  fitView,
  resolveOverlaps,
  screenToWorld,
  TAB_CARD_H,
  TAB_CARD_W,
  zoomAt,
  type LayoutItem,
  type Rect,
  type View,
} from '../../utils/canvasMath';
import { DND_FOLDER_MIME, DND_OPEN_TAB_MIME, readOpenTabDrop, ROOT_DROP_ID } from '../../utils/dnd';
import {
  buildFolderPreview,
  canReparent,
  collectSubtree,
  countTabs,
  PREVIEW_DEEP,
  PREVIEW_SHALLOW,
  type PreviewRow,
} from '../../utils/workspaceTree';
import { ExpandIcon, GridIcon, ListIcon, MinusIcon, PlusIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';
import { folderTargets, type MenuEntry } from '../ui/menu';
import { FolderCard } from './FolderCard';
import { TabCard } from './TabCard';

type ItemKind = 'tab' | 'folder';

interface DragSession {
  kind: ItemKind;
  id: string;
  startX: number;
  startY: number;
  /** İmlecin kartın sol üst köşesine göre dünya koordinatındaki uzaklığı (sürüklerken kaydırma/yakınlaştırma olsa da kart imleçte kalır). */
  grabX: number;
  grabY: number;
  moved: boolean;
}

interface DragVisual {
  kind: ItemKind;
  id: string;
  x: number;
  y: number;
  /**
   * Sürükleme başladığı andaki yerleşim. Sürükleme boyunca diğer kartlar bu sabit yerleşimde kalır;
   * aksi halde sürüklenen kart ayrılınca onun yüzünden itilmiş kartlar yukarı "zıplar".
   */
  layout: Record<string, Point>;
}

type DropResolution = { type: 'folder'; id: string | null } | { type: 'position' } | { type: 'cancel' };

const DRAG_THRESHOLD_PX = 4;
const ROOT_KEY = '__root__';
const NO_FOLDERS: Workspace[] = [];
const NO_TABS: SavedTab[] = [];
const NO_ROWS: PreviewRow[] = [];

/** Klasör başına görünüm (kaydırma/yakınlaştırma) bu oturum boyunca hatırlanır. */
const viewMemory = new Map<string, View>();

interface CanvasProps {
  folderId: string | null;
  workspaces: WorkspaceMap;
  index: Map<string | null, Workspace[]>;
  moveTargets: FolderRef[];
  disabled: boolean;
  onEnterFolder: (id: string) => void;
  onMoveTab: (fromFolderId: string, tabId: string, toFolderId: string, copy: boolean) => void;
  onMoveFolder: (folderId: string, newParentId: string | null, position?: Point) => void;
  onSetTabPosition: (folderId: string, tabId: string, x: number, y: number) => Promise<unknown>;
  onSetFolderPosition: (folderId: string, x: number, y: number) => Promise<unknown>;
  onOpenTab: (tab: SavedTab) => void;
  onRemoveTab: (folderId: string, tabId: string) => void;
  onRenameFolder: (id: string) => void;
  onRenameCommit: (id: string, name: string) => void;
  onStyleFolder: (id: string, anchor: Point) => void;
  onDeleteFolder: (id: string) => void;
  onRestoreFolder: (id: string, recursive: boolean) => void;
  onNewSubfolder: (parentId: string | null) => void;
  onDropOpenTab: (folderId: string | null, tab: OpenTab, closeOriginal: boolean, position?: Point) => void;
  onArrange: (positions: Record<string, Point>) => void;
}

function findDropTarget(clientX: number, clientY: number, skipId: string): string | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const id = el.closest('[data-drop-folder]')?.getAttribute('data-drop-folder');
    if (id && id !== skipId) return id;
  }
  return null;
}

export function Canvas({
  folderId,
  workspaces,
  index,
  moveTargets,
  disabled,
  onEnterFolder,
  onMoveTab,
  onMoveFolder,
  onSetTabPosition,
  onSetFolderPosition,
  onOpenTab,
  onRemoveTab,
  onRenameFolder,
  onRenameCommit,
  onStyleFolder,
  onDeleteFolder,
  onRestoreFolder,
  onNewSubfolder,
  onDropOpenTab,
  onArrange,
}: CanvasProps) {
  const memoryKey = folderId ?? ROOT_KEY;
  const [view, setView] = useState<View>(() => viewMemory.get(memoryKey) ?? DEFAULT_VIEW);
  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [selected, setSelected] = useState<{ kind: ItemKind; id: string } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rectsRef = useRef<Rect[]>([]);
  const viewRef = useRef(view);
  const sessionRef = useRef<DragSession | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const dropHoverId = useUiStore((s) => s.dropHoverId);
  const setDropHover = useUiStore((s) => s.setDropHover);
  const renamingId = useUiStore((s) => s.renamingId);
  const renamingSource = useUiStore((s) => s.renamingSource);
  const enterIds = useUiStore((s) => s.enterIds);
  const leavingIds = useUiStore((s) => s.leavingIds);
  const deepPreview = useUiStore((s) => s.deepPreview);
  const setDeepPreview = useUiStore((s) => s.setDeepPreview);
  const setRenamingId = useUiStore((s) => s.setRenamingId);
  const { menu, openAt } = useContextMenu();

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Görünümü hafızaya yalnızca kullanıcı/sığdırma değiştirdiyse yaz; ilk (varsayılan) görünüm sayılmaz.
  useEffect(() => {
    if (view !== DEFAULT_VIEW) viewMemory.set(memoryKey, view);
  }, [view, memoryKey]);

  // Wheel olayı pasif olmayan dinleyici ister (React'in onWheel'i pasif): Ctrl/⌘ + tekerlek = yakınlaştır.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Tuvalin içindeki menü kendi içinde kaydırılabilsin; arkadaki tuval kaymasın.
      if (e.target instanceof Element && e.target.closest('[role="menu"]')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Fare tekerleği bir çentikte ~100 piksel bildirir; touchpad kıstırması küçük değerler. Normalize et ve
        // sınırla: bir çentik ≈ 1.2×, kıstırma pürüzsüz kalır.
        const raw = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
        const factor = Math.exp(-Math.max(-60, Math.min(60, raw)) * 0.003);
        setView((v) => zoomAt(v, factor, e.clientX - rect.left, e.clientY - rect.top));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const folder = folderId !== null ? workspaces[folderId] : undefined;
  const childFolders = index.get(folderId) ?? NO_FOLDERS;
  const tabs = folder?.tabs ?? NO_TABS;
  const isEmpty = childFolders.length === 0 && tabs.length === 0;

  // Kart içi önizleme (iç içe) ve buna göre tahmini kart yüksekliği
  const previews = useMemo(() => {
    const options = deepPreview ? PREVIEW_DEEP : PREVIEW_SHALLOW;
    return new Map(childFolders.map((c) => [c.id, buildFolderPreview(index, workspaces, c.id, options)] as const));
  }, [childFolders, index, workspaces, deepPreview]);

  const layoutItems = useMemo<LayoutItem[]>(
    () => [
      ...childFolders.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        w: FOLDER_CARD_W,
        h: estimateFolderCardHeight(previews.get(c.id) ?? NO_ROWS, c.name),
      })),
      ...tabs.map((t) => ({ id: t.id, x: t.x, y: t.y, w: TAB_CARD_W, h: TAB_CARD_H })),
    ],
    [childFolders, tabs, previews],
  );

  // Büyüyen kartlar altındakilerin üstüne binmesin: gösterim için aşağı itilir (depo değişmez).
  const resolved = useMemo(() => resolveOverlaps(layoutItems), [layoutItems]);

  const rects: Rect[] = layoutItems.map((item) => ({
    x: resolved[item.id]?.x ?? item.x,
    y: resolved[item.id]?.y ?? item.y,
    w: item.w,
    h: item.h,
  }));

  useEffect(() => {
    rectsRef.current = rects;
  });

  // Bu klasör bu oturumda ilk kez açılıyorsa içeriği görünür alana sığdır
  // (ResizeObserver gözlem başlar başlamaz bir kez tetiklenir, boyut o zaman bellidir).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || viewMemory.has(memoryKey)) return;
    let done = false;
    const observer = new ResizeObserver(() => {
      if (done) return;
      done = true;
      setView(fitView(boundsOf(rectsRef.current), { width: el.clientWidth, height: el.clientHeight }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [memoryKey]);

  const fitToContent = () => {
    const el = containerRef.current;
    if (!el) return;
    setView(fitView(boundsOf(rects), { width: el.clientWidth, height: el.clientHeight }));
  };

  // ---- Arka plan: kaydırma (pan) ---------------------------------------------
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault(); // Orta tuş otomatik kaydırmasını ve metin seçimini engelle
    containerRef.current?.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: viewRef.current.x, origY: viewRef.current.y };
    setIsPanning(true);
    setSelected(null);
  };

  const handleBackgroundPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    const x = pan.origX + (e.clientX - pan.startX);
    const y = pan.origY + (e.clientY - pan.startY);
    setView((v) => ({ ...v, x, y }));
  };

  const endPan = () => {
    panRef.current = null;
    setIsPanning(false);
  };

  // ---- Öğe sürükleme (sekme / klasör kartı) ------------------------------------
  const resolveDrop = (session: DragSession, clientX: number, clientY: number): DropResolution => {
    const rect = containerRef.current?.getBoundingClientRect();
    const inside =
      rect !== undefined &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    const raw = findDropTarget(clientX, clientY, session.kind === 'folder' ? session.id : '');
    if (raw !== null) {
      if (session.kind === 'tab') {
        // Sekme köke ya da bulunduğu klasörün kendisine bırakılamaz.
        return raw === ROOT_DROP_ID || raw === folderId ? { type: 'cancel' } : { type: 'folder', id: raw };
      }
      const target = raw === ROOT_DROP_ID ? null : raw;
      if (target === folderId || !canReparent(workspaces, session.id, target)) return { type: 'cancel' };
      return { type: 'folder', id: target };
    }
    return inside ? { type: 'position' } : { type: 'cancel' };
  };

  /** İmlecin dünya koordinatı (o anki görünüme göre). */
  const worldAt = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return screenToWorld(viewRef.current, clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0));
  };

  const cancelItemDrag = () => {
    sessionRef.current = null;
    setDrag(null);
    setDropHover(null);
  };

  const startItemDrag = (e: PointerEvent<HTMLDivElement>, kind: ItemKind, id: string, x: number, y: number) => {
    if (e.button !== 0) return; // Orta tuş: arka plan gibi kaydırır (olay yukarı çıkar)
    e.stopPropagation();
    setSelected({ kind, id });
    if (disabled || (e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const grab = worldAt(e.clientX, e.clientY);
    sessionRef.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      grabX: grab.x - x,
      grabY: grab.y - y,
      moved: false,
    };
  };

  const moveItemDrag = useEventCallback((e: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    // Tuş bırakılmış ama pointerup kaçmış (ör. kart kaldırıldı): hayalet sürüklemeyi bitir.
    if (e.buttons === 0) {
      cancelItemDrag();
      return;
    }
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    session.moved = true;

    const world = worldAt(e.clientX, e.clientY);
    const x = world.x - session.grabX;
    const y = world.y - session.grabY;
    // İlk harekette yerleşimi dondur; sonrakilerde yalnızca konumu güncelle (diğer kartların prop'ları değişmez).
    setDrag((prev) =>
      prev && prev.id === session.id
        ? { ...prev, x, y }
        : { kind: session.kind, id: session.id, x, y, layout: resolved },
    );

    const res = resolveDrop(session, e.clientX, e.clientY);
    setDropHover(res.type === 'folder' ? (res.id ?? ROOT_DROP_ID) : null);
  });

  const endItemDrag = useEventCallback((e: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setDropHover(null);
    if (!session || !session.moved) {
      setDrag(null);
      return;
    }

    const world = worldAt(e.clientX, e.clientY);
    const x = Math.round(world.x - session.grabX);
    const y = Math.round(world.y - session.grabY);
    const res = e.type === 'pointercancel' ? ({ type: 'cancel' } as const) : resolveDrop(session, e.clientX, e.clientY);

    // Depo güncellenene kadar kart bıraktığın yerde kalır (geri sıçrama olmaz).
    const settle = (work: Promise<unknown> | void) => {
      void Promise.resolve(work).finally(() => setDrag(null));
    };

    if (res.type === 'cancel') {
      setDrag(null);
    } else if (res.type === 'position') {
      setDrag((prev) => ({ kind: session.kind, id: session.id, x, y, layout: prev?.layout ?? resolved }));
      if (session.kind === 'tab') {
        if (folderId !== null) settle(onSetTabPosition(folderId, session.id, x, y));
      } else {
        settle(onSetFolderPosition(session.id, x, y));
      }
    } else {
      // Bir klasöre bırakıldı: eylem App'te (toast + hata yönetimi) yürür.
      setDrag(null);
      if (session.kind === 'tab') {
        if (folderId !== null && res.id !== null) onMoveTab(folderId, session.id, res.id, e.altKey);
      } else {
        onMoveFolder(session.id, res.id);
      }
    }
  });

  // Kartlar sürükleme bitmeden kaldırılırsa (ör. başka pencereden silindi) pointerup kaçabilir.
  const onItemLostCapture = useEventCallback(() => {
    if (sessionRef.current) cancelItemDrag();
  });

  // ---- Açık sekmeler listesinden ve ağaçtan (HTML5 DnD) tuvale bırakma -------------
  const handleCanvasDragOver = (e: DragEvent<HTMLDivElement>) => {
    const types = e.dataTransfer.types;
    if (!types.includes(DND_OPEN_TAB_MIME) && !(types.includes(DND_FOLDER_MIME) && !disabled)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = types.includes(DND_FOLDER_MIME) ? 'move' : e.altKey ? 'copy' : 'move';
  };

  const handleCanvasDrop = (e: DragEvent<HTMLDivElement>) => {
    const world = worldAt(e.clientX, e.clientY);
    const folderRaw = e.dataTransfer.getData(DND_FOLDER_MIME);
    if (folderRaw) {
      // Ağaçtan sürüklenen klasör bu tuvale (bırakılan yere) taşınır.
      e.preventDefault();
      if (!disabled) {
        onMoveFolder(folderRaw, folderId, { x: Math.round(world.x - FOLDER_CARD_W / 2), y: Math.round(world.y - 24) });
      }
      return;
    }
    if (!e.dataTransfer.types.includes(DND_OPEN_TAB_MIME)) return;
    e.preventDefault();
    const tab = readOpenTabDrop(e.dataTransfer);
    if (!tab) return; // Başka bir sayfadan gelen sahte veri
    const position = { x: Math.round(world.x - TAB_CARD_W / 2), y: Math.round(world.y - 24) };
    onDropOpenTab(folderId, tab, !e.altKey, position);
  };

  // Odak, ekran dışındaki bir karta geçince tarayıcı overflow-hidden kabı programla kaydırır; bu kayma
  // görünüme (view) yansımaz ve koordinatları bozar. Kaymayı görünüme aktarıp kabı sıfırla.
  const handleContainerScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const dx = el.scrollLeft;
    const dy = el.scrollTop;
    if (dx === 0 && dy === 0) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
    setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };

  // ---- Menüler -----------------------------------------------------------------
  const tabMenu = (tab: SavedTab): MenuEntry[] => {
    const entries: MenuEntry[] = [{ label: 'Arka planda aç', onSelect: () => onOpenTab(tab) }];
    if (folderId === null) return entries;
    const targets = moveTargets.filter((f) => f.id !== folderId);
    if (targets.length > 0) {
      entries.push(
        { type: 'heading', label: 'Klasöre taşı' },
        ...folderTargets(targets, (f) => onMoveTab(folderId, tab.id, f.id, false)),
        { type: 'heading', label: 'Klasöre kopyala' },
        ...folderTargets(targets, (f) => onMoveTab(folderId, tab.id, f.id, true)),
      );
    }
    entries.push(
      { type: 'separator' },
      { label: 'Klasörden kaldır', onSelect: () => onRemoveTab(folderId, tab.id), danger: true },
    );
    return entries;
  };

  const folderMenu = (target: Workspace, anchor: Point): MenuEntry[] => {
    const subtreeTabs = countTabs(collectSubtree(index, workspaces, target.id));
    const entries: MenuEntry[] = [
      { label: 'Klasöre git', onSelect: () => onEnterFolder(target.id) },
      {
        label: 'Sekmeleri aç',
        onSelect: () => onRestoreFolder(target.id, false),
        disabled: disabled || target.tabs.length === 0,
      },
    ];
    if (subtreeTabs > target.tabs.length) {
      entries.push({
        label: `Alt klasörlerle birlikte aç (${subtreeTabs})`,
        onSelect: () => onRestoreFolder(target.id, true),
        disabled,
      });
    }
    entries.push(
      { type: 'separator' },
      { label: 'Alt klasör ekle', onSelect: () => onNewSubfolder(target.id), disabled },
      { label: 'Yeniden adlandır (F2)', onSelect: () => onRenameFolder(target.id), disabled },
      { label: 'Renk ve simge…', onSelect: () => onStyleFolder(target.id, anchor), disabled },
      { type: 'separator' },
      { label: 'Klasörü sil', onSelect: () => onDeleteFolder(target.id), danger: true, disabled },
    );
    return entries;
  };

  // Kartlara verilen tüm geri çağrılar kimlik tabanlı ve kararlı (useEventCallback): kartlar memo ile
  // sarılı olduğundan, kaydırma/yakınlaştırma/sürükleme sırasında diğer kartlar yeniden çizilmez.
  const onFolderPointerDown = useEventCallback((e: PointerEvent<HTMLDivElement>, id: string, x: number, y: number) =>
    startItemDrag(e, 'folder', id, x, y),
  );
  const onTabPointerDown = useEventCallback((e: PointerEvent<HTMLDivElement>, id: string, x: number, y: number) =>
    startItemDrag(e, 'tab', id, x, y),
  );

  const onTabContextMenu = useEventCallback((e: MouseEvent<HTMLElement>, id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected({ kind: 'tab', id });
    openAt(e.clientX, e.clientY, tabMenu(tab));
  });

  const onFolderContextMenu = useEventCallback((e: MouseEvent<HTMLElement>, id: string) => {
    const target = workspaces[id];
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected({ kind: 'folder', id });
    openAt(e.clientX, e.clientY, folderMenu(target, { x: e.clientX, y: e.clientY }));
  });

  const onFolderMenuButton = useEventCallback((rect: DOMRect, id: string) => {
    const target = workspaces[id];
    if (target) openAt(rect.right, rect.bottom + 4, folderMenu(target, { x: rect.left, y: rect.bottom + 4 }));
  });

  // ---- Klavye ------------------------------------------------------------------
  const onTabKeyDown = useEventCallback((e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.target !== e.currentTarget) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenTab(tab);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && folderId !== null && !disabled) {
      e.preventDefault();
      // Kart kaldırılınca odak <body>'ye düşmesin: tuvalde kalsın.
      containerRef.current?.focus({ preventScroll: true });
      onRemoveTab(folderId, tab.id);
    }
  });

  const onFolderKeyDown = useEventCallback((e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEnterFolder(id);
    }
    if (e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation(); // Genel F2 dinleyicisi (seçili klasör) devreye girmesin
      onRenameFolder(id);
    }
  });

  const onTabOpen = useEventCallback((id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) onOpenTab(tab);
  });
  const onTabRemove = useEventCallback((id: string) => {
    if (folderId !== null) onRemoveTab(folderId, id);
  });
  const onFolderEnter = useEventCallback((id: string) => onEnterFolder(id));
  const onFolderRenameCommit = useEventCallback((id: string, name: string) => onRenameCommit(id, name));
  const onFolderRenameCancel = useEventCallback(() => setRenamingId(null));
  const onFolderTabDrop = useEventCallback((id: string, tab: OpenTab, closeOriginal: boolean) =>
    onDropOpenTab(id, tab, closeOriginal),
  );
  const onFolderFolderDrop = useEventCallback((draggedId: string, targetId: string) => {
    if (!disabled) onMoveFolder(draggedId, targetId);
  });

  const handleContainerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && sessionRef.current) cancelItemDrag();
  };

  // ---- Yakınlaştırma düğmeleri -------------------------------------------------
  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    setView((v) => zoomAt(v, factor, el.clientWidth / 2, el.clientHeight / 2));
  };

  // Sürüklenen kart imleçte; diğerleri sürükleme başındaki sabit yerleşimde; sürükleme yoksa güncel yerleşimde.
  const posOf = (id: string, x: number, y: number): Point => {
    if (drag && drag.id === id) return { x: drag.x, y: drag.y };
    return (drag?.layout ?? resolved)[id] ?? { x, y };
  };

  const arrangeAll = () => {
    // Önce alt klasörler (ada göre), sonra sekmeler; satır yüksekliği o satırın en uzun kartı kadar.
    onArrange(arrangeGrid(layoutItems));
  };

  const gridSize = 24 * view.scale;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="application"
      aria-label={folder ? `${folder.name} tuvali` : 'Kök tuval'}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onKeyDown={handleContainerKeyDown}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onScroll={handleContainerScroll}
      style={{
        backgroundImage: 'radial-gradient(circle, var(--tf-grid-dot, #d1d5db) 1px, transparent 1px)',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        touchAction: 'none',
      }}
      className={`relative h-full w-full overflow-hidden bg-gray-50 outline-none ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {childFolders.map((child) => {
          const pos = posOf(child.id, child.x, child.y);
          return (
            <FolderCard
              key={child.id}
              folder={child}
              childCount={(index.get(child.id) ?? NO_FOLDERS).length}
              rows={previews.get(child.id) ?? NO_ROWS}
              x={pos.x}
              y={pos.y}
              isDragging={drag?.id === child.id}
              isSelected={selected?.kind === 'folder' && selected.id === child.id}
              isDropTarget={dropHoverId === child.id}
              isRenaming={renamingId === child.id && renamingSource === 'canvas'}
              isEntering={enterIds[child.id] === true}
              isLeaving={leavingIds[child.id] === true}
              onRenameCommit={onFolderRenameCommit}
              onRenameCancel={onFolderRenameCancel}
              onPointerDown={onFolderPointerDown}
              onPointerMove={moveItemDrag}
              onPointerUp={endItemDrag}
              onLostPointerCapture={onItemLostCapture}
              onContextMenu={onFolderContextMenu}
              onMenuButton={onFolderMenuButton}
              onKeyDown={onFolderKeyDown}
              onEnter={onFolderEnter}
              onOpenTabDrop={onFolderTabDrop}
              onFolderDrop={onFolderFolderDrop}
            />
          );
        })}
        {tabs.map((tab) => {
          const pos = posOf(tab.id, tab.x, tab.y);
          return (
            <TabCard
              key={tab.id}
              tab={tab}
              x={pos.x}
              y={pos.y}
              isDragging={drag?.id === tab.id}
              isSelected={selected?.kind === 'tab' && selected.id === tab.id}
              onPointerDown={onTabPointerDown}
              onPointerMove={moveItemDrag}
              onPointerUp={endItemDrag}
              onLostPointerCapture={onItemLostCapture}
              onContextMenu={onTabContextMenu}
              onKeyDown={onTabKeyDown}
              onOpen={onTabOpen}
              onRemove={onTabRemove}
            />
          );
        })}
      </div>

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-xs text-center text-sm text-gray-500">
            {folderId === null
              ? 'Henüz klasör yok. “Yeni klasör” ile başla.'
              : 'Bu klasör boş. Sağdaki açık sekmeleri buraya sürükle ya da alt klasör ekle.'}
          </p>
        </div>
      )}

      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
      >
        <IconButton label="Uzaklaştır (Ctrl + tekerlek)" onClick={() => zoomBy(1 / 1.25)}>
          <MinusIcon />
        </IconButton>
        <button
          type="button"
          onClick={() => setView({ ...DEFAULT_VIEW })}
          title="Görünümü sıfırla"
          className="min-w-12 rounded-md px-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <IconButton label="Yakınlaştır (Ctrl + tekerlek)" onClick={() => zoomBy(1.25)}>
          <PlusIcon />
        </IconButton>
        <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
        <IconButton label="Tümünü sığdır" onClick={fitToContent} disabled={isEmpty}>
          <ExpandIcon />
        </IconButton>
        <IconButton label="Öğeleri ızgaraya diz" onClick={arrangeAll} disabled={disabled || isEmpty}>
          <GridIcon />
        </IconButton>
        <IconButton
          label={deepPreview ? 'Alt klasör içeriklerini gizle' : 'Alt klasör içeriklerini göster'}
          aria-pressed={deepPreview}
          onClick={() => setDeepPreview(!deepPreview)}
          className={deepPreview ? 'bg-gray-100 text-gray-900' : ''}
        >
          <ListIcon />
        </IconButton>
      </div>
      {menu}
    </div>
  );
}