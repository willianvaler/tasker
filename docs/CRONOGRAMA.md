# Cronograma de implementação — V2 + V3

Junta o `ESCOPO_V2.md` e o `ESCOPO_V3.md` (V3 > V2 > V1) num plano único, ajustado ao que o repositório já tem (Fases 0 a 7 do `ESCOPO.md`). O andamento de cada tarefa fica em `docs/STATUS.md`; os itens B e C do brainstorm da V3, em `docs/BACKLOG.md`.

## Como ler

- **Cada tarefa numerada (`A1`, `B4`...) = um commit** (às vezes dois, se tiver migração + tela). Mensagem em Conventional Commits, em pt-BR, com o id no fim: `feat(i18n): infraestrutura com pt-BR, en e es [A3]`. Assim `git log --grep '\[B'` mostra a fase inteira.
- Toda tarefa termina com `lint + typecheck + test` passando (e `db:test` / `e2e` quando mexer em banco ou tela) e com o `docs/STATUS.md` atualizado **no mesmo commit**.
- 🚦 = **portão do usuário**: a fase para até você aprovar (visual ou decisão em aberto).
- Datas em dias úteis a partir de 14/10/2026, sequenciais. São estimativas: os portões dependem da sua revisão e podem empurrar tudo. Feriados (25/12, 01/01) não estão descontados.

## Ajustes à stack real (registrar em `DECISIONS.md` na Fase A)

| O escopo diz | O repositório tem | Proposta |
|---|---|---|
| Web empacotada com **Capacitor** + SQLite nativo | **Expo SDK 57** (Android/iOS/web num código só), `expo-sqlite` já instalado | Manter Expo. Capacitor não é necessário: o app já é nativo. SQLite nativo via `expo-sqlite`; na web, SQLite WASM ou IndexedDB atrás do `LocalStore` |
| Sync: PowerSync / Electric / Zero / RxDB ou protocolo próprio | Fila offline do TanStack Query (D52) + cache persistido | Spike na A6. PowerSync tem SDK React Native + web e integração com Supabase: é o primeiro candidato |
| Ordem por **fractional indexing** em string | `position double precision` | Avaliar no spike; trocar para chave em string só se o sync exigir (o `double` já evita reescrever a lista, mas perde precisão depois de muitas inserções no mesmo ponto) |
| `containers(kind folder/project)` + **times** | `folders` + `folder_members` (owner/editor/viewer) e **clãs** | Projeto = pasta com `kind = 'project'`; time é entidade nova; clã continua sendo só da gamificação (decidir na E) |
| Fontes, tokens, Tailwind | NativeWind 4 (Tailwind 3), cores do tema já em variáveis | Tokens no `tailwind.config.js` + `global.css`; fontes via `expo-font`, hospedadas no app |
| `next-intl` / `react-i18next` | Nenhum i18n; texto fixo em pt-BR | `i18next` + `react-i18next` + `expo-localization` |
| React Flow (xyflow) no grafo | React Native (web + nativo) | React Flow só existe na web: grafo na web; no celular, visão em lista/leitura (decidir na I) |

O que **já existe** e só será adaptado, não refeito: subtarefas (`parent_task_id`), kanban, captura rápida e lote, convites com papéis, "Atribuídas a mim", modelos, notificações in-app e push, fila offline, gamificação inteira (XP, boss, classes, loja).

---

## Visão geral

| Fase | Origem | Conteúdo | Dias | Datas previstas |
|---|---|---|:-:|---|
| **A** | V2 §0, §13A | Auditoria, docs, i18n, `can()`, atalhos, spike de sync | 3 | 14/10 – 16/10 |
| **B** | V3 §0 + V2 §12 | Correção visual: mockups 🚦, tokens, `/design`, telas-chave | 7 | 19/10 – 27/10 |
| **C** | V2 §5–9 | Pasta × Projeto, "+ Novo", F2, ícones, paleta, criação avançada | 5 | 28/10 – 03/11 |
| **D** | V2 §2–3 | Offline-first e sync (LocalStore, outbox, pull, lixeira) | 8 | 04/11 – 13/11 |
| **E** | V2 §4 | Times, cargos, permissões atômicas, marcos, auditoria | 5 | 16/11 – 20/11 |
| **G** | V3 §1 | Subtarefas e WBS | 3 | 23/11 – 25/11 |
| **H** | V3 §2.1–2.5 | Dependências e estados derivados | 4 | 26/11 – 01/12 |
| **I** | V3 §2.6–2.7 | Fluxo, Pessoas, linha do tempo, indicadores | 5 | 02/12 – 08/12 |
| **J** | V3 §4 | Repetições, descanso, timers, Modo Treino | 5 | 09/12 – 15/12 |
| **K** | V3 §5 | Pomodoro e registro de tempo | 3 | 16/12 – 18/12 |
| **L** | V3 §3 | Página enviada (Treinador → Aluno) | 5 | 21/12 – 25/12 |
| **M** | V3 §6 (A), §2.8 | Extras "A" e automações | 5 | 28/12 – 01/01 |
| **F** | V2 §10–11, §13F | Ajuda completa, revisão de idiomas, acessibilidade, performance | 4 | 04/01 – 07/01 |

