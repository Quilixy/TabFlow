import { useState, memo, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { OpenTab } from '../../hooks/useTabManager';
import type { Workspace } from '../../types';
import type { PreviewRow } from '../../utils/workspaceTree';
import { FOLDER_CARD_W } from '../../utils/canvasMath';
import { cardDecorFor } from '../../utils/decor';
import { DND_FOLDER_MIME, DND_OPEN_TAB_MIME, readOpenTabDrop } from '../../utils/dnd';
import { folderColorCss } from '../../utils/folderStyle';
import { Favicon } from '../Favicon';
import { FolderGlyph } from '../ui/FolderGlyph';
import { MoreIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';
import { InlineRename } from '../ui/InlineRename';
import { t } from '../../i18n';

const INDENT_PX = 14;

interface FolderCardProps {
  folder: Workspace;
  childCount: number;
  rows: PreviewRow[];
  x: number;
  y: number;
  isDragging: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  isRenaming: boolean;
  isEntering: boolean;
  isLeaving: boolean;
  onRenameCommit: (id: string, name: string) => void;
  onRenameCancel: () => void;
  /** Geri çağrılar kimlik (ve konum) alır: üst bileşen kararlı bir fonksiyon verebilsin diye. */
  onPointerDown: (e: PointerEvent<HTMLDivElement>, id: string, x: number, y: number) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: () => void;
  onContextMenu: (e: MouseEvent<HTMLElement>, id: string) => void;
  onMenuButton: (rect: DOMRect, id: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, id: string) => void;
  onEnter: (id: string) => void;
  onOpenTabDrop: (folderId: string, tab: OpenTab, closeOriginal: boolean) => void;
  /** Ağaçtan sürüklenen bir klasör bu kartın içine bırakıldı. */
  onFolderDrop: (draggedId: string, targetId: string) => void;
}

export const FolderCard = memo(function FolderCard({ folder, childCount, rows, x, y, isDragging, isSelected, isDropTarget, isRenaming, isEntering, isLeaving, onRenameCommit, onRenameCancel, onPointerDown, onPointerMove, onPointerUp, onLostPointerCapture, onContextMenu, onMenuButton, onKeyDown, onEnter, onOpenTabDrop, onFolderDrop }: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    const types = e.dataTransfer.types;
    const isFolder = types.includes(DND_FOLDER_MIME);
    if (!isFolder && !types.includes(DND_OPEN_TAB_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isFolder ? 'move' : e.altKey ? 'copy' : 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  // Kartın içindeki bir alt öğeye geçmek "ayrılmak" sayılmaz (vurgu titremesini önler).
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    const draggedFolder = e.dataTransfer.getData(DND_FOLDER_MIME);
    if (draggedFolder) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (draggedFolder !== folder.id) onFolderDrop(draggedFolder, folder.id);
      return;
    }
    if (!e.dataTransfer.types.includes(DND_OPEN_TAB_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const tab = readOpenTabDrop(e.dataTransfer);
    if (tab) onOpenTabDrop(folder.id, tab, !e.altKey);
  };

  const highlighted = isDropTarget || isDragOver;
  const decor = cardDecorFor(folder.id);

  return (
    <div
      data-item-id={folder.id}
      data-drop-folder={folder.id}
      data-decor-corner={decor.corner}
      data-decor-variant={decor.variant}
      tabIndex={0}
      role="button"
      aria-label={t('card.folderLabel', {
        name: folder.name,
        tabs: t('count.tabs', { n: folder.tabs.length }),
        sub: childCount > 0 ? `, ${t('count.subfolders', { n: childCount })}` : '',
      })}
      style={{ left: x, top: y, width: FOLDER_CARD_W }}
      onPointerDown={(e) => onPointerDown(e, folder.id, x, y)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onLostPointerCapture}
      onContextMenu={(e) => onContextMenu(e, folder.id)}
      onKeyDown={(e) => onKeyDown(e, folder.id)}
      onDoubleClick={(e) => {
        // İşlem düğmelerine çift tıklamak klasöre girmesin (yeni açılan menü kaybolurdu).
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
        onEnter(folder.id);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={t('card.folderTitle', { name: folder.name })}
      className={`group absolute rounded-2xl border p-3 outline-none select-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        highlighted
          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 shadow-md'
          : isSelected
            ? 'border-indigo-600 bg-white ring-1 ring-indigo-600 shadow-md z-10'
            : 'border-[var(--tf-card-border)] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)]'
      } ${isDragging ? 'z-20 cursor-grabbing shadow-2xl' : 'cursor-grab'} ${isEntering ? 'tf-enter' : ''} ${isLeaving ? 'tf-leave' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${folderColorCss(folder.color)} 15%, transparent)` }}
        >
          <FolderGlyph icon={folder.icon} color={folder.color} width={20} height={20} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          {isRenaming ? (
            <div data-no-drag>
              <InlineRename initialValue={folder.name} onCommit={(name) => onRenameCommit(folder.id, name)} onCancel={onRenameCancel} />
            </div>
          ) : (
            <p className="line-clamp-2 text-sm leading-snug font-semibold tracking-tight text-gray-900">{folder.name}</p>
          )}
          <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400">
            {t('count.tabs', { n: folder.tabs.length })}
            {childCount > 0 ? ` · ${t('count.folders', { n: childCount })}` : ''}
          </p>
        </div>
        <div data-no-drag className="-mt-1 -mr-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
          <IconButton label={t('folder.actions')} onClick={(e) => onMenuButton(e.currentTarget.getBoundingClientRect(), folder.id)}>
            <MoreIcon />
          </IconButton>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.length === 0 && <li className="text-xs text-gray-400 italic">{t('card.emptyFolder')}</li>}
        {rows.map((row) => {
          const indent = { paddingLeft: row.depth * INDENT_PX };
          if (row.kind === 'tab') {
            return (
              <li key={row.key} style={indent} className="flex items-center gap-2">
                <Favicon pageUrl={row.tab.url} fallbackUrl={row.tab.favIconUrl} title={row.tab.title} />
                <span className="truncate text-xs font-medium text-gray-600">{row.tab.title}</span>
              </li>
            );
          }
          if (row.kind === 'folder') {
            return (
              <li key={row.key} style={indent} className="flex items-center gap-1.5">
                <FolderGlyph icon={row.folder.icon} color={row.folder.color} width={16} height={16} className="shrink-0" />
                <span className="truncate text-xs font-semibold text-gray-800">{row.folder.name}</span>
                {row.folder.tabs.length > 0 && (
                  <span className="ml-auto shrink-0 pl-1 text-[11px] font-medium text-gray-400">{row.folder.tabs.length}</span>
                )}
              </li>
            );
          }
          return (
            <li key={row.key} style={indent} className="text-[11px] font-medium text-gray-400">
              {t('card.more', { n: row.count })}
            </li>
          );
        })}
      </ul>
    </div>
  );
});