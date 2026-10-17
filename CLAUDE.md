# CLAUDE.md

**Questlist** (nome provisório): app de tarefas e projetos colaborativos com gamificação leve, para Android, iOS e web com um único código. O escopo está em `ESCOPO.md` (v1), `ESCOPO_V2.md`, `ESCOPO_V3.md`, `ESCOPO_V4.md` e `ESCOPO_V5.md` (em conflito, o mais recente vence); as decisões tomadas, em `DECISIONS.md`; o plano da V2/V3, em `docs/CRONOGRAMA.md`, e o andamento, em `docs/STATUS.md`. Leia antes de mudar comportamento.

**Sempre que concluir uma tarefa do cronograma, atualize `docs/STATUS.md` no mesmo commit** (feito / em andamento / pendente / decisões). Um commit por tarefa, em Conventional Commits e pt-BR, com o id no fim: `feat(i18n): infraestrutura [A3]`. Interface, mensagens, comentários e commits em **português (pt-BR)**.

`AGENTS.md` (veio do template do Expo) vale também: **o Expo muda a cada SDK, não confie na memória**. Confira a doc da versão instalada (`https://docs.expo.dev/versions/v57.0.0/`, índice em `https://docs.expo.dev/llms.txt`) antes de usar uma API do Expo/React Native. Instale pacotes com `npx expo install`, não com `npm install`.

## Estado atual

**V2/V3 em andamento:** veja `docs/STATUS.md`. Fases A (fundação: i18n, `can()`, atalhos, decisão de sync D75), B (visual "Caderno de bolso", `docs/DESIGN.md`), C (pasta × projeto, menu Novo, F2, seletor de ícone, atalhos, paleta, criação avançada, `/ajuda`) e D (offline-first com PowerSync: banco no aparelho, fila idempotente, conflitos, lixeira, XP pendente) E (times, cargos no projeto e personalizados, convites, marcos, @nome com autocomplete) G (árvore de subtarefas/WBS com limite de níveis, teclado, estrutura e lote em árvore) H (dependências, estados derivados, iniciar, estrito/flexível, avisos de fluxo, ^ na captura e no lote) e I (histórico `task_events`, abas Lista · Fluxo · Pessoas · Linha do tempo, grafo React Flow + dagre, indicadores, lista que depende de outra, Relacionados) concluídas, D71 a D122. **Fase J** concluída (repetições, timers com fim absoluto, descanso, aviso no celular e na web, Modo Treino, D123 a D128). **Fase K** concluída (pomodoro com sugestões de pausa, cronômetro, registro de tempo, estatísticas e XP limitado, D129 a D132). **Fase L** concluída (página enviada ao vivo/cópia, Executor, progresso por aluno, Recebidas, painel Alunos, D133 a D137). **Fase M** concluída (adiar, eu levo, peso, Meu dia e Próxima ação, campos personalizados, automações, aprovação, D138 a D144). **Fase F** concluída (ajuda em 3 idiomas, "?" contextual, parser e datas em en/es, contraste AA, capturas, D145 a D149). Próximo: ESCOPO_V4. Antes disso, **Fases 0 a 6 concluídas** (todas as do ESCOPO), mais a **Fase 7** (RPG leve e redesign para tela larga, D60 a D67; Início, tela Hábitos e página de hábitos de sistema, D68 a D70). Falta só o que depende do dono do projeto (contas das lojas e do EAS, nome/ícone, domínio, e-mail, teste em aparelho): veja `PUBLICACAO.md`. Barra lateral e telas de pasta em D32; gamificação em D33 a D39; projetos em D40 a D48; clã, bosses cooperativos, fila offline e privacidade em D49 a D53; Fase 6 (kanban, tema, onboarding, acessibilidade/performance, push, publicação) em D54 a D59; Fase 7 (dano separado do XP, classes, atributos, níveis de boss, ouro, loja e drops, hábitos contador e bom/ruim, conquistas, telas largas) em D60 a D67.

## Stack

