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
- [x] **B3** Aprovação dos mockups: dispensada pelo dono em 19/10 (o app já passou deles; ajuste de visual vem do uso)
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
- [x] **C6** Atalhos da V2 §9 no registro (seleção, J/K, Space/X, 1-2-3, D, A, G+H/I/M, Ctrl+D, Ctrl+B, Delete com desfazer) — feitos: Espaço/X, 1-2-3, D, A, Ctrl+↑↓, Delete com desfazer, Ctrl+D, Ctrl+Z, Ctrl+B, G H/I/M, Q/N. →← (abrir/fechar subtarefas, na G); Shift+Z refaz e os atalhos podem ser trocados na tabela da Ajuda (19/10, D207)
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
- [x] **D10** Testes da V2 §2.8 em `e2e/sync.spec.ts`: dois aparelhos offline na mesma tarefa chegam ao mesmo estado; reenvio sem duplicar (resposta perdida no meio do envio); criar → editar → apagar offline; removido do projeto com mudanças na fila (recusadas, dados saem do aparelho); mais revogação, descartar, XP pendente. **Aceite da Fase D** coberto na web; falta repetir com o celular em modo avião num development build (op-sqlite nunca rodou em aparelho). A janela de ~1 s da D89 (cortar a rede logo depois de uma criação subir) não reproduz mais em 156 rodadas sob carga e virou teste de regressão (19/10, D209)

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
- [x] **M6** Automações "quando… então…": 5 gatilhos, 6 ações, até 20 por projeto, encadeamento até 3, uma vez por regra e tarefa, falha não desfaz; tela `/automacoes/[id]` (D143)
- [x] **M7** Tarefa do tipo Aprovação: pessoa, Gerente ou só o Dono conclui/reabre (guarda no servidor), marca na linha (D144). **Fase M concluída**

## Fase F — Ajuda, polimento e idiomas (04/01 – 07/01)

- [x] **F1** Artigos da Ajuda (V2 §10 + V3 §9) em `content/help/{pt-BR,en,es}/`: 15 por idioma, `help:build`, busca no texto, `/ajuda/<slug>` (D145)
- [x] **F2** Tour inicial opcional (a introdução de 3 passos, refazível pela Ajuda) e "?" contextual no cabeçalho das telas-chave (D146)
- [x] **F3** Revisão das traduções: parser em en/es (palavras, recorrência, ordem MM/DD em inglês), datas da tela no idioma, feed no i18n, artigos conferidos (D147). Notificações (tela 🔔 e push) nos três idiomas, o push no idioma do aparelho (19/10, D208)
- [x] **F4** Acessibilidade (contraste AA no tema claro com teste, foco, teclado, reduzir movimento) e desempenho (filtro por pastas nas consultas pelo servidor, pendência D70) (D148)
- [x] **F5** Capturas finais (48, inclusive treino, pomodoro e ajuda) e revisão contra o checklist anti "cara de IA" com correções (D149). **Fase F concluída: V2/V3 completos**

## Fase U — Pedidos do dono (15/10, antes da Fase O)

- [x] **U1** Seletor de modo: Treino, Foco (pomodoro) e Descanso num lugar só (D159)
- [x] **U2** Painel da tarefa simples × completo (D158)
- [x] **U3** Sem foco automático (teclado) ao abrir telas no toque (D154)
- [x] **U4** Assistente de primeiro uso (D160)
- [x] **U5** Permissão de notificações no navegador (Perfil) (D156)
- [x] **U6** Vibrar ao fim do timer (D157)
- [x] **U7** APK para Android e botão de baixar no Perfil (D155)

## ESCOPO_V5 (pedido do dono em 16/10: tela de bloqueio e usabilidade primeiro)

