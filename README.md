# Questlist

App de tarefas e projetos colaborativos com gamificação leve, para Android, iOS e web com um único código (Expo + Supabase). Escopo em [`ESCOPO.md`](ESCOPO.md), decisões em [`DECISIONS.md`](DECISIONS.md) e como publicar em [`PUBLICACAO.md`](PUBLICACAO.md).

## O que tem

- **Captura rápida**: digite e Enter; data, prioridade, etiqueta e repetição saem do texto. Colar uma lista cria várias.
- **Pastas e páginas**: lista, cards (treino), hábitos com sequência, kanban. Reset por ciclo, recorrência, arrastar para reordenar.
- **Projetos**: convite por link, papéis, `@nome` (mesmo antes da pessoa entrar), comentários, atividade, notificações, tempo real, modelos (Churrasco, Viagem...).
- **Gamificação** (desligável): XP com anti-farm, níveis, sequência com congelamento, conquistas, boss semanal (solo, do clã e do projeto com prazo).
- **Offline**: criar e marcar sem internet; envia ao reconectar.
- **Privacidade**: exportar (JSON/CSV) e excluir a conta. Tema claro/escuro/sistema.

## Rodar localmente

Pré-requisitos: Node 22+, e Docker ou Podman (para o Supabase local).

```bash
npm install
cp .env.example .env.local
npm run db:start     # sobe o Supabase local e aplica as migrações
npm run web          # abre em http://localhost:8081
```

Crie uma conta na própria tela de login (no ambiente local não há confirmação por e-mail). Para ver os e-mails que o Supabase enviaria, abra http://127.0.0.1:54324. O painel do banco (Studio) fica em http://127.0.0.1:54323.

No celular, rode `npm start` e abra pelo app Expo Go. Troque o `127.0.0.1` do `EXPO_PUBLIC_SUPABASE_URL` no `.env.local` pelo IP da sua máquina na rede. Para testar notificações push, use um development build (veja [`PUBLICACAO.md`](PUBLICACAO.md)).

## Testes

```bash
npm run lint && npm run typecheck && npm test   # lint, tipos e testes de unidade (Jest)
npm run db:test                                 # RLS e regras do banco (pgTAP)
npm run e2e                                     # fluxos na web, celular e desktop (Playwright; lê a chave do Supabase local)
```