Expo SDK 57 + Expo Router (rotas em `src/app/`) + TypeScript estrito · NativeWind 4 (Tailwind 3) · Supabase (Postgres, Auth, RLS, Realtime) local via CLI · TanStack Query · zod. Web é SPA (`web.output: "single"`).

## Comandos

```bash
npm run db:start      # Supabase local (Podman/Docker). Studio: http://127.0.0.1:54323 · e-mails: http://127.0.0.1:54324
npm run web           # app na web (http://localhost:8082; a 8081 é do app publicado)
npm start             # Expo dev server (Expo Go / development build no celular)
npm run lint && npm run typecheck && npm test   # rode antes de dar algo por pronto
npm run db:test       # testes pgTAP de RLS (supabase/tests/)
npm run e2e           # Playwright na web, perfis celular e desktop (precisa do db:start). Argumentos: npm run e2e -- e2e/x.spec.ts
npm run db:reset      # recria o banco do zero e APAGA as contas (inclusive as de quem testa pelo endereço remoto). Só com pedido explícito
npm run db:types      # regenera src/lib/database.types.ts depois de mudar o banco
npm run sync:start    # PowerSync local (container, porta 8095; serviço tasker-powersync). Sync no app só com EXPO_PUBLIC_POWERSYNC_URL
npm run deploy        # publica a web para acesso remoto (dist-remote/ + reinicia tasker-web.service)
npm run capturas      # capturas das telas-chave (1280/390, claro/escuro) em docs/screenshots/ (precisa do db:start)
```

Nesta máquina o "Docker" é o **Podman**: o socket precisa estar ativo (`systemctl --user start podman.socket`) e o `DOCKER_HOST` já aponta para ele. O `.env.local` (copiado do `.env.example`) tem as chaves padrão do Supabase local, que não são segredo.

O npm desta máquina (v12) bloqueia scripts de instalação de pacotes sem aprovação (`npm install-scripts ls`). Se um pacote depender de `postinstall` (baixar binário, compilar), aprove com `npm install-scripts approve <pacote>`.

## Acesso remoto (túnel da Cloudflare)

**Desde 17/10/2026 a produção roda no servidor Linux Mint da rede de casa** (`ssh` com chave; projeto em `~/projects/task_tracking`; instalado por `scripts/servidor/instalar.sh`, D177, `docs/SERVIDOR.md`; atualizar: `git pull`, `npm ci` se mudou dependência, `npx supabase migration up` se houver migração, `npm run deploy`). **Este PC é só de desenvolvimento**: banco local vazio com as chaves padrão, sem túnel e sem os serviços `tasker-*`; o PowerSync local sobe à mão (`npm run sync:start`). O que segue descreve o servidor (lá o container é o Docker, não o Podman).

