import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useContextMenu } from '../../hooks/useContextMenu';
import type { OpenTab } from '../../hooks/useTabManager';
import { useUiStore } from '../../store/useUiStore';
import type { Point, Workspace, WorkspaceMap } from '../../types';
import { DND_FOLDER_MIME, DND_OPEN_TAB_MIME, readOpenTabDrop, ROOT_DROP_ID } from '../../utils/dnd';
import { normalizeQuery } from '../../utils/search';
import type { DropPlacement } from '../../utils/workspaceOps';
import { collectSubtree, computeVisibleIds, countTabs, flattenTree, type TreeRow } from '../../utils/workspaceTree';
import { FolderGlyph } from '../ui/FolderGlyph';
import { ChevronDownIcon, HomeIcon, MoreIcon, PinIcon, PlusIcon, SearchIcon, XIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';
import { InlineRename } from '../ui/InlineRename';
import { restoreEntries, type MenuEntry } from '../ui/menu';
import type { RestoreMode } from '../../utils/restore';

const ROW_HEIGHT = 32;
const OVERSCAN = 8;
const INDENT_PX = 14;

/** Satırı (sanallaştırılmış listede) görünür alana kaydırır. Satır listede yoksa false. */
function scrollRowIntoView(el: HTMLElement | null, rows: TreeRow[], id: string): boolean {
  const position = rows.findIndex((r) => r.workspace.id === id);
  if (!el || position === -1) return false;
  const top = position * ROW_HEIGHT;
  if (top < el.scrollTop) el.scrollTop = top;
  else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
  return true;
}

interface FolderTreeProps {
  workspaces: WorkspaceMap;
  index: Map<string | null, Workspace[]>;
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string | null) => void;
  onNewFolder: (parentId: string | null) => void;
  onRename: (id: string) => void;
  onRenameCommit: (id: string, name: string) => void;
  onStyle: (id: string, anchor: Point) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string, recursive: boolean, mode: RestoreMode) => void;
  onDropOpenTab: (folderId: string, tab: OpenTab, closeOriginal: boolean) => void;
  onMoveFolder: (folderId: string, newParentId: string | null) => void;
  /** Klasörü bir kardeşinin önüne/arkasına taşır (elle sıralama). */
  onReorderFolder: (folderId: string, targetId: string, placement: DropPlacement) => void;
  onToggleFavorite: (id: string) => void;
}

/** Satırın üst/alt çeyreğine bırakmak araya yerleştirir; ortasına bırakmak içine taşır. */
type RowDropZone = DropPlacement | 'inside';
const EDGE_RATIO = 0.27;

