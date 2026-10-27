import { useEffect, useRef, useState } from 'react';
import { formatAgo } from '../utils/format';
import { describeTrashEntry, TRASH_RETENTION_MS, type TrashEntry } from '../utils/trash';
import { Favicon } from './Favicon';
import { Button } from './ui/Button';
import { FolderGlyph } from './ui/FolderGlyph';
import { XIcon } from './ui/icons';
import { IconButton } from './ui/IconButton';
import { t } from '../i18n';

const RETENTION_DAYS = Math.round(TRASH_RETENTION_MS / (24 * 60 * 60 * 1000));

interface TrashPanelProps {
  entries: TrashEntry[];
  busy: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onEmpty: () => void;
  onClose: () => void;
}

/** Çöp kutusu: silinen klasör ve sekmeler; tek tek geri yüklenir ya da kalıcı silinir. */
export function TrashPanel({ entries, busy, onRestore, onDelete, onEmpty, onClose }: TrashPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // "Boşalt" iki adımlı: yanlışlıkla tıklanınca her şey kalıcı silinmesin.
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [now] = useState(() => Date.now());

  // showModal: odak tuzağı ve Esc tarayıcıdan gelir; kapanınca odak açan düğmeye döner.
  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-labelledby="tf-trash-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // Arka plana tıklama
      }}
      className="m-auto flex max-h-[min(36rem,calc(100vh-4rem))] w-[min(32rem,calc(100vw-2rem))] flex-col rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40 [&:not([open])]:hidden"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="tf-trash-title" className="text-sm font-semibold">
            {t('trash.title')}
          </h2>
          <p className="text-xs text-gray-500">{t('trash.retention', { days: RETENTION_DAYS })}</p>
        </div>
        <IconButton label={t('common.close')} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      {entries.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-500">{t('trash.empty')}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {entries.map((entry) => {
            const { title, detail } = describeTrashEntry(entry);
            return (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  {entry.kind === 'tab' ? (
                    <Favicon pageUrl={entry.tab.url} fallbackUrl={entry.tab.favIconUrl} title={entry.tab.title} />
                  ) : (
                    <FolderGlyph icon={entry.folders[0]?.icon} color={entry.folders[0]?.color} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={title}>
                    {title}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {t('trash.deletedAgo', { detail, ago: formatAgo(entry.deletedAt, now) })}
                  </span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => onRestore(entry.id)} disabled={busy}>
                  {t('trash.restore')}
                </Button>
                <IconButton label={t('trash.deleteForever', { title })} onClick={() => onDelete(entry.id)} disabled={busy}>
                  <XIcon />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          {confirmEmpty ? (
            <>
              <span className="mr-auto text-xs text-gray-600">{t('trash.emptyConfirm', { n: entries.length })}</span>
              <Button variant="secondary" size="sm" onClick={() => setConfirmEmpty(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setConfirmEmpty(false);
                  onEmpty();
                }}
              >
                {t('trash.deleteAll')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmEmpty(true)} disabled={busy}>
              {t('trash.emptyAction')}
            </Button>
          )}
        </footer>
      )}
    </dialog>
  );
}
