import { expect, type Page, type Response, type TestInfo } from '@playwright/test';

/** Cria uma conta nova e espera a tela Hoje. */
export async function signUp(page: Page, testInfo: TestInfo) {
  const email = `e2e-${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`;
  await page.goto('/');
  await page.getByText('Não tenho conta').click();
  await page.getByPlaceholder('Seu nome').fill('Teste E2E');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('senha-forte-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  // Conta nova abre a introdução (fase6.spec.ts testa ela); aqui, pula
  await page.getByRole('button', { name: 'Pular introdução' }).click();
  // Abre no Início (D69); os testes começam na Hoje
  await expect(page.getByRole('heading', { name: /^Olá/ })).toBeVisible();
  await openTab(page, 'Hoje');
  await expect(page.getByRole('heading', { name: /^Hoje/ })).toBeVisible();
  return email;
}

/** Vai para uma aba: na barra de baixo no celular, nos links da barra lateral no desktop. */
export async function openTab(page: Page, name: string) {
  await page
    .getByRole('tab', { name })
    .or(page.getByRole('navigation').getByRole('link', { name: new RegExp(`^(\\S+ )?${name}$`) }))
    .click();
}

/** Simula colar texto no campo focado (o Playwright não tem área de transferência no headless). */
export async function paste(page: Page, text: string) {
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData('text', value);
    document.activeElement?.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

// Chave secreta do Supabase local, só para simular o tempo passando nos testes. Vem do
// `supabase status` pelo scripts/e2e.mjs (npm run e2e); não fica no repositório.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SECRET_KEY = process.env.E2E_SUPABASE_SECRET_KEY ?? '';
if (!SECRET_KEY)
  throw new Error('Rode os E2E com "npm run e2e" (ele lê a chave do Supabase local).');

/** Faz as marcações da página parecerem de um ciclo passado (ex.: a semana anterior). */
export async function ageCycle(pageId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?page_id=eq.${pageId}&status=eq.done`, {
    method: 'PATCH',
    headers: {
      apikey: SECRET_KEY,
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ done_cycle_key: '2000-W01' }),
  });
  if (!res.ok) throw new Error(`ageCycle: ${res.status} ${await res.text()}`);
}

/** Cria pasta + página pela aba Pastas e espera a página abrir. Devolve o id da página (da URL). */
export async function createPage(
  page: Page,
  { folder, name, type }: { folder: string; name: string; type: 'Lista' | 'Cards' | 'Hábitos' },
) {
  await openTab(page, 'Pastas');
  await page.getByRole('button', { name: 'Nova pasta' }).last().click();
  await page.getByPlaceholder('Nome (ex.: Academia)').fill(folder);
  await page.getByRole('button', { name: 'Salvar' }).click();
  // A pasta nova abre sozinha
  await expect(page.getByRole('heading', { name: folder })).toBeVisible();
  await page.getByRole('button', { name: 'Criar a primeira página' }).click();
  await page.getByPlaceholder('Nome (ex.: Treino A)').fill(name);
  await page.getByRole('radio', { name: new RegExp(type) }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^(\\S+ )?${name}$`) })).toBeVisible();
  return new URL(page.url()).pathname.split('/').pop()!;
}

/**
 * Texto na tela atual. As abas inativas continuam montadas atrás da ativa (com aria-hidden),
 * e o getByText do Playwright as conta; isto filtra só o que está na aba visível.
 */
export function shown(page: Page, text: string | RegExp, options?: { exact?: boolean }) {
  return page.getByText(text, options).and(page.locator(':not([aria-hidden="true"] *)'));
}

/** Faz a tarefa parecer criada há 1 hora (senão concluir na hora é "relâmpago" e vale 0 XP). */
export async function ageTask(title: string) {
  const createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?title=eq.${encodeURIComponent(title)}`, {
    method: 'PATCH',
    headers: {
      apikey: SECRET_KEY,
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ created_at: createdAt }),
  });
  if (!res.ok) throw new Error(`ageTask: ${res.status} ${await res.text()}`);
}

/** Chamada à API REST do Supabase local como administrador (ignora a RLS). */
export async function adminRest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SECRET_KEY,
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`adminRest ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Resposta OK de uma RPC, chamada direto ou pela fila do sync (que manda as ações pelo
 * `run_once`, com o nome da ação no corpo).
 */
export function isRpc(response: Response, name: string) {
  if (!response.ok()) return false;
  const url = response.url();
  if (url.includes(`/rpc/${name}`)) return true;
  if (!url.includes('/rpc/run_once')) return false;
  try {
    return JSON.parse(response.request().postData() ?? '{}').p_name === name;
  } catch {
    return false;
  }
}

/** Espera a fila do sync esvaziar e o download parar (sem sync configurado, volta na hora). */
export async function waitForSync(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db = (window as unknown as { questlistDb?: any }).questlistDb;
          if (!db) return true;
          const { n } = await db.get('select count(*) as n from ps_crud');
          return n === 0 && !db.currentStatus.dataFlowStatus.downloading;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
}