**Por que esta ordem**
- A V3 manda a correção visual primeiro, mas i18n, `can()` e o registro de atalhos são pré-requisito de toda tela nova: ficam na A, que é curta. As telas são extraídas para o i18n **enquanto são redesenhadas** na B (cada tela é reescrita uma vez só).
- A **D (sync) vem antes de times e da V3** porque toda tabela nova da V3 precisa nascer com as regras de sync (id de cliente, `deleted_at`, `version`). Fazer o contrário obrigaria a migrar tudo duas vezes.
- A **F vai para o fim**: a rota `/ajuda` e a tabela de atalhos nascem na C (a definição de pronto exige que todo atalho apareça na Ajuda); a F completa os artigos (V2 + V3) e faz a revisão final.

---

## Fase A — Auditoria e fundação (14/10 – 16/10)

| # | Tarefa | Commit sugerido |
|---|---|---|
| A1 | `docs/AUDITORIA.md`: stack real, o que existe do ESCOPO, lacunas, dívidas (inclui a pendência da D70) | `docs: auditoria do repositório` |
| A2 | `CLAUDE.md` aponta para V2/V3 e para a regra "ao concluir, atualize `docs/STATUS.md`"; `DECISIONS.md` com a tabela "Ajustes à stack real" do cronograma | `docs: CLAUDE.md e decisões da V2/V3` |
| A3 | Infra de i18n: `i18next` + `react-i18next` + `expo-localization`, `locales/pt-BR.json`, `en.json`, `es.json`, detecção de idioma | `feat(i18n): infraestrutura com pt-BR, en e es` |
| A4 | Teste que falha se uma chave existir num idioma e faltar em outro; seletor de idioma no Perfil, salvo em `profiles.locale` | `test(i18n): paridade de chaves` + `feat(i18n): idioma no perfil` |
| A5 | Permissões como dados: catálogo de permissões atômicas (já com as da V3 §8), presets Gerente/Editor/Colaborador/Leitor, função única `can(user, action, resource)` no app e espelho no banco; mapear os papéis atuais (owner/editor/viewer) | `feat(permissoes): can() e catálogo de permissões` |
| A6 | Registro central de atalhos `shortcuts.ts` (id, teclas, chave i18n, escopo, permissão); migrar os atalhos existentes (N, Ctrl+K) para ele | `feat(atalhos): registro central` |
| A7 | **Spike de sync** (1 dia): PowerSync × protocolo próprio sobre Supabase, com protótipo descartável numa branch; decisão em `DECISIONS.md` | `docs: decisão do spike de sync` |

**Aceite:** i18n funcionando com troca de idioma; teste de paridade passando; decisão de sync registrada. 🚦 *Decisão em aberto V2 #2 (engine de sync) é tomada aqui com você.*

## Fase B — Correção visual (19/10 – 27/10)

