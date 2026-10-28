import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, setLook, test } from './fixtures';
import { allTabs, LANGS, library, SHOTS, TEXT, visitSites, type Lang } from './sample-library';

/**
 * Chrome Web Store görselleri (docs/store/<dil>/): 1280×800 ekran görüntüleri, 440×280 küçük tanıtım
 * kutucuğu ve 1400×560 geniş tanıtım görseli. `npm run screenshots` ile README görüntüleriyle birlikte üretilir.
 * Mağaza saydamlık kanalı olan PNG'leri reddedebildiği için hepsi JPEG'dir.
 */
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'store');
const ROOT = path.resolve(import.meta.dirname, '..');

const dataUrl = (buf: Buffer, type: string) => `data:${type};base64,${buf.toString('base64')}`;
const font = (file: string) =>
  dataUrl(readFileSync(path.join(ROOT, 'node_modules/@fontsource-variable/inter/files', file)), 'font/woff2');
const ICON = dataUrl(readFileSync(path.join(ROOT, 'public/icons/icon-128.png')), 'image/png');

const BASE_CSS = `
  @font-face { font-family: Inter; font-weight: 100 900; src: url(${font('inter-latin-wght-normal.woff2')}) format('woff2'); }
  @font-face { font-family: Inter; font-weight: 100 900; src: url(${font('inter-latin-ext-wght-normal.woff2')}) format('woff2');
    unicode-range: U+0100-024F, U+1E00-1EFF; }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { font-family: Inter, sans-serif; color: #fff; overflow: hidden;
    background: radial-gradient(120% 140% at 0% 0%, #6366f1 0%, #4338ca 45%, #1e1b4b 100%); }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand img { border-radius: 22%; box-shadow: 0 12px 30px rgb(0 0 0 / 0.25); }
  h1 { font-weight: 750; letter-spacing: -0.02em; }
  p { color: rgb(255 255 255 / 0.85); line-height: 1.35; }
  .shot { border-radius: 14px; box-shadow: 0 30px 70px rgb(0 0 0 / 0.45); display: block; }
`;

const COPY: Record<Lang, { tagline: string; popupTitle: string; popupText: string; backup: string }> = {
  en: {
    tagline: 'Save tabs into folders. Restore them in seconds.',
    popupTitle: 'Save every open tab in one click',
    popupText: 'Search your folders, then reopen them in this window, as a tab group or in a new window.',
    backup: 'Backup',
  },
  tr: {
    tagline: 'Sekmeleri klasörlere kaydet. Saniyeler içinde geri aç.',
    popupTitle: 'Tüm sekmeleri tek tıkla kaydet',
    popupText: 'Klasörlerinde ara; bu pencerede, sekme grubu olarak ya da yeni pencerede geri aç.',
    backup: 'Yedek',
  },
};

/** Verilen HTML'i belirtilen boyutta çizip JPEG olarak kaydeder. */
async function compose(page: Page, size: { width: number; height: number }, body: string, file: string) {
  await page.setViewportSize(size);
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${BASE_CSS}</style><body>${body}</body>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

for (const lang of LANGS) {
  test(`mağaza görselleri: ${lang}`, async ({ context, openApp, openPopup, seed }) => {
    test.setTimeout(120_000);
    const t = TEXT[lang];
    const copy = COPY[lang];
    const lib = library(lang);
    await visitSites(context, allTabs(lib));
    const out = (name: string) => path.join(OUT, lang, `${name}.jpg`);
    const shoot = (page: Page, name: string) =>
      page.screenshot({ path: out(name), type: 'jpeg', quality: 92, animations: 'disabled', caret: 'hide' });

    const app = await openApp();
    await app.setViewportSize({ width: 1280, height: 800 });
    await seed(lib);
    const show = async (look: Parameters<typeof setLook>[1]) => {
      await setLook(app, { language: lang, ...look });
      await app.getByRole('treeitem', { name: new RegExp(t.dev) }).click();
      await expect(app.getByRole('group', { name: t.folderLabel(t.research) })).toBeVisible();
      await app.waitForTimeout(500);
    };

    // 1-2: tema paketleri
    await show(SHOTS[0]);
    await shoot(app, 'screenshot-1');
    await show(SHOTS[1]);
    const hero = await app.screenshot({ animations: 'disabled', caret: 'hide' }); // geniş tanıtım görseli için
    await shoot(app, 'screenshot-2');

    // 3: komut paleti
    await show({ pack: 'default', theme: 'dark', accent: 'emerald' });
    await app.keyboard.press('Control+k');
    await expect(app.getByRole('dialog')).toBeVisible();
    await app.waitForTimeout(300);
    await shoot(app, 'screenshot-3');
    await app.keyboard.press('Escape');

    // 4: yedek menüsü
    await show({ pack: 'default', theme: 'light' });
    await app.getByRole('button', { name: copy.backup, exact: true }).click();
    await expect(app.getByRole('menu')).toBeVisible();
    await app.waitForTimeout(300);
    await shoot(app, 'screenshot-4');

    // 5: popup, açıklamayla birlikte
    const popup = await openPopup();
    await popup.setViewportSize({ width: 380, height: 560 });
    await setLook(popup, { language: lang, ...SHOTS[0] });
    await expect(popup.getByText(t.reading)).toBeVisible();
    await popup.waitForTimeout(300);
    const popupPng = await popup.screenshot({ animations: 'disabled', caret: 'hide' });

    const canvas = await context.newPage();
    await compose(
      canvas,
      { width: 1280, height: 800 },
      `<div style="display:flex;align-items:center;gap:90px;height:100%;padding:0 110px">
        <div style="flex:1">
          <div class="brand" style="margin-bottom:40px"><img src="${ICON}" width="72"><h1 style="font-size:40px">TabFlow</h1></div>
          <h1 style="font-size:46px;line-height:1.12;margin-bottom:22px">${copy.popupTitle}</h1>
          <p style="font-size:24px">${copy.popupText}</p>
        </div>
        <img class="shot" src="${dataUrl(popupPng, 'image/png')}" width="380" height="560">
      </div>`,
      out('screenshot-5'),
    );

    // Küçük tanıtım kutucuğu (440×280)
    await compose(
      canvas,
      { width: 440, height: 280 },
      `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:0 36px">
        <div class="brand" style="margin-bottom:18px"><img src="${ICON}" width="64"><h1 style="font-size:40px">TabFlow</h1></div>
        <p style="font-size:19px;font-weight:500">${copy.tagline}</p>
      </div>`,
      out('promo-small'),
    );

    // Geniş tanıtım görseli (1400×560)
    await compose(
      canvas,
      { width: 1400, height: 560 },
      `<div style="display:flex;align-items:center;height:100%;padding-left:90px">
        <div style="width:440px;flex:none">
          <div class="brand" style="margin-bottom:26px"><img src="${ICON}" width="88"><h1 style="font-size:56px">TabFlow</h1></div>
          <p style="font-size:28px;font-weight:500">${copy.tagline}</p>
        </div>
        <img class="shot" src="${dataUrl(hero, 'image/png')}" width="900"
          style="margin-left:70px;margin-top:150px;border-radius:14px 0 0 0">
      </div>`,
      out('promo-marquee'),
    );
  });
}
