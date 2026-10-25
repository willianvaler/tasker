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
- [x] **AC2.1** `lib/gym/fields.ts`: o que aparece no item de treino e o que vai para "Mais opções" (D234)
- [x] **AC2.2** Painel do item e criação avançada com o corte do treino; E2E `e2e/treino-item.spec.ts` (D234)
- [x] **AC3.1** `scripts/exercicios/montar-base.mjs`: as duas bases livres juntas em `data/exercicios/base.json` (2.016 exercícios) (D235)
- [x] **AC3.2** `scripts/exercicios/traduzir.mjs`: tradução retomável pelo modelo local (D235)
- [x] **AC3.3** Traduzir a base: os 2.016 com nome em pt-BR e es e instruções em pt-BR; os 669 sem instruções ganharam passos curtos nos três idiomas (o modelo local fez 60, o Claude o resto) (D235)
- [x] **AC3.4** `lib/gym/exercise-match.ts`: achar o exercício pelo que foi digitado, nos três idiomas, com sinônimos (D235)
- [x] **AC3.5** `lib/gym/exercise-filter.ts`: busca e filtros por equipamento, parte do corpo e músculo (D235)
- [x] **AC3.6** `exercises` e `user_exercises`, carga da base por migração, RLS, sync, pgTAP (D235)
- [x] **AC3.7** Tela Biblioteca (busca, filtros, ficha, exercício próprio) (D235)
- [x] **AC3.8** `tasks.exercise_id`, sugestão e escolha no painel do item de treino; E2E `e2e/biblioteca.spec.ts` (D235)
- [x] **AC3.9** `NOTICE.md` com os créditos e licenças das bases (D235)
- [x] **AC4.1** `lib/gym/units.ts`: kg ↔ lb, passo e arredondamento, texto da carga em kg (espelho do `_set_weight_kg`), formato no idioma, volume sem o aquecimento (D236)
- [x] **AC4.2** `lib/gym/effort.ts`: RIR ↔ RPE, opções das escalas, média misturando escalas, rótulo (D236)
- [x] **AC4.3** `workout_sets` (cada série como aconteceu, carga em kg), gravada pelo `log_rep` e pelo `log_group_set`; `log_warmup` e `delete_workout_set` pela fila (`run_once`); RLS só a pessoa, sync, exportação, pgTAP `diario.test.sql` (D236)
- [x] **AC4.4** `SetRow`: repetições reais com −1/+1, esforço (se ligado) e, no cardio, distância e tempo (D236)
- [x] **AC4.5** Modo Treino grava a série detalhada e o aquecimento à parte; Perfil → Registro do treino (kg/lb, esforço); política de privacidade com o diário (versão 2026-10-20.2) (D236)
- [x] **AC4.6** Histórico por exercício no painel do item e na ficha da Biblioteca (por dia, volume, apagar série); E2E `e2e/diario.spec.ts` e Ajuda nos 3 idiomas (D236)
- [x] **AC4.7** Carga real de cada série no Modo Treino: `−10 −5 −2,5 −1 · atual · +1 +2,5 +5 +10` ajustam só a série (no descanso ou antes dela), seguem nas séries seguintes do mesmo exercício e grupo, tocar na carga volta à do plano e "Usar no plano" grava no item; sem mexer, vale a do plano; diário, volume, recordes, aquecimento e anilhas usam a real; E2E nos specs do Modo Treino e Ajuda nos 3 idiomas (D249)
- [x] **AC5.1** `lib/gym/one-rm.ts`: 1RM estimado (Epley, até 12 repetições), melhor série, carga para N repetições, tabela de porcentagens (D237)
- [x] **AC5.2** `lib/gym/records.ts`: que recordes uma série bate (carga, repetições na carga, 1RM, volume do dia, tempo, distância), espelho do `_set_records` com os mesmos casos; pgTAP `recordes.test.sql` (D237)
- [x] **AC5.3** Aviso de recorde no Modo Treino e no resumo; recorde no exercício faz a conclusão ser crítico garantido no boss (`app.force_crit` no `_attack`) (D237)
- [x] **AC5.4** Recordes, de que série veio o 1RM e evolução por dia no painel e na ficha; calculadora de 1RM na ficha; E2E e Ajuda nos 3 idiomas (D237)
- [x] **AC6.1** `lib/gym/progression.ts`: leitura honesta da sessão, linear e progressão dupla, degrau por parte do corpo (D238)
- [x] **AC6.2** Greyskull, mais tempo, deload por falhas seguidas, peso do corpo em repetições (D238)
- [x] **AC6.3** Regra do treino (`pages.progression`) e do exercício (`tasks.progression`, `progression_step`), meta de cada série no diário; o Modo Treino aplica a prescrição no treino pessoal e sugere com "Usar" no compartilhado, com o porquê; painel e configuração da página; E2E e Ajuda nos 3 idiomas (D238)
- [x] **AC7.1** `body_metrics` e `body_goals` (dado sensível: só a pessoa), consentimento específico em `sensitive_consents` exigido pela RLS, revogar apaga, exportação, sync; pgTAP `peso_medidas.test.sql` (D239)
- [x] **AC7.2** `lib/gym/body-trend.ts`: um valor por dia, média móvel, mudança que aproximou ou afastou da meta, resumo (D239)
- [x] **AC7.3** Tela Peso e medidas (`/corpo`, no bloco Academia e na paleta): consentimento, registro, meta, gráfico com a linha da meta, revogar; política de privacidade (2026-10-20.2); E2E `e2e/corpo.spec.ts` e Ajuda nos 3 idiomas (D239)
- [x] **AC8.1** `lib/gym/heatmap.ts`: minutos por dia pelo diário (cada bloco de séries), grade do ano de segunda a domingo com nível 0 a 4, totais do período (D240)
- [x] **AC8.2** `lib/gym/muscle-volume.ts`: músculos da base para o desenho, séries por músculo (alvo 1, sinergista ½), não treinados, nível, volume e esforço por semana (D240)
- [x] **AC8.3** Contornos do MuscleMap (MIT) em `src/lib/gym/body-paths.json` por `scripts/musclemap/gerar.mjs`, crédito no `NOTICE.md` (D240)
- [x] **AC8.4** `BodyMap`: frente e costas, figura masculina ou feminina, cores do tema (D240)
- [x] **AC8.5** Tela Estatísticas de treino (`/treino-estatisticas`, no bloco Academia e na paleta): período, mapa muscular, não treinados, volume por semana com esforço, ano de treino; E2E `e2e/estatisticas.spec.ts` e Ajuda nos 3 idiomas (D240)
- [x] **AC8.6** Mapa muscular do treino: na página de treino, a linha "Músculos deste treino" (recolhida, com os nomes; abre o mapa) pelas séries previstas; no fim do Modo Treino, uma tela de resumo (séries, tempo, volume, XP) com os músculos trabalhados pelas séries feitas, até "Fechar"; `setsWork`/`workLevels` com testes, E2E `e2e/mapa-treino.spec.ts` e Ajuda nos 3 idiomas (D250)
- [x] **AC9.1** `lib/gym/plates.ts`: anilhas por lado com a barra e as anilhas da pessoa (e quantos pares), quanto faltou, rótulo agrupado (D241)
- [x] **AC9.2** `lib/gym/warmup.ts`: aquecimento sugerido 40/60/80% ao degrau, nunca abaixo da barra (D241)
- [x] **AC9.3** Calculadora de anilhas na ficha; no Modo Treino, aquecimento sugerido (um toque registra), anilhas por lado no exercício com barra e a observação do item; barra e anilhas no Perfil; E2E e Ajuda nos 3 idiomas (D241)
- [x] **AC9.4** Superset e circuito (`tasks.superset`, letra A a D): o Modo Treino alterna entre os itens do grupo sem descanso e descansa no fim da rodada, sozinho e no treino junto; escolha no painel; E2E e Ajuda nos 3 idiomas (D242)
- [x] **AC9.5** Plano da semana (`pages.train_days`), remarcar ou pular o treino do dia só para a pessoa (`workout_moves`), "Treino de hoje" na Hoje, lembrete às 18h no dia de treino sem série (`send_workout_reminders`, desligável no Perfil); regra espelhada (`lib/gym/week-plan.ts` × `_planned_on`), pgTAP `plano_semana.test.sql`, E2E e Ajuda nos 3 idiomas (D243)
- [x] **AC11** Conquistas de academia (categoria própria): recordes 1/10/50/100, dias de treino 50/100/365, toneladas 10/100, corpo inteiro na semana, supino do próprio peso; o recorde crítico já vinha do AC5; pgTAP `conquistas_academia.test.sql` e Ajuda nos 3 idiomas (D244)
- [x] **AC11.2** Prêmio para os primeiros do desafio: no dia seguinte ao fim, o `finish_challenges` (pg_cron, de hora em hora) fecha o ranking uma vez; até o 3º lugar ganha a conquista Pódio, o 1º (empate divide) também Campeão de desafio e o título Campeão (`user_items.source = 'prize'`), com aviso `challenge_finished`; só com disputa (duas pessoas treinaram); medalhas no ranking encerrado (`podium`, espelho de `_challenge_podium`); pgTAP `premio_desafio.test.sql`, E2E em `e2e/desafios.spec.ts` e Ajuda nos 3 idiomas (D251)
- [x] **AC12.1** Planos prontos (`/planos`, Treino → Ferramentas e Ctrl+K): Iniciante corpo inteiro 3×, ABC, ABCD, Superior/inferior 4×, Empurrar/puxar/pernas, 5×5, Greyskull LP e Em casa sem equipamento (`lib/gym/plans.ts`, exercícios do catálogo com foto da free-exercise-db sempre que possível, com teste). Usar cria uma pasta na Academia (liga o Treino se preciso) com um treino de cards por dia, os dias no plano da semana, a regra de progressão e os itens com séries, repetições ou tempo e descanso; exercício por tempo com a regra "tempo". O lote aceita `progression` (migração `20261181000000_lote_progressao.sql`, pgTAP `lote_progressao.test.sql`), e criar tarefas numa lista que ainda não desceu para o aparelho vai pela RPC em vez de falhar. E2E `e2e/planos.spec.ts`, Ajuda nos 3 idiomas (D272)
- [x] **AC12.3** Levar exercícios para outro treino (parcial: sem arrastar): no **…** de um treino, marcar um, vários ou todos, escolher o destino e **Copiar** (lote com exercício, séries, carga e regra de progressão) ou **Mover** (`page_id`, no fim do destino, sem superset) (`components/gym/carry-exercises.tsx`). Correção junto: a linha "Músculos deste treino" com muitos músculos alargava a página no celular e o menu da lista abria fora da tela (`workout-muscles.tsx`). E2E em `e2e/planos.spec.ts`, Ajuda nos 3 idiomas (D273). Falta arrastar um exercício de um treino para outro
- [x] **AC3.10** Fotos dos exercícios (free-exercise-db, Unlicense; D247, D274): 873 exercícios do catálogo com as duas fotos (posição inicial e final), reduzidas para 480 px e miniatura de 160 px pelo `scripts/exercicios/fotos.mjs` (liga `free-…` e os juntados `mit-…`, regra de `comum.mjs`) e servidas pelo bucket público `exercise-photos` (migração `20261182000000_fotos_exercicios.sql`); o `atualizar.sh` sobe no servidor uma vez por versão (`--se-faltar`). No app (`components/gym/exercise-photo.tsx`, lista em `lib/gym/exercise-photos.json`): alternando como animação na ficha da Biblioteca, no painel do exercício ligado e no Modo Treino; miniatura parada na lista; parada com "reduzir movimento"; sem foto, nada. Crédito no NOTICE e na ficha; E2E `e2e/fotos-exercicios.spec.ts`, Ajuda nos 3 idiomas
- [ ] **AC15A** Treinar com… em qualquer treino, para amigos, times, grupos e desafios; conta para todos (decidido, D252)
- [ ] **AC15B** Treino ↔ grupo nos dois sentidos ("Adicionar a um grupo" num treino da Academia) (decidido, D252)
- [ ] **AC15C** Bloco Desafios estilo GymRats: código ou link, ranking configurável, atividades (decidido, D252; medir a complexidade antes)
- [ ] **AC15D** Atividades de apps de terceiros nos desafios (depende do V7)
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
- [~] **TR5** Memória e lentidão do APK: o dono viu que só as telas com arte engasgam; as miniaturas (CD4, D229) atacam isso. Falta medir num aparelho (perfil do Hermes/Android Studio) se ainda engasga e se o cache do TanStack pesa

