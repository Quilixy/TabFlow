import path from 'node:path';
import { expect, setLook, test } from './fixtures';
import { allTabs, LANGS, library, SHOTS, TEXT, visitSites } from './sample-library';

/**
 * README ekran görüntüleri (docs/screenshots/<dil>/). Test değildir; `npm run screenshots` ile ayrı bir
 * yapılandırmadan çalışır ve normal e2e koşusuna katılmaz. Her dil için arayüz ve örnek klasörler o dilde.
 */
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'screenshots');

for (const lang of LANGS) {
  test(`README ekran görüntüleri: ${lang}`, async ({ context, openApp, openPopup, seed }) => {
    test.setTimeout(120_000);
    const t = TEXT[lang];
    const lib = library(lang);
    await visitSites(context, allTabs(lib));
    const out = (name: string) => path.join(OUT, lang, `${name}.png`);

    const app = await openApp();
    await app.setViewportSize({ width: 1440, height: 900 });
    await seed(lib);
    for (const shot of SHOTS) {
      await setLook(app, { language: lang, ...shot });
      await app.getByRole('treeitem', { name: new RegExp(t.dev) }).click();
      await expect(app.getByRole('group', { name: t.folderLabel(t.research) })).toBeVisible();
      await app.waitForTimeout(500); // simgeler ve süsler
      await app.screenshot({ path: out(`app-${shot.name}`), animations: 'disabled', caret: 'hide' });
    }

    const popup = await openPopup();
    await popup.setViewportSize({ width: 380, height: 560 });
    for (const shot of [SHOTS[0], SHOTS[2]]) {
      await setLook(popup, { language: lang, ...shot });
      await expect(popup.getByText(t.reading)).toBeVisible();
      await popup.waitForTimeout(300);
      await popup.screenshot({ path: out(`popup-${shot.name}`), animations: 'disabled', caret: 'hide' });
    }
  });
}
