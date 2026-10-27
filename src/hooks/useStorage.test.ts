import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateKey } from './useStorage';

// Bellek içi chrome.storage.local taklidi: yalnızca updateKey'in kullandığı get/set.
let store: Record<string, unknown>;
const set = vi.fn(async (items: Record<string, unknown>) => {
  await Promise.resolve(); // Gerçek API gibi eşzamansız
  Object.assign(store, structuredClone(items));
});

beforeEach(() => {
  store = {};
  set.mockClear();
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: structuredClone(store[key]) }),
        set,
      },
    },
  });
});

describe('updateKey', () => {
  it('eşzamanlı güncellemeler birbirini ezmez', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => updateKey<number[]>('k', [], (current) => [...current, i])),
    );
    expect((store.k as number[]).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('güncelleyici aynı değeri döndürürse yazmaz', async () => {
    store.k = { a: 1 };
    const result = await updateKey<Record<string, number>>('k', {}, (current) => current);
    expect(result).toEqual({ a: 1 });
    expect(set).not.toHaveBeenCalled();
  });

  it('başarısız güncelleme kuyruğu kilitlemez', async () => {
    await expect(
      updateKey<number>('k', 0, () => {
        throw new Error('geçersiz');
      }),
    ).rejects.toThrow('geçersiz');
    await expect(updateKey<number>('k', 0, (n) => n + 1)).resolves.toBe(1);
  });

  it('yazma hatasını anlaşılır iletiyle bildirir', async () => {
    set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await expect(updateKey<number>('k', 0, (n) => n + 1)).rejects.toThrow('depolama kotası');
  });
});
