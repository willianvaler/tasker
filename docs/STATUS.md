# Status

Andamento das tarefas do `docs/CRONOGRAMA.md`. Atualize **no mesmo commit** da tarefa: `[ ]` pendente · `[~]` em andamento · `[x]` feito. O commit da tarefa leva o id no fim da mensagem (`git log --grep "\[A1\]"`).

Base: Fases 0 a 7 do `ESCOPO.md` concluídas (ver `DECISIONS.md`, D1 a D70).


## Fase A — Auditoria e fundação (14/10 – 16/10)

- [x] **A1** `docs/AUDITORIA.md`: stack real, o que existe do ESCOPO, lacunas, dívidas (inclui a pendência da D70)
- [x] **A2** `CLAUDE.md` aponta para V2/V3 e para a regra "ao concluir, atualize `docs/STATUS.md`"; `DECISIONS.md` com a tabela "Ajustes à stack real" do cronograma
- [x] **A3** Infra de i18n: `i18next` + `react-i18next` + `expo-localization`, `locales/pt-BR.json`, `en.json`, `es.json`, detecção de idioma
- [x] **A4** Teste que falha se uma chave existir num idioma e faltar em outro; seletor de idioma no Perfil, salvo em `profiles.locale`
- [x] **A5** Permissões como dados: catálogo de permissões atômicas (já com as da V3 §8), presets Gerente/Editor/Colaborador/Leitor, função única `can(user, action, resource)` no app e espelho no banco; mapear os papéis atuais (owner/editor/viewer)
- [x] **A6** Registro central de atalhos `shortcuts.ts` (id, teclas, chave i18n, escopo, permissão); migrar os atalhos existentes (N, Ctrl+K) para ele
- [x] **A7** Spike de sync: pesquisa em `docs/SPIKE_SYNC.md`, decisão D75 (PowerSync). O protótipo virou a D0

## Fase B — Correção visual (19/10 – 27/10)

- [x] **B1** `docs/DESIGN.md`: direção "Caderno de bolso", tokens (cores claro/escuro, escala 4–48, tipografia 12/14/16/20/28, pesos 400/600, raios 4/8, durações)
- [x] **B2** Mockups HTML/CSS estáticos em `docs/mockups/`: Hoje, Página lista, Página cards, Sidebar, Painel da tarefa — claro/escuro, 1280 e 390 px
- [~] **B3** Você aprova os mockups. Ajustes viram commits `docs(mockups): ajuste ...` — o dono pediu para seguir sem parar (13/10); revisão depois, nas capturas da B9
- [x] **B4** Tokens no `tailwind.config.js`/`global.css`; fontes (Fraunces/Newsreader, Instrument Sans/Hanken, JetBrains/Plex Mono) via `expo-font`; lint que barra hex solto
- [x] **B5** Página `/design` (só em dev)
- [x] **B6** Componentes-base, um commit por componente: botão (primário/fantasma), campo, checkbox "carimbo", linha de tarefa (40/52 px, risco de caneta), chip, item de sidebar, popover, painel lateral, folha inferior, toast, estado vazio, linha de pessoa
- [x] **B7** Telas, um commit por tela, com textos já no i18n: Hoje (+ faixa do boss), Página lista, Página cards, Sidebar + barra inferior, Painel da tarefa
- [x] **B8** Restante das telas (Início, Caixa, Hábitos, Pastas, Perfil, Personagem, Loja, Clã, Convites), também migradas para o i18n
- [x] **B9** Script Playwright de capturas (1280/390, claro/escuro) em `docs/screenshots/` + comparação com os mockups; checklist anti "cara de IA" por tela

## Fase C — Estrutura e velocidade (28/10 – 03/11)

