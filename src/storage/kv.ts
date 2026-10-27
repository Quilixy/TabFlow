/**
 * chrome.storage.local üzerinde kilitli okuma-değiştirme-yazma. React'ten bağımsızdır: popup, tam ekran
 * uygulama ve service worker aynı kodu kullanır.
 */

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
export const asStorageError = (e: unknown, fallbackMessage = 'Beklenmeyen depolama hatası.'): StorageError => {
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