## ESCOPO_V9 — gastos no projeto e leitura de foto (pedido do dono em 19/10)

- [x] **GA1** Tabela `expenses`, permissão `expense.write`, RLS, sync, Realtime, lixeira, exportação de dados, fotos no bucket `receipts`, pgTAP (D218)
- [x] **GA2** Página do tipo Gastos: totais do período, orçamento, por categoria, lançamento rápido, planilha e painel do lançamento (D218)
- [x] **GA3** Exportar CSV e XLSX (gerado no app, sem dependência) (D218)
- [x] **GA4** Edge Function `read-photo` com o Gemini (chave no servidor, leitor de exemplo sem chave), limite do mês, portão, política de privacidade (D219)
- [x] **GA5** Foto da nota → conferir → lançamento (ou um por item), foto guardada, aviso de nota repetida (D219)
- [x] **GA6** Foto de uma lista → criação em lote (o OCR do ESCOPO §11 e V3 §6 C) (D219)
- [x] **GA7** Ajuda nos 3 idiomas, E2E (`e2e/gastos.spec.ts`) (D218, D219)
- [ ] **GA8** Pôr a chave do Gemini no servidor e testar com listas de verdade (a nota não precisa mais dela, D254). Pendente: chave do dono (`docs/OPERACOES.md`)
- [ ] **GA9** Depois: editar célula a célula na planilha, ligar lançamento a tarefa pela tela, fila de fotos sem internet, apagar a foto quando a lixeira vence (o racha de contas saiu daqui: PB5)

