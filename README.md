# Questlist

App de tarefas e projetos colaborativos com gamificação leve, para Android, iOS e web. Escopo em [`ESCOPO.md`](ESCOPO.md) e decisões em [`DECISIONS.md`](DECISIONS.md).

## Rodar localmente

Pré-requisitos: Node 22+, e Docker ou Podman (para o Supabase local).

```bash
npm install
cp .env.example .env.local
npm run db:start     # sobe o Supabase local e aplica as migrações
npm run web          # abre em http://localhost:8081
```

Crie uma conta na própria tela de login (no ambiente local não há confirmação por e-mail). Para ver os e-mails que o Supabase enviaria, abra http://127.0.0.1:54324. O painel do banco (Studio) fica em http://127.0.0.1:54323.

No celular, rode `npm start` e abra pelo app Expo Go. Troque o `127.0.0.1` do `EXPO_PUBLIC_SUPABASE_URL` no `.env.local` pelo IP da sua máquina na rede.

## Testes

```bash
npm run lint && npm run typecheck && npm test   # lint, tipos e testes de unidade (Jest)
npm run db:test                                 # RLS e regras do banco (pgTAP)
npm run e2e                                     # fluxos na web, celular e desktop (Playwright)
```