- [x] **X1** Treino pela tela de bloqueio (Android 14+): notificação fixa com Feita, Pular descanso e +30 s (D173)
- [x] **Y1** Revisão de usabilidade: percorrer as tarefas principais e anotar os atritos (`docs/USABILIDADE.md`)
- [x] **Y2** Corrigir os atritos encontrados (D174)
- [x] **Y3** Medir toques e teste formal com 3 a 5 pessoas: dispensado pelo dono em 19/10 (o teste segue com os testers de verdade, 2 hoje, e um encontro com times no fim de semana)
- [x] **Z1** Segurança do servidor no PC (D175): portão do `/supabase` e segredos próprios do Supabase local (`docs/OPERACOES.md`, "Segurança")
- [x] **Z2** Treino fecha sozinho com aviso de resumo; aviso preto fecha em 10 s sem reabrir (D176)
- [x] **Z3** Scripts para levar o app a um servidor com Linux Mint: empacotar e instalar (D177, `docs/SERVIDOR.md`)
- [x] **Z5** Segurança da web (V5 §3): CSP só relatando, testada para valer sem violação, e CORS do `/supabase` e `/powersync` só para o próprio endereço (19/10, D212)
- [x] **Z6** LGPD (V5 §4): termos de uso, política completa, aceite registrado no cadastro e para contas antigas, pedidos do titular com prazo, plano de incidente, backup diário, idade mínima de 13 (19/10, D213)
- [x] **Z4** Ambientes: alpha no servidor (segue a main), produção por tag (`npm run promover`) e lab no PC (`npm run lab`) (D178, `docs/AMBIENTES.md`)

## Fase W — Correções do dono (15/10, noite)

- [x] **W1** Esqueci minha senha e olhinho na senha (D165)
- [x] **W2** Bloco Projetos fixo com "+", configurações de projetos (Times sai do jogo) (D166)
- [x] **W3** Anotações simples (bloco acima de Pastas e Projetos; no Início no celular) (D167)
- [x] **W3.1** Anotações em Markdown: barra de formatação, visualização com `react-native-marked`, editor ocupando a tela; reabrir logo depois de criar não fica mais em branco (D187)
- [x] **W10** Ajuda: artigos como botões que abrem o texto no lugar, "?" das telas com o artigo aberto (D188)
- [x] **W11** Revisão das telas: rolagem principal com `ScreenScroll` (a barra de rolagem fica na margem, fora do texto) e telas de detalhe até 1024 px (D189)
- [x] **W12** Treino em grupo: o seletor "quem treina junto" aparece desde o grupo novo, e sozinho oferece o convite (D193)
- [x] **W4** Descrição em tarefas e hábitos ("+ adicionar descrição", até 4.000 caracteres) (D168)
- [x] **W5** Painel da tarefa mais largo; busca de Relacionar legível (D169)
- [x] **W6** Clicar fora do painel fecha e salva (D170)
- [x] **W7** Modo Treino fácil de achar (D171)
- [x] **W8** `ESCOPO_V5.md`: relógio, tela de bloqueio, usabilidade, HTTPS, LGPD, e-mail, restauração de conta
- [x] **W9** HTTPS: mandar `http://` para `https://` e cabeçalhos de segurança (D172)

## ESCOPO_V4 (plano em `docs/CRONOGRAMA.md`)

- [x] **N1** Storage + `task_attachments` + RLS (D150)
- [x] **N2** Anexar no painel, compressão WebP e miniatura no aparelho (D151)
- [x] **N3** Anexo offline (fila) (D152)
- [x] **N4** Limites e E2E (D153)
- [x] **O1** Boss diário no servidor (D161)
- [x] **O2** Calibragem do dano (D162)
- [x] **O3** Aviso com o dano nos bosses e limite atingido (D163)
- [x] **O4** Boss diário nas telas (D164)
- [x] **V1** Sessão que sobrevive ao servidor fora do ar (V4 §7.1, D179)
- [x] **P1** Raridade das conquistas, % de jogadores e progresso das séries (D180)
- [x] **P2** 35 conquistas novas (68 no total), 4 secretas, concessão pelas séries e textos nos 3 idiomas (D180)
- [x] **P3** Tela de conquistas com filtros, próximas da faixa, secretas e cores de raridade no tema (D180)
- [x] **Q1** Inventário (tela própria) e itens com 5 raridades no i18n e nos tokens (D181)
- [x] **Q2** Configurações só no Perfil (já estava); Perfil e Personagem levam a Inventário e Conquistas (D181)
- [x] **R1** Renascer: do nível 20, volta ao 1 com ouro, itens e conquistas; +5% de XP por renascimento até +25%; bosses solo recomeçam; conquistas próprias (19/10, D210)
- [x] **S1** Página de entrada: apresentação com capturas antes do login, formulário ao lado (computador) ou no fim (celular) (19/10, D211)
- [ ] **T1** Planos e assinaturas (modelo)
- [ ] **T2** Provedor de pagamento (bloqueado: decisão e contas do dono)