## ESCOPO_V3 — itens B que subiram de prioridade (V3-6, pedido do dono em 19/10, D220)

- [x] **PB0** Recompensas personalizadas: já feitas no modo jogo (HB7, D201)
- [x] **PB1** Matriz de Eisenhower: aba Lista · Matriz na página de lista, quadrantes pela prioridade e pela data, mover de quadrante ajusta as duas; E2E `e2e/matriz.spec.ts` e Ajuda nos 3 idiomas (D221)
- [x] **PB2** Reações nas tarefas concluídas e nos comentários: `reactions` com RLS e pgTAP, na Atividade do projeto e no painel da tarefa, aviso para quem concluiu ou comentou, Realtime e exportação; E2E `e2e/reacoes.spec.ts` e Ajuda nos 3 idiomas (D222)
- [x] **PB3** Revisão semanal guiada: tela `/revisao` (concluí, ficou, parado, próxima semana), sugestão no Início e na paleta; E2E `e2e/revisao.spec.ts` e Ajuda nos 3 idiomas (D223)
- [x] **PB4** Lista de compras gerada do cardápio: ingredientes das subtarefas e das notas, iguais somados, destino escolhido, conferência na criação em lote; E2E `e2e/compras.spec.ts` e Ajuda nos 3 idiomas (D224)
- [x] **PB5** Racha de contas nos gastos do projeto: `split_among` (todos por padrão), acerto (`settle`) fora dos totais, quem deve a quem e "Registrar acerto", pgTAP; E2E `e2e/racha.spec.ts` e Ajuda nos 3 idiomas (D225)

