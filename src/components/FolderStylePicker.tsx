import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Workspace } from '../types';
import {
  DEFAULT_FOLDER_COLOR_CSS,
  FOLDER_COLORS,
  FOLDER_COLOR_LABELS,
  FOLDER_ICON_IDS,
  FOLDER_ICON_LABELS,
  type FolderColorId,
} from '../utils/folderStyle';
import { FolderGlyph } from './ui/FolderGlyph';
import { CheckIcon } from './ui/icons';

export interface FolderStylePatch {
  /** null: varsayılana dön */
  color?: string | null;
  icon?: string | null;
}

interface FolderStylePickerProps {
  folder: Workspace;
  x: number;
  y: number;
  onChange: (patch: FolderStylePatch) => void;
  onClose: () => void;
}

const EDGE = 8;

/** Klasör rengi ve simgesi seçici. Seçim anında uygulanır, panel açık kalır; Esc / dışarı tıklama kapatır. */
export function FolderStylePicker({ folder, x, y, onChange, onClose }: FolderStylePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE))}px`;
    el.style.top = `${Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE))}px`;
  }, [x, y]);

  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);

  // Odak: açılışta ilk düğmeye; kapanınca önceki öğeye geri.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttons()[0]?.focus();
    return () => {
      const active = document.activeElement;
      if (previous?.isConnected && (!active || active === document.body)) previous.focus();
    };
  }, []);

  // Ok tuşlarıyla renk/simge düğmeleri arasında gezin (sıra: renkler, sonra simgeler).
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = buttons();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    items[next].focus();
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const colorIds = Object.keys(FOLDER_COLORS) as FolderColorId[];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Klasör rengi ve simgesi"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      className="fixed z-50 w-64 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
    >
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-500">Renk</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            title="Varsayılan (tema rengi)"
            aria-label="Varsayılan renk"
            aria-pressed={folder.color === undefined}
            onClick={() => onChange({ color: null })}
            style={{ backgroundColor: DEFAULT_FOLDER_COLOR_CSS }}
            className="inline-flex size-6 items-center justify-center rounded-full text-[#fff] ring-offset-2 ring-offset-white focus-visible:outline-2 focus-visible:outline-indigo-600 aria-pressed:ring-2 aria-pressed:ring-gray-500"
          >
            {folder.color === undefined && <CheckIcon width={14} height={14} />}
          </button>
          {colorIds.map((id) => (
            <button
              key={id}
              type="button"
              title={FOLDER_COLOR_LABELS[id]}
              aria-label={FOLDER_COLOR_LABELS[id]}
              aria-pressed={folder.color === id}
              onClick={() => onChange({ color: id })}
              style={{ backgroundColor: FOLDER_COLORS[id] }}
              className="inline-flex size-6 items-center justify-center rounded-full text-[#fff] ring-offset-2 ring-offset-white focus-visible:outline-2 focus-visible:outline-indigo-600 aria-pressed:ring-2 aria-pressed:ring-gray-500"
            >
              {folder.color === id && <CheckIcon width={14} height={14} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-500">Simge</p>
        <div className="grid grid-cols-7 gap-1">
          {FOLDER_ICON_IDS.map((id) => {
            const selected = (folder.icon ?? 'folder') === id;
            return (
              <button
                key={id}
                type="button"
                title={FOLDER_ICON_LABELS[id]}
                aria-label={FOLDER_ICON_LABELS[id]}
                aria-pressed={selected}
                onClick={() => onChange({ icon: id === 'folder' ? null : id })}
                className={`inline-flex size-8 items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  selected ? 'bg-gray-100 ring-1 ring-gray-300' : ''
                }`}
              >
                <FolderGlyph icon={id} color={folder.color} width={18} height={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}