# Projeto: "Questlist" (nome provisório)

App multiplataforma (Android, iOS e web a partir de um único código, mobile-first) de tarefas + gerenciamento de projetos colaborativo, com gamificação leve inspirada no Habitica, mas com menos foco em RPG e mais foco em produtividade.

> **Instruções para o Claude Code:** leia este documento inteiro antes de começar. Trabalhe por fases (seção 12), entregando cada fase funcionando antes de seguir para a próxima. Antes de codar a Fase 1, crie um `CLAUDE.md` na raiz com as convenções do projeto e atualize-o conforme o projeto evolui. Em caso de dúvida de produto, escolha a opção mais simples e registre a decisão em `DECISIONS.md`.

---

## 1. Visão e princípios

1. **Criar tarefa tem que ser absurdamente rápido.** Meta: do app aberto até a tarefa criada em ≤ 2 interações (digitar + Enter). Nenhum modal obrigatório, nenhum campo obrigatório além do título.
2. **Navegação simples.** Estrutura mental única: _Pastas → Páginas → Tarefas_. No máximo 2 níveis de pasta.
3. **Gamificação que ajuda, não atrapalha.** XP, nível, streaks e bosses são camadas sobre o app, nunca bloqueiam o uso. Dá pra desativar a gamificação por usuário.
4. **Colaboração de primeira classe.** Projetos podem ter membros, tarefas delegadas e progresso compartilhado.
5. **Mobile-first e multiplataforma.** Uso principal esperado é no celular (ex.: marcar exercícios na academia, lista de churrasco no mercado), com app nativo para Android e iOS e versão web para o computador. Um único código para as três plataformas.
6. **Idioma:** interface em pt-BR (preparar i18n desde o início, mas pt-BR é o padrão).

---

## 2. Stack

| Camada               | Escolha                                                                                                                   | Motivo                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Framework            | **Expo (React Native) + Expo Router + TypeScript**                                                                        | Um código só para Android, iOS e web (via react-native-web). Roteamento por arquivos, igual nas três plataformas        |
| UI                   | **NativeWind (Tailwind para React Native) + React Native Reusables**                                                      | Classes do Tailwind no nativo e na web; componentes no estilo do shadcn/ui portados para RN                             |
| Backend/DB           | **Supabase** (Postgres + Auth + Realtime + RLS)                                                                           | Auth, realtime e permissões por linha já resolvidos                                                                     |
| Lógica de servidor   | **Funções Postgres (RPC)** + **Supabase Edge Functions**                                                                  | App nativo não tem servidor próprio (sem server actions). Regras de XP/boss/convite ficam no banco ou em Edge Functions |
| Migrations           | Supabase CLI (SQL versionado) + tipos gerados com `supabase gen types`                                                    | Tipagem do banco no app                                                                                                 |
| Validação            | **zod**                                                                                                                   | Schemas compartilhados entre o app e as Edge Functions                                                                  |
| Estado cliente       | **TanStack Query** + atualização otimista, com cache persistido (MMKV no nativo, IndexedDB na web)                        | Criar/marcar tarefa precisa parecer instantâneo; o app abre com os dados da última sessão                               |
| Listas e drag & drop | **FlashList** + **react-native-reanimated** + **react-native-gesture-handler** (ex.: react-native-reorderable-list)       | Listas longas sem travar; o dnd-kit só funciona na web                                                                  |
| Feedback tátil       | **expo-haptics**                                                                                                          | Vibração leve ao marcar (no-op na web)                                                                                  |
| Distribuição         | **EAS Build** (Play Store / App Store) + **EAS Update** (atualização OTA); web exportada estática (EAS Hosting ou Vercel) | Atualizações de JS sem passar pela loja                                                                                 |
| Testes               | **Jest (jest-expo)** para unidade; **Maestro** para E2E no celular; **Playwright** para E2E na web                        |                                                                                                                         |

Se o usuário preferir outra stack, manter os mesmos conceitos. **Armazenamento local (MMKV, IndexedDB, AsyncStorage, localStorage) nunca é fonte de verdade**; serve só como cache, fila de mutações offline e preferências de UI. A fonte de verdade é o Postgres.

