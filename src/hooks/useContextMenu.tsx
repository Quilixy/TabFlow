import { useCallback, useState, type ReactNode } from 'react';
import { ContextMenu } from '../components/ui/ContextMenu';
import type { MenuEntry } from '../components/ui/menu';

interface MenuState {
  x: number;
  y: number;
  entries: MenuEntry[];
}

/** `menu` düğümünü bileşenin içinde render et; `openAt` ile (sağ tık / ⋯ butonu) aç. */
export function useContextMenu(): {
  menu: ReactNode;
  openAt: (x: number, y: number, entries: MenuEntry[]) => void;
} {
  const [state, setState] = useState<MenuState | null>(null);
  const close = useCallback(() => setState(null), []);
  const openAt = useCallback(
    (x: number, y: number, entries: MenuEntry[]) => setState({ x, y, entries }),
    [],
  );

  const menu = state ? (
    <ContextMenu x={state.x} y={state.y} entries={state.entries} onClose={close} />
  ) : null;

  return { menu, openAt };
}