export function FolderTree({
  workspaces,
  index,
  query,
  onQueryChange,
  selectedId,
  disabled,
  onSelect,
  onNewFolder,
  onRename,
  onRenameCommit,
  onStyle,
  onDelete,
  onRestore,
  onDropOpenTab,
  onMoveFolder,
  onReorderFolder,
  onToggleFavorite,
}: FolderTreeProps) {
  const expanded = useUiStore((s) => s.expanded);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const dropHoverId = useUiStore((s) => s.dropHoverId);
  const enterIds = useUiStore((s) => s.enterIds);
  const leavingIds = useUiStore((s) => s.leavingIds);
  const renamingId = useUiStore((s) => s.renamingId);
  const renamingSource = useUiStore((s) => s.renamingSource);
  const setRenamingId = useUiStore((s) => s.setRenamingId);
  const { menu, openAt } = useContextMenu();

  const [hoverRowId, setHoverRowId] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<RowDropZone>('inside');
  const [isSearchOpen, setIsSearchOpen] = useState(query !== '');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = normalizeQuery(query);
  const visibleIds = useMemo(() => computeVisibleIds(workspaces, q), [workspaces, q]);
  const rows = useMemo(() => flattenTree(index, expanded, visibleIds, q !== ''), [index, expanded, visibleIds, q]);
  const rowsRef = useRef<TreeRow[]>(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Yüksekliği izle (ResizeObserver gözlem başlar başlamaz bir kez tetiklenir).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tuvalden/başka yerden seçim değişince satırı görünür alana kaydır. Satır henüz listede olmayabilir
  // (veri yükleniyor ya da üst dallar sonradan açılıyor): o zaman satırlar değişince yeniden dene.
  const revealRef = useRef<string | null>(null);
  useEffect(() => {
    revealRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    const id = revealRef.current;
    if (id !== null && scrollRowIntoView(scrollRef.current, rows, id)) revealRef.current = null;
  }, [rows, selectedId]);

  // Yeniden adlandırma (ör. genel F2) ağaçta başladıysa satırı göster; satır hiç yoksa (aramayla gizlenmiş)
  // adlandırmayı iptal et: aksi halde satır sonradan görünür olunca beklenmedik biçimde odağı çalardı.
  useEffect(() => {
    if (renamingId === null || renamingSource !== 'tree') return;
    if (!scrollRowIntoView(scrollRef.current, rowsRef.current, renamingId)) setRenamingId(null);
  }, [renamingId, renamingSource, setRenamingId]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(start, end);

  const buildMenu = (workspace: Workspace, anchor: Point): MenuEntry[] => {
    const subtreeTabs = countTabs(collectSubtree(index, workspaces, workspace.id));
    const entries: MenuEntry[] = [
      { label: 'Yeni alt klasör', onSelect: () => onNewFolder(workspace.id), disabled },
      { type: 'separator' },
      ...restoreEntries(workspace.tabs.length, subtreeTabs, disabled, (recursive, mode) =>
        onRestore(workspace.id, recursive, mode),
      ),
    ];
    entries.push(
      { type: 'separator' },
      {
        label: workspace.favorite ? 'Sabitlemeyi kaldır' : 'Üste sabitle',
        onSelect: () => onToggleFavorite(workspace.id),
        disabled,
      },
      { label: 'Yeniden adlandır (F2)', onSelect: () => onRename(workspace.id), disabled },
      { label: 'Renk ve simge…', onSelect: () => onStyle(workspace.id, anchor), disabled },
      { label: 'Klasörü sil', onSelect: () => onDelete(workspace.id), danger: true, disabled },
    );
    return entries;
  };

  // ---- Klavye: ağaç gezinmesi (oklar, Home/End, Enter, F2) --------------------------
  const focusRow = (position: number) => {
    const row = rowsRef.current[Math.max(0, Math.min(rowsRef.current.length - 1, position))];
    if (!row) return;
    scrollRowIntoView(scrollRef.current, rowsRef.current, row.workspace.id);
    // Sanallaştırma: görünen pencereyi hemen güncelle (onScroll'u beklemeden), satır bir sonraki karede DOM'da olsun.
    setScrollTop(scrollRef.current?.scrollTop ?? 0);
    requestAnimationFrame(() => {
      scrollRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(row.workspace.id)}"]`)?.focus();
    });
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: TreeRow) => {
    if (e.target !== e.currentTarget) return;
    const position = rowsRef.current.findIndex((r) => r.workspace.id === row.workspace.id);
    // Alt+↑/↓: klasörü kardeşleri arasında bir sıra yukarı/aşağı taşı (sabitlenmiş grubun içinde kalır).
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (disabled) return;
      const group = (index.get(row.workspace.parentId) ?? []).filter(
        (w) => Boolean(w.favorite) === Boolean(row.workspace.favorite),
      );
      const at = group.findIndex((w) => w.id === row.workspace.id);
      const neighbor = group[e.key === 'ArrowUp' ? at - 1 : at + 1];
      if (neighbor) {
        onReorderFolder(row.workspace.id, neighbor.id, e.key === 'ArrowUp' ? 'before' : 'after');
        requestAnimationFrame(() => focusRow(rowsRef.current.findIndex((r) => r.workspace.id === row.workspace.id)));
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        focusRow(position + 1);
        break;
      case 'ArrowUp':
        focusRow(position - 1);
        break;
      case 'Home':
        focusRow(0);
        break;
      case 'End':
        focusRow(rowsRef.current.length - 1);
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.isOpen) setExpanded(row.workspace.id, true);
        else if (row.hasChildren) focusRow(position + 1);
        break;
      case 'ArrowLeft':
        if (row.isOpen && q === '') setExpanded(row.workspace.id, false);
        else if (row.workspace.parentId !== null) {
          focusRow(rowsRef.current.findIndex((r) => r.workspace.id === row.workspace.parentId));
        }
        break;
      case 'Enter':
      case ' ':
        onSelect(row.workspace.id);
        break;
      case 'F2':
        e.stopPropagation(); // Genel F2 dinleyicisi (seçili klasör) devreye girmesin
        if (!disabled) onRename(row.workspace.id);
        break;
      case 'ContextMenu':
      case 'F10': {
        if (e.key === 'F10' && !e.shiftKey) return;
        const rect = e.currentTarget.getBoundingClientRect();
        openAt(rect.left + 24, rect.bottom, buildMenu(row.workspace, { x: rect.left + 24, y: rect.bottom }));
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  };

  // ---- HTML5 DnD: açık sekme ve ağaçtaki klasörler bir düğüme bırakılabilir ----
  const acceptsDrop = (e: DragEvent<HTMLElement>, allowOpenTab: boolean): boolean => {
    const types = e.dataTransfer.types;
    return !disabled && (types.includes(DND_FOLDER_MIME) || (allowOpenTab && types.includes(DND_OPEN_TAB_MIME)));
  };

  const handleDragOver = (e: DragEvent<HTMLElement>, targetId: string, allowOpenTab: boolean) => {
    if (!acceptsDrop(e, allowOpenTab)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
    setHoverRowId(targetId);
    // Klasör sürüklenirken satırın kenarları "araya koy", ortası "içine taşı" (kökte yalnızca içine).
    let zone: RowDropZone = 'inside';
    if (targetId !== ROOT_DROP_ID && e.dataTransfer.types.includes(DND_FOLDER_MIME)) {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      zone = ratio < EDGE_RATIO ? 'before' : ratio > 1 - EDGE_RATIO ? 'after' : 'inside';
    }
    setHoverZone(zone);
  };

  // Satırın içindeki bir alt öğeye geçmek "ayrılmak" sayılmaz (aksi halde vurgu kısa süre kapanıp açılır).
  // Yalnızca bu satırın vurgusunu kaldır: aradaki olay sırası başka bir satırın vurgusunu silmesin.
  const handleDragLeave = (e: DragEvent<HTMLElement>, rowId: string) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setHoverRowId((prev) => (prev === rowId ? null : prev));
  };

  const handleDrop = (e: DragEvent<HTMLElement>, target: string | null) => {
    e.preventDefault();
    const zone = hoverZone;
    setHoverRowId(null);
    setHoverZone('inside');
    if (disabled) return;

    if (e.dataTransfer.types.includes(DND_OPEN_TAB_MIME)) {
      const tab = readOpenTabDrop(e.dataTransfer);
      if (tab && target !== null) onDropOpenTab(target, tab, !e.altKey);
      return;
    }

    const folderId = e.dataTransfer.getData(DND_FOLDER_MIME);
    if (!folderId || folderId === target) return;
    if (target !== null && zone !== 'inside') onReorderFolder(folderId, target, zone);
    else onMoveFolder(folderId, target);
  };

  // Klavyeyle ağaca girişte odaklanacak tek satır (roving tabindex): seçili satır, yoksa ilk satır.
  const tabStopId = rows.some((r) => r.workspace.id === selectedId) ? selectedId : (rows[0]?.workspace.id ?? null);

  const renderRow = (row: TreeRow) => {
    const { workspace, depth, hasChildren, isOpen } = row;
    const isSelected = workspace.id === selectedId;
    const isRowHover = hoverRowId === workspace.id;
    const edgeZone = isRowHover && hoverZone !== 'inside' ? hoverZone : null;
    const isDropHover = (isRowHover && edgeZone === null) || dropHoverId === workspace.id;
    const isRenaming = renamingId === workspace.id && renamingSource === 'tree';

    return (
      <div
        key={workspace.id}
        data-drop-folder={workspace.id}
        data-row-id={workspace.id}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isSelected}
        tabIndex={workspace.id === tabStopId ? 0 : -1}
        onKeyDown={(e) => handleRowKeyDown(e, row)}
        draggable={!disabled && !isRenaming}
        onDragStart={(e: DragEvent<HTMLDivElement>) => {
          e.dataTransfer.setData(DND_FOLDER_MIME, workspace.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => handleDragOver(e, workspace.id, true)}
        onDragLeave={(e) => handleDragLeave(e, workspace.id)}
        onDrop={(e) => handleDrop(e, workspace.id)}
        onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
          e.preventDefault();
          openAt(e.clientX, e.clientY, buildMenu(workspace, { x: e.clientX, y: e.clientY }));
        }}
        onClick={() => onSelect(workspace.id)}
        style={{ height: ROW_HEIGHT, paddingLeft: 6 + depth * INDENT_PX }}
        className={`group relative flex cursor-pointer items-center gap-1 pr-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset ${enterIds[workspace.id] ? 'tf-enter' : ''} ${leavingIds[workspace.id] ? 'tf-leave' : ''} ${
          isDropHover
            ? 'bg-indigo-100 ring-1 ring-indigo-400 ring-inset'
            : isSelected
              ? 'bg-indigo-50 font-medium text-indigo-700'
              : 'text-gray-800 hover:bg-gray-100'
        }`}
      >
        {edgeZone && (
          // Araya bırakma göstergesi: satırın üst ya da alt kenarında çizgi
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute right-1 h-0.5 rounded-full bg-indigo-500 ${
              edgeZone === 'before' ? 'top-0' : 'bottom-0'
            }`}
            style={{ left: 6 + depth * INDENT_PX }}
          />
        )}
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={isOpen ? 'Daralt' : 'Genişlet'}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(workspace.id, !isOpen);
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
          >
            <ChevronDownIcon width={14} height={14} className={isOpen ? '' : '-rotate-90'} />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        <FolderGlyph icon={workspace.icon} color={workspace.color} className="shrink-0" />
        {isRenaming ? (
          <div className="min-w-0 flex-1">
            <InlineRename
              initialValue={workspace.name}
              onCommit={(name) => onRenameCommit(workspace.id, name)}
              onCancel={() => setRenamingId(null)}
            />
          </div>
        ) : (
          <span
            className="min-w-0 flex-1 truncate"
            title={`${workspace.name}\nÇift tık: yeniden adlandır`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!disabled) onRename(workspace.id);
            }}
          >
            {workspace.name}
          </span>
        )}
        {workspace.favorite && (
          <PinIcon width={12} height={12} className="shrink-0 text-gray-400" aria-label="Sabitlenmiş" role="img" />
        )}
        {workspace.tabs.length > 0 && <span className="shrink-0 text-xs text-gray-500">{workspace.tabs.length}</span>}
        <IconButton
          label="Klasör işlemleri"
          tabIndex={-1} // Satırlar tek sekme durağı (roving tabindex); menü klavyeden Shift+F10 ile açılır
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openAt(rect.right, rect.bottom + 4, buildMenu(workspace, { x: rect.left, y: rect.bottom + 4 }));
          }}
          className="size-6 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <MoreIcon />
        </IconButton>
      </div>
    );
  };

  const isRootSelected = selectedId === null;
  const isRootHover = hoverRowId === ROOT_DROP_ID || dropHoverId === ROOT_DROP_ID;
  const totalCount = Object.keys(workspaces).length;

  return (
    <nav aria-label="Klasör ağacı" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 items-center gap-1 px-3 pt-3 pb-1.5">
        {isSearchOpen ? (
          <>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={query}
                autoFocus
                placeholder="Klasör veya sekme ara…"
                aria-label="Klasör veya sekme ara"
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onQueryChange('');
                    setIsSearchOpen(false);
                  }
                }}
                onBlur={() => {
                  if (query.trim() === '') setIsSearchOpen(false);
                }}
                className="block w-full rounded-md border-0 bg-gray-50 py-1.5 pr-2 pl-7 text-sm text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <IconButton
              label="Aramayı kapat"
              // onMouseDown: input blur'undan önce çalışsın, arama kutusu kapanıp yer değiştirmesin
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onQueryChange('');
                setIsSearchOpen(false);
              }}
            >
              <XIcon />
            </IconButton>
          </>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              Klasörler
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{totalCount}</span>
            </h2>
            <div className="ml-auto flex items-center">
              <IconButton label="Ara" onClick={() => setIsSearchOpen(true)}>
                <SearchIcon />
              </IconButton>
              <IconButton label="Yeni kök klasör" onClick={() => onNewFolder(null)} disabled={disabled}>
                <PlusIcon />
              </IconButton>
            </div>
          </>
        )}
      </div>

      <div
        data-drop-folder={ROOT_DROP_ID}
        role="button"
        tabIndex={0}
        aria-pressed={isRootSelected}
        onClick={() => onSelect(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(null);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusRow(0);
          }
        }}
        onDragOver={(e) => handleDragOver(e, ROOT_DROP_ID, false)}
        onDragLeave={(e) => handleDragLeave(e, ROOT_DROP_ID)}
        onDrop={(e) => handleDrop(e, null)}
        style={{ height: ROW_HEIGHT }}
        className={`mx-0 flex cursor-pointer items-center gap-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset ${
          isRootHover
            ? 'bg-indigo-100 ring-1 ring-indigo-400 ring-inset'
            : isRootSelected
              ? 'bg-indigo-50 font-medium text-indigo-700'
              : 'text-gray-800 hover:bg-gray-100'
        }`}
      >
        <HomeIcon className="shrink-0 text-gray-500" />
        Tümü
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-500">
            {q !== '' ? 'Aramayla eşleşen klasör yok.' : 'Henüz klasör yok.'}
          </p>
        ) : (
          <div role="tree" aria-label="Klasörler" style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
            <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>{visibleRows.map(renderRow)}</div>
          </div>
        )}
      </div>
      {menu}
    </nav>
  );
}