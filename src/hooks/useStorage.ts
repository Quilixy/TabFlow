import { useCallback, useEffect, useRef, useState } from 'react';
import { asStorageError, readKey, StorageError, updateKey } from '../storage/kv';

export { readKey, StorageError, updateKey } from '../storage/kv';

export function useStorage<T>(key: string, fallback: T) {
  const fallbackRef = useRef(fallback); // Obje literal fallback'lerin effect'i tetiklemesini engeller
  const [data, setData] = useState<T>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<StorageError | null>(null);

  useEffect(() => {
    let cancelled = false;

    readKey(key, fallbackRef.current)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e) => {
        if (!cancelled) setError(asStorageError(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Başka bir bağlamda (sekme, background) yapılan değişiklikleri yansıt
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !(key in changes)) return;
      const { newValue } = changes[key];
      setData(newValue === undefined ? fallbackRef.current : (newValue as T));
      setError(null); // Veri geldi: ilk okumadaki (geçici) hata artık geçersiz
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [key]);

  // Yazma hataları çağırana fırlatılır (arayüz kendi gösterir); `error` yalnızca ilk okuma hatasıdır.
  // Aksi halde kapatılan hata bandı, hook'ta kalan aynı hatayla kapatılamaz biçimde geri gelirdi.
  const update = useCallback(
    async (updater: (current: T) => T): Promise<T> => {
      try {
        const next = await updateKey(key, fallbackRef.current, updater);
        setData(next);
        setError(null);
        return next;
      } catch (e) {
        throw asStorageError(e);
      }
    },
    [key],
  );

  const set = useCallback((value: T) => update(() => value), [update]);

  return { data, isLoading, error, set, update } as const;
}