**Diferenças entre plataformas (tratar desde o início):**

- **Atalhos de teclado** (`N`, `Ctrl/Cmd+K`) existem só na web e em teclado físico. No celular, a captura rápida é o campo fixo da página e um botão flutuante (FAB).
- **Colar várias linhas:** na web, detectar pelo evento de paste. No nativo, detectar pela mudança de texto contendo quebra de linha (o `TextInput` não expõe evento de paste).
- **Login com Google:** no nativo, via `expo-auth-session`/deep link (`questlist://`); na web, pelo redirect padrão do Supabase.
- **Links de convite:** precisam abrir o app se instalado (universal links / app links) e cair na versão web se não estiver.
- **Desktop:** coberto pela versão web. App de desktop nativo fica fora da v1.

---

## 3. Conceitos e hierarquia

```
Workspace do usuário
├── Pasta (ex.: "Academia", "Casa", "Trabalho")
│   ├── Página (tipo: lista | checklist-cards | hábitos | kanban*)
│   │   └── Tarefas / Itens
│   └── (subpasta, no máx. 1 nível)
└── Projeto (pasta compartilhada com membros)
    ├── Páginas
    └── Tarefas com responsável
```

- **Pasta:** agrupador visual (nome, ícone/emoji, cor). Pode ser pessoal ou **Projeto** (compartilhada).
- **Página:** contém tarefas. Possui um **tipo de visualização**:
  - `lista` — lista compacta padrão (linha por tarefa).
  - `cards` — cards grandes, ideais para checar rápido (treinos). Toque no card inteiro marca/desmarca.
  - `habitos` — itens recorrentes diários/semanais com streak (estilo Habitica).
  - `kanban` — colunas A fazer / Fazendo / Feito (**fase posterior, opcional**).
- **Tarefa:** unidade básica (ver modelo de dados).
- **Projeto:** uma pasta com membros, papéis, tarefas delegáveis e progresso agregado. Projetos podem ser criados a partir de **templates** (ex.: "Churrasco").

> Simplificação: internamente, `Projeto` pode ser só uma `Pasta` com `is_shared = true`. Evitar duas entidades paralelas.

---

## 4. Funcionalidades

### 4.1 Criação rápida de tarefas (CRÍTICO)

- **Campo de entrada sempre visível** no topo (ou rodapé no mobile) de cada página: digita e dá Enter → cria. O foco permanece no campo para criar a próxima.
- **Atalho global** (`N` ou `Ctrl/Cmd+K` na web; botão flutuante no celular) abre captura rápida de qualquer tela, com seletor de destino (página) — padrão: última página usada ou uma "Caixa de entrada".
- **Caixa de entrada (Inbox):** destino padrão quando não se escolhe página. Depois dá pra mover.
- **Sintaxe rápida opcional** no título (parser simples, nunca obrigatório):
  - `@nome` → atribui a um membro (em páginas de projeto)
  - `!` / `!!` / `!!!` → prioridade baixa/média/alta
  - `#etiqueta` → etiqueta
  - `amanhã`, `sexta`, `15/10` → data de vencimento (pt-BR)
  - `/diaria`, `/semanal`, `/seg,qua,sex`, `/mensal` → recorrente (ver 4.4). **Não usar `*` para recorrência**: no lote, `*` no início é marcador de lista e é removido
- **Criação em lote** (botão "Adicionar várias" ou colar texto no campo):
  - Entrada: texto puro, separado por **quebra de linha** e/ou **ponto e vírgula `;`**.
  - Ignorar linhas vazias; remover marcadores comuns no início (`-`, `*`, `•`, `1.`, `[ ]`, `[x]`). O `*` aqui é sempre marcador, nunca recorrência.
  - `[x]` no início cria a tarefa já concluída.
  - Suporta a sintaxe rápida acima em cada item (ex.: `Comprar carne @gregory; Comprar cerveja @cris`).
  - Indentação de 2+ espaços / tab cria **subtarefa** do item anterior.
  - Mostrar **pré-visualização** com contagem ("12 tarefas serão criadas") e botão Confirmar. Permitir editar/remover itens na pré-visualização.
  - Detectar automaticamente quando o usuário **cola** múltiplas linhas no campo rápido e oferecer a pré-visualização (ver diferenças entre plataformas na seção 2).
  - Implementar o parser como **função pura e testada** (`parseBatchInput(text, opts)`), com testes unitários cobrindo casos de borda.

