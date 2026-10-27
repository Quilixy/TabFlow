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
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await context.route(`${SITE}/**`, (route) => {
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
      const url = new URL(pathname, SITE);
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

/** Testlerde kullanılan küçük klasör/sekme kurucuları. */
export const folder = (id: string, name: string, tabs: { url: string; title: string }[] = [], parentId: string | null = null) => ({
  id,
  name,
  parentId,
  createdAt: 1,
  updatedAt: 1,
  tabs: tabs.map((t, i) => ({ id: `${id}-${i}`, favIconUrl: null, pinned: false, ...t })),
});