- [x] **C1** Migração: `folders.kind` (`folder`/`project`), ícone/cor padrão por tipo; sidebar com seções Pastas e Projetos
- [x] **C2** Menu "+ Novo" (Tarefa · Página · Pasta · Projeto · Hábito · Criação avançada), Ctrl+N e letras T/P/F/J/H, padrão pelo contexto
- [x] **C3** "Mover para…" por comando e por arrastar entre pasta/projeto — por comando ("Mover para…" nas opções da página); arrastar entre pastas fica para depois
- [x] **C4** Seletor de ícones (Phosphor ou Lucide + emoji), busca pt/en/es, recentes/favoritos, id estável (`ph:barbell`)
- [x] **C5** Edição inline com F2 (nome + ícone/cor), Enter/Esc/Tab
- [x] **C6** Atalhos da V2 §9 no registro (seleção, J/K, Space/X, 1-2-3, D, A, G+H/I/M, Ctrl+D, Ctrl+B, Delete com desfazer) — feitos: Espaço/X, 1-2-3, D, A, Ctrl+↑↓, Delete com desfazer, Ctrl+D, Ctrl+Z, Ctrl+B, G H/I/M, Q/N. Pendentes: →← (expandir/recolher, junto da árvore WBS na G), Shift+Z (refazer), remapear atalhos
- [x] **C7** Paleta de comandos (Ctrl+K) lendo o registro
- [x] **C8** Criação/edição avançada: painel lateral (desktop) / tela deslizante (celular), seções recolhíveis, Ctrl+Shift+N, Ctrl+E, Ctrl+Enter
- [x] **C9** Rota `/ajuda` com a tabela de atalhos gerada do registro e o atalho `?`
- [x] **C10** E2E do aceite

## Fase D — Offline-first e sync (04/11 – 13/11)

- [x] **D0** Protótipo PowerSync: serviço local (`npm run sync:start`), Sync Streams por membro, banco local na web, escrita offline pela fila até as RPCs, revogação; tela `/sync` e `e2e/sync.spec.ts` (D82). Falta provar o op-sqlite num development build
- [x] **D1** Ids UUID v7 no app (`lib/uuid.ts`), `version`/`updated_by`/`updated_at` em pastas, páginas e tarefas; `change_seq` e `deleted_at` não entram com PowerSync, a lixeira vira tabela própria na D7 (D83)
- [x] **D2** Banco local: é o SQLite do PowerSync (`lib/sync/db.ts` nativo com op-sqlite, `db.web.ts` com wa-sqlite em worker), feito na D0; não há `LocalStore` próprio (D84)
- [x] **D3** Fila: a do PowerSync; o `uploadData` manda só as colunas com grant, cria tarefa pelo `create_tasks_batch` e as ações de RPC pela tabela local `commands` → `run_once` (chave de idempotência, tabela `applied_ops`); erro definitivo descarta, erro de rede repete (D84)
- [x] **D4** Leitura: Sync Streams com responsáveis, comentários, conclusões, perfis (o meu inteiro; dos outros, nome e avatar); revogação e reenvio cobertos no `e2e/sync.spec.ts`
- [x] **D5** Conflitos: campo a campo (o aparelho só manda o que mudou), notas com cópia da versão perdida (`conflict_copies`, `set_task_notes`, aviso "Ver versão anterior" no painel da tarefa), etiquetas como conjunto (`patch_task_labels`), conclusão como evento (já era); teste de dois aparelhos offline no `e2e/sync.spec.ts` (D85)
- [x] **D6** Telas lendo e gravando no banco do aparelho: tarefas (página, Hoje, próximos dias, hábitos, conclusões, tarefa avulsa, progresso do projeto, Atribuídas a mim), árvore de pastas/páginas, membros, responsáveis e comentários (D86). Ficam no Supabase, com o cache do TanStack para abrir offline: perfil, gamificação (game_state), clã, notificações, atividade, convites e modelos, que dependem do servidor
- [x] **D7** Lixeira de 30 dias (`deleted_items`, `trash_list`, `restore_deleted`, tela `/lixeira` no Perfil e na paleta), retenção por cron (lixeira e `applied_ops`), exclusão de conta sem lixeira; `docs/OPERACOES.md` com backup e restauração (D87)
- [x] **D8** Ponto de estado na barra lateral (sincronizado / sincronizando / sem conexão / erro; o nome aparece no hover e leva à tela) e tela "Estado da sincronização" (`/sync`, no Perfil e na paleta): última sincronização, fila pendente por ação, erro, Forçar sincronização, Descartar mudanças locais; E2E com 4 workers (cada página roda o SQLite em WASM)
- [x] **D9** XP otimista: sem resposta do servidor (offline ou lento), concluir/kanban/hábito mostram "+~N XP (pendente)" no aviso e "+N XP pendente" na barra; quando o comando sobe, a estimativa some e o `game_state` oficial é relido (D88)
- [x] **D10** Testes da V2 §2.8 em `e2e/sync.spec.ts`: dois aparelhos offline na mesma tarefa chegam ao mesmo estado; reenvio sem duplicar (resposta perdida no meio do envio); criar → editar → apagar offline; removido do projeto com mudanças na fila (recusadas, dados saem do aparelho); mais revogação, descartar, XP pendente. **Aceite da Fase D** coberto na web; falta repetir com o celular em modo avião num development build (op-sqlite nunca rodou em aparelho). Pendência conhecida: janela de ~1 s após uma criação subir em que cortar a rede esconde a tarefa até reconectar (D89)

