import { defineConfig } from '@playwright/test';

import base from './playwright.config';

// Capturas das telas-chave para revisão visual (V3 §0.1): npm run capturas.
// Salva em docs/screenshots/<tela>-<celular|desktop>-<claro|escuro>.png.
export default defineConfig({
  ...base,
  testDir: './e2e-capturas',
  workers: 1,
});