### 4.2 Tarefas

- Campos: título, notas (markdown simples), status, data de vencimento, prioridade, etiquetas, responsável(is), subtarefas (checklist), recorrência, ordem.
- Marcar como feita com 1 toque/clique; desfazer via toast ("Desfazer") por alguns segundos.
- Reordenar por drag & drop; mover entre páginas/pastas.
- Edição inline do título (clique/toque); painel lateral/gaveta para detalhes (nunca modal bloqueante em mobile).
- Filtros e visões globais: **Hoje**, **Próximos 7 dias**, **Atrasadas**, **Atribuídas a mim**, **Concluídas**.
- Busca global por título/notas.

### 4.3 Páginas do tipo "cards" (ex.: Academia)

- Cada item é um **card grande**, com título, detalhe opcional (ex.: "4x12 · 20kg") e checkbox grande.
- Toque em qualquer parte do card marca/desmarca, com feedback visual claro (cor + animação curta + vibração leve via `expo-haptics` no celular).
- Barra de progresso no topo da página ("5/8 exercícios").
- **Reset por ciclo:** a página pode ser configurada para "resetar" os checks (diário, semanal, manual) para ser reutilizada como rotina — ex.: "Treino A" reinicia toda segunda. Guardar **histórico** de execuções (para estatísticas e XP).
- Campos opcionais por item: séries, repetições, carga (para o caso de treino). Manter genérico (`meta` JSON ou campos opcionais), não acoplar ao domínio "academia".
- Permitir **duplicar página** (ex.: Treino A → Treino B).

### 4.4 Hábitos e recorrência

- Tarefas recorrentes: diária, dias da semana específicos, semanal, mensal.
- Hábitos (página tipo `habitos`): itens que podem ser marcados 1x por período; mostram **streak** e histórico (mini-calendário).
- Ao concluir tarefa recorrente, gerar a próxima ocorrência automaticamente (ou considerar o item "feito hoje" e resetar no próximo ciclo, no caso de hábitos).
- Fuso horário do usuário respeitado para virada de dia (padrão: `America/Sao_Paulo`, configurável).

### 4.5 Projetos colaborativos

- Criar projeto (pasta compartilhada) → convidar membros por **link de convite** e/ou e-mail.
- Papéis: **Dono** (tudo), **Editor** (cria/edita/atribui/conclui), **Visualizador** (só vê e comenta). Padrão ao convidar: Editor.
- **Delegar tarefas:** atribuir a um ou mais membros. Cada membro tem a visão "Minhas tarefas" agregando de todos os projetos.
- **Responsável pendente:** um `@nome` que não corresponde a nenhum membro (o caso comum: a lista é colada **antes** de convidar a galera) cria um responsável pendente, guardado só pelo nome. Ao aceitar o convite, a pessoa vê os nomes pendentes do projeto ("Você é o @gregory?") e escolhe o seu; as tarefas passam a ser dela. O dono/editor também pode vincular manualmente. A tarefa mostra o nome pendente com um estilo diferente (ex.: tracejado) até ser vinculada. Responsável pendente não recebe notificação nem conta no "Minhas tarefas" de ninguém.
- **Correspondência do `@nome`:** sem diferenciar maiúsculas e acentos, contra o nome de exibição e o @usuário dos membros. Se houver mais de um membro compatível, não atribuir e mostrar a ambiguidade na pré-visualização para o usuário escolher.
- Quando atribuída, o membro recebe notificação (in-app; e-mail/push em fase posterior).
- Atualizações em **tempo real** (Supabase Realtime): tarefas marcadas por outros aparecem sem recarregar.
- Comentários por tarefa (simples, em lista cronológica, com @menção).
- Log de atividade do projeto ("Cris concluiu _Comprar cerveja_").
- Progresso do projeto: % concluído, por pessoa e geral.
- **Templates de projeto** (JSON no repo, seed inicial): "Churrasco" (Carne, Bebidas, Carvão, Gelo, Descartáveis, Local, Convidados...), "Viagem", "Mudança", "Festa". Usuário pode salvar um projeto como template.
- Exemplo de fluxo alvo: criar projeto "Churrasco" → colar lista em lote `carne @gregory; cerveja @cris; carvão; gelo` (Gregory e Cris viram responsáveis pendentes) → convidar a galera por link → cada um entra, se identifica e vê "minhas tarefas".
- Um usuário que entra pelo link de convite, sem conta, deve poder criar conta em poucos passos e cair direto no projeto. Sem o app instalado, o link abre a versão web, que oferece instalar o app sem bloquear o uso.

