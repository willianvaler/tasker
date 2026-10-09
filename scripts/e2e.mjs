// Roda o Playwright com a chave secreta do Supabase LOCAL, lida na hora do `supabase status`.
// A chave não fica no repositório (o GitHub bloqueia segredos no push). Os testes usam essa chave
// só para simular o tempo passando (ageCycle, ageTask). Argumentos vão direto para o Playwright:
//   npm run e2e -- e2e/fase4.spec.ts --project=desktop
import { execSync, spawnSync } from 'node:child_process';

let key = process.env.E2E_SUPABASE_SECRET_KEY;
if (!key) {
  try {
    const status = JSON.parse(
      execSync('npx supabase status -o json', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    key = status.SECRET_KEY;
  } catch {
    console.error(
      'Não deu para ler a chave do Supabase local. Ele está rodando? (npm run db:start)',
    );
    process.exit(1);
  }
}

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, E2E_SUPABASE_SECRET_KEY: key },
});
process.exit(result.status ?? 1);