| # | Tarefa | Commit sugerido |
|---|---|---|
| B1 | `docs/DESIGN.md`: direção "Caderno de bolso", tokens (cores claro/escuro, escala 4–48, tipografia 12/14/16/20/28, pesos 400/600, raios 4/8, durações) | `docs(design): tokens e regras` |
| B2 | Mockups HTML/CSS estáticos em `docs/mockups/`: Hoje, Página lista, Página cards, Sidebar, Painel da tarefa — claro/escuro, 1280 e 390 px | `docs(mockups): telas-chave` (um commit por tela) |
| B3 | 🚦 **Você aprova os mockups.** Ajustes viram commits `docs(mockups): ajuste ...` | — |
| B4 | Tokens no `tailwind.config.js`/`global.css`; fontes (Fraunces/Newsreader, Instrument Sans/Hanken, JetBrains/Plex Mono) via `expo-font`; lint que barra hex solto | `feat(design): tokens e fontes` |
| B5 | Página `/design` (só em dev) | `feat(design): página de referência` |
| B6 | Componentes-base, **um commit por componente**: botão (primário/fantasma), campo, checkbox "carimbo", linha de tarefa (40/52 px, risco de caneta), chip, item de sidebar, popover, painel lateral, folha inferior, toast, estado vazio, linha de pessoa | `feat(ui): <componente>` |
| B7 | Telas, **um commit por tela**, com textos já no i18n: Hoje (+ faixa do boss), Página lista, Página cards, Sidebar + barra inferior, Painel da tarefa | `feat(telas): Hoje no novo visual` ... |
| B8 | Restante das telas (Início, Caixa, Hábitos, Pastas, Perfil, Personagem, Loja, Clã, Convites), também migradas para o i18n | um commit por tela |
| B9 | Script Playwright de capturas (1280/390, claro/escuro) em `docs/screenshots/` + comparação com os mockups; checklist anti "cara de IA" por tela | `test(e2e): capturas das telas-chave` |

**Aceite:** 🚦 você aprova Hoje, Página (lista e cards), Sidebar e Painel da tarefa no app, lado a lado com os mockups. *Decisão em aberto V2 #4 (tipografia e acento) fecha aqui.*

## Fase C — Estrutura e velocidade (28/10 – 03/11)

| # | Tarefa | Commit sugerido |
|---|---|---|
| C1 | Migração: `folders.kind` (`folder`/`project`), ícone/cor padrão por tipo; sidebar com seções Pastas e Projetos | `feat(estrutura): pasta e projeto` |
| C2 | Menu "+ Novo" (Tarefa · Página · Pasta · Projeto · Hábito · Criação avançada), Ctrl+N e letras T/P/F/J/H, padrão pelo contexto | `feat(estrutura): menu + Novo` |
| C3 | "Mover para…" por comando e por arrastar entre pasta/projeto | `feat(estrutura): mover itens` |
| C4 | Seletor de ícones (Phosphor ou Lucide + emoji), busca pt/en/es, recentes/favoritos, id estável (`ph:barbell`) | `feat(icones): seletor` |
| C5 | Edição inline com F2 (nome + ícone/cor), Enter/Esc/Tab | `feat(edicao): F2 inline` |
| C6 | Atalhos da V2 §9 no registro (seleção, J/K, Space/X, 1-2-3, D, A, G+H/I/M, Ctrl+D, Ctrl+B, Delete com desfazer) | `feat(atalhos): navegação e ações em lista` (pode ser 2–3 commits) |
| C7 | Paleta de comandos (Ctrl+K) lendo o registro | `feat(atalhos): paleta de comandos` |
| C8 | Criação/edição avançada: painel lateral (desktop) / tela deslizante (celular), seções recolhíveis, Ctrl+Shift+N, Ctrl+E, Ctrl+Enter | `feat(avancado): painel de criação/edição` (tarefa, hábito, página, pasta/projeto em commits separados) |
| C9 | Rota `/ajuda` com a tabela de atalhos gerada do registro e o atalho `?` | `feat(ajuda): rota e tabela de atalhos` |
| C10 | E2E do aceite | `test(e2e): fase C sem mouse` |

**Aceite:** criar pasta + página + 10 tarefas em lote, renomear com F2 e trocar ícone sem usar o mouse.

## Fase D — Offline-first e sync (04/11 – 13/11)

Decidido na A7: **PowerSync** (D75). A tabela abaixo é a do protocolo próprio; com PowerSync, D3/D4 viram configuração (Sync Streams + `uploadData`) e a fase começa pelo protótipo:

| D0 | Protótipo PowerSync validando os riscos do `docs/SPIKE_SYNC.md` |

