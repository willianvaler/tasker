import { defineConfig, devices } from '@playwright/test';

// Confere a versão publicada (npm run deploy) com o teste do sync, sem subir servidor:
//   BASE=https://questlist.wavdev.org npm run e2e -- -c playwright.remoto.config.ts
export default defineConfig({
  testDir: './e2e',
  testMatch: 'sync.spec.ts',
  use: { baseURL: process.env.BASE ?? 'http://localhost:8081', locale: 'pt-BR' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
});