## ESCOPO_V10 — amigos, visibilidade, comunidade e Bem-estar (pedido do dono em 20/10)

- [x] **AM1** Nick, amizades, link de amizade, RPCs, avisos, RLS, pgTAP, LGPD (política e termos novos) (D230)
- [x] **AM2** Tela Amigos e página do link `/amigo/<token>`; E2E `e2e/amigos.spec.ts` e Ajuda nos 3 idiomas (D230)
- [x] **AM3** Adicionar amigo direto em projeto, grupo de treino, time e clã (`add_friend_to_group`, `FriendPicker`), pgTAP, E2E e Ajuda (D231)
- [x] **VI1** Visibilidade da tarefa (privada, amigos, pública): coluna, lote, sync, `+publica`/`+amigos`, painel, linha, `profile_tasks`, pgTAP (D232)
- [x] **VI2** Perfil da pessoa (`/pessoa?nick=`), com a amizade; E2E `e2e/visibilidade.spec.ts` e Ajuda nos 3 idiomas (D232)
- [x] **CM1** Comunidade: publicar, usar, curtir, denunciar, feed e prévia por RPC, RLS, pgTAP, LGPD (D233)
- [x] **CM2** Aba Comunidade (busca, filtros, prévia) e "Publicar" no menu da página, da pasta e nos modelos; E2E `e2e/comunidade.spec.ts` e Ajuda nos 3 idiomas (D233)
- [x] **BE1** Tela **Bem-estar** (`/bem-estar`): na barra lateral, no Mais, na paleta e como posição da barra de baixo; chave **Academia dentro do Bem-estar** em Configurações → Recursos (`ui_prefs.wellness.gym`), que põe os treinos, grupos e ferramentas dentro dela e tira o bloco Academia da barra lateral, a seção da tela Pastas e o Treino das posições da barra (quem o tinha passa a ver o Bem-estar; `lib/tab-slots.ts` com testes); a tela Treino virou o componente `WorkoutHub`; e2e `e2e/bem-estar.spec.ts` e Ajuda nos 3 idiomas (D270)
- [x] **BE4** **Remédios** no Bem-estar (pedido do dono em 22/10): nome, comprimidos por vez (aceita meio), vezes por dia, todo dia / dia sim, dia não / semanal, comprimidos por caixa e quantos tem; saldo de hoje, até quando dá e "compre logo" a 7 dias (`lib/medications.ts`, com testes); **Comprei** soma ao que resta, **Contar de novo**, parar e voltar a tomar; tabela `medications` com RLS, consentimento específico (dado de saúde), exportação, sync offline e pgTAP; política de privacidade nova (`2026-10-22`); e2e e Ajuda nos 3 idiomas (D270)
- [x] **BE2** Dieta (D275): **Montar o cardápio da semana** cria a pasta Dieta com a lista "Cardápio da semana" (reinício semanal, lembrada em `ui_prefs.wellness.diet`); `/cardapio` mostra um cartão por dia com Café, Almoço, Lanche e Jantar e o "+" põe um prato (nome, refeição, dias, ingredientes nas subtarefas; `meta.meal` e `meta.days`, sem data, então não vira atrasado). No Bem-estar, o **Cardápio de hoje** para marcar (concluir o prato conclui os ingredientes) e a **lista de compras** da semana pelo gerador do PB4 (`lib/diet.ts` com teste, `components/wellness/diet.tsx`). E2E `e2e/dieta.spec.ts`, Ajuda nos 3 idiomas
- [x] **BE3** Vida saudável (D275): 11 hábitos prontos (água com contador de 8, sono, caminhada, passos, fruta com contador de 2, verdura, sem açúcar, alongar, meditar, sem tela antes de dormir, sol) que entram na página de sistema dos Hábitos com um toque; o que já existe (mesmo nome) aparece como Adicionado; atalho para Peso e medidas (`lib/healthy-habits.ts`, `components/wellness/healthy-habits.tsx`). E2E em `e2e/dieta.spec.ts`, Ajuda nos 3 idiomas