| # | Tarefa |
|---|---|
| D1 | Migração "sync-ready" em todas as tabelas sincronizáveis: `deleted_at`, `version`, `updated_by`, `change_seq` global; ids UUID v7 gerados no cliente |
| D2 | `LocalStore` (interface) + implementação `expo-sqlite` (nativo) e web (SQLite WASM ou IndexedDB) |
| D3 | Outbox de mutations com `mutation_id`, worker em lote, `sync/push` idempotente com checagem de permissão por mutation |
| D4 | `sync/pull` por cursor, snapshot inicial paginado, Realtime só como aviso, evento de revogação apagando dados locais |
| D5 | Conflitos: LWW por campo (HLC), conclusão como evento, conjuntos para etiquetas/subtarefas, `conflict_copies` nas notas |
| D6 | Telas lendo do `LocalStore` (troca do TanStack Query por leitura local, tela por tela — um commit por tela) |
| D7 | Lixeira 30 dias + rotina de retenção de tombstones; `docs/OPERACOES.md` (backup/restauração) |
| D8 | Indicador de sync (ponto) + tela "Estado da sincronização" |
| D9 | XP/boss otimista marcado como pendente, substituído pelo oficial |
| D10 | Testes da V2 §2.8 (dois clientes, reenvio, criar→editar→excluir offline, revogação, queda no meio do push) |

**Aceite:** editar no celular em modo avião e no navegador ao mesmo tempo, reconectar e os dois chegarem ao mesmo estado.

## Fase E — Times, cargos e projetos (16/11 – 20/11)

