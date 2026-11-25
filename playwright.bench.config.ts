import { defineConfig } from '@playwright/test';

import base from './playwright.config';

// Bancada do editor (ED0/ED5, ESCOPO_V16): npm run bench:editor. Só o perfil desktop, um por vez,
// para os números não brigarem entre si. Resultado no console (BENCH ...) e em docs/DESEMPENHO_EDITOR.md.
export default defineConfig({
  ...base,
  testDir: './e2e-bench',
  workers: 1,
  retries: 0,
  projects: (base.projects ?? []).filter((p) => p.name === 'desktop'),
});
