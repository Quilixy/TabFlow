import type { FormEvent, KeyboardEvent } from 'react';
import { useUiStore } from '../store/useUiStore';
import { Button } from './ui/Button';
import { t } from '../i18n';

export type ComposerMode = 'empty' | 'saveAll' | 'saveActive';

interface FolderComposerProps {
  mode: ComposerMode;
  isBusy: boolean;
  disabled: boolean;
  /** Yeni klasörün oluşturulacağı üst klasörün adı (kökse null). */
  parentName?: string | null;
  onSubmit: (name: string, includePinned: boolean) => Promise<boolean>;
  onClose: () => void;
}

export function FolderComposer({ mode, isBusy, disabled, parentName = null, onSubmit, onClose }: FolderComposerProps) {
  const draftName = useUiStore((s) => s.draftName);
  const setDraftName = useUiStore((s) => s.setDraftName);
  const includePinned = useUiStore((s) => s.includePinned);
  const setIncludePinned = useUiStore((s) => s.setIncludePinned);

  const isSaveAll = mode === 'saveAll';
  const isSaveActive = mode === 'saveActive';
  const canSubmit = draftName.trim().length > 0 && !disabled;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await onSubmit(draftName, includePinned);
    if (ok) {
      setDraftName('');
      onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && !isBusy) onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3"
    >
      <label htmlFor="workspace-name" className="block text-sm font-semibold text-gray-900">
        {isSaveAll
          ? t('composer.saveAllTitle')
          : isSaveActive
            ? t('composer.saveActiveTitle')
            : parentName
              ? t('composer.newSubfolder')
              : t('composer.newFolder')}
      </label>
      {parentName && !isSaveAll && !isSaveActive && <p className="text-xs text-gray-600">{t('composer.inParent', { parent: parentName })}</p>}
      {isSaveAll && (
        <p className="text-xs text-gray-600">
          {t('composer.saveAllHelp')}
        </p>
      )}
      {isSaveActive && (
        <p className="text-xs text-gray-600">
          {t('composer.saveActiveHelp')}
        </p>
      )}
      <input
        id="workspace-name"
        type="text"
        value={draftName}
        maxLength={60}
        autoFocus
        disabled={disabled}
        placeholder={isSaveAll || isSaveActive ? t('composer.placeholderSave') : t('composer.placeholderName')}
        onChange={(e) => setDraftName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-600 disabled:opacity-60"
      />
      {isSaveAll && (
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={includePinned}
            disabled={disabled}
            onChange={(e) => setIncludePinned(e.target.checked)}
            className="size-4 accent-indigo-600"
          />
          {t('composer.includePinned')}
        </label>
      )}
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isBusy}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" isLoading={isBusy} disabled={!canSubmit}>
          {isSaveAll || isSaveActive ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}