### 4.6 Gamificação

**Princípio:** simples, recompensadora, desativável (`settings.gamification_enabled`).

**Núcleo (solo):**

- **XP e nível** por tarefas concluídas. Valores base (configuráveis em um único arquivo `gamification.config.ts`):
  - Tarefa comum: 10 XP · prioridade média ×1.25 · alta ×1.5
  - Hábito/recorrente: 8 XP + bônus de streak (+1 XP por dia de streak, teto +20)
  - Item de checklist/card: 5 XP
  - Completar uma página-checklist inteira (ex.: treino completo): bônus de 25 XP
- Curva de nível: `xp_para_proximo = 100 * nivel^1.4` (arredondar).
- **Moedas** (opcional, fase 2 da gamificação): ganhas junto com XP; gastas em itens cosméticos (temas, avatares, títulos). Sem pay-to-win, sem monetização.
- **Streak global** de dias com ao menos 1 tarefa concluída; "congelar streak" (1 por semana, grátis) para não punir imprevistos.
- **Sem punição pesada:** diferente do Habitica, **não perder HP/XP por tarefa não feita**. Penalidade, se existir, é só quebrar streak. (Opcional: modo "hardcore" nas configurações que reativa HP.)
- **Conquistas/badges:** primeira tarefa, 7/30/100 dias de streak, 100 tarefas, primeiro projeto concluído, primeiro boss derrotado etc.
- **Anti-farm:** toda concessão de XP é registrada em um **ledger** (`xp_events`), nunca apenas incrementada num contador. Regras exatas (valores em `gamification.config.ts`):
  1. **Uma concessão por ciclo:** no máximo **um** `xp_event` não revertido por `(task_id, cycle_key)`. O `cycle_key` é o ciclo da tarefa (ex.: `2026-W41` para página com reset semanal, a data para hábito diário, `once` para tarefa comum).
  2. **Desmarcar reverte exatamente o que foi concedido:** marca o evento como `reverted` e desfaz o dano no boss do mesmo evento. Marcar de novo no mesmo ciclo concede outra vez, recalculada pelas regras atuais. O saldo de marcar/desmarcar várias vezes é sempre o de uma única conclusão.
  3. **Tarefa relâmpago:** concluída em menos de **30 s** depois de criada → **0 XP** (o evento é registrado com `amount = 0` e `kind = 'too_fast'`, para o histórico ficar consistente). Inclui itens do lote criados já como `[x]`. Não se aplica a itens de páginas `cards`/`habitos`, que são rotinas reutilizadas.
  4. **Teto diário:** tarefas comuns concluídas em menos de **5 min** depois de criadas somam no máximo **50 XP por dia** (no fuso do usuário). Acima disso, o evento é registrado com o valor limitado.
  5. O toast de "Desfazer" chama o mesmo `uncomplete_task`; não existe caminho separado.
  6. O XP e o nível exibidos no perfil são a soma do ledger (o `profiles.xp` é só um cache atualizado na mesma transação).

**Boss solo:**