## ESCOPO_V6 — academia (tarefas em `docs/TAREFAS_V6.md`)

- [x] **AC0** Decisões do V6, app para quem treina, lista de tarefas e tipos comuns
- [x] **AC1.1** `profiles.gym_enabled` (null = não respondeu; só pela RPC `set_gym_mode`) e `profiles.ui_prefs` (objeto, até 4 KB), com pgTAP (D182)
- [x] **AC1.2** `lib/sidebar-blocks.ts`: ordem padrão, ordem salva (bloco novo entra no lugar certo), subir/descer, esconder (feito pelo Claude: a fila local foi parada)
- [x] **AC1.3** `lib/move-sibling.ts`: nova posição para subir/descer entre irmãs (feito pelo Claude)
- [x] **AC1.4** Componente `GymQuestion` com os textos nos 3 idiomas (feito pelo Claude)
- [x] **AC1.5** Pasta de sistema Academia (`folders.is_gym`, uma por conta, não vira projeto nem subpasta), criada ao ligar; `tree.gym` (D182)
- [x] **AC1.6** Bloco Academia na barra lateral e na aba Pastas (acima de Projetos, com os treinos direto), "+ Novo treino" cria página de cards com reinício semanal (D182)
- [x] **AC1.7** Perfil → "Barra lateral": subir, descer e esconder blocos (salvo em `ui_prefs`, vale em todos os aparelhos); a barra lateral e a aba Pastas seguem a ordem (D182)
- [x] **AC1.8** "Mover para cima / para baixo" no menu de pasta e página (irmãs do mesmo bloco ou da mesma pasta-mãe) e Alt+↑/↓ na pasta ou página aberta
- [x] **AC1.9** "Vai usar para treinar?" no Início (uma vez, depois da introdução, enquanto `gym_enabled` é nulo) e o interruptor Modo academia no Perfil; E2E `e2e/academia.spec.ts` e Ajuda nos 3 idiomas
- [x] **AC10.1** Sessão de treino no servidor (`workout_sessions`, `workout_session_members`): convite com aviso e push, entrar/sair, série do grupo (`log_group_set`, quem marca a última conclui), exercício atual e descanso iguais nos aparelhos pelo Realtime; E2E `e2e/treino-junto.spec.ts` (D183)
- [x] **AC10.2** Seletor "Quem está treinando junto agora?" no Modo Treino de pasta compartilhada (D183)
- [x] **AC10.3** `lib/gym/leaderboard.ts`: dias ativos (um por dia), pontos opcionais, empates dividindo a posição, sequência atual e maior; `challengeProgress` (feito pelo Claude, tirado da fila local)
- [x] **AC10.4** Desafios de projeto ou time (`start_challenge` com duração em dias, `challenge_board`), dia de treino no servidor (`workout_days`: página de treino concluída ou 30 min ou mais na sessão), mural e chat (`group_posts`, reações, foto no bucket `group-photos`), RLS e pgTAP (D184)
- [x] **AC10.5** Tela Treino em grupo (`/grupo/projeto|time/<id>`: Desafios com ranking e "Iniciar novo desafio", Mural com check-in, foto, reações e comentários, Chat), botão no projeto e no time, aviso `challenge_started`; E2E `e2e/desafios.spec.ts` e Ajuda nos 3 idiomas (D184). Prêmio para os primeiros fica com o AC11
- [x] **AC10.6** Correções do dono (18/10): grupo de treino no bloco Academia (`folders.gym_group`, convite pelo link, treinos do grupo, seletor de quem treina junto), Séries · Repetições · Carga · Descanso no painel do exercício gravando o plano do Modo Treino (descanso e aviso na tela de bloqueio de volta), sem pomodoro e cronômetro em página de treino; pgTAP, E2E `e2e/grupo-treino.spec.ts` e Ajuda nos 3 idiomas (D186)

