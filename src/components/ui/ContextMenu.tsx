import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MenuEntry } from './menu';

interface ContextMenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}

const EDGE = 4;

export function ContextMenu({ x, y, entries, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Ölçüp görünür alana sığdır (state yerine doğrudan stil: ekstra render yok).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE))}px`;
    el.style.top = `${Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE))}px`;
  }, [x, y]);

  const enabledItems = () =>
    Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  // Odak: açılışta ilk öğeye; kapanınca (odak kaybolduysa) önceki öğeye geri.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    enabledItems()[0]?.focus();
    return () => {
      const active = document.activeElement;
      // Başka bir bileşen (ör. yeniden adlandırma alanı) odağı çoktan aldıysa ona dokunma.
      if (previous?.isConnected && (!active || active === document.body)) previous.focus();
    };
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = enabledItems();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current <= 0 ? items.length - 1 : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'Tab':
        onClose(); // Menü kapansın, odak doğal akışta ilerlesin
        return;
      default:
        return;
    }
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
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      className="fixed z-50 max-h-72 max-w-64 min-w-44 overflow-y-auto rounded-xl border border-[var(--tf-card-border)] bg-white py-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.12)]"
    >
      {entries.map((entry, i) => {
        if (entry.type === 'separator') {
          return <div key={i} role="separator" className="my-1 h-px bg-gray-100" />;
        }
        if (entry.type === 'heading') {
          return (
            <p key={i} className="px-3 pt-2 pb-1 text-xs font-medium text-gray-500">
              {entry.label}
            </p>
          );
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
            className={`block w-full truncate px-3 py-1.5 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
              entry.danger
                ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50'
                : 'text-gray-800 hover:bg-gray-50 focus-visible:bg-gray-100'
            }`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}