## Correções do dono (20/10)

- [x] **CD1** Hábito bom/ruim com o + à esquerda e o − à direita (D227)
- [x] **CD2** Peso da tarefa com seis níveis nomeados: Trivial, Baixo, Médio, Alto, Muito alto, Extremo (D226)
- [x] **CD3** Menu Novo: pelo botão não passa do fim da janela (abre para cima); pelo Alt+N, no meio da tela (D228)
- [x] **CD4** Arte do jogo leve nas telas: miniaturas de 192 px para avatares e listas, sem esmaecer as pequenas (D229, parte do TR5)
- [x] **CD5** Apagar a página aberta pelo menu dela (a página vazia do treino da Academia não tinha como) (D245)
- [x] **CD6** Kanban com arrastar e soltar entre colunas (toque longo no celular), as setas continuam (D245)
- [x] **CD7** Anotações dentro de pastas e projetos (`notes.folder_id`, quem é da pasta lê, quem cria tarefas escreve), seção Anotações na pasta (D245)
- [x] **CD8** APK: intermediários do Let's Encrypt (YE1–3, YR1–3, E5–E9, R10–R14) e a Root YR como âncoras, para o "Trust anchor for certification path not found" (D245)
- [x] **CD9** Login no celular com o formulário no topo, à vista com o teclado aberto (D245); E2E `e2e/correcoes-2010.spec.ts` e Ajuda nos 3 idiomas
- [x] **CD10** Botões de apagar, remover, sair e descartar em vermelho (`destructive` no `Button` e no `ConfirmDialog`, lixeira com `tone="danger"`) (D246)
- [x] **CD11** Notas no celular: o editor encolhe acima do teclado e não fica em branco quando a releitura não vem (D246)
- [x] **CD12** Tela de entrada: "Gestão de tarefas, hábitos e projetos com uma camada de gamificação." (D246)
- [x] **CD13** Cadastro: resposta que não é JSON (página de erro do proxy ou da Cloudflare, servidor reiniciando) vira um aviso claro, em vez de "Unexpected token '<'" (D246)
- [x] **CD15** Página de cards fora da Academia e dos grupos de treino é página comum: sem Modo Treino (a não ser com séries), sem painel de exercício, sem dia de treino no desafio nem evento de treino no calendário (`isWorkoutPage` e `_is_workout_page`); pgTAP e E2E `e2e/correcoes-cd15.spec.ts` (D248)
- [x] **CD16** "Depende de" à vista no painel simples, em projeto e em pasta pessoal; `^tarefa` na captura e no lote também em pasta pessoal; aba Fluxo (Lista · Fluxo) em pasta pessoal; `^` na dica do campo e na Ajuda nos 3 idiomas (D248)
- [x] **CD17** "Mais opções" alterna com "Menos opções" (`aria-expanded`) no editor de página e no painel do exercício (D248)
- [x] **CD18** Busca da Biblioteca com o texto pela metade: "supi" acha os supinos, "sup ret" o supino reto (começo de cada palavra, nos três idiomas, sem acento; texto no meio do nome; sinônimos como antes); empate pelos exercícios comuns e pelo nome mais curto (`searchScore` em `lib/gym/exercise-filter.ts`, com testes) (D253)
- [x] **CD19** Alt+N → T, N, a paleta e Alt+Shift+N criam na página ou pasta aberta, não na última página visitada; fora de pasta (Início, Hoje), na Caixa de entrada (`captureContext`/`captureTargetId` em `lib/capture-target.ts`, com testes; e2e em `menu-novo.spec.ts`)
- [x] **CD14** Foto da nota lida pelo Tesseract no próprio servidor, sem o Gemini: `tesseract-wasm` (modelo `por` do tessdata_fast) dentro da Edge Function `read-photo` (`ocr.ts`, WEBP, JPEG e PNG), e o texto vira os mesmos campos de antes pelo parser puro `functions/_shared/receipt-ocr.ts` (loja, CNPJ, data, total pago, forma de pagamento, chave da NFC-e, itens e categoria, com testes); APK antigo continua funcionando. A foto de uma lista segue no Gemini (escrita à mão). Política de privacidade nova (`2026-10-21`) e Ajuda nos 3 idiomas (D254)
- [x] **CD20** Página de gastos dividida em abas **Geral · Gastos · Entradas**: cada aba é a página só com as saídas ou só com as entradas (totais, lançamento rápido sem escolher o tipo, lista, categorias e exportação da aba), lembrada por página no aparelho (`inTab` em `lib/expenses.ts`, com testes; e2e em `gastos.spec.ts`; Ajuda nos 3 idiomas) (D255)