- O sistema gera um **boss semanal** para o usuário (nome/arte simples, HP total).
- **Dano ao boss** = XP ganho nas tarefas concluídas durante a semana (ou dano fixo por tarefa — decisão registrada em `DECISIONS.md`).
- HP do boss escala com o nível do usuário e com a média de tarefas das últimas semanas (para ser desafiador, mas alcançável).
- Derrotar o boss → recompensa (XP bônus, moedas, badge). Se não derrotar, o boss simplesmente "foge" e o próximo vem sem punição.
- Barra de HP do boss visível no topo da tela "Hoje" (compacta, discreta).

**Boss do clã / projeto (colaborativo):**

- Cada **projeto** (e opcionalmente um **clã** — grupo de amigos sem projeto específico) pode ativar um **boss cooperativo**.
- O dano ao boss é a soma do progresso dos membros (tarefas concluídas no escopo do projeto/clã).
- Boss de projeto pode ser vinculado a um **prazo** (ex.: "o churrasco é sábado: derrote o boss da organização até lá"). HP = nº de tarefas do projeto (ou soma de pesos); cada tarefa concluída causa dano.
- Boss de clã semanal: HP escalado pelo número de membros ativos; todos que contribuíram (≥ 1 ação) recebem a recompensa.
- Quadro de contribuição (quem causou quanto dano), em tom amistoso, sem ranking humilhante (mostrar "destaques" em vez de "último lugar").
- **Clã:** entidade simples (`clans`) com nome, membros e convite por link. Um usuário pode estar em 1 clã (começar simples). Um clã tem chat? **Não** nesta versão — apenas feed de atividade.

**Interface de gamificação:** barra de XP/nível no cabeçalho; animação curta ao concluir; toast de "level up"; tela de Perfil com conquistas e estatísticas. Nada de telas pesadas de RPG (sem inventário complexo, sem classes na v1).

---

## 5. Telas e navegação

**Layout:** sidebar (web em tela larga) / abas inferiores + drawer (celular e web estreita). Mesmas rotas do Expo Router nas três plataformas.

1. **Hoje** (home): tarefas de hoje + atrasadas + hábitos do dia, campo de captura rápida, barra do boss e XP.
2. **Caixa de entrada**
3. **Pastas/Projetos** (árvore na sidebar, recolhível; favoritar para fixar no topo)
4. **Página** (lista ou cards, conforme o tipo), com campo de adicionar no topo e botão "adicionar várias"
5. **Minhas tarefas** (atribuídas a mim, de todos os projetos)
6. **Projeto** (visão geral: progresso, membros, atividade, boss, páginas)
7. **Boss / Clã**
8. **Perfil e conquistas**
9. **Configurações** (tema claro/escuro, gamificação on/off, fuso horário, notificações, conta)

Regras de UX:

- Máximo **2 toques** para chegar a qualquer página favorita.
- Estados vazios com um exemplo claro e um botão de ação (ex.: "Cole uma lista aqui").
- Atualização **otimista**: nada de spinner ao criar/marcar tarefa.
- Acessibilidade: navegação por teclado, contraste AA, alvos de toque ≥ 44px.
- Tema claro/escuro desde o início.

---

## 6. Modelo de dados (rascunho — Postgres)

