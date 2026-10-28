import path from 'node:path';
import { expect, setLook, test, type Look } from './fixtures';

/**
 * README ekran görüntüleri (docs/screenshots/). Test değildir; `npm run screenshots` ile ayrı bir
 * yapılandırmadan çalışır ve normal e2e koşusuna katılmaz.
 *
 * Örnek sitelerin hiçbirine ağdan gidilmez: adresler yerelde yanıtlanır ve her biri baş harfinden
 * üretilen bir simge döner. Sayfalar bir kez ziyaret edilir ki Chrome'un /_favicon/ önbelleği dolsun.
 */
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'screenshots');

const SITES: Record<string, { letter: string; color: string }> = {
  'github.com': { letter: 'G', color: '#24292f' },
  'developer.chrome.com': { letter: 'C', color: '#1a73e8' },
  'developer.mozilla.org': { letter: 'M', color: '#1b1b1b' },
  'react.dev': { letter: 'R', color: '#087ea4' },
  'tailwindcss.com': { letter: 'T', color: '#0ea5e9' },
  'playwright.dev': { letter: 'P', color: '#2ead33' },
  'web.dev': { letter: 'W', color: '#3740ff' },
  'css-tricks.com': { letter: '*', color: '#e8590c' },
  'fonts.google.com': { letter: 'F', color: '#4285f4' },
  'coolors.co': { letter: 'C', color: '#0066ff' },
  'tr.wikipedia.org': { letter: 'W', color: '#54595d' },
  'news.ycombinator.com': { letter: 'Y', color: '#ff6600' },
  'japan-guide.com': { letter: 'J', color: '#c0392b' },
  'kyoto.travel': { letter: 'K', color: '#8e44ad' },
  'open.spotify.com': { letter: 'S', color: '#1db954' },
  'bandcamp.com': { letter: 'B', color: '#1da0c3' },
};

const icon = ({ letter, color }: { letter: string; color: string }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${color}"/>` +
  `<text x="16" y="22.5" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`;

type Tab = [url: string, title: string];

const tabs = (id: string, list: Tab[], cols = 3) =>
  list.map(([url, title], i) => ({
    id: `${id}-${i}`,
    url,
    title,
    favIconUrl: null,
    pinned: false,
    x: 32 + (i % cols) * 272,
    y: 32 + Math.floor(i / cols) * 104,
  }));

const ws = (id: string, name: string, parentId: string | null, x: number, y: number, list: Tab[], extra = {}) => ({
  id,
  name,
  parentId,
  createdAt: 1,
  updatedAt: 1,
  x,
  y,
  tabs: tabs(id, list),
  ...extra,
});

const DEV: Tab[] = [
  ['https://developer.chrome.com/docs/extensions/reference/api/tabs', 'chrome.tabs | Chrome for Developers'],
  ['https://developer.chrome.com/docs/extensions/develop/migrate', "Manifest V3'e geçiş"],
  ['https://react.dev/reference/react/useSyncExternalStore', 'useSyncExternalStore – React'],
  ['https://tailwindcss.com/docs/theme', 'Theme variables – Tailwind CSS'],
  ['https://developer.mozilla.org/docs/Web/CSS/backdrop-filter', 'backdrop-filter – CSS | MDN'],
  ['https://playwright.dev/docs/chrome-extensions', 'Chrome extensions | Playwright'],
];

const LIBRARY = {
  dev: ws('dev', 'TabFlow geliştirme', null, 32, 32, DEV, { icon: 'code', color: 'violet', favorite: true }),
  research: ws('research', 'Araştırma', 'dev', 32, 248, [
    ['https://web.dev/articles/animations-guide', 'Yüksek performanslı CSS animasyonları'],
    ['https://web.dev/articles/rendering-performance', 'Rendering performance'],
    ['https://css-tricks.com/svg-animation-on-css-transforms', 'SVG animation on CSS transforms'],
  ], { icon: 'science', color: 'sky' }),
  design: ws('design', 'Tasarım', 'dev', 304, 248, [
    ['https://fonts.google.com/specimen/Inter', 'Inter – Google Fonts'],
    ['https://coolors.co/palettes/trending', 'Trend renk paletleri'],
  ], { icon: 'palette', color: 'rose' }),
  repo: ws('repo', 'Depo', 'dev', 576, 248, [
    ['https://github.com/topics/chrome-extension', 'chrome-extension · GitHub Topics'],
  ], { icon: 'terminal', color: 'gray' }),
  reading: ws('reading', 'Okuma listesi', null, 320, 32, [
    ['https://tr.wikipedia.org/wiki/Kiraz_%C3%A7i%C3%A7e%C4%9Fi', 'Kiraz çiçeği – Vikipedi'],
    ['https://tr.wikipedia.org/wiki/Avc%C4%B1_(tak%C4%B1my%C4%B1ld%C4%B1z)', 'Avcı (takımyıldız) – Vikipedi'],
    ['https://news.ycombinator.com/', 'Hacker News'],
  ], { icon: 'book', color: 'amber' }),
  kyoto: ws('kyoto', 'Seyahat: Kyoto', null, 608, 32, [
    ['https://www.japan-guide.com/e/e3900.html', 'Kyoto Travel Guide'],
    ['https://kyoto.travel/en/', 'Kyoto City Official Travel Guide'],
  ], { icon: 'plane', color: 'emerald' }),
  music: ws('music', 'Çalışırken dinle', null, 32, 248, [
    ['https://open.spotify.com/genre/focus', 'Focus – Spotify'],
    ['https://bandcamp.com/discover/ambient', 'Ambient – Bandcamp'],
  ], { icon: 'music', color: 'red' }),
};

/** Sağ paneldeki "Açık sekmeler" listesinde görünecek sayfalar. */
const OPEN_TABS = [
  'https://github.com/topics/chrome-extension',
  'https://developer.chrome.com/docs/extensions/reference/api/tabs',
  'https://react.dev/reference/react/useSyncExternalStore',
  'https://tr.wikipedia.org/wiki/Kiraz_%C3%A7i%C3%A7e%C4%9Fi',
  'https://open.spotify.com/genre/focus',
];

const ALL_TABS = Object.values(LIBRARY).flatMap((w) => w.tabs.map((t) => [t.url, t.title] as Tab));

const SHOTS: (Look & { name: string })[] = [
  { name: 'sakura-light', pack: 'sakura', theme: 'light' },
  { name: 'space-dark', pack: 'space', theme: 'dark' },
  { name: 'default-light', pack: 'default', theme: 'light' },
];

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname.replace(/^www\./, '') in SITES,
    (route) => {
      const url = new URL(route.request().url());
      const site = SITES[url.hostname.replace(/^www\./, '')];
      const title = ALL_TABS.find(([u]) => u === url.href)?.[1] ?? url.hostname;
      const href = `data:image/svg+xml,${encodeURIComponent(icon(site))}`;
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><title>${title}</title><link rel="icon" href="${href}"><h1>${title}</h1>`,
      });
    },
  );
});

/** Her sayfayı ziyaret eder (simge önbelleği), yalnızca OPEN_TABS'ı açık bırakır. */
async function warmFavicons(context: import('@playwright/test').BrowserContext) {
  for (const [url] of ALL_TABS) {
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForTimeout(150); // simgenin önbelleğe yazılması
    if (!OPEN_TABS.includes(url)) await page.close();
  }
}

test('README ekran görüntüleri', async ({ context, openApp, openPopup, seed }) => {
  test.setTimeout(120_000);
  await warmFavicons(context);

  const app = await openApp();
  await app.setViewportSize({ width: 1440, height: 900 });
  await seed(LIBRARY);
  for (const shot of SHOTS) {
    await setLook(app, shot);
    await app.getByRole('treeitem', { name: /TabFlow geliştirme/ }).click();
    await expect(app.getByRole('group', { name: /Araştırma klasörü/ })).toBeVisible();
    await app.waitForTimeout(500); // simgeler ve süsler
    await app.screenshot({ path: path.join(OUT, `app-${shot.name}.png`), animations: 'disabled', caret: 'hide' });
  }

  const popup = await openPopup();
  await popup.setViewportSize({ width: 380, height: 560 });
  for (const shot of [SHOTS[0], SHOTS[2]]) {
    await setLook(popup, shot);
    await expect(popup.getByText('Okuma listesi')).toBeVisible();
    await popup.waitForTimeout(300);
    await popup.screenshot({ path: path.join(OUT, `popup-${shot.name}.png`), animations: 'disabled', caret: 'hide' });
  }
});
