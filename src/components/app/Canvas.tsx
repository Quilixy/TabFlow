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
import { folderTargets, restoreEntries, type MenuEntry } from '../ui/menu';
import type { RestoreMode } from '../../utils/restore';
import { FolderCard } from './FolderCard';
import { TabCard } from './TabCard';

type ItemKind = 'tab' | 'folder';
type CanvasItem = LayoutItem & { kind: ItemKind };

/** Seçim anahtarı: "t:<sekme>" ya da "f:<klasör>" (sekme ve klasör kimlikleri çakışmasın). */
type ItemKey = `${'t' | 'f'}:${string}`;
const keyOf = (kind: ItemKind, id: string): ItemKey => `${kind === 'tab' ? 't' : 'f'}:${id}`;
const NO_SELECTION: ReadonlySet<ItemKey> = new Set();

interface DragMember {
  kind: ItemKind;
  id: string;
  origX: number;
  origY: number;
}

interface DragSession {
  /** Sürüklenen (tutulan) kart; grup sürüklemede diğerleri ona göre kayar. */
  lead: DragMember;
  /** Birlikte sürüklenenler (lead dahil). */
  members: DragMember[];
  startX: number;
  startY: number;
  /** İmlecin kartın sol üst köşesine göre dünya koordinatındaki uzaklığı (sürüklerken kaydırma/yakınlaştırma olsa da kart imleçte kalır). */
  grabX: number;
  grabY: number;
  moved: boolean;
}

interface DragVisual {
  /** Sürüklenen kartların anlık konumları. */
  positions: Record<string, Point>;
  /**
   * Sürükleme başladığı andaki yerleşim. Sürükleme boyunca diğer kartlar bu sabit yerleşimde kalır;
   * aksi halde sürüklenen kart ayrılınca onun yüzünden itilmiş kartlar yukarı "zıplar".
   */
  layout: Record<string, Point>;
}

/** Shift + boş alanda sürükleme ile çizilen seçim dikdörtgeni (dünya koordinatı). */
interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Başladığında zaten seçili olanlar (dikdörtgen bunlara eklenir). */
  base: ReadonlySet<ItemKey>;
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
  onToggleFavorite: (id: string) => void;
  onRestoreFolder: (id: string, recursive: boolean, mode: RestoreMode) => void;
  onNewSubfolder: (parentId: string | null) => void;
  onDropOpenTab: (folderId: string | null, tab: OpenTab, closeOriginal: boolean, position?: Point) => void;
  onArrange: (positions: Record<string, Point>) => void;
  /** Çoklu seçim: seçili sekme ve klasörleri bir klasöre taşı (sekmeler için copy: kopyala). */
  onMoveItems: (tabIds: string[], folderIds: string[], toFolderId: string | null, copy: boolean) => void;
  onDeleteItems: (tabIds: string[], folderIds: string[]) => void;
  /** Birden çok kartın konumunu tek yazmada kaydeder (grup sürükleme). */
  onSetPositions: (positions: Record<string, Point>) => Promise<unknown>;
}

