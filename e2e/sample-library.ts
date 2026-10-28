import type { BrowserContext } from '@playwright/test';
import type { Look } from './fixtures';

/**
 * README ve mağaza görsellerinin ortak örnek kitaplığı (screenshots.spec.ts, store.spec.ts).
 * Örnek sitelerin hiçbirine ağdan gidilmez: adresler yerelde yanıtlanır ve her biri baş harfinden
 * üretilen bir simge döner. Sayfalar bir kez ziyaret edilir ki Chrome'un /_favicon/ önbelleği dolsun.
 */
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
  'en.wikipedia.org': { letter: 'W', color: '#54595d' },
  'news.ycombinator.com': { letter: 'Y', color: '#ff6600' },
  'japan-guide.com': { letter: 'J', color: '#c0392b' },
  'kyoto.travel': { letter: 'K', color: '#8e44ad' },
  'open.spotify.com': { letter: 'S', color: '#1db954' },
  'bandcamp.com': { letter: 'B', color: '#1da0c3' },
};

const icon = ({ letter, color }: { letter: string; color: string }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${color}"/>` +
  `<text x="16" y="22.5" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`;

export type Tab = [url: string, title: string];
export type Lang = 'tr' | 'en';
export const LANGS: Lang[] = ['tr', 'en'];

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

/** Dile göre değişen adlar ve sayfa başlıkları. */
export const TEXT = {
  tr: {
    dev: 'TabFlow geliştirme',
    research: 'Araştırma',
    design: 'Tasarım',
    repo: 'Depo',
    reading: 'Okuma listesi',
    kyoto: 'Seyahat: Kyoto',
    music: 'Çalışırken dinle',
    folderLabel: (name: string) => new RegExp(`${name} klasörü`),
    migrate: "Manifest V3'e geçiş",
    animations: 'Yüksek performanslı CSS animasyonları',
    palettes: 'Trend renk paletleri',
    wiki: [
      ['https://tr.wikipedia.org/wiki/Kiraz_%C3%A7i%C3%A7e%C4%9Fi', 'Kiraz çiçeği – Vikipedi'],
      ['https://tr.wikipedia.org/wiki/Avc%C4%B1_(tak%C4%B1my%C4%B1ld%C4%B1z)', 'Avcı (takımyıldız) – Vikipedi'],
    ] as Tab[],
  },
  en: {
    dev: 'TabFlow development',
    research: 'Research',
    design: 'Design',
    repo: 'Repo',
    reading: 'Reading list',
    kyoto: 'Trip: Kyoto',
    music: 'Focus music',
    folderLabel: (name: string) => new RegExp(`Folder ${name}`),
    migrate: 'Migrate to Manifest V3',
    animations: 'High-performance CSS animations',
    palettes: 'Trending color palettes',
    wiki: [
      ['https://en.wikipedia.org/wiki/Cherry_blossom', 'Cherry blossom – Wikipedia'],
      ['https://en.wikipedia.org/wiki/Orion_(constellation)', 'Orion (constellation) – Wikipedia'],
    ] as Tab[],
  },
};

export function library(lang: Lang) {
  const t = TEXT[lang];
  return {
    dev: ws('dev', t.dev, null, 32, 32, [
      ['https://developer.chrome.com/docs/extensions/reference/api/tabs', 'chrome.tabs | Chrome for Developers'],
      ['https://developer.chrome.com/docs/extensions/develop/migrate', t.migrate],
      ['https://react.dev/reference/react/useSyncExternalStore', 'useSyncExternalStore – React'],
      ['https://tailwindcss.com/docs/theme', 'Theme variables – Tailwind CSS'],
      ['https://developer.mozilla.org/docs/Web/CSS/backdrop-filter', 'backdrop-filter – CSS | MDN'],
      ['https://playwright.dev/docs/chrome-extensions', 'Chrome extensions | Playwright'],
    ], { icon: 'code', color: 'violet', favorite: true }),
    research: ws('research', t.research, 'dev', 32, 248, [
      ['https://web.dev/articles/animations-guide', t.animations],
      ['https://web.dev/articles/rendering-performance', 'Rendering performance'],
      ['https://css-tricks.com/svg-animation-on-css-transforms', 'SVG animation on CSS transforms'],
    ], { icon: 'science', color: 'sky' }),
    design: ws('design', t.design, 'dev', 304, 248, [
      ['https://fonts.google.com/specimen/Inter', 'Inter – Google Fonts'],
      ['https://coolors.co/palettes/trending', t.palettes],
    ], { icon: 'palette', color: 'rose' }),
    repo: ws('repo', t.repo, 'dev', 576, 248, [
      ['https://github.com/topics/chrome-extension', 'chrome-extension · GitHub Topics'],
    ], { icon: 'terminal', color: 'gray' }),
    reading: ws('reading', t.reading, null, 320, 32, [...t.wiki, ['https://news.ycombinator.com/', 'Hacker News']], {
      icon: 'book',
      color: 'amber',
    }),
    kyoto: ws('kyoto', t.kyoto, null, 608, 32, [
      ['https://www.japan-guide.com/e/e3900.html', 'Kyoto Travel Guide'],
      ['https://kyoto.travel/en/', 'Kyoto City Official Travel Guide'],
    ], { icon: 'plane', color: 'emerald' }),
    music: ws('music', t.music, null, 32, 248, [
      ['https://open.spotify.com/genre/focus', 'Focus – Spotify'],
      ['https://bandcamp.com/discover/ambient', 'Ambient – Bandcamp'],
    ], { icon: 'music', color: 'red' }),
  };
}

/** Sağ paneldeki "Açık sekmeler" listesinde görünecek sayfalar (kitaplıktaki sırayla). */
const OPEN_TABS = ['github.com/topics', 'reference/api/tabs', 'useSyncExternalStore', 'wikipedia.org/wiki/', 'open.spotify.com'];

export const SHOTS: (Look & { name: string })[] = [
  { name: 'sakura-light', pack: 'sakura', theme: 'light' },
  { name: 'space-dark', pack: 'space', theme: 'dark' },
  { name: 'default-light', pack: 'default', theme: 'light' },
];

/** Adresleri yerelde yanıtlar; her sayfayı bir kez ziyaret eder (simge önbelleği), OPEN_TABS'ı açık bırakır. */
export async function visitSites(context: BrowserContext, all: Tab[]) {
  const host = (url: URL) => url.hostname.replace(/^www\./, '');
  await context.route(
    (url) => host(url) in SITES,
    (route) => {
      const url = new URL(route.request().url());
      const title = all.find(([u]) => u === url.href)?.[1] ?? url.hostname;
      const href = `data:image/svg+xml,${encodeURIComponent(icon(SITES[host(url)]))}`;
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><title>${title}</title><link rel="icon" href="${href}"><h1>${title}</h1>`,
      });
    },
  );
  const open = new Set(OPEN_TABS.map((part) => all.find(([u]) => u.includes(part))![0]));
  for (const [url] of all) {
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForTimeout(150); // simgenin önbelleğe yazılması
    if (!open.has(url)) await page.close();
  }
}

/** Kitaplıktaki tüm sekmeler, visitSites için. */
export const allTabs = (lib: ReturnType<typeof library>) =>
  Object.values(lib).flatMap((w) => w.tabs.map((x) => [x.url, x.title] as Tab));
