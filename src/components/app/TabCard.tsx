import { memo, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { SavedTab } from '../../types';
import { TAB_CARD_W } from '../../utils/canvasMath';
import { hostOf } from '../../utils/url';
import { Favicon } from '../Favicon';
import { ArrowUpRightIcon, XIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';

interface TabCardProps {
  tab: SavedTab;
  x: number;
  y: number;
  isDragging: boolean;
  isSelected: boolean;
  /** Geri çağrılar kimlik (ve konum) alır: üst bileşen kararlı bir fonksiyon verebilsin diye. */
  onPointerDown: (e: PointerEvent<HTMLDivElement>, id: string, x: number, y: number) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: () => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, id: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, id: string) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export const TabCard = memo(function TabCard({ tab, x, y, isDragging, isSelected, onPointerDown, onPointerMove, onPointerUp, onLostPointerCapture, onContextMenu, onKeyDown, onOpen, onRemove }: TabCardProps) {
  return (
    <div
      data-item-id={tab.id}
      tabIndex={0}
      role="button"
      aria-label={`${tab.title} (${hostOf(tab.url)})`}
      style={{ left: x, top: y, width: TAB_CARD_W }}
      onPointerDown={(e) => onPointerDown(e, tab.id, x, y)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onLostPointerCapture}
      onContextMenu={(e) => onContextMenu(e, tab.id)}
      onKeyDown={(e) => onKeyDown(e, tab.id)}
      onDoubleClick={(e) => {
        // İşlem düğmelerine çift tıklamak sayfayı fazladan açmasın / kaldırılan sekmeyi açmasın.
        if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
        onOpen(tab.id);
      }}
      title={`${tab.title}\n${tab.url}\nÇift tık: arka planda aç`}
      className={`group absolute rounded-2xl border bg-white p-3 outline-none select-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isDragging 
          ? 'z-20 border-gray-400 cursor-grabbing shadow-2xl' 
          : isSelected
            ? 'border-gray-900 ring-1 ring-gray-900 shadow-md z-10'
            : 'border-[var(--tf-card-border)] cursor-grab shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)]'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <Favicon pageUrl={tab.url} fallbackUrl={tab.favIconUrl} title={tab.title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium tracking-tight text-gray-900">{tab.title}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400">{hostOf(tab.url)}</p>
        </div>
        <div data-no-drag className="-mt-1 -mr-1 flex flex-col opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
          <IconButton label="Arka planda aç" onClick={() => onOpen(tab.id)}>
            <ArrowUpRightIcon />
          </IconButton>
          <IconButton label="Klasörden kaldır" onClick={() => onRemove(tab.id)}>
            <XIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
});