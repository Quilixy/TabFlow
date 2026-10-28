import { defineConfig } from '@playwright/test';

// README ekran görüntüleri (docs/screenshots/) ve mağaza görselleri (docs/store/): npm run screenshots
export default defineConfig({
  testDir: './e2e',
  testMatch: ['screenshots.spec.ts', 'store.spec.ts'],
  workers: 1,
  reporter: 'list',
});