## Fase E — Times, cargos e projetos (16/11 – 20/11)

- [x] **E1** Tabelas `teams`, `team_members` (Dono/Admin/Membro/Convidado), RLS + pgTAP de isolamento entre times
- [x] **E2** Cargo no projeto sobrescrevendo o do time; presets via permissões atômicas; `can()` no banco usado pelas policies
- [x] **E3** Convite com validade/limite de usos e por e-mail; pedido de entrada com aprovação opcional
- [x] **E4** Tela Time e cargos; sempre 1 Dono; log de auditoria do time
- [x] **E5** Cargos personalizados (se aprovado)
- [x] **E6** Marcos (`milestones`) e visão geral do projeto (progresso, marcos, membros, atividade, boss)
- [x] **E7** `@nome` com autocomplete; captura some para Leitor
- [x] **E8** E2E do cenário "Churrasco"

## Fase G — Subtarefas e WBS (23/11 – 25/11)

- [x] **G1** `config/limits.ts`; `tasks.depth`, `max_depth` em página/projeto; trigger de profundidade e de ciclo na árvore
- [x] **G2** Só folhas geram XP; progresso do pai por folhas (régua fina); concluir pai automaticamente (config)
- [x] **G3** Herança de responsável/etiquetas; aviso de data do filho > pai; rollup de estimativa
- [x] **G4** Teclado: Tab/Shift+Tab, Ctrl+↑↓, →/← respeitando o limite
- [x] **G5** Códigos WBS (toggle `W`) e visão "Estrutura"
- [x] **G6** Lote achatando indentação além do limite, com aviso na pré-visualização
- [x] **G7** Testes: criar/mover/lote/redução de limite, cliente e servidor

## Fase H — Dependências e estados (26/11 – 01/12)

- [x] **H1** `task_dependencies` (lag, `deps_mode`), detecção de ciclo no servidor com o caminho na mensagem
- [x] **H2** Estados derivados (`bloqueada`/`pronta`) numa função pura, idêntica no app e no banco, com os mesmos casos de teste
- [x] **H3** `started_at` (botão Iniciar, atalho S); modo estrito/flexível com "forçar" auditado
- [x] **H4** Notificação de desbloqueio e de reabertura de pré-requisito
- [x] **H5** Campo "Depende de / Libera" no painel e atalho L
- [x] **H6** Sintaxe `^` na captura e no lote (`^2` por linha)
- [x] **H7** E2E "carvão → fogo", inclusive após sync offline

