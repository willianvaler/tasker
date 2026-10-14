import { defineConfig, devices } from '@playwright/test';

// E2E da web: exporta a SPA e serve na 8082 (precisa do Supabase local rodando: npm run db:start)
export default defineConfig({
  testDir: './e2e',
  // Cada página roda o SQLite do sync em WASM; com mais workers, envios e sync passam do tempo
  workers: 4,
  // No CI, cada falha vira anotação no GitHub (os logs completos pedem login)
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // Uma nova tentativa: com a máquina carregada, arrastar e esperas de sync às vezes estouram o
  // tempo. O relatório marca como "flaky" o que só passou na segunda
  retries: 1,
  // locale: o app segue o idioma do navegador (V2 §11); o padrão do Playwright é en-US
  use: { baseURL: 'http://localhost:8082', trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // --clear: o Metro guarda os EXPO_PUBLIC_* já embutidos no cache, e o deploy usa outros valores
    // serve --single: rotas da SPA (/inbox, /page/...) caem no index.html, como a hospedagem real precisa fazer
    command: 'EXPO_PUBLIC_WEB_URL=http://localhost:8082 npx expo export --platform web --clear && npx serve --single --no-clipboard --listen 8082 dist',
    url: 'http://localhost:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
