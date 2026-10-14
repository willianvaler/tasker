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
- [ ] **C4** Seletor de ícones (Phosphor ou Lucide + emoji), busca pt/en/es, recentes/favoritos, id estável (`ph:barbell`)
- [ ] **C5** Edição inline com F2 (nome + ícone/cor), Enter/Esc/Tab
- [ ] **C6** Atalhos da V2 §9 no registro (seleção, J/K, Space/X, 1-2-3, D, A, G+H/I/M, Ctrl+D, Ctrl+B, Delete com desfazer)
- [ ] **C7** Paleta de comandos (Ctrl+K) lendo o registro
- [ ] **C8** Criação/edição avançada: painel lateral (desktop) / tela deslizante (celular), seções recolhíveis, Ctrl+Shift+N, Ctrl+E, Ctrl+Enter
- [ ] **C9** Rota `/ajuda` com a tabela de atalhos gerada do registro e o atalho `?`
- [ ] **C10** E2E do aceite

## Fase D — Offline-first e sync (04/11 – 13/11)

- [ ] **D0** Protótipo PowerSync (riscos do fim do `docs/SPIKE_SYNC.md`): serviço local, Sync Streams por membro, leitura local na web e no development build, escrita offline até a RPC, revogação
- [ ] **D1** Migração "sync-ready" em todas as tabelas sincronizáveis: `deleted_at`, `version`, `updated_by`, `change_seq` global; ids UUID v7 gerados no cliente
- [ ] **D2** `LocalStore` (interface) + implementação `expo-sqlite` (nativo) e web (SQLite WASM ou IndexedDB)
- [ ] **D3** Outbox de mutations com `mutation_id`, worker em lote, `sync/push` idempotente com checagem de permissão por mutation
- [ ] **D4** `sync/pull` por cursor, snapshot inicial paginado, Realtime só como aviso, evento de revogação apagando dados locais
- [ ] **D5** Conflitos: LWW por campo (HLC), conclusão como evento, conjuntos para etiquetas/subtarefas, `conflict_copies` nas notas
- [ ] **D6** Telas lendo do `LocalStore` (troca do TanStack Query por leitura local, tela por tela — um commit por tela)
- [ ] **D7** Lixeira 30 dias + rotina de retenção de tombstones; `docs/OPERACOES.md` (backup/restauração)
- [ ] **D8** Indicador de sync (ponto) + tela "Estado da sincronização"
- [ ] **D9** XP/boss otimista marcado como pendente, substituído pelo oficial
- [ ] **D10** Testes da V2 §2.8 (dois clientes, reenvio, criar→editar→excluir offline, revogação, queda no meio do push)

## Fase E — Times, cargos e projetos (16/11 – 20/11)

- [ ] **E1** Tabelas `teams`, `team_members` (Dono/Admin/Membro/Convidado), RLS + pgTAP de isolamento entre times
- [ ] **E2** Cargo no projeto sobrescrevendo o do time; presets via permissões atômicas; `can()` no banco usado pelas policies
- [ ] **E3** Convite com validade/limite de usos e por e-mail; pedido de entrada com aprovação opcional
- [ ] **E4** Tela Time e cargos; sempre 1 Dono; log de auditoria do time
- [ ] **E5** Cargos personalizados (se aprovado)
- [ ] **E6** Marcos (`milestones`) e visão geral do projeto (progresso, marcos, membros, atividade, boss)
- [ ] **E7** `@nome` com autocomplete; captura some para Leitor
- [ ] **E8** E2E do cenário "Churrasco"

## Fase G — Subtarefas e WBS (23/11 – 25/11)

- [ ] **G1** `config/limits.ts`; `tasks.depth`, `max_depth` em página/projeto; trigger de profundidade e de ciclo na árvore
- [ ] **G2** Só folhas geram XP; progresso do pai por folhas (régua fina); concluir pai automaticamente (config)
- [ ] **G3** Herança de responsável/etiquetas; aviso de data do filho > pai; rollup de estimativa
- [ ] **G4** Teclado: Tab/Shift+Tab, Ctrl+↑↓, →/← respeitando o limite
- [ ] **G5** Códigos WBS (toggle `W`) e visão "Estrutura"
- [ ] **G6** Lote achatando indentação além do limite, com aviso na pré-visualização
- [ ] **G7** Testes: criar/mover/lote/redução de limite, cliente e servidor