**Ambientes (D178, `docs/AMBIENTES.md`):** produção (tag, https://tasker.wavdev.org), **alpha** no servidor (segue a `main` sozinho a cada 5 min, https://alpha.tasker.wavdev.org) e **lab** neste PC (`npm run lab`, branch `lab` em `../task_tracking-lab`). Push na `main` vai para o alpha; produção só por `npm run promover`. Portas e nomes por pasta vêm de `.ambiente.local` e `supabase/.env.local` (lidos por `scripts/ambiente.sh`); script novo que use porta, container ou serviço deve passar por ele, nunca com número fixo.

`https://tasker.wavdev.org` → túnel `tasker-tunnel.service` (cloudflared em `~/.local/bin`, token em `~/.config/cloudflared/tasker.token`, **nunca no repositório**) → `tasker-web.service` (`scripts/serve.mjs`, porta 8081, a da rota no painel da Cloudflare), que entrega `dist-remote/` e repassa `/supabase/*` (HTTP e websocket) para o Supabase local e `/powersync/*` para o PowerSync. O build remoto usa `EXPO_PUBLIC_SUPABASE_URL=/supabase` (relativo ao endereço do app). Serviços de usuário do systemd com linger: `systemctl --user status tasker-web tasker-tunnel tasker-quick tasker-powersync`. `tasker-quick` dá um endereço `*.trycloudflare.com` provisório (muda a cada reinício; `npm run endereco` mostra o atual). Depois de mudar o app: `npm run deploy`.

## Estrutura

```
src/
  app/                        # Rotas (Expo Router). Só telas e _layout aqui
    _layout.tsx               # Providers (tema, sessão, query, toast) + Stack.Protected
    sign-in.tsx
    (app)/_layout.tsx         # Stack logado + atalho N / Ctrl+K (web) + barra lateral em tela ≥ 768px (fora da pilha)
    (app)/(tabs)/             # Início (index, `/`), Hoje (today), Caixa de entrada (inbox), Hábitos (habits), Pastas (grade de cards),
                              # Perfil, Atribuídas a mim (mine: só para quem está em projeto, sem aba no celular). Abas embaixo no
                              # celular; em tela larga a barra de abas some e quem navega é a barra lateral
    (app)/folder/[id].tsx     # Pasta: páginas, subpastas; em projeto, progresso por pessoa e atividade
    (app)/share/[id].tsx      # Compartilhar: link de convite, pessoas e papéis, nomes pendentes
    (app)/notifications.tsx   # Notificações in-app (abrir marca como lidas)
    (app)/templates.tsx       # Usar modelo (prontos + salvos)
    (app)/clan.tsx            # Clã: criar, boss da semana com destaques, membros, convite, feed, sair
    (app)/character.tsx       # Personagem: classe, atributos, habilidades, conta do dano, boss, equipamento
    (app)/shop.tsx            # Loja (só visual): itens por espaço, comprar com ouro, equipar
    clan-invite/[token].tsx   # Convite do clã, FORA do login (como o de projeto)
    privacidade.tsx           # Política de privacidade, pública (as lojas pedem o endereço)
    (app)/onboarding.tsx      # Introdução em 3 passos (conta nova sem profiles.onboarded_at)
    invite/[token].tsx        # Link de convite, FORA do login: prévia, cria conta, entra, escolhe o nome pendente
    enviada/[token].tsx       # Link de página enviada, FORA do login: recebe e cai na página (D135)
    (app)/page/[id].tsx       # Página (lista, cards ou hábitos) + menu: configurar, duplicar
    (app)/task/[id].tsx       # Detalhes da tarefa (modal): notas, data, prioridade, etiquetas, subtarefas, mover, apagar
    (app)/capture.tsx         # Captura rápida com seletor de página
    (app)/batch.tsx           # Criação em lote com pré-visualização (texto vem do lib/batch-draft.ts)
    (app)/treino/[id].tsx     # Modo Treino (tela cheia): séries, descanso, carga, resumo (D127)
    (app)/pomodoro.tsx        # Pomodoro: durações, sugestões de pausa, estatísticas (D129 a D132)
    (app)/alunos/[id].tsx     # Painel "Alunos" de uma página enviada (D137)
    (app)/automacoes/[id].tsx # Automações "quando… então…" do projeto (D143)
  components/
    ui/                       # Button, Input, Checkbox, Chip, dialogs (PromptDialog, ConfirmDialog, ActionMenu),
                              # ProgressBar, Grid (colunas pela largura da janela)
    screen.tsx                # Screen: size narrow (formulários) | medium (listas) | wide (painéis e grades), D67
    character.tsx             # Avatar, HeroCard, ClassPicker, AttributesPanel, SkillsPanel, DamagePanel, EquipmentPanel
    theme-toggle.tsx          # Atalho claro/escuro (barra lateral e topo da Hoje/Início no celular)
    hero-panel.tsx            # HeroPanel: personagem, habilidade do dia e bosses (coluna direita da Hoje e do Início)
    page-dialog.tsx           # Criar/configurar página: tipo (lista/cards/hábitos) e reinício dos checks
    sidebar.tsx               # Barra lateral (useIsWide, WIDE = 768): atalhos, + pasta, árvore recolhível
    folder-actions.tsx        # useFolderActions: diálogos de criar/renomear/apagar pasta e página
    folder-cards.tsx          # FolderCard, PageTile, MenuButton, folderLabel
    game-bar.tsx              # GameHeader (topo da Hoje no celular), BossLine, SidebarGame
    game-profile.tsx          # Perfil: liga/desliga, nível, sequência, boss, conquistas
    project-overview.tsx      # Progresso do projeto (geral e por pessoa), boss do projeto e atividade
    project-boss.tsx          # Boss de projeto com prazo: chamar, barra, destaques, desistir
    boss-board.tsx            # Quadro de contribuição (só destaques, sem último lugar)
    privacy-section.tsx       # Perfil: exportar (JSON/CSV) e excluir conta
    push-setting.tsx          # Perfil: avisos no celular (push); na web, explica o 🔔
    notifications-bell.tsx    # Sino com contador (Hoje) e Badge
    sign-in-form.tsx          # Formulário de entrar/criar conta (login e convite)
    tasks/                    # PageView (escolhe a visão pelo tipo), TaskRow (+ useToggleWithUndo), TaskCard, KanbanBoard,
                              # assignee-chips (AssigneeChips, MentionChips), task-collab (AssigneesEditor, Comments),
                              # HabitRow (+ useHabitDates, useHabitTickWithToast: + e − do contador e do bom/ruim),
                              # SortableTasks/DragHandle, TaskMeta, QuickAdd,
                              # task-extras (RecurrenceEditor, MetaEditor, HabitHistory, HabitKindEditor)
  lib/
    parser/                   # quick.ts (sintaxe rápida), batch.ts (lote), dates.ts. Funções puras, com testes
    queries/                  # Hooks do TanStack Query: profile (useToday), tree (pastas/páginas), tasks, game (useGameState),
                              # projects (membros, papéis, convites, responsáveis, comentários, atividade, notificações, modelos),
                              # mentions (useMentions: @nome da página → responsáveis),
                              # clan (clã, convite, boss de projeto, quadro, exportar/excluir)
    members.ts                # nameKey/memberMatches/resolveMention (espelho do banco), toAssignees, initials
    progress.ts, activity.ts, notifications.ts, templates.ts, board.ts, export.ts   # funções puras, com testes
    download(.web).ts         # saveTextFile: baixa no navegador; no celular grava e abre o Compartilhar
    push(.web).ts             # registro do aparelho para push e toque no aviso; na web, nada
    gamification.config.ts    # Valores de XP/anti-farm/nível/boss/dano/ouro/atributos/classes (espelho de public.xp_rules(), teste compara)
    character.ts              # Classes, atributos, hitDamage/healAmount/goldFor/bossHpForLevel (espelho do banco), itens
    gamification.ts           # levelFromXp/xpToNext (espelho do banco), rewardMessage
    recurrence.ts             # nextDueDate (espelho do banco), habitStreak, rótulos de recorrência
    positions.ts              # positionAfterMove (arrastar)
    supabase.ts, storage(.web).ts, db.ts, database.types.ts (GERADO), prefs.ts, batch-draft.ts
  providers/                  # session, query (cache persistido + clearQueryCache), online (useIsOnline), toast,
                              # write (useCanWrite/WriteScope: conexão + papel), realtime (useRealtimeSync),
                              # theme (Sistema/Claro/Escuro, D55)
  global.css
supabase/
  migrations/                 # 1: base + RLS · 2: Fase 1 (due_date, labels, complete/uncomplete, create_tasks_batch)
                              # 3: Fase 2 (task_completions, ciclos, refresh_cycles + pg_cron, recorrência, duplicate_page, reset_page)
                              # 4: Fase 3 (xp_events, bosses, boss_damage, achievements, game_state, XP em complete/uncomplete)
                              # 5: Fase 4 (invites, task_assignees, comments, activity_log, notifications, user_templates, Realtime)
                              # 6: Fase 5 (clans, clan_members/invites/activity, boss de clã e de projeto, boss_board,
                              #    export_my_data, delete_my_account)
                              # 7-9: Fase 6 (set_task_status do kanban, onboarded_at, push_tokens + app_config + pg_net)
                              # 10: Fase 7 (classe/atributos, dano/ouro no ledger, níveis de boss, items/user_items, habit_tick)
  functions/                  # Edge Functions (Deno): push/ e _shared/ (texto das notificações, usado também pelo app)
  tests/                      # pgTAP (*.test.sql)
e2e/                          # Playwright (helpers.ts: signUp, openTab, paste, shown, createPage, ageCycle, ageTask)
```

## Peças da V2 (Fases A a C)

- `src/i18n/` (i18next; chaves tipadas pelo `pt-BR.json`), `lib/permissions.ts` (`can()`), `lib/tokens.ts` (cores, durações, medidas), `lib/fonts.ts`.
- `lib/shortcuts.ts` (registro) + `lib/use-shortcut.ts`; os atalhos de lista e globais são tratados em `components/list-keys.tsx`; a seleção da lista mora em `lib/selection.ts` (store com assinatura por linha) e as telas registram a ordem com `useSelectableList`.
- `components/new-menu.tsx` (menu Novo), `components/command-palette.tsx` (Ctrl+K), `components/icon-picker.tsx` + `lib/icon-names.ts`/`lib/icons.ts` (ícones `lucide:id`), `components/item-icon.tsx`, `components/ui/*` (Button/IconButton, Checkbox/StampBox, Sheet, Popover/MenuItem, SectionLabel, EmptyState, Avatar/PersonRow, ToggleRow, Text).
- Rotas novas: `/task/new` (criação avançada), `/ajuda`, `/design` (só em desenvolvimento), `/sync` (estado da sincronização, lê só do banco local), `/lixeira`, `/teams` e `/team/[id]` (times: pessoas, convites, pedidos, projetos, configurações, histórico; `lib/queries/teams.ts`), `/team-invite/[token]` (fora do login).
- Sync (Fase D, D82): `lib/sync/` (schema do SQLite local, `db` por plataforma, `connector` com o `uploadData`), `providers/sync.tsx`, `powersync/` (config do serviço e Sync Streams). Tabela sincronizável nova: publicação `powersync` (migração), `sync-config.yaml`, `lib/sync/schema.ts` e `WRITABLE` no `connector.ts`. Operação, backup e lixeira: `docs/OPERACOES.md`.

## Regras do projeto

- **Artigos da Ajuda** (`content/help/<idioma>/*.md`, D145): comportamento descrito mudou → artigo nos três idiomas + `npm run help:build` (o teste acusa).
- **Texto em módulo puro (`lib/`)** usa `tr()` de `lib/i18n-ref.ts`, nunca o `@/i18n` (puxa armazenamento nativo e quebra os testes).
- **Texto da interface vem do i18n** (V2 §11): `t('chave')` do `react-i18next`, com a chave nos três arquivos de `src/i18n/locales/` (pt-BR é a referência e tipa as chaves). O teste `parity.test.ts` falha se faltar chave ou variável num idioma. As telas antigas migram para o i18n quando forem redesenhadas (Fase B).
- **Permissão passa por `can()`** (`src/lib/permissions.ts`, D74), nunca por `role === 'x'`. Mudou um preset? Mude também `public.permission_presets()` (migração nova); o teste `permissions.test.ts` acusa a diferença.
- **Banco é a fonte de verdade.** Armazenamento local é só cache, fila offline e preferências de UI.
- **Toda tabela nova tem RLS** e testes pgTAP cobrindo: dono acessa, estranho não vê nem grava, papel `viewer` não escreve. Policies de pasta usam `has_permission(folder_id, 'permissão')` (resolve pela pasta raiz e pelo cargo); `is_folder_member` fica para "é do projeto". Tarefas e páginas também têm guardas por trigger (`zz_tasks_permission`, `zz_pages_permission`) que valem dentro das RPCs: Colaborador só mexe no que criou ou no que é dele (D91).
- **Privilégio por coluna.** Depois de criar uma tabela, `revoke insert, update` de `anon, authenticated` e dê `grant` só nas colunas que o cliente pode escrever (veja D7 no `DECISIONS.md`). Colunas calculadas ou de servidor (XP, status de conclusão, `folder_id`) mudam só por trigger ou RPC `security definer`.
- **Funções `security definer` sempre com `set search_path = ''`** e nomes qualificados (`public.tabela`).
- **`folder_id` desnormalizado** (tarefas e, nas próximas fases, conclusões e comentários) é preenchido por trigger a partir da página. O cliente nunca envia.
- **Atualização otimista** em criar/marcar/editar: id gerado no cliente com `randomUUID()` do `expo-crypto`; `onMutate` ajusta todas as listas com `patchTaskLists` (toda chave de lista de tarefas começa com `'tasks'`), `onError` restaura, `onSettled` chama `invalidateWhenIdle` (só recarrega quando a última mutação em sequência termina; senão as tarefas em voo "piscam"). Toda mutação de tarefa usa `mutationKey: taskMutationKey`. Veja `lib/queries/tasks.ts`.
- **Páginas de sistema** (na pasta escondida da Caixa de entrada): `tree.inbox` (`is_inbox`) e `tree.habits` (`is_habits`, D68). Hábito novo da tela Hábitos vai para `tree.habits`, com `habitKind`/`habitTarget` no item.
- **Consultas de tarefas precisam de filtro seletivo** (página, pasta, vencimento): sem ele, a RLS checa todas as tarefas do banco (D70).
- **Criar tarefa sempre por `useCreateTasks` → RPC `create_tasks_batch`** (D16). Concluir/desfazer só por `useToggleTask` (RPCs). Para marcar com aviso de "Desfazer", use `useToggleWithUndo`.
- **Datas:** `due_date` é `'YYYY-MM-DD'` sem hora; "hoje" vem de `useToday()` (fuso do perfil). Nunca use `new Date()` direto para decidir o dia.
- **Sem conexão (D86):** depois da primeira sincronização (`isLocal()`), as consultas e mutações de tarefas, pastas, páginas, responsáveis e comentários leem e gravam no SQLite do aparelho (`lib/sync/local.ts`) e o PowerSync envia depois. Função de consulta/mutação nova nesses dados: ramo `if (isLocal())` com SQL local e `networkMode: isLocal() ? 'always' : 'online'`. Ação que é regra do servidor (concluir, status, hábito) vai por `runCommand` (linha local + comando na mesma transação → `run_once` no servidor); nunca leia pelo `db` dentro de uma transação (use o `tx`, senão trava). Antes da primeira sincronização vale a fila antiga do TanStack (D52). Controle que pode ser usado offline: `useCanWrite(folderId, { offline: true })`.
- **Bosses:** dano no solo e no do clã vem do ledger (`_grant_event`, coluna `xp_events.damage`, calculada por `_attack`); o de projeto, das tarefas (trigger). Hábito ruim grava dano negativo (cura). Recompensa (XP, ouro e item sorteado) sempre por `_sync_boss_rewards` (dá e tira conforme quem contribuiu; o item sai junto).
- **Personagem e loja são do servidor** (D60 a D64): classe, atributos, habilidade, ouro e itens mudam só por RPC (`set_class`, `allocate_attribute`, `use_skill`, `buy_item`, `equip_item`). Mudou a conta do dano? Mude `_attack`/`_gold_for`/`habit_tick` **e** o espelho em `lib/character.ts`, com os mesmos casos nos dois testes.
- **Séries de tarefa com `repeat_plan` só contam por `log_rep`** (`useLogRep`/`useRepWithToast`, D123): a conta é de cada pessoa (`task_progress`, sem escrita direta) e concluir no total é efeito do servidor. Mudou a regra? Mude `log_rep` **e** `lib/repeat.ts`, com os mesmos casos nos dois testes.
- **Timer só muda por `start_timer`/`update_timer`** (`useTimerActions`, D124) e o tempo é sempre calculado do `ends_at` (`lib/timers.ts`), nunca contado com `setInterval`. Mudou a regra? Mude a RPC **e** `applyTimerAction`, com os mesmos casos nos dois testes.
- **Página recebida (L, D133 a D137):** quem recebe ao vivo não é membro da pasta; lê pela policy `is_page_recipient` e é Executor no app (`useFolderActor`). O "feito" dele é `share_checks` (por ciclo), só por `check_item`/`log_rep`; `usePageTasks`/`useTask` trocam o estado com `overlayReceived`, e as listas gerais usam `TASK_WITH_PAGE_SQL`, que exige a pasta no aparelho (as recebidas ficam de fora). Consulta nova de tarefas que mostre estado: passe pelo overlay ou filtre as recebidas.
- **Automações (D143) rodam no servidor a partir de `task_events`**: ação nova vai em `_automation_act` (isolada, falha vira `automation_log`); não confie nelas para regra de negócio que precisa barrar algo.
- **Tempo registrado (`time_entries`) só nasce no servidor** (D129, D131): foco de pomodoro e cronômetro pelo `_timer_finished` (chamado pelo `update_timer`), lançamento por `log_time`, apagar por `delete_time_entry`; `tasks.actual_minutes` é soma por trigger.
- **Hábito contador ou bom/ruim só muda por `habit_tick`** (`useHabitTick`, na fila offline com id gerado no app). As contagens são do período (`count_key`) e zeram no `refresh_cycles`.
- **Dado de consulta é só JSON** (nada de `Map`, `Set` ou `Date` no retorno do `queryFn`): o cache salvo em disco volta como objeto vazio e a tela quebra ao recarregar. Monte o `Map` no componente.
- **Mudou o formato de um dado em cache** (campo novo no `game_state`, coluna nova em tarefas)? Suba o `buster` em `providers/query.tsx`: o cache do disco é restaurado sem passar pelo zod e quebra a tela de quem já usava o app.
- **Campo booleano novo em JSON do banco:** compare com `is not distinct from` (ou `coalesce`), nunca `=` com coluna que pode ser nula; um `null` onde o zod espera boolean derruba o `game_state` inteiro.
- **XP, nível, sequência e boss são do servidor** (D33 a D39): só funções `security definer` gravam no ledger (`xp_events`); o perfil é cache. Mudou um valor? Mude `gamification.config.ts` **e** `public.xp_rules()` (migração nova); o teste `gamification.test.ts` acusa a diferença. Toda reversão passa por `_revert_xp` (tira o dano do boss junto).
- **Escrita respeita o cargo no projeto:** controles de escrita usam `useCanWrite(folderId)` (ou `WriteScope` + `useCanWrite()`), não só `useIsOnline()`. Para uma permissão específica, `actorCan(useFolderActor(folderId), 'permissão')` (vale para preset e cargo personalizado, D94); numa tarefa, `useTaskCan(task)` (concluir/editar/apagar, D97). Leitor só vê e comenta (D44).
- **`@nome` só em página de projeto** (`useMentions(pageId)`), resolvido no app com `resolveMention`; ambíguo não atribui (D41). Mudou a regra de nome? Mude `lib/members.ts` e `public.name_key`/`members_matching` juntos.
- **Tabela nova de projeto entra na publicação do Realtime e no `AFFECTS` de `providers/realtime.ts`.**
- **Estado de fluxo (pronta/bloqueada/em andamento) é derivado** (D108): mudou a regra? Mude `lib/task-state.ts` **e** `public.task_state`/`task_blockers`, com os mesmos casos nos dois testes. O guarda `tasks_respect_blockers` recusa iniciar/concluir bloqueada (modo estrito); forçar só por `force_task`.
- **Ciclos e recorrência são do servidor** (D24, D25). Mudou regra de ciclo ou de próxima data? Mude no banco e no espelho do app (`lib/recurrence.ts`) juntos, com os mesmos casos de teste.
- **Acessibilidade na web: use `aria-checked`, `aria-selected`, `aria-expanded`, `aria-disabled`**, não `accessibilityState` (o react-native-web não repassa este para o HTML).
- **React Compiler está ligado.** Não use `x!.campo` dentro de handlers ou closures do render: o compilador pode ler o valor já no render, quando `x` ainda é `undefined` (quebrou a tela de página). Faça `if (!x) return;`. Valores do Reanimated: `.get()` / `.set()`, não `.value =`.
- **Diálogos:** use os de `components/ui/dialog.tsx`. O `Alert` do React Native não tem botões na web.
- **Atalhos de teclado nascem no registro** `src/lib/shortcuts.ts` (id, combinações, descrição no i18n, escopo, permissão) e são ligados com `useShortcut(id, ação)`, que já escuta na fase de captura (o `TextInput` do react-native-web para a propagação) e ignora teclas sem Ctrl/⌘ enquanto se digita. Nada de `addEventListener('keydown')` solto nas telas.
- **Depois de mudar o banco:** `npx supabase migration up` (aplica só as migrações novas e mantém os dados), `npm run db:test` e `npm run db:types`. Nunca `db:reset` sem o usuário pedir: o banco local é o que ele usa pelo endereço remoto. Ver `docs/OPERACOES.md`.
- **Listas longas:** `TaskRow` e `TaskCard` são memoizadas; não passe objetos recriados a cada render como props delas (compare pelo conteúdo no `memo`). Acima de `SORTABLE_LIMIT` itens a lista não usa a grade de arrastar (D57).
- **Classes do NativeWind não pegam em `Animated.View`**: ponha a classe num `View` comum dentro dele (ProgressBar, Checkbox).
- **`mutate(..., { onSuccess })` não dispara se o componente desmontar antes da resposta** (ex.: card que muda de coluna no kanban, tarefa concluída que sai da lista): use `mutateAsync(...).then(...)`, cuja promessa resolve mesmo assim.
- **Tela larga:** escolha o `size` do `Screen` (D67); grades com `Grid`; layouts de colunas a partir de `lg:` ou por `useWindowDimensions` (a Hoje vira duas colunas em ≥ 1024 px).
- **Estilos com classes do NativeWind** usando as cores do tema (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`...). Nada de cor fixa, para o modo escuro funcionar.
- **Campos de captura rápida** usam `submitBehavior="submit"` para não perder o foco no Enter; o `Input` traduz isso para a web (o react-native-web só entende o antigo `blurOnSubmit`).
- **Diferenças de plataforma** vão em arquivos `.web.ts(x)` / `.native.ts(x)` ou `Platform.OS`, nunca quebrando a outra plataforma.

## Verificação

1. `npm run lint && npm run typecheck && npm test`
2. `npm run db:test` se mexeu no banco.
3. `npm run e2e` para fluxos de tela (exporta a web e serve na 8082 com `serve --single`; pare o `npm run web` antes, ou ele reaproveita o servidor aberto). Recarregar a página logo depois de uma mutação cancela o envio: nos testes, espere a resposta (`page.waitForResponse`) antes do `reload`. As abas inativas continuam montadas atrás da ativa (com `aria-hidden`): prefira `getByRole` ou o helper `shown()`, porque o `getByText`/`getByLabel` encontram o texto da aba escondida também (ex.: a Hoje mostra os mesmos hábitos de uma página aberta por cima). O `signUp` termina na Hoje (o app abre no Início). Para simular a virada do ciclo, use `ageCycle(pageId)`. Rode sempre por `npm run e2e` (o `scripts/e2e.mjs` lê a chave secreta do Supabase local no `supabase status`; **nunca** escreva chave secreta no repositório: o GitHub bloqueia o push). Concluir uma tarefa logo depois de criar vale 0 XP (relâmpago, mas o golpe no boss vale): para testar XP, use `ageTask(título)` antes, **sempre com título único** (o `ageTask` acha pelo título e o banco é compartilhado entre os testes em paralelo). Dano tem crítico aleatório: nos testes, aceite os dois valores (ex.: `(4|8) de dano`). No desktop o XP aparece também na barra lateral; escope as checagens (ex.: ao link "Nível, XP e boss da semana"). `now()` é fixo dentro da transação dos testes pgTAP: recue o `created_at` como superusuário. Fluxos com várias pessoas: `browser.newContext(...)` dentro do teste (veja `e2e/fase4.spec.ts`); o projeto que entra pelo convite abre por cima das abas, então no celular é preciso "Voltar" antes de `openTab`.
4. No celular: `npm start` e abrir no Expo Go. Para o celular alcançar o Supabase local, o `EXPO_PUBLIC_SUPABASE_URL` precisa usar o IP da máquina na rede (não `127.0.0.1`).