🚦 *Antes de começar: nome dos itens dentro de Projeto (proposta "Listas") e se cargos personalizados entram já (decisões V2 #1 e #3).*

| # | Tarefa |
|---|---|
| E1 | Tabelas `teams`, `team_members` (Dono/Admin/Membro/Convidado), RLS + pgTAP de isolamento entre times |
| E2 | Cargo no projeto sobrescrevendo o do time; presets via permissões atômicas; `can()` no banco usado pelas policies |
| E3 | Convite com validade/limite de usos e por e-mail; pedido de entrada com aprovação opcional |
| E4 | Tela Time e cargos; sempre 1 Dono; log de auditoria do time |
| E5 | Cargos personalizados (se aprovado) |
| E6 | Marcos (`milestones`) e visão geral do projeto (progresso, marcos, membros, atividade, boss) |
| E7 | `@nome` com autocomplete; captura some para Leitor |
| E8 | E2E do cenário "Churrasco" |

## Fase G — Subtarefas e WBS (23/11 – 25/11)

🚦 *Limite padrão de profundidade = 4? (V3 #1)*

| # | Tarefa |
|---|---|
| G1 | `config/limits.ts`; `tasks.depth`, `max_depth` em página/projeto; trigger de profundidade e de ciclo na árvore |
| G2 | Só folhas geram XP; progresso do pai por folhas (régua fina); concluir pai automaticamente (config) |
| G3 | Herança de responsável/etiquetas; aviso de data do filho > pai; rollup de estimativa |
| G4 | Teclado: Tab/Shift+Tab, Ctrl+↑↓, →/← respeitando o limite |
| G5 | Códigos WBS (toggle `W`) e visão "Estrutura" |
| G6 | Lote achatando indentação além do limite, com aviso na pré-visualização |
| G7 | Testes: criar/mover/lote/redução de limite, cliente e servidor |

## Fase H — Dependências e estados (26/11 – 01/12)

🚦 *Modo padrão estrito ou flexível? (V3 #2)*

| # | Tarefa |
|---|---|
| H1 | `task_dependencies` (lag, `deps_mode`), detecção de ciclo no servidor com o caminho na mensagem |
| H2 | Estados derivados (`bloqueada`/`pronta`) numa função pura, idêntica no app e no banco, com os mesmos casos de teste |
| H3 | `started_at` (botão Iniciar, atalho S); modo estrito/flexível com "forçar" auditado |
| H4 | Notificação de desbloqueio e de reabertura de pré-requisito |
| H5 | Campo "Depende de / Libera" no painel e atalho L |
| H6 | Sintaxe `^` na captura e no lote (`^2` por linha) |
| H7 | E2E "carvão → fogo", inclusive após sync offline |

## Fase I — Fluxo, pessoas e auditoria (02/12 – 08/12)

🚦 *Biblioteca do grafo e nomes das visões (V3 #3 e #5).*

| # | Tarefa |
|---|---|
| I1 | `task_events` (só inserção) gravado por trigger; aba Histórico na tarefa |
| I2 | Abas do Projeto: Lista (indicadores) · Fluxo · Pessoas · Linha do tempo |
| I3 | Visão Fluxo (grafo com layout automático, raias, "você está aqui", caminho crítico); alternativa em lista acessível |
| I4 | Visão Pessoas (fazendo / pronta / bloqueada / concluída) |
| I5 | Linha do tempo filtrável + exportação CSV; permissão `workflow.view_audit` |
| I6 | Indicadores (tempo por estado, espera, gargalos, atrasos) |
| I7 | Dependência entre páginas (X%) e vínculos "Relacionados" |

## Fase J — Repetições, descanso e Modo Treino (09/12 – 15/12)

| # | Tarefa |
|---|---|
| J1 | `repeat_plan` + `task_progress`; atalho `3x12`/`x5` na captura |
| J2 | Tabela `timers` com `ends_at` absoluto, um ativo por usuário, sincronizado |
| J3 | Timer de descanso: +30/−30/Pular, notificação local (`expo-notifications`), vibração (`expo-haptics`) |
| J4 | Web: Notification + Service Worker, Wake Lock, Web Audio; limitações documentadas |
| J5 | Modo Treino em tela cheia (Space = série feita, R = pular descanso), resumo final, offline |
| J6 | XP só na conclusão final, validado no servidor; testes de timer em segundo plano |

## Fase K — Pomodoro e tempo (16/12 – 18/12)

| # | Tarefa |
|---|---|
| K1 | Pomodoro (config, ciclos, mini-barra, atalho P) usando os timers da J |
| K2 | Sugestões de pausa personalizáveis (`pomodoro_settings`) |
| K3 | Cronômetro por tarefa (Shift+T), `time_entries`, lançamento manual, rollup no pai |
| K4 | Estatísticas simples; XP de pomodoro com limite diário no servidor |

## Fase L — Página enviada (21/12 – 25/12)

🚦 *Modo padrão "ao vivo" ou "cópia"? (V3 #4)*

| # | Tarefa |
|---|---|
| L1 | `page_shares`, preset Executor, RLS + pgTAP (aluno A nunca vê o B; Executor não edita estrutura via API) |
| L2 | Progresso por usuário (`task_completions` por tarefa, usuário e ciclo) |
| L3 | "Enviar para…": link/e-mail, modo, vários destinatários; quem não tem conta cai direto na página |
| L4 | Seção "Recebidas" na sidebar |
| L5 | Painel "Alunos" (aderência, histórico, gráfico de cargas, lembrete) |
| L6 | E2E treinador → 2 alunos, offline do aluno |

## Fase M — Extras "A" e automações (28/12 – 01/01)

| # | Tarefa |
|---|---|
| M1 | Adiar (snooze) com 1 gesto |
| M2 | Reivindicar tarefa ("eu levo") |
| M3 | Estimativa e peso (alimentam WBS, caminho crítico e dano) |
| M4 | Meu dia + Próxima ação |
| M5 | Campos personalizados por página |
| M6 | Automações "quando… então…" com limite e proteção contra laço |
| M7 | Tarefa do tipo Aprovação |

## Fase F — Ajuda, polimento e idiomas (04/01 – 07/01)

| # | Tarefa |
|---|---|
| F1 | Artigos da Ajuda (V2 §10 + V3 §9) em `content/help/{pt-BR,en,es}/` |
| F2 | Tour inicial opcional (3 passos) e "?" contextual |
| F3 | Revisão das traduções (incluindo parser de datas e `^`/`3x12` em en/es) |
| F4 | Revisão de acessibilidade (AA, foco, teclado, `prefers-reduced-motion`) e performance (pendência D70) |
| F5 | Capturas finais e revisão contra o checklist anti "cara de IA" |

---

## Riscos

1. **Sync (Fase D)** é a maior incerteza: reescreve como as telas leem dados. Se o spike apontar PowerSync, a D encurta; com protocolo próprio, pode passar de 8 dias.
2. **Portões visuais da B**: cada rodada de ajuste de mockup adia o resto.
3. **Grafo no celular** (I3): React Flow é só web; no nativo a visão será mais simples.
4. **Timers em segundo plano no iOS/PWA** (J4) têm limites da plataforma; o aceite precisa de teste em aparelho.
5. **i18n retroativo**: todas as telas atuais têm texto fixo; a extração acontece junto com o redesign (B7/B8) para não tocar cada tela duas vezes.