```sql
profiles(id uuid pk -> auth.users, display_name, avatar_url, timezone, gamification_enabled bool,
         xp int, level int, coins int, streak int, streak_best int, last_active_date date, created_at)

folders(id, owner_id, parent_id null, name, icon, color, is_shared bool, position, archived bool, created_at)
folder_members(folder_id, user_id, role enum('owner','editor','viewer'), joined_at, pk(folder_id,user_id))
invites(id, folder_id, token unique, role, expires_at, max_uses, uses)

pages(id, folder_id, name, icon, view_type enum('list','cards','habits','kanban'),
      reset_cycle enum('none','daily','weekly','manual'), position, created_at)

tasks(id, page_id, folder_id,   -- folder_id desnormalizado (= pasta da página), ver nota abaixo
      parent_task_id null, title, notes, status enum('todo','doing','done'),
      priority smallint, due_at timestamptz null, recurrence jsonb null, position,
      meta jsonb null,           -- ex.: {sets:4, reps:12, weight:"20kg"}
      created_by, completed_by null, completed_at null, created_at)
task_assignees(id, task_id, user_id null, pending_name null,   -- exatamente um dos dois preenchido
               unique(task_id, user_id), unique(task_id, lower(pending_name)))
labels(id, owner_or_folder_id, name, color) ; task_labels(task_id, label_id)
comments(id, task_id, folder_id, author_id, body, created_at)

task_completions(id, task_id, folder_id, user_id, completed_at, cycle_key)   -- histórico (hábitos / checklists resetáveis)

xp_events(id, user_id, task_id null, cycle_key null, kind, amount, created_at, reverted bool)  -- ledger
          -- índice único parcial: (task_id, cycle_key) where not reverted and task_id is not null
achievements(id, key, name, description) ; user_achievements(user_id, achievement_id, unlocked_at)

clans(id, name, created_by) ; clan_members(clan_id, user_id)
bosses(id, scope enum('user','folder','clan'), scope_id, name, max_hp, hp, starts_at, ends_at,
       status enum('active','defeated','escaped'), reward jsonb)
boss_damage(id, boss_id, user_id, task_id null, amount, created_at)

activity_log(id, folder_id, user_id, action, payload jsonb, created_at)
notifications(id, user_id, kind, payload jsonb, read_at, created_at)
```

**`folder_id` desnormalizado:** `tasks`, `task_completions` e `comments` guardam o `folder_id` direto. Assim as policies de RLS e os filtros do Realtime checam `is_folder_member(folder_id)` sem fazer join tarefa → página → pasta → membros a cada linha. Consistência: um trigger preenche o `folder_id` a partir da página no insert e atualiza as tarefas (e subtarefas) quando a tarefa é movida de página ou a página muda de pasta. O cliente nunca envia o `folder_id`.

**Segurança (obrigatório):** habilitar **Row Level Security** em todas as tabelas. Regras base: usuário acessa apenas dados de pastas das quais é dono/membro; Visualizador só lê; XP/HP/boss só são alterados por **funções no servidor** (funções Postgres `security definer` chamadas por RPC, ou Edge Functions), nunca por escrita direta do cliente. Policies de membro usam uma função `is_folder_member(folder_id, min_role)` `stable security definer`, para evitar recursão de RLS em `folder_members`.

---

## 7. Lógica de servidor importante

Tudo aqui é função Postgres (RPC) em transação, exceto o que precisa de rede ou segredo (e-mail, push), que vai para Edge Functions. Os crons usam `pg_cron` do Supabase.

- `complete_task(task_id)` → transação: marca concluída, registra `task_completions`, calcula XP (ledger, com as regras de anti-farm da 4.6), atualiza streak, aplica dano em bosses ativos relevantes (solo + projeto + clã), checa conquistas, retorna resumo (xp ganho, level up?, boss dano).
- `uncomplete_task(task_id)` → reverte XP e dano (marca eventos como `reverted`).
- `create_tasks_batch(page_id, items[])` → cria em transação, preservando ordem e subtarefas.
- `reset_page_cycle(page_id)` → job agendado (`pg_cron`) que reinicia checks conforme `reset_cycle` e fuso do dono.
- `spawn_weekly_bosses()` → cron semanal que cria bosses solo e de clã e encerra os antigos.
- `accept_invite(token)` → entra no projeto com o papel do convite e devolve os responsáveis pendentes do projeto.
- `claim_pending_assignee(folder_id, pending_name)` → vincula as tarefas do nome pendente ao usuário atual (só membros; um nome só pode ser reivindicado uma vez). Dono/editor podem chamar para outro membro.

---

## 8. Parser de lote — especificação de testes

Casos mínimos (entrada → saída esperada):