## ESCOPO_V8 — modo jogo e identidade visual (pedido do dono em 19/10)

- [x] **HB0** Identidade visual: símbolo limpo no ComfyUI (FLUX.2 klein) e redesenhado em vetor (`assets/brand/`, gerador `gerar.py`); ícone, ícone adaptativo e monocromático do Android, splash claro/escuro, favicon, peças da Google Play; `BrandMark` no login e na barra lateral (D190)
- [x] **HB0.1** Acento laranja da marca nos tokens do app: `#A94604` no claro (AA), `#FF8A3D` no escuro (D192)
- [x] **HB0.2** Ícones da web como app: manifesto, ícones 192/512/maskable, apple-touch-icon, theme-color (D198)
- [x] **HB1** Hábitos: − e + lado a lado na direita (`hábito  |−| |+|`), no bom/ruim e no contador (D191)
- [x] **HB2** Força do hábito bom/ruim (barra de cor pelo valor, regra do Habitica) e hábito só bom ou só ruim (D194)
- [x] **HB3** Três níveis de jogo no Perfil: Desligado, Leve e Completo (D195)
- [x] **HB4** Início como acampamento no Completo: personagem, bosses com fala, missões do dia (D196)
- [x] **HB5** Vida e diárias, "o que você fez ontem?", taverna, poção; morte: vida por 500 de ouro ou recomeçar do nível 1 (D197, D199)
- [x] **HB6** Mana, 4 habilidades por classe e dia perfeito (D200)
- [x] **HB7** Recompensas personalizadas e baú encantado (D201)
- [x] **HB8** Mascotes e montarias: drops, chocar, alimentar, estábulo (D202)
- [x] **HB9** Missões com história, sozinho ou com o clã (D203)
- [x] **HB10** Retrato pintado sobre cenário, equipamento de batalha com atributos e fantasia (D204)
- [x] **HB11** Arte no ComfyUI (79 imagens), vocabulário de jogo, celebrações e sons (D205)
- [x] **LB1** Horário nas tarefas e lembretes (servidor, celular e web; feed .ics com hora) (D206)

## ESCOPO_V6 — correções do Modo Treino (pedido do dono em 19/10)

- [x] **TR1** Descanso entre um exercício e o próximo no Modo Treino (o "depois" do plano ou o das séries), também em grupo (D216)
- [x] **TR2** Continuar o treino ao voltar (sem o seletor de novo, mesma sessão no servidor, botão "Continuar treino"); "Próximo exercício" num exercício já feito; aviso do treino pausado (D216)
- [x] **TR3** Séries avançadas: interruptor no painel do exercício, "+" no fim da linha, repetições e carga por série no Modo Treino (D217)
- [x] **TR4** Bateria E2E de usabilidade do Modo Treino (`e2e/treino-bateria.spec.ts`) (D216)
- [ ] **TR5** Memória e lentidão do APK: medir num aparelho (perfil do Hermes/Android Studio) antes de mexer; ver o relatório desta tarefa

## ESCOPO_V9 — gastos no projeto e leitura de foto (pedido do dono em 19/10)

- [x] **GA1** Tabela `expenses`, permissão `expense.write`, RLS, sync, Realtime, lixeira, exportação de dados, fotos no bucket `receipts`, pgTAP (D218)
- [x] **GA2** Página do tipo Gastos: totais do período, orçamento, por categoria, lançamento rápido, planilha e painel do lançamento (D218)
- [x] **GA3** Exportar CSV e XLSX (gerado no app, sem dependência) (D218)
- [x] **GA4** Edge Function `read-photo` com o Gemini (chave no servidor, leitor de exemplo sem chave), limite do mês, portão, política de privacidade (D219)
- [x] **GA5** Foto da nota → conferir → lançamento (ou um por item), foto guardada, aviso de nota repetida (D219)
- [x] **GA6** Foto de uma lista → criação em lote (o OCR do ESCOPO §11 e V3 §6 C) (D219)
- [x] **GA7** Ajuda nos 3 idiomas, E2E (`e2e/gastos.spec.ts`) (D218, D219)
- [ ] **GA8** Pôr a chave do Gemini no servidor e testar com notas de verdade. Pendente: chave do dono (`docs/OPERACOES.md`)
- [ ] **GA9** Depois: editar célula a célula na planilha, ligar lançamento a tarefa pela tela, fila de fotos sem internet, apagar a foto quando a lixeira vence, racha de contas

