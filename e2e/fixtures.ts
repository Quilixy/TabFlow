import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', 'dist');
/** Sahte web siteleri: ağa çıkmadan, bu adresler yerelde yanıtlanır. */
export const SITE = 'http://tabflow.test';

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  /** Tam ekran uygulamayı yeni bir sekmede açar. */
  openApp: () => Promise<Page>;
  /** Popup sayfasını yeni bir sekmede açar (araç çubuğu açılır penceresiyle aynı sayfa). */
  openPopup: () => Promise<Page>;
  /** Sahte bir web sayfası açar (ör. "/haber" → "Haber" başlıklı sayfa). */
  openSite: (pathname: string, title?: string) => Promise<Page>;
  /** Depoya klasör yazar (uygulama sayfası bunu canlı olarak görür). */
  seed: (workspaces: Record<string, unknown>) => Promise<void>;
  /** chrome.storage.local'den bir anahtarı okur. */
  readStorage: <T>(key: string) => Promise<T | undefined>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // Yeni başsız kip eklentileri destekler
      // Testler Türkçe arayüzü doğrular ("Otomatik" dil ayarı tarayıcının dilini izler).
      locale: 'tr-TR',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--lang=tr-TR'],
    });
    // tabflow.test ve alt alan adları (ör. http://haber.tabflow.test) yerelde yanıtlanır.
    await context.route((url) => url.hostname === 'tabflow.test' || url.hostname.endsWith('.tabflow.test'), (route) => {
      const url = new URL(route.request().url());
      const title = url.searchParams.get('title') ?? url.pathname.slice(1);
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>${title}</title><h1>${title}</h1>` });
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },

  openApp: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/app/index.html`);
      await page.getByRole('heading', { name: 'TabFlow' }).waitFor();
      return page;
    });
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
      await page.getByRole('heading', { name: 'TabFlow' }).waitFor();
      return page;
    });
  },

  openSite: async ({ context }, use) => {
    await use(async (pathname, title) => {
      const page = await context.newPage();
      const url = new URL(pathname, SITE); // tam adres de verilebilir (başka bir alt alan adı)
      if (title) url.searchParams.set('title', title);
      await page.goto(url.toString());
      return page;
    });
  },

  seed: async ({ context }, use) => {
    await use(async (workspaces) => {
      const worker = context.serviceWorkers()[0];
      await worker.evaluate((data) => chrome.storage.local.set({ workspaces: data }), workspaces);
    });
  },

  readStorage: async ({ context }, use) => {
    await use(async <T,>(key: string) => {
      const worker = context.serviceWorkers()[0];
      return (await worker.evaluate(async (k) => (await chrome.storage.local.get(k))[k], key)) as T | undefined;
    });
  },
});

export const expect = test.expect;

export interface Look {
  pack: 'default' | 'sakura' | 'space';
  theme: 'light' | 'dark';
  accent?: string;
  decor?: boolean;
}

/** Görünüm ayarlarını (arayüz deposu, localStorage) yazar ve sayfayı yeniden yükler. */
export async function setLook(page: Page, look: Look) {
  await page.evaluate((l) => {
    const raw = JSON.parse(localStorage.getItem('tabflow-ui') ?? '{"state":{},"version":0}');
    Object.assign(raw.state, { accent: 'indigo', decor: true, ...l });
    localStorage.setItem('tabflow-ui', JSON.stringify(raw));
  }, look);
  await page.reload();
  await page.getByRole('heading', { name: 'TabFlow' }).waitFor();
}

/** Testlerde kullanılan küçük klasör/sekme kurucuları. */
export const folder = (id: string, name: string, tabs: { url: string; title: string }[] = [], parentId: string | null = null) => ({
  id,
  name,
  parentId,
  createdAt: 1,
  updatedAt: 1,
  tabs: tabs.map((t, i) => ({ id: `${id}-${i}`, favIconUrl: null, pinned: false, ...t })),
});

/** Erişilebilirlik ve görsel testlerin ortak örnek kitaplığı: iki kök klasör ve bir alt klasör. */
export const SAMPLE_LIBRARY = {
  a: { ...folder('a', 'İş', [{ url: `${SITE}/1`, title: 'Takvim' }, { url: `${SITE}/2`, title: 'Posta' }]), x: 32, y: 32 },
  b: { ...folder('b', 'Okuma', [{ url: `${SITE}/3`, title: 'Blog' }]), x: 320, y: 32, color: 'rose' },
  c: { ...folder('c', 'Proje', [], 'a'), x: 32, y: 32 },
};
