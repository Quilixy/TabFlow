import { defineConfig } from '@playwright/test';

// README ekran görüntüleri (docs/screenshots/): npm run screenshots
export default defineConfig({
  testDir: './e2e',
  testMatch: 'screenshots.spec.ts',
  workers: 1,
  reporter: 'list',
});