## ESCOPO v1 — backlog (§11)

- [x] **C1** Calendário: tela `/calendario` (mês e semana, tarefas com data de todas as pastas e projetos, recorrentes em todos os dias, página de treino como um item por dia que abre a página, hábitos fora), na barra lateral, no Início ("Próximos 7 dias"), na paleta e em `G C`; feed .ics com link secreto por pessoa (`calendar_feeds`, `calendar_feed_link`/`calendar_feed_off`, `calendar_ics` montado no banco com RRULE) servido pelo `serve.mjs` em `/calendario/<token>.ics` e botão "Adicionar ao Google Agenda"; pgTAP, E2E `e2e/calendario.spec.ts` e Ajuda nos 3 idiomas (D185). A API do Google (OAuth, mão dupla) fica para depois, se o atraso do feed incomodar

## Decisões em aberto

| # | Pergunta | Quando | Resposta |
|---|---|---|---|
| V2-2 | Engine de sync pronta ou protocolo próprio | A7 | **PowerSync** (D75, 13/10) |
| V2-4 | Tipografia e acento final | B3/B9 | Fica a atual (B3 dispensada pelo dono, 19/10) |
| V2-1 / V3-5 | Nome dos itens dentro de Projeto (proposta: "Listas") e das visões | antes da E | |
| V2-3 | Cargos personalizados já na V2? | antes da E | |
| V2-5 | Hospedagem do servidor e do banco | antes da D7 | |
| V3-1 | Profundidade padrão 4? | antes da G | |
| V3-2 | Dependências: estrito ou flexível por padrão? | antes da H | |
| V3-3 | Biblioteca do grafo | antes da I | |
| V3-4 | Página enviada: ao vivo ou cópia por padrão? | antes da L | **Ao vivo** (D133, decidido na ausência do dono; a cópia continua no envio) |
| V3-6 | Quais itens B sobem de prioridade | depois da M | Racha de contas, lista de compras gerada, revisão semanal, Eisenhower, reações, recompensas personalizadas (D220) |
| V4-1 | Boss diário: HP base e recompensa | O1 | Provisório (D150+) |
| V4-2 | Rebirth: nível mínimo, ouro, bônus | R1 | Implementado com o provisório (D210): 20, ouro fica, +5%/renascimento até +25%; mudar é só `xp_rules -> rebirth` |
| V4-3 | Raridades: dificuldade fixa ou % de jogadores | P1 | Provisório: dificuldade fixa, % mostrada à parte |
| V4-4 | Anexos: limite por arquivo e por conta | N4 | Provisório: 10 MB / 1 GB |
| V4-5 | Planos: o que cada um libera, preços, founder | T1 | Tudo grátis por enquanto; plano pago no futuro, com founder (D220) |
| V4-6 | Provedor de pagamento e compras nas lojas | T2 | Decidir depois (D220) |
| V5-3 | Provedor de e-mail e domínio de envio | V5 §5 | Inativo por enquanto (D220) |
| V5-4 | Carência da exclusão de conta | V5 §6 | 30 dias (D220) |
| V7-1 | Conta de desenvolvedor no Strava | V7 §2 | App "Questlist", retorno em `questlist.wavdev.org` (D220) |
| V7-2 | Escrever no Health Connect/Strava ou só ler | V7 §2 | Só ler; a atividade de fora vira um registro de treino, sem passar pelo Modo Treino (D220) |
| V7-3 | Quais atividades contam como treino | V7 §2 | Todas (D220) |
| V9-3 | Limite de leituras de foto por conta | GA8 | Sem limite enquanto for teste (`photo_read_limit()` nulo, D220) |