## Correções do dono (22/10) — reforma de usabilidade (`docs/PROPOSTA_UX.md`)

Pedido do dono em 22/10: "o app tem muitas funcionalidades, mas muitas ficam escondidas ou espalhadas"; aprovou a proposta inteira ("corrija tudo"). Os ids são UX1 a UX14 (a Fase U já usa U1 a U9).

- [x] **UX1** Caminhos que faltam, entregues com o UX8: busca (lupa) no topo das telas principais do celular, abrindo a paleta; tela **Treino** (`/treino`) com os treinos, grupos, Biblioteca, Peso e medidas e Estatísticas; Revisão semanal fixa no Planejar e no Mais (D258)
- [x] **UX2** Rodapé da barra lateral com três alvos: o cartão da pessoa (nome, nível e XP, com o ponto dos pedidos de amizade) que abre o Mais, o sino e a Ajuda, mais o ponto de sincronização; saíram os 8 ícones sem texto, cortados em 1280 px (D259)
- [x] **UX3** Nomes e rótulos: jogo Desligado · Discreto · RPG; "Recompensas" e "Estábulo" com ícone em vez de emoji; botão primário desabilitado com contorno e texto apagado (o laranja claro parecia ativo); pasta Academia vazia diz "Criar o primeiro treino" na tela Pastas, como na barra lateral (D256)
- [x] **UX4** Painel da tarefa reordenado: título; em projeto, Responsáveis e "Depende de" logo no alto; vencimento, prioridade e etiquetas; descrição; **subtarefas** (antes vinham no fim); depois o resto. Em pasta pessoal, o "Depende de" fica à vista depois das subtarefas (D263)
- [x] **UX5** Menu Novo é o lugar de criar tudo: Tarefa, Página, Pasta, Projeto, Hábito, **Anotação** (A), **Várias de uma vez** (V, na página ou pasta aberta, senão na Caixa de entrada) e **A partir de um modelo** (M), além da criação avançada; tela Pastas sem o "Nova pasta" do topo (fica o "+" de cada seção, e a seção Pastas aparece sempre), com **Usar modelo** e **Comunidade** como links com nome no fim; Ajuda nos 3 idiomas (D261)
- [x] **UX6** Doca: no celular, nas telas com a barra de baixo, o timer encaixa nela como um mini player (`TimerBar docked`) e empurra o conteúdo; nas telas abertas por cima e no computador, flutua no canto de baixo; o aviso fica acima dos dois e, no Modo Treino, no topo (`isTabPath` em `lib/tab-slots.ts`) (D260)
- [x] **UX7** Configurações, Mais, Jogo e Pessoas separados: o Perfil vira **Configurações** (`/configuracoes`, só ajustes: conta, aparência, **Recursos** com Treino e o nível do jogo, **Navegação**, avisos, foco, dados, sobre o app); a aba vira **Mais** (`/mais`, o índice de tudo, com nome e dica em cada linha); **Pessoas** (`/pessoas`: amigos, times, projetos, clã, comunidade, notificações) e **Jogo** (`/jogo`: acampamento ou herói, lugares do jogo, números, bosses e conquistas); `/profile` redireciona; Ajuda nos 3 idiomas com os caminhos novos (D257)
- [x] **UX8** **Hoje** única (o Início saiu; `/today` redireciona): próxima ação só com Meu dia, captura, atrasadas, de hoje e hábitos; faixa do jogo em duas linhas; avisos de treino e revisão como linha (`NoticeLine`); **Planejar** (`/planejar`: calendário, revisão, Atribuídas a mim, próximos 7 dias, Entrada sem data); **barra de baixo** com Hoje · 2 posições escolhidas · + · Mais (`components/tab-bar.tsx`, `lib/tab-slots.ts` com testes; escolha em Configurações → Navegação; padrão Planejar e Pastas, Treino para quem treina, Jogo para quem joga no RPG); barra lateral com Hoje, Planejar, Entrada, Hábitos, Calendário, Pastas e Pessoas; Ajuda nos 3 idiomas ("Onde fica cada coisa") (D258)
- [x] **UX9** Topo da página: **Compartilhar** (convidar pessoas, enviar, publicar na comunidade, alunos) e o "…" agrupado (Arrumar · Recursos da página · Outros); sai o ícone de ajustes (igual ao da criação avançada); toda página de tarefas tem as visões **Lista · Quadro · Matriz** em abas (o kanban virou o Quadro de qualquer lista; o tipo salvo é só a visão padrão), lembradas no aparelho (`components/tasks/page-mode.ts`); Ajuda nos 3 idiomas (D262)
- [x] **UX10** **Ligações**: "Depende de" e "Relacionados" numa seção só do painel, com uma linha explicando a diferença (um espera o outro; o outro é só atalho); no alto em projeto, depois das subtarefas em pasta pessoal; Ajuda nos 3 idiomas (D264)
- [x] **UX11** Painel por uso: sai o seletor Simples/Completo do topo; aparece o essencial, o do contexto e o que a tarefa já usa (agora também repetição, quem vê e anexos), e o resto entra por **+ Adicionar** (repetição, tempo, séries, Meu dia, peso, quem vê, anexos, aprovação, histórico); "Mostrar todas as seções do painel da tarefa" em Configurações → Aparência (a introdução não pergunta mais); `lib/panel-sections.ts` com testes; Ajuda nos 3 idiomas (D265)
- [x] **UX12** Introdução: o último passo virou **"Para que você vai usar?"** (Treino e o nível do jogo: Desligado · Discreto · RPG), que decide o que aparece e quais telas entram na barra de baixo; a resposta do treino vale ao começar (o "Vai usar para treinar?" da Hoje fica só para quem pula a introdução); o painel deixou de ser pergunta da introdução; **Configurações → Recursos** já tem as duas chaves (UX7) (D266)
- [x] **UX13** "Página" virou **Lista** em toda a interface e na Ajuda, nos 3 idiomas (em projeto já era "lista"); os tipos viraram **Tarefas · Rotina · Hábitos · Quadro · Gastos** (Rotina é o antigo Cards: checklist que reinicia; Quadro é o antigo Kanban, que abre na visão Quadro, D262); a coluna do CSV exportado também; fica "página" só onde é página de livro e no texto legal (mudar o texto pediria novo aceite de todos, sem mudar o sentido) (D267)
- [x] **UX14** Personagem: o retrato pintado da classe vale em todos os níveis do jogo (antes só no RPG; o herói em emoji destoava dos bosses pintados), com os itens da loja por cima no Discreto e a escolha de retrato e cenário em Aparência; a conta do dano fica em **Como funciona o dano**, recolhida; Ajuda nos 3 idiomas (D268)

