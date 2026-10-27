import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import {
  listBookmarkFolders,
  parseTabList,
  specFromBookmarks,
  specFromTabList,
  type BookmarkNode,
  type ImportFolderSpec,
} from '../utils/externalImport';
import { Button } from './ui/Button';
import { XIcon } from './ui/icons';
import { IconButton } from './ui/IconButton';

export type ImportSource = 'text' | 'bookmarks';

interface ImportDialogProps {
  source: ImportSource;
  busy: boolean;
  onImport: (spec: ImportFolderSpec) => void;
  onClose: () => void;
}

/** Başka araçlardan içe aktarma: yapıştırılan metin (OneTab, adres listesi) ya da bir Chrome yer imi klasörü. */
export function ImportDialog({ source, busy, onImport, onClose }: ImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(() => t(source === 'text' ? 'import.defaultName' : 'import.bookmarksDefaultName'));
  const [text, setText] = useState('');
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  useEffect(() => {
    if (source !== 'bookmarks') return;
    chrome.bookmarks.getTree().then(
      (roots) => setTree(roots as BookmarkNode[]),
      () => setTree([]),
    );
  }, [source]);

  const parsed = useMemo(() => parseTabList(text), [text]);
  const folders = useMemo(() => (tree ? listBookmarkFolders(tree) : []), [tree]);
  const selectedFolder = folders.find((f) => f.node.id === selected)?.node;

  const textSpec = (): ImportFolderSpec | null =>
    parsed.groups.length === 0
      ? null
      : specFromTabList(name.trim() || t('import.defaultName'), parsed, (i) => t('import.groupName', { n: i }));
  const bookmarkSpec = (): ImportFolderSpec | null => {
    if (!selectedFolder) return null;
    const { spec } = specFromBookmarks(selectedFolder, t('import.bookmarksDefaultName'));
    return { ...spec, name: name.trim() || spec.name };
  };
  const spec = source === 'text' ? textSpec() : bookmarkSpec();
  const totalTabs = parsed.groups.reduce((sum, g) => sum + g.length, 0);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-labelledby="tf-import-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto flex max-h-[min(40rem,calc(100vh-4rem))] w-[min(34rem,calc(100vw-2rem))] flex-col rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40 [&:not([open])]:hidden"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="tf-import-title" className="text-sm font-semibold">
            {t(source === 'text' ? 'import.textTitle' : 'import.bookmarksTitle')}
          </h2>
          <p className="text-xs text-gray-500">{t(source === 'text' ? 'import.textHelp' : 'import.bookmarksHelp')}</p>
        </div>
        <IconButton label={t('common.close')} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <label className="block text-xs font-medium text-gray-600">
          {t('import.folderName')}
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600"
          />
        </label>

        {source === 'text' ? (
          <label className="block text-xs font-medium text-gray-600">
            {t('import.textLabel')}
            <textarea
              value={text}
              autoFocus
              rows={9}
              spellCheck={false}
              placeholder={'https://example.com | Example\nhttps://another.com'}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 block w-full resize-y rounded-md border-0 bg-white px-3 py-2 font-mono text-xs text-gray-900 ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600"
            />
            <span className="mt-1 block font-normal text-gray-500" role="status">
              {text.trim() === ''
                ? ''
                : t('import.textSummary', { tabs: totalTabs, groups: parsed.groups.length, skipped: parsed.skipped })}
            </span>
          </label>
        ) : tree === null ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : folders.length === 0 ? (
          <p className="text-sm text-gray-500">{t('import.bookmarksEmpty')}</p>
        ) : (
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-gray-600">{t('import.bookmarksPick')}</legend>
            <ul className="max-h-72 overflow-y-auto rounded-md ring-1 ring-gray-200">
              {folders.map(({ node, depth, links }) => (
                <li key={node.id}>
                  <label
                    className="flex cursor-pointer items-center gap-2 py-1.5 pr-3 text-sm hover:bg-gray-50"
                    style={{ paddingLeft: 12 + depth * 16 }}
                  >
                    <input
                      type="radio"
                      name="bookmark-folder"
                      checked={selected === node.id}
                      onChange={() => {
                        setSelected(node.id);
                        setName(node.title || t('import.bookmarksDefaultName'));
                      }}
                      className="accent-indigo-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{node.title || t('import.bookmarksDefaultName')}</span>
                    <span className="shrink-0 text-xs text-gray-500">{t('count.tabs', { n: links })}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" disabled={busy || spec === null} onClick={() => spec && onImport(spec)}>
          {t('app.import.action')}
        </Button>
      </footer>
    </dialog>
  );
}