## Fase H — Dependências e estados (26/11 – 01/12)

- [ ] **H1** `task_dependencies` (lag, `deps_mode`), detecção de ciclo no servidor com o caminho na mensagem
- [ ] **H2** Estados derivados (`bloqueada`/`pronta`) numa função pura, idêntica no app e no banco, com os mesmos casos de teste
- [ ] **H3** `started_at` (botão Iniciar, atalho S); modo estrito/flexível com "forçar" auditado
- [ ] **H4** Notificação de desbloqueio e de reabertura de pré-requisito
- [ ] **H5** Campo "Depende de / Libera" no painel e atalho L
- [ ] **H6** Sintaxe `^` na captura e no lote (`^2` por linha)
- [ ] **H7** E2E "carvão → fogo", inclusive após sync offline

## Fase I — Fluxo, pessoas e auditoria (02/12 – 08/12)

- [ ] **I1** `task_events` (só inserção) gravado por trigger; aba Histórico na tarefa
- [ ] **I2** Abas do Projeto: Lista (indicadores) · Fluxo · Pessoas · Linha do tempo
- [ ] **I3** Visão Fluxo (grafo com layout automático, raias, "você está aqui", caminho crítico); alternativa em lista acessível
- [ ] **I4** Visão Pessoas (fazendo / pronta / bloqueada / concluída)
- [ ] **I5** Linha do tempo filtrável + exportação CSV; permissão `workflow.view_audit`
- [ ] **I6** Indicadores (tempo por estado, espera, gargalos, atrasos)
- [ ] **I7** Dependência entre páginas (X%) e vínculos "Relacionados"

## Fase J — Repetições, descanso e Modo Treino (09/12 – 15/12)

- [ ] **J1** `repeat_plan` + `task_progress`; atalho `3x12`/`x5` na captura
- [ ] **J2** Tabela `timers` com `ends_at` absoluto, um ativo por usuário, sincronizado
- [ ] **J3** Timer de descanso: +30/−30/Pular, notificação local (`expo-notifications`), vibração (`expo-haptics`)
- [ ] **J4** Web: Notification + Service Worker, Wake Lock, Web Audio; limitações documentadas
- [ ] **J5** Modo Treino em tela cheia (Space = série feita, R = pular descanso), resumo final, offline
- [ ] **J6** XP só na conclusão final, validado no servidor; testes de timer em segundo plano

## Fase K — Pomodoro e tempo (16/12 – 18/12)

- [ ] **K1** Pomodoro (config, ciclos, mini-barra, atalho P) usando os timers da J
- [ ] **K2** Sugestões de pausa personalizáveis (`pomodoro_settings`)
- [ ] **K3** Cronômetro por tarefa (Shift+T), `time_entries`, lançamento manual, rollup no pai
- [ ] **K4** Estatísticas simples; XP de pomodoro com limite diário no servidor

## Fase L — Página enviada (21/12 – 25/12)

- [ ] **L1** `page_shares`, preset Executor, RLS + pgTAP (aluno A nunca vê o B; Executor não edita estrutura via API)
- [ ] **L2** Progresso por usuário (`task_completions` por tarefa, usuário e ciclo)
- [ ] **L3** "Enviar para…": link/e-mail, modo, vários destinatários; quem não tem conta cai direto na página
- [ ] **L4** Seção "Recebidas" na sidebar
- [ ] **L5** Painel "Alunos" (aderência, histórico, gráfico de cargas, lembrete)
- [ ] **L6** E2E treinador → 2 alunos, offline do aluno

## Fase M — Extras "A" e automações (28/12 – 01/01)

- [ ] **M1** Adiar (snooze) com 1 gesto
- [ ] **M2** Reivindicar tarefa ("eu levo")
- [ ] **M3** Estimativa e peso (alimentam WBS, caminho crítico e dano)
- [ ] **M4** Meu dia + Próxima ação
- [ ] **M5** Campos personalizados por página
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
| V3-4 | Página enviada: ao vivo ou cópia por padrão? | antes da L | |
| V3-6 | Quais itens B sobem de prioridade | depois da M | |
