import { useCallback, useEffect, useState } from 'react';
import { asStorageError, StorageError } from '../storage/kv';
import {
  applyWorkspaceChanges,
  isWorkspaceChange,
  readRawWorkspaces,
  updateWorkspaces,
  type RawWorkspaces,
} from '../storage/workspaceStore';
import type { WorkspaceMap } from '../types';

const EMPTY: RawWorkspaces = {};

/**
 * Klasör deposunun React tarafı: ilk okuma, başka bağlamlardaki değişikliklerin canlı yansıması (yalnızca değişen
 * klasörler gelir) ve kilitli güncelleme. Kendi yazmalarımız da onChanged ile döner; durum tek kaynaktan güncellenir.
 */
export function useWorkspaceData() {
  const [data, setData] = useState<RawWorkspaces>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  // Yalnızca ilk okuma hatası (yazma hataları çağırana fırlatılır, arayüz kendi gösterir).
  const [error, setError] = useState<StorageError | null>(null);

  useEffect(() => {
    let cancelled = false;
    readRawWorkspaces()
      .then((raw) => {
        if (!cancelled) setData(raw);
      })
      .catch((e) => {
        if (!cancelled) setError(asStorageError(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !isWorkspaceChange(changes)) return;
      setData((prev) => applyWorkspaceChanges(prev, changes) ?? prev);
      setError(null); // Veri geldi: ilk okumadaki (geçici) hata artık geçersiz
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const update = useCallback(async (fn: (map: WorkspaceMap) => WorkspaceMap): Promise<WorkspaceMap> => {
    try {
      return await updateWorkspaces(fn);
    } catch (e) {
      throw asStorageError(e);
    }
  }, []);

  return { data, isLoading, error, update } as const;
}