/** İmlecin altındaki bırakma hedefi (klasör kartı ya da ağaç satırı); sürüklenen klasörlerin kendileri atlanır. */
function findDropTarget(clientX: number, clientY: number, skipIds: ReadonlySet<string>): string | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const id = el.closest('[data-drop-folder]')?.getAttribute('data-drop-folder');
    if (id && !skipIds.has(id)) return id;
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
  onToggleFavorite,
  onRestoreFolder,
  onNewSubfolder,
  onDropOpenTab,
  onArrange,
  onMoveItems,
  onDeleteItems,
  onSetPositions,
}: CanvasProps) {
  const memoryKey = folderId ?? ROOT_KEY;
  const [view, setView] = useState<View>(() => viewMemory.get(memoryKey) ?? DEFAULT_VIEW);
  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [selection, setSelection] = useState<ReadonlySet<ItemKey>>(NO_SELECTION);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
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

  const layoutItems = useMemo<CanvasItem[]>(
    () => [
      ...childFolders.map((c) => ({
        kind: 'folder' as const,
        id: c.id,
        x: c.x,
        y: c.y,
        w: FOLDER_CARD_W,
        h: estimateFolderCardHeight(previews.get(c.id) ?? NO_ROWS, c.name),
      })),
      ...tabs.map((t) => ({ kind: 'tab' as const, id: t.id, x: t.x, y: t.y, w: TAB_CARD_W, h: TAB_CARD_H })),
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
    // Shift (ya da Ctrl/⌘) + sürükle: alan seçimi; aksi halde tuvali kaydır.
    if (e.button === 0 && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const start = worldAt(e.clientX, e.clientY);
      setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y, base: selection });
      return;
    }
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: viewRef.current.x, origY: viewRef.current.y };
    setIsPanning(true);
    setSelection(NO_SELECTION);
  };

  const handleBackgroundPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (marquee) {
      const at = worldAt(e.clientX, e.clientY);
      const next = { ...marquee, x1: at.x, y1: at.y };
      setMarquee(next);
      setSelection(itemsInMarquee(next));
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const x = pan.origX + (e.clientX - pan.startX);
    const y = pan.origY + (e.clientY - pan.startY);
    setView((v) => ({ ...v, x, y }));
  };

  const endPan = () => {
    panRef.current = null;
    setIsPanning(false);
    setMarquee(null);
  };

  /** Dikdörtgene değen kartlar (+ başlangıçta seçili olanlar). */
  const itemsInMarquee = (m: Marquee): ReadonlySet<ItemKey> => {
    const left = Math.min(m.x0, m.x1);
    const right = Math.max(m.x0, m.x1);
    const top = Math.min(m.y0, m.y1);
    const bottom = Math.max(m.y0, m.y1);
    const next = new Set(m.base);
    layoutItems.forEach((item, i) => {
      const r = rects[i];
      if (r.x < right && r.x + r.w > left && r.y < bottom && r.y + r.h > top) {
        next.add(keyOf(item.kind, item.id));
      }
    });
    return next;
  };

  /** Seçimdeki sekme ve klasör kimlikleri (artık var olmayanlar atılır). */
  const selectedIds = (keys: ReadonlySet<ItemKey> = selection) => {
    const tabIds: string[] = [];
    const folderIds: string[] = [];
    for (const key of keys) {
      const id = key.slice(2);
      if (key.startsWith('t:') && tabs.some((t) => t.id === id)) tabIds.push(id);
      if (key.startsWith('f:') && childFolders.some((f) => f.id === id)) folderIds.push(id);
    }
    return { tabIds, folderIds };
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

    const dragged = new Set(session.members.filter((m) => m.kind === 'folder').map((m) => m.id));
    const raw = findDropTarget(clientX, clientY, dragged);
    if (raw !== null) {
      const target = raw === ROOT_DROP_ID ? null : raw;
      if (target === folderId) return { type: 'cancel' };
      // Sekme köke bırakılamaz; klasör kendi alt klasörüne taşınamaz.
      if (target === null && session.members.some((m) => m.kind === 'tab')) return { type: 'cancel' };
      if (session.members.some((m) => m.kind === 'folder' && !canReparent(workspaces, m.id, target))) {
        return { type: 'cancel' };
      }
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
    const key = keyOf(kind, id);
    // Ctrl/⌘/Shift + tık: seçime ekle/çıkar (sürükleme başlamaz).
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }
    // Seçili bir karta basmak seçimi korur (hepsi birlikte sürüklenir); seçili olmayana basmak yalnızca onu seçer.
    const group = selection.has(key) ? selection : new Set([key]);
    if (!selection.has(key)) setSelection(group);
    if (disabled || (e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const layout = drag?.layout ?? resolved;
    const members: DragMember[] = [];
    for (const k of group) {
      const memberKind: ItemKind = k.startsWith('t:') ? 'tab' : 'folder';
      const memberId = k.slice(2);
      const item = layoutItems.find((it) => it.id === memberId && it.kind === memberKind);
      if (!item) continue;
      const pos = layout[memberId] ?? { x: item.x, y: item.y };
      members.push({ kind: memberKind, id: memberId, origX: pos.x, origY: pos.y });
    }
    const lead = members.find((m) => m.id === id && m.kind === kind) ?? { kind, id, origX: x, origY: y };
    if (!members.includes(lead)) members.push(lead);

    const grab = worldAt(e.clientX, e.clientY);
    sessionRef.current = {
      lead,
      members,
      startX: e.clientX,
      startY: e.clientY,
      grabX: grab.x - lead.origX,
      grabY: grab.y - lead.origY,
      moved: false,
    };
  };

  /** Öncü kartın yeni konumuna göre tüm grubun konumları. */
  const groupPositions = (session: DragSession, leadX: number, leadY: number, round = false): Record<string, Point> => {
    const dx = leadX - session.lead.origX;
    const dy = leadY - session.lead.origY;
    const out: Record<string, Point> = {};
    for (const m of session.members) {
      const x = m.origX + dx;
      const y = m.origY + dy;
      out[m.id] = round ? { x: Math.round(x), y: Math.round(y) } : { x, y };
    }
    return out;
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
    const positions = groupPositions(session, world.x - session.grabX, world.y - session.grabY);
    // İlk harekette yerleşimi dondur; sonrakilerde yalnızca konumları güncelle (diğer kartların prop'ları değişmez).
    setDrag((prev) => ({ positions, layout: prev?.layout ?? resolved }));

    const res = resolveDrop(session, e.clientX, e.clientY);
    setDropHover(res.type === 'folder' ? (res.id ?? ROOT_DROP_ID) : null);
  });

  const endItemDrag = useEventCallback((e: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setDropHover(null);
    if (!session || !session.moved) {
      setDrag(null);
      // Gruptaki bir karta sürüklemeden tıklamak seçimi yalnızca o karta indirir.
      if (session && session.members.length > 1) setSelection(new Set([keyOf(session.lead.kind, session.lead.id)]));
      return;
    }

    const world = worldAt(e.clientX, e.clientY);
    const x = Math.round(world.x - session.grabX);
    const y = Math.round(world.y - session.grabY);
    const positions = groupPositions(session, x, y, true);
    const isGroup = session.members.length > 1;
    const { lead } = session;
    const res = e.type === 'pointercancel' ? ({ type: 'cancel' } as const) : resolveDrop(session, e.clientX, e.clientY);

    // Depo güncellenene kadar kart bıraktığın yerde kalır (geri sıçrama olmaz).
    const settle = (work: Promise<unknown> | void) => {
      void Promise.resolve(work).finally(() => setDrag(null));
    };

    if (res.type === 'cancel') {
      setDrag(null);
    } else if (res.type === 'position') {
      setDrag((prev) => ({ positions, layout: prev?.layout ?? resolved }));
      if (isGroup) settle(onSetPositions(positions));
      else if (lead.kind === 'tab') {
        if (folderId !== null) settle(onSetTabPosition(folderId, lead.id, x, y));
      } else {
        settle(onSetFolderPosition(lead.id, x, y));
      }
    } else {
      // Bir klasöre bırakıldı: eylem App'te (toast + hata yönetimi) yürür.
      setDrag(null);
      if (isGroup) {
        const tabIds = session.members.filter((m) => m.kind === 'tab').map((m) => m.id);
        const folderIds = session.members.filter((m) => m.kind === 'folder').map((m) => m.id);
        onMoveItems(tabIds, folderIds, res.id, e.altKey);
        setSelection(NO_SELECTION);
      } else if (lead.kind === 'tab') {
        if (folderId !== null && res.id !== null) onMoveTab(folderId, lead.id, res.id, e.altKey);
      } else {
        onMoveFolder(lead.id, res.id);
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
      ...restoreEntries(target.tabs.length, subtreeTabs, disabled, (recursive, mode) =>
        onRestoreFolder(target.id, recursive, mode),
      ),
    ];
    entries.push(
      { type: 'separator' },
      { label: 'Alt klasör ekle', onSelect: () => onNewSubfolder(target.id), disabled },
      {
        label: target.favorite ? 'Sabitlemeyi kaldır' : 'Üste sabitle',
        onSelect: () => onToggleFavorite(target.id),
        disabled,
      },
      { label: 'Yeniden adlandır (F2)', onSelect: () => onRenameFolder(target.id), disabled },
      { label: 'Renk ve simge…', onSelect: () => onStyleFolder(target.id, anchor), disabled },
      { type: 'separator' },
      { label: 'Klasörü sil', onSelect: () => onDeleteFolder(target.id), danger: true, disabled },
    );
    return entries;
  };

  /** Birden çok öğe seçiliyken sağ tık menüsü: toplu taşı/kopyala/sil. */
  const selectionMenu = (): MenuEntry[] => {
    const { tabIds, folderIds } = selectedIds();
    const count = tabIds.length + folderIds.length;
    const excluded = new Set([folderId, ...folderIds]);
    const targets = moveTargets.filter((f) => !excluded.has(f.id));
    const entries: MenuEntry[] = [{ type: 'heading', label: `${count} öğe seçili` }];
    if (targets.length > 0) {
      entries.push(
        { type: 'heading', label: 'Klasöre taşı' },
        ...folderTargets(targets, (f) => {
          onMoveItems(tabIds, folderIds, f.id, false);
          setSelection(NO_SELECTION);
        }).map((entry) => ({ ...entry, disabled })),
      );
      if (tabIds.length > 0 && folderIds.length === 0) {
        entries.push(
          { type: 'heading', label: 'Klasöre kopyala' },
          ...folderTargets(targets, (f) => onMoveItems(tabIds, [], f.id, true)).map((entry) => ({ ...entry, disabled })),
        );
      }
    }
    if (folderId !== null && folderIds.length > 0) {
      entries.push({
        label: 'Klasörleri köke taşı',
        onSelect: () => {
          onMoveItems([], folderIds, null, false);
          setSelection(NO_SELECTION);
        },
        disabled,
      });
    }
    entries.push(
      { type: 'separator' },
      { label: 'Seçimi kaldır', onSelect: () => setSelection(NO_SELECTION) },
      {
        label: `Seçilenleri sil (${count})`,
        onSelect: () => {
          onDeleteItems(tabIds, folderIds);
          setSelection(NO_SELECTION);
        },
        danger: true,
        disabled,
      },
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
    if (selection.size > 1 && selection.has(keyOf('tab', id))) {
      openAt(e.clientX, e.clientY, selectionMenu());
      return;
    }
    setSelection(new Set([keyOf('tab', id)]));
    openAt(e.clientX, e.clientY, tabMenu(tab));
  });

  const onFolderContextMenu = useEventCallback((e: MouseEvent<HTMLElement>, id: string) => {
    const target = workspaces[id];
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    if (selection.size > 1 && selection.has(keyOf('folder', id))) {
      openAt(e.clientX, e.clientY, selectionMenu());
      return;
    }
    setSelection(new Set([keyOf('folder', id)]));
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
    // Çoklu seçimde silme tuvalin kendi dinleyicisinde (hepsi birlikte) yapılır.
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size <= 1 && folderId !== null && !disabled) {
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
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"], [role="menu"]')) return;
    if (e.key === 'Escape') {
      if (sessionRef.current) cancelItemDrag();
      else setSelection(NO_SELECTION);
      return;
    }
    // Ctrl/⌘ + A: bu tuvaldeki her şeyi seç.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelection(new Set(layoutItems.map((item) => keyOf(item.kind, item.id))));
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size > 1 && !disabled) {
      e.preventDefault();
      const { tabIds, folderIds } = selectedIds();
      containerRef.current?.focus({ preventScroll: true });
      onDeleteItems(tabIds, folderIds);
      setSelection(NO_SELECTION);
    }
  };

  // ---- Yakınlaştırma düğmeleri -------------------------------------------------
  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    setView((v) => zoomAt(v, factor, el.clientWidth / 2, el.clientHeight / 2));
  };

  // Sürüklenen kart imleçte; diğerleri sürükleme başındaki sabit yerleşimde; sürükleme yoksa güncel yerleşimde.
  const posOf = (id: string, x: number, y: number): Point => {
    const dragged = drag?.positions[id];
    if (dragged) return dragged;
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
              isDragging={drag?.positions[child.id] !== undefined}
              isSelected={selection.has(keyOf('folder', child.id))}
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
              isDragging={drag?.positions[tab.id] !== undefined}
              isSelected={selection.has(keyOf('tab', tab.id))}
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
        {marquee && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-sm border border-indigo-500 bg-indigo-500/10"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}
      </div>

      {selection.size > 1 && (
        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white py-1 pr-1 pl-3 text-xs text-gray-700 shadow-sm"
          role="status"
        >
          <span>
            <strong className="font-semibold text-gray-900">{selection.size}</strong> öğe seçili · sürükle, sağ tıkla ya da
            Delete
          </span>
          <button
            type="button"
            onClick={() => setSelection(NO_SELECTION)}
            className="rounded px-2 py-1 font-medium text-gray-600 hover:bg-gray-100"
          >
            Kaldır
          </button>
        </div>
      )}

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