| Entrada                               | Resultado                                           |
| ------------------------------------- | --------------------------------------------------- |
| `a\nb\nc`                             | 3 tarefas                                           |
| `a; b; c`                             | 3 tarefas                                           |
| `a; b\nc`                             | 3 tarefas                                           |
| `- a\n- b`                            | 2 tarefas (sem o `-`)                               |
| `1. a\n2. b`                          | 2 tarefas (sem numeração)                           |
| `[x] a\n[ ] b`                        | `a` concluída, `b` pendente                         |
| `a\n  b\n  c\nd`                      | `a` com 2 subtarefas, `d` solta                     |
| `carne @gregory; cerveja @cris`       | 2 tarefas com responsáveis (membros ou pendentes)   |
| `* a\n* b`                            | 2 tarefas comuns (sem o `*`, **não** recorrentes)   |
| `academia /seg,qua,sex`               | 1 tarefa recorrente nesses dias                     |
| `[x] a`                               | `a` concluída (0 XP pela regra de tarefa relâmpago) |
| `\n\n  ;; a ;; \n`                    | 1 tarefa (`a`)                                      |
| `reunião amanhã !!`                   | data = amanhã, prioridade média                     |
| texto com `;` dentro de aspas `"a;b"` | tratar como 1 item (aspas escapam o separador)      |

---

## 9. Requisitos não funcionais

- **Performance:** criação/marcação de tarefa com feedback < 100 ms percebido (otimismo); listas com 500+ itens sem travar (virtualização se necessário).
- **Offline em duas etapas:**
  - **v1 (Fase 1):** o app abre sem internet mostrando os dados da última sessão (cache persistido do TanStack Query) e deixa claro que está offline. Escritas ficam desabilitadas offline.
  - **Fase 5:** fila de mutações (criar/marcar/desmarcar/reordenar) persistida localmente, reenviada na ordem ao reconectar. Conflitos: a última escrita vence por campo; conclusão vinda do servidor sempre vence. XP e boss são recalculados pelo servidor no reenvio (o cliente nunca calcula XP definitivo). Se isso ficar complexo demais, avaliar um motor de sync (PowerSync ou similar) em vez de fazer à mão; registrar em `DECISIONS.md`.
- **Privacidade:** dados do usuário não são vendidos nem compartilhados; permitir exportar (JSON/CSV) e excluir conta.
- **Segurança:** validação de entrada no servidor (zod), rate limit em convites e criação em lote, tokens de convite aleatórios e expiráveis.
- **Observabilidade:** logs de erro com Sentry (`@sentry/react-native`, cobre nativo e web).
- **Qualidade:** TypeScript estrito, ESLint, Prettier, CI rodando lint + testes + type-check + export da web. Builds nativos pelo EAS (não precisa rodar a cada PR).

---

## 10. Fora de escopo (v1)

- Chat em tempo real, chamadas, anexos pesados de arquivo.
- Loja com dinheiro real, itens pay-to-win.
- Classes de RPG, inventário complexo, pets/montarias.
- App nativo de desktop (a versão web cobre o computador na v1).
- Integrações externas (Google Calendar, WhatsApp etc.) — listar como ideias futuras.

---

## 11. Ideias futuras (backlog)

- Notificações push e lembretes por horário.
- Integração com Google Calendar.
- Visão kanban e calendário.
- Import de listas por foto/áudio (OCR / voz → lote).
- Desafios entre amigos (competição saudável).
- Widgets para tela inicial do celular.
- Modo "foco" (pomodoro) que dá XP extra.

---

## 12. Plano de entrega por fases

### Fase 0 — Setup

- Repo Expo (Expo Router) + TS + NativeWind + React Native Reusables, ESLint/Prettier, CI.
- Rodando nas três plataformas: Expo Go / development build no Android, web no navegador (iOS precisa de Mac ou do EAS Build).
- Projeto Supabase, auth (e-mail + Google, com deep link no nativo), migrations iniciais, RLS base com `is_folder_member`.
- `CLAUDE.md` e `DECISIONS.md`.

### Fase 1 — Núcleo de tarefas (MVP solo)

- Auth, perfil, pastas, páginas (lista), tarefas (CRUD, subtarefas, prioridade, data).
- Captura rápida (campo sempre visível + atalho) e **Caixa de entrada**.
- **Criação em lote** com parser testado e pré-visualização.
- Telas Hoje / Caixa de entrada / Página. Tema claro/escuro. App abre offline com o cache (somente leitura).
- **Critério de aceite:** criar 10 tarefas colando uma lista em < 10 segundos; marcar tarefa com 1 toque; funcionando no Android e na web (e no iOS, se houver como testar).

