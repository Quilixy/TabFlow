import { useCallback, useEffect, useRef, useState } from 'react';

export class StorageError extends Error {
  readonly originalError?: unknown;
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

/**
 * Hatayı StorageError'a çevirir. Güncelleyicinin (updater) kendi attığı anlamlı iletiler (ör. "Bir klasör kendi
 * alt klasörüne taşınamaz.") korunur; yalnızca iletisi olmayan hatalar genel iletiyle değiştirilir.
 */
const asStorageError = (e: unknown, fallbackMessage = 'Beklenmeyen depolama hatası.'): StorageError => {
  if (e instanceof StorageError) return e;
  const message = e instanceof Error && e.message ? e.message : fallbackMessage;
  return new StorageError(message, e);
};

/**
 * Aynı bağlamdaki yazmalar tek bir kuyruktan geçer (read-modify-write yarışlarını önler).
 * Kuyruk modül seviyesindedir; farklı hook örnekleri aynı kuyruğu paylaşır.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task);
  writeQueue = next.catch(() => undefined); // Bir hata kuyruğu kilitlemesin
  return next;
}

/**
 * Bağlamlar arası kilit: popup, tam ekran sekmeleri ve service worker modülün ayrı kopyalarını yükler; kuyruk
 * onları sıraya sokamaz. Web Locks aynı köken (eklenti) içindeki tüm bağlamlarda ortaktır.
 */
function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return enqueue(task);
  return enqueue(() => locks.request(`tabflow:${key}`, task));
}

export async function readKey<T>(key: string, fallback: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? fallback;
  } catch (e) {
    throw new StorageError(`"${key}" okunamadı.`, e);
  }
}

/**
 * Güncel değeri okuyup, updater ile dönüştürüp yazar. updater saf ve senkron olmalı.
 * updater aynı referansı döndürürse (değişiklik yok) yazılmaz: gereksiz onChanged yayını olmaz.
 */
export function updateKey<T>(key: string, fallback: T, updater: (current: T) => T): Promise<T> {
  return withLock(key, async () => {
    const current = await readKey(key, fallback);
    const next = updater(current);
    if (next === current) return current;
    try {
      await chrome.storage.local.set({ [key]: next });
    } catch (e) {
      throw new StorageError(`"${key}" yazılamadı (depolama kotası dolmuş olabilir).`, e);
    }
    return next;
  });
}

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