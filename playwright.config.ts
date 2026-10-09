import { defineConfig, devices } from '@playwright/test';

// E2E da web: exporta a SPA e serve na 8081 (precisa do Supabase local rodando: npm run db:start)
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:8081', trace: 'retain-on-failure' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // serve --single: rotas da SPA (/inbox, /page/...) caem no index.html, como a hospedagem real precisa fazer
    command: 'npx expo export --platform web && npx serve --single --no-clipboard --listen 8081 dist',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
