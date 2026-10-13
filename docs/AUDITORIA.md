# Auditoria do repositório (13/10/2026)

Retrato do código antes da V2/V3, pedido no `ESCOPO_V2.md` §0. Plano em `docs/CRONOGRAMA.md`.

## Stack real

- **App:** Expo SDK 57 + Expo Router (Android, iOS e web num código só; web é SPA), React 19 com React Compiler, TypeScript estrito, ~14 mil linhas em `src/`.
- **Estilo:** NativeWind 4 (Tailwind 3). Cores do tema em variáveis CSS (`src/global.css`), claro/escuro por classe (D55).
- **Dados:** Supabase local (Postgres, Auth, RLS, Realtime, pg_cron, pg_net, Edge Function de push). 11 migrações, 25 tabelas, lógica sensível em funções `security definer`.
- **Cliente:** TanStack Query com cache persistido e fila offline de mutações de tarefa (D52); zod nas respostas.
- **Testes:** Jest (183 testes em 12 suítes, funções puras e espelhos do banco), pgTAP (302 testes em 10 arquivos), Playwright na web em perfis celular e desktop (31 testes, `e2e/fase1..7`). CI no GitHub Actions roda os três.

## O que já existe do ESCOPO (v1)

Fases 0 a 6 completas e Fase 7 (RPG leve, telas largas, Início e Hábitos), ver `DECISIONS.md` D1–D70: captura rápida com sintaxe e lote, páginas lista/cards/hábitos/kanban, ciclos e recorrência no servidor, gamificação inteira (XP, sequência, conquistas, bosses solo/clã/projeto, classes, ouro, loja), projetos compartilhados com convite por link, papéis owner/editor/viewer, responsáveis, comentários, atividade, notificações in-app e push, modelos, exportar/excluir conta, onboarding. O que falta da v1 depende do dono (lojas, EAS, nome, domínio): `PUBLICACAO.md`.

## Já existe e a V2/V3 vai adaptar

| Escopo novo | Situação hoje |
|---|---|
| Subtarefas / WBS (V3 §1) | `tasks.parent_task_id` existe; sem limite de profundidade, rollup ou códigos |
| Ordenação (V2 §2.3) | `position double precision`; não é chave em string |
| Offline (V2 §2) | Cache + fila do TanStack Query só para tarefas; o resto fica só leitura sem rede. Não há banco local nem pull por cursor |
| Conclusão como evento (V2 §2.5) | `task_completions` por ciclo já existe |
| Cargos (V2 §4) | 3 papéis fixos por pasta (`folder_role`), checados com `is_folder_member`; não há permissões atômicas, times, nem cargo personalizado |
| Pasta × Projeto (V2 §5) | Projeto = pasta compartilhada; não há `kind` nem marcos |
| Atalhos (V2 §9) | Só `N` e `Ctrl/Cmd+K` (ambos abrem a captura), em `src/app/(app)/_layout.tsx` e `capture.tsx`; não há registro central |
| Minhas tarefas, modelos, kanban | Existem ("Atribuídas a mim", `templates.tsx`, `KanbanBoard`) |
| Timers, pomodoro, dependências, página enviada | Não existem |

## Lacunas da fundação (Fase A)

- **i18n inexistente.** Todo texto é pt-BR fixo nos componentes, nas mensagens de erro, no texto das notificações (`supabase/functions/_shared`) e no parser de datas. A extração toca praticamente todos os arquivos de `src/app` e `src/components`.
- **Sem `can()`.** A regra de permissão está espalhada: policies RLS + `useCanWrite`/`WriteScope` no app (papel mínimo).
- **Sem registro de atalhos nem página de ajuda.**
- **Sem `docs/STATUS.md`** (criado junto com o cronograma).

## Dívidas técnicas relevantes

1. **Consultas sem filtro seletivo** (pendência da D70): "Atribuídas a mim" e, em menor grau, a Hoje fazem a RLS checar tarefas de todo o banco; o custo cresce com o total de tarefas. Resolver antes de ter usuários reais (Fase F, ou antes se o sync mudar essas consultas).
2. **Visual com "cara de IA"** (V2 §12.1): paleta slate + violeta do Tailwind, `rounded-xl/2xl` em 37 lugares, emojis decorativos em ~50 arquivos (inclusive o personagem, desenhado com emojis, D64), fonte do sistema. Substituído na Fase B.
3. **Leitura direta do servidor nas telas** via TanStack Query: a troca para um `LocalStore` (Fase D) vai mexer em todas as consultas de `src/lib/queries/`.
4. **Espelhos app ↔ banco duplicados à mão** (gamificação, personagem, recorrência, nomes): cobertos por testes com os mesmos casos, mas cada regra nova da V3 (estados derivados, profundidade, ciclos) aumenta essa superfície.
5. **E2E dependentes de tempo e aleatoriedade** (relâmpago de 30 s, crítico): já contornados com `ageTask` e regex, mas frágeis.