## Fase I — Fluxo, pessoas e auditoria (02/12 – 08/12)

- [x] **I1** `task_events` (só inserção) gravado por trigger; aba Histórico na tarefa
- [x] **I2** Abas do Projeto: Lista (indicadores) · Fluxo · Pessoas · Linha do tempo
- [x] **I3** Visão Fluxo (grafo com layout automático, raias, "você está aqui", caminho crítico); alternativa em lista acessível
- [x] **I4** Visão Pessoas (fazendo / pronta / bloqueada / concluída)
- [x] **I5** Linha do tempo filtrável + exportação CSV; permissão `workflow.view_audit`
- [x] **I6** Indicadores (tempo por estado, espera, gargalos, atrasos)
- [x] **I7** Dependência entre páginas (X%) e vínculos "Relacionados"

## Fase J — Repetições, descanso e Modo Treino (09/12 – 15/12)

- [x] **J1** `repeat_plan` + `task_progress` (conta por pessoa, `log_rep`, conclui no total, desfazer reabre); atalho `3x12`/`x8` na captura e no lote; botão "2/4" na linha e no card, "Quantas vezes" no painel e na criação avançada (D123)
- [x] **J2** Tabela `timers` com `ends_at` absoluto, um ativo por usuário, sincronizado: RPCs `start_timer`/`update_timer` (também offline, vence quem iniciou por último), mini-barra flutuante, início pela paleta, E2E com dois aparelhos (D124)
- [x] **J3** Timer de descanso: começa sozinho depois da série (desfazer cancela), +30/−30/Pular na mini-barra e em grande no painel, notificação local agendada para o fim (`expo-notifications`), vibração (`expo-haptics`), permissão pedida no primeiro timer (D125). Falta testar a notificação num development build
- [x] **J4** Web: aviso pelo Service Worker (`public/sw.js`) com a aba escondida, `setTimeout` único para o fim, som por Web Audio, vibração onde houver, Wake Lock no descanso; limitações na D126
- [x] **J5** Modo Treino em tela cheia (`/treino/[id]`, "Iniciar treino" nos cards): Espaço = série feita, R = pular descanso, carga −/+, mais uma série, anterior/pular, pausa, resumo (tempo, séries, volume, XP), offline, tela acesa (D127). Corrigido o Espaço nos atalhos (nunca disparava)
- [x] **J6** XP só na conclusão final, validado no servidor (pgTAP: séries do meio, desfazer/refazer, reenvio); XP pendente só na série que conclui; E2E de timer em segundo plano com o relógio do Playwright (D128). **Aceite da Fase J** coberto na web; falta o aviso com o celular bloqueado num development build

## Fase K — Pomodoro e tempo (16/12 – 18/12)

- [x] **K1** Pomodoro (config, ciclos, mini-barra, atalho P) usando os timers da J: fases no config do timer, aviso com sugestão de pausa e botão da fase seguinte, `pomodoro_settings`, `time_entries` + `actual_minutes`, foco só conta se o servidor vê o fim (D129)
- [x] **K2** Sugestões de pausa personalizáveis (`pomodoro_settings`): tela `/pomodoro` com durações, ciclos, iniciar sozinho e a lista (ordenar, tirar, adicionar, sortear/em ordem, padrão do idioma) (D130)
- [x] **K3** Cronômetro por tarefa (Shift+T), `time_entries`, lançamento manual ("1h30 ontem"), apagar o próprio, rollup no pai; `log_time`/`delete_time_entry` também offline (D131)
- [x] **K4** Estatísticas simples (hoje, 7 dias, por tarefa; tempo do projeto por lista e pessoa); XP de pomodoro (5, foco ≥ 15 min, até 4/dia) no servidor, revertido ao apagar o registro (D132). **Fase K concluída**

## Fase L — Página enviada (21/12 – 25/12)