## Correções do dono (22/10, tarde)
- [x] **CD21** Quadro: arrastar começando pelo título soltava o card e abria a tarefa; o título não abre mais nada e o card ganhou um lápis (**Detalhes de…**) para editar; Ajuda nos 3 idiomas, e2e em `correcoes-2010.spec.ts` (D269)
- [x] **CD22** Hoje e Planejar sumiam atrás do painel da tarefa (criar ou editar deixava o fundo vazio): fora de foco elas não desenham as listas, e o painel transparente tirava o foco; agora continuam desenhadas quando só um painel transparente está por cima (`useShownTab`, `tabUnderOverlay` em `lib/tab-slots.ts`, com testes; e2e em `correcoes-2010.spec.ts`) (D269)

## Correções do dono (24/10)

- [x] **CD23** Erro em HTML na tela (ex.: "Concordo e quero registrar" na rede da empresa): o cliente do Supabase troca toda resposta HTML (proxy, inspeção de SSL, página de erro da Cloudflare; o Supabase nunca responde HTML) por um erro curto em JSON com status 502 (`lib/html-guard.ts`, com testes). O login passa a tratar isso como falha passageira: antes, um 4xx em HTML na renovação do token apagava a sessão e a pessoa tinha de entrar de novo
- [x] **CD24** Sync parado depois do Wi-Fi da empresa (erro de SSL) até fechar o app: a conexão aberta na rede anterior ficava pendurada sem erro. Agora o app reconecta o sync quando a rede muda (Wi-Fi ↔ dados móveis, volta da conexão) e quando volta do segundo plano sem conexão com o sync (`providers/sync.tsx`)
- [x] **CD25** Web: passar o mouse no ponto vermelho do sync quebrava o rodapé da barra lateral (o texto longo entrava na linha e espremia o cartão, o sino e a ajuda); o nome do estado aparece num balão por cima (`components/sync-dot.tsx`)
- [x] **CD26** Android: notificações do Modo Treino se acumulavam na tela de bloqueio (8 fixas): o app guardava só na memória o id da última e, encerrado pelo sistema, esquecia as anteriores. Agora cada atualização tira todas as do treino pelo prefixo do id, o app limpa as que sobraram ao abrir, e um descanso novo tira os avisos de "descanso acabou" que ficaram (`lib/workout-notification.ts`, `lib/timer-alerts.ts`)
- [x] **CD27** Computador: abrir o painel de uma tarefa na "Missões de hoje" deixava o fundo vazio. Indo para Configurações e voltando pela barra lateral, a pilha fica com duas `(tabs)`, e o `tabUnderOverlay` olhava a primeira (coberta por Configurações), então a Hoje parava de desenhar atrás do painel. Agora vale a última (`lib/tab-slots.ts`, com teste)
- [x] **CD28** Painel dos bosses mais fácil de entender (pedido do dono): no Jogo os bosses apareciam duas vezes (acampamento ou herói e a coluna dos números) e também no Personagem, com a vida num fio de 2 px que, cheio, parecia sublinhado. Agora é um bloco só (`components/bosses-panel.tsx`): primeiro como bater (tudo que você conclui bate em todos ao mesmo tempo; hábito ruim cura), o dano de hoje, e um cartão por boss com tipo e nível, vida numa barra de 8 px com fundo, "foge em N horas" / "foge domingo (faltam 2 dias)", a fala no RPG e o que vencer dá (XP, ouro do nível, item ou chance, HP do próximo; `lib/boss-info.ts`, espelho do `_sync_boss_rewards`, com teste). A faixa da Hoje e a coluna do herói também usam a barra grossa
- [x] **CD29** Fundo do modo escuro à escolha (D271): Marrom, Verde-escuro, Azul-noite, Grafite, Preto e Ameixa em Configurações → Aparência, com amostra de cada um; guardado no aparelho (`lib/dark-palette.ts`), aplicado no `<html>` na web e pelo `vars()` do NativeWind no celular; contraste AA testado nos seis (`design-tokens.test.ts`) e e2e `tema-escuro.spec.ts`. Falta ver no celular de verdade (o `vars()` só roda no app nativo)

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