### Fase 2 — Páginas de cards, hábitos e recorrência

- View `cards` com toque no card inteiro, barra de progresso, reset por ciclo, histórico.
- Hábitos com streak, recorrência, duplicar página.
- **Critério de aceite:** montar a página "Treino A" com 8 exercícios em lote, marcar tudo no celular e ver o reset automático na semana seguinte.

### Fase 3 — Gamificação solo

- XP, níveis, streak (com congelamento), ledger, anti-farm, conquistas, perfil.
- Boss solo semanal com barra de HP e recompensa.
- Toggle para desativar gamificação.
- **Critério de aceite:** concluir/desmarcar tarefas altera XP e HP do boss de forma consistente e reversível.

### Fase 4 — Projetos colaborativos

- Pastas compartilhadas, convites por link, papéis, atribuição de tarefas, "Minhas tarefas", comentários, log de atividade, realtime, notificações in-app, templates (Churrasco etc.).
- **Critério de aceite:** criar "Churrasco" via template, colar a lista com `@nomes` antes de convidar, convidar 2 pessoas por link (uma pelo app, outra pela web), elas reivindicarem os nomes pendentes e o progresso mudar em tempo real nos dispositivos.

### Fase 5 — Clã e boss cooperativo

- Clãs, boss de projeto (com prazo) e boss de clã, quadro de contribuição, recompensas.
- Offline/sincronização (se ainda não feito), exportação de dados.

### Fase 6 — Polimento

- Acessibilidade, performance, animações, onboarding guiado (3 passos), e-mail/push (`expo-notifications`), kanban, publicação nas lojas.

---

## 13. Definição de pronto (para cada fase)

- Funcionalidades da fase implementadas e demonstráveis.
- Testes unitários (lógica de parser, XP, boss) e ao menos um E2E por fluxo crítico.
- RLS revisada para as tabelas novas.
- Testado no Android (aparelho ou emulador) e na web em 390px e 1280px; no iOS quando houver build disponível.
- `CLAUDE.md` e `DECISIONS.md` atualizados; README com instruções de rodar localmente.

---

## 14. Decisões tomadas e perguntas em aberto

Já decidido (copiar para o `DECISIONS.md` na Fase 0):

- **Plataforma:** Expo (React Native) para Android, iOS e web com um único código, no lugar de Next.js + PWA.
- **`*` na sintaxe:** sempre marcador de lista; recorrência só com `/diaria`, `/semanal`, `/seg,qua,sex`, `/mensal`.
- **`@nome` sem membro:** vira responsável pendente, reivindicado ao aceitar o convite.
- **Anti-farm:** regras exatas na seção 4.6.
- **`folder_id` desnormalizado** em `tasks`, `task_completions` e `comments`, mantido por trigger.
- **Offline:** leitura offline na v1; fila de mutações na Fase 5.
- **Lógica de servidor:** funções Postgres (RPC) + Edge Functions; crons com `pg_cron`.

Ainda em aberto (sugestão entre parênteses; decidir cedo e registrar em `DECISIONS.md`):

1. Dano ao boss = XP ganho ou dano fixo por tarefa? (XP ganho: reaproveita o ledger e o anti-farm.)
2. Clã é entidade separada de Projeto ou só um projeto com boss ativado? (Separar, mas reaproveitar a lógica de boss.)
3. Permitir modo "hardcore" com HP e penalidades desde a v1 ou só depois? (Só depois.)
4. Hospedagem da web: EAS Hosting ou Vercel? Supabase na nuvem ou local com Docker para desenvolver? (Supabase na nuvem desde o início, com o CLI local para migrations.)
5. Conta de desenvolvedor Apple (US$ 99/ano) e Google Play (US$ 25, taxa única): quando criar? (Só na Fase 6; até lá, Android por APK/development build e web.)
6. Nome e identidade visual finais do app.
