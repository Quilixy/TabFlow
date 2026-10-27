import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { filterCommands, type PaletteCommand } from '../utils/palette';

interface CommandPaletteProps {
  commands: PaletteCommand[];
  onClose: () => void;
}

/** Ctrl+K komut paleti: klasöre git ya da bir işlemi çalıştır. Oklar + Enter, Esc ile kapanır. */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  // Etkin satır görünür kalsın.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runCommand = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setActive((activeIndex + 1) % Math.max(1, results.length));
    else if (e.key === 'ArrowUp') setActive((activeIndex - 1 + results.length) % Math.max(1, results.length));
    else if (e.key === 'Enter') runCommand(results[activeIndex]);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-label={t('palette.title')}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/40 [&:not([open])]:hidden"
    >
      <input
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-label={t('palette.title')}
        placeholder={t('palette.placeholder')}
        value={query}
        autoFocus
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        className="block w-full border-0 border-b border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-500"
      />
      {results.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500">{t('palette.empty')}</p>
      ) : (
        <ul ref={listRef} id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.map((command, i) => (
            <li
              key={command.id}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === activeIndex}
              onMouseMove={() => setActive(i)}
              onClick={() => runCommand(command)}
              className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                i === activeIndex ? 'bg-indigo-50 text-indigo-700' : 'text-gray-800'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{command.label}</span>
              {command.hint && <span className="shrink-0 text-xs text-gray-600">{command.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">{t('palette.footer')}</p>
    </dialog>
  );
}