- [x] **L1** `page_shares` + `page_share_links`, preset Executor, RLS + pgTAP (aluno A nunca vê o B; Executor não edita estrutura via API), stream `received`, ator Executor no app (D133). Modo padrão: ao vivo
- [x] **L2** Progresso por usuário: `share_checks` por tarefa, usuário e ciclo (`check_item`, offline), séries do aluno pelo `log_rep`, autor acompanha; app troca o estado pelo do aluno e tira as recebidas das listas gerais (D134)
- [x] **L3** "Enviar para…": link (30 dias, revogável) e e-mail (vários), modo ao vivo/cópia, quem recebeu com revogar; `/enviada/<token>` cria a conta e cai direto na página; cópia vai para "Recebidas" (D135)
- [x] **L4** Seção "Recebidas" na barra lateral e na aba Pastas, com convites pendentes (Receber/Recusar) via `my_pending_shares` (D136)
- [x] **L5** Painel "Alunos": ciclo atual, aderência, última atividade, observações; histórico por ciclo com cargas e evolução; observação do aluno; lembrete (1/dia, notificação) e arquivar (D137)
- [x] **L6** E2E treinador → 2 alunos (treino em lote, link ao vivo; a aluna marca offline, cada um só vê o seu; o treinador vê ciclo e cargas de cada um). **Fase L concluída**

## Fase M — Extras "A" e automações (28/12 – 01/01)

- [x] **M1** Adiar com 1 gesto: botão na linha (hoje/atrasada → amanhã, com Desfazer) e atalho Z (D138)
- [x] **M2** Reivindicar tarefa ("eu levo"): botão na linha da tarefa de projeto sem responsável; policy `task_assignees_claim` (só a si, só vaga) (D139)
- [x] **M3** Estimativa e peso: peso 1–5 no painel (dano até 2×, XP igual), progresso da mãe pelo peso; a estimativa já alimentava soma e caminho crítico (D140)
- [x] **M4** Meu dia (`my_day`, painel, atalho M, ordem, tempo disponível) + Próxima ação ("Fazer agora" no Início e na Hoje) (D141)
- [x] **M5** Campos personalizados por página (`page_fields` + `tasks.custom`, 6 tipos, painel e linha) (D142)
- [ ] **M6** Automações "quando… então…" com limite e proteção contra laço
- [ ] **M7** Tarefa do tipo Aprovação

## Fase F — Ajuda, polimento e idiomas (04/01 – 07/01)

- [ ] **F1** Artigos da Ajuda (V2 §10 + V3 §9) em `content/help/{pt-BR,en,es}/`
- [ ] **F2** Tour inicial opcional (3 passos) e "?" contextual
- [ ] **F3** Revisão das traduções (incluindo parser de datas e `^`/`3x12` em en/es)
- [ ] **F4** Revisão de acessibilidade (AA, foco, teclado, `prefers-reduced-motion`) e performance (pendência D70)
- [ ] **F5** Capturas finais e revisão contra o checklist anti "cara de IA"

## Decisões em aberto

| # | Pergunta | Quando | Resposta |
|---|---|---|---|
| V2-2 | Engine de sync pronta ou protocolo próprio | A7 | **PowerSync** (D75, 13/10) |
| V2-4 | Tipografia e acento final | B3/B9 | |
| V2-1 / V3-5 | Nome dos itens dentro de Projeto (proposta: "Listas") e das visões | antes da E | |
| V2-3 | Cargos personalizados já na V2? | antes da E | |
| V2-5 | Hospedagem do servidor e do banco | antes da D7 | |
| V3-1 | Profundidade padrão 4? | antes da G | |
| V3-2 | Dependências: estrito ou flexível por padrão? | antes da H | |
| V3-3 | Biblioteca do grafo | antes da I | |
| V3-4 | Página enviada: ao vivo ou cópia por padrão? | antes da L | **Ao vivo** (D133, decidido na ausência do dono; a cópia continua no envio) |
| V3-6 | Quais itens B sobem de prioridade | depois da M | |
