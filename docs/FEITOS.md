# Feitos

O que já foi feito em todos os escopos, numa tabela só, para ler rápido. **Gerado por `npm run feitos`** a partir do `docs/STATUS.md`: não edite à mão, rode de novo depois de atualizar o STATUS. O que falta está em `docs/PENDENTES.md`; o detalhe, no STATUS e no `DECISIONS.md`.

| Escopo | Id | Tarefa | Decisões |
|---|---|---|---|
| **V1** | Fase 0 | Base do app, login, pastas e páginas, RLS | D1 a D12 |
| V1 | Fase 1 | Captura rápida, lote, datas, etiquetas | D13 a D23 |
| V1 | Fase 2 | Ciclos, recorrência, duplicar e reiniciar página | D24 a D31 |
| V1 | Pastas | Barra lateral e telas de pasta | D32 |
| V1 | Fase 3 | Gamificação: XP, nível, sequência, boss, conquistas | D33 a D39 |
| V1 | Fase 4 | Projetos: convites, responsáveis, comentários, atividade, notificações, modelos | D40 a D48 |
| V1 | Fase 5 | Clã, bosses cooperativos, fila offline, privacidade | D49 a D53 |
| V1 | Fase 6 | Kanban, tema, onboarding, acessibilidade e desempenho, push, publicação | D54 a D59 |
| V1 | Fase 7 | RPG leve, telas largas, Início e tela Hábitos | D60 a D70 |
| V1 | C1 | Calendário: tela `/calendario` (mês e semana, tarefas com data de todas as pastas e projetos, recorrentes em todos os dias, página de treino como um item por dia que abre a página, hábitos fora), na barra lateral, no Início ("Próximos 7 dias"), na paleta e em `G C`; feed .ics com link secreto por pessoa (`calendar_feeds`, `calendar_feed_link`/`calendar_feed_off`, `calendar_ics` montado no banco com RRULE) servido pelo `serve.mjs` em `/calendario/<token>.ics` e botão "Adicionar ao Google Agenda"; pgTAP, E2E `e2e/calendario.spec.ts` e Ajuda nos 3 idiomas | D185 |
| **V2** | A1 | `docs/AUDITORIA.md`: stack real, o que existe do ESCOPO, lacunas, dívidas (inclui a pendência da D70) | D70 |
| V2 | A2 | `CLAUDE.md` aponta para V2/V3 e para a regra "ao concluir, atualize `docs/STATUS.md`"; `DECISIONS.md` com a tabela "Ajustes à stack real" do cronograma | — |
| V2 | A3 | Infra de i18n: `i18next` + `react-i18next` + `expo-localization`, `locales/pt-BR.json`, `en.json`, `es.json`, detecção de idioma | — |
| V2 | A4 | Teste que falha se uma chave existir num idioma e faltar em outro; seletor de idioma no Perfil, salvo em `profiles.locale` | — |
| V2 | A5 | Permissões como dados: catálogo de permissões atômicas (já com as da V3 §8), presets Gerente/Editor/Colaborador/Leitor, função única `can(user, action, resource)` no app e espelho no banco; mapear os papéis atuais (owner/editor/viewer) | — |
| V2 | A6 | Registro central de atalhos `shortcuts.ts` (id, teclas, chave i18n, escopo, permissão); migrar os atalhos existentes (N, Ctrl+K) para ele | — |
| V2 | A7 | Spike de sync: pesquisa em `docs/SPIKE_SYNC.md`, decisão D75 (PowerSync) | D75, D0 |
| V2 | B1 | `docs/DESIGN.md`: direção "Caderno de bolso", tokens (cores claro/escuro, escala 4–48, tipografia 12/14/16/20/28, pesos 400/600, raios 4/8, durações) | — |
| V2 | B2 | Mockups HTML/CSS estáticos em `docs/mockups/`: Hoje, Página lista, Página cards, Sidebar, Painel da tarefa — claro/escuro, 1280 e 390 px | — |
| V2 | B3 | Aprovação dos mockups: dispensada pelo dono em 19/10 (o app já passou deles; ajuste de visual vem do uso) | — |
| V2 | B4 | Tokens no `tailwind.config.js`/`global.css`; fontes (Fraunces/Newsreader, Instrument Sans/Hanken, JetBrains/Plex Mono) via `expo-font`; lint que barra hex solto | — |
| V2 | B5 | Página `/design` (só em dev) | — |
| V2 | B6 | Componentes-base, um commit por componente: botão (primário/fantasma), campo, checkbox "carimbo", linha de tarefa (40/52 px, risco de caneta), chip, item de sidebar, popover, painel lateral, folha inferior, toast, estado vazio, linha de pessoa | — |
| V2 | B7 | Telas, um commit por tela, com textos já no i18n: Hoje (+ faixa do boss), Página lista, Página cards, Sidebar + barra inferior, Painel da tarefa | — |
| V2 | B8 | Restante das telas (Início, Caixa, Hábitos, Pastas, Perfil, Personagem, Loja, Clã, Convites), também migradas para o i18n | — |
| V2 | B9 | Script Playwright de capturas (1280/390, claro/escuro) em `docs/screenshots/` + comparação com os mockups; checklist anti "cara de IA" por tela | — |
| V2 | C1 | Migração: `folders.kind` (`folder`/`project`), ícone/cor padrão por tipo; sidebar com seções Pastas e Projetos | — |
| V2 | C2 | Menu "+ Novo" (Tarefa · Página · Pasta · Projeto · Hábito · Criação avançada), Ctrl+N e letras T/P/F/J/H, padrão pelo contexto | — |
| V2 | C3 | "Mover para…" por comando e por arrastar entre pasta/projeto — por comando ("Mover para…" nas opções da página); arrastar entre pastas fica para depois | — |
| V2 | C4 | Seletor de ícones (Phosphor ou Lucide + emoji), busca pt/en/es, recentes/favoritos, id estável (`ph:barbell`) | — |
| V2 | C5 | Edição inline com F2 (nome + ícone/cor), Enter/Esc/Tab | — |
| V2 | C6 | Atalhos da V2 §9 no registro (seleção, J/K, Space/X, 1-2-3, D, A, G+H/I/M, Ctrl+D, Ctrl+B, Delete com desfazer) — feitos: Espaço/X, 1-2-3, D, A, Ctrl+↑↓, Delete com desfazer, Ctrl+D, Ctrl+Z, Ctrl+B, G H/I/M, Q/N | D207 |
| V2 | C7 | Paleta de comandos (Ctrl+K) lendo o registro | — |
| V2 | C8 | Criação/edição avançada: painel lateral (desktop) / tela deslizante (celular), seções recolhíveis, Ctrl+Shift+N, Ctrl+E, Ctrl+Enter | — |
| V2 | C9 | Rota `/ajuda` com a tabela de atalhos gerada do registro e o atalho `?` | — |
| V2 | C10 | E2E do aceite | — |
| V2 | D0 | Protótipo PowerSync: serviço local (`npm run sync:start`), Sync Streams por membro, banco local na web, escrita offline pela fila até as RPCs, revogação; tela `/sync` e `e2e/sync.spec.ts` (parcial) | D82 |
| V2 | D1 | Ids UUID v7 no app (`lib/uuid.ts`), `version`/`updated_by`/`updated_at` em pastas, páginas e tarefas; `change_seq` e `deleted_at` não entram com PowerSync, a lixeira vira tabela própria na D7 | D7, D83 |
| V2 | D2 | Banco local: é o SQLite do PowerSync (`lib/sync/db.ts` nativo com op-sqlite, `db.web.ts` com wa-sqlite em worker), feito na D0; não há `LocalStore` próprio | D0, D84 |
| V2 | D3 | Fila: a do PowerSync; o `uploadData` manda só as colunas com grant, cria tarefa pelo `create_tasks_batch` e as ações de RPC pela tabela local `commands` → `run_once` (chave de idempotência, tabela `applied_ops`); erro definitivo descarta, erro de rede repete | D84 |
| V2 | D4 | Leitura: Sync Streams com responsáveis, comentários, conclusões, perfis (o meu inteiro; dos outros, nome e avatar); revogação e reenvio cobertos no `e2e/sync.spec.ts` | — |
| V2 | D5 | Conflitos: campo a campo (o aparelho só manda o que mudou), notas com cópia da versão perdida (`conflict_copies`, `set_task_notes`, aviso "Ver versão anterior" no painel da tarefa), etiquetas como conjunto (`patch_task_labels`), conclusão como evento (já era); teste de dois aparelhos offline no `e2e/sync.spec.ts` | D85 |
| V2 | D6 | Telas lendo e gravando no banco do aparelho: tarefas (página, Hoje, próximos dias, hábitos, conclusões, tarefa avulsa, progresso do projeto, Atribuídas a mim), árvore de pastas/páginas, membros, responsáveis e comentários | D86 |
| V2 | D7 | Lixeira de 30 dias (`deleted_items`, `trash_list`, `restore_deleted`, tela `/lixeira` no Perfil e na paleta), retenção por cron (lixeira e `applied_ops`), exclusão de conta sem lixeira; `docs/OPERACOES.md` com backup e restauração | D87 |
| V2 | D8 | Ponto de estado na barra lateral (sincronizado / sincronizando / sem conexão / erro; o nome aparece no hover e leva à tela) e tela "Estado da sincronização" (`/sync`, no Perfil e na paleta): última sincronização, fila pendente por ação, erro, Forçar sincronização, Descartar mudanças locais; E2E com 4 workers (cada página roda o SQLite em WASM) | — |
| V2 | D9 | XP otimista: sem resposta do servidor (offline ou lento), concluir/kanban/hábito mostram "+~N XP (pendente)" no aviso e "+N XP pendente" na barra; quando o comando sobe, a estimativa some e o `game_state` oficial é relido | D88 |
| V2 | D10 | Testes da V2 §2.8 em `e2e/sync.spec.ts`: dois aparelhos offline na mesma tarefa chegam ao mesmo estado; reenvio sem duplicar (resposta perdida no meio do envio); criar → editar → apagar offline; removido do projeto com mudanças na fila (recusadas, dados saem do aparelho); mais revogação, descartar, XP pendente (parcial) | D89, D209 |
| V2 | E1 | Tabelas `teams`, `team_members` (Dono/Admin/Membro/Convidado), RLS + pgTAP de isolamento entre times | — |
| V2 | E2 | Cargo no projeto sobrescrevendo o do time; presets via permissões atômicas; `can()` no banco usado pelas policies | — |
| V2 | E3 | Convite com validade/limite de usos e por e-mail; pedido de entrada com aprovação opcional | — |
| V2 | E4 | Tela Time e cargos; sempre 1 Dono; log de auditoria do time | — |
| V2 | E5 | Cargos personalizados (se aprovado) | — |
| V2 | E6 | Marcos (`milestones`) e visão geral do projeto (progresso, marcos, membros, atividade, boss) | — |
| V2 | E7 | `@nome` com autocomplete; captura some para Leitor | — |
| V2 | E8 | E2E do cenário "Churrasco" | — |
| V2 | F1 | Artigos da Ajuda (V2 §10 + V3 §9) em `content/help/{pt-BR,en,es}/`: 15 por idioma, `help:build`, busca no texto, `/ajuda/<slug>` | D145 |
| V2 | F2 | Tour inicial opcional (a introdução de 3 passos, refazível pela Ajuda) e "?" contextual no cabeçalho das telas-chave | D146 |
| V2 | F3 | Revisão das traduções: parser em en/es (palavras, recorrência, ordem MM/DD em inglês), datas da tela no idioma, feed no i18n, artigos conferidos | D147, D208 |
| V2 | F4 | Acessibilidade (contraste AA no tema claro com teste, foco, teclado, reduzir movimento) e desempenho (filtro por pastas nas consultas pelo servidor, pendência D70) | D70, D148 |
| V2 | F5 | Capturas finais (48, inclusive treino, pomodoro e ajuda) e revisão contra o checklist anti "cara de IA" com correções | D149 |
| **V3** | G1 | `config/limits.ts`; `tasks.depth`, `max_depth` em página/projeto; trigger de profundidade e de ciclo na árvore | — |
| V3 | G2 | Só folhas geram XP; progresso do pai por folhas (régua fina); concluir pai automaticamente (config) | — |
| V3 | G3 | Herança de responsável/etiquetas; aviso de data do filho > pai; rollup de estimativa | — |
| V3 | G4 | Teclado: Tab/Shift+Tab, Ctrl+↑↓, →/← respeitando o limite | — |
| V3 | G5 | Códigos WBS (toggle `W`) e visão "Estrutura" | — |
| V3 | G6 | Lote achatando indentação além do limite, com aviso na pré-visualização | — |
| V3 | G7 | Testes: criar/mover/lote/redução de limite, cliente e servidor | — |
| V3 | H1 | `task_dependencies` (lag, `deps_mode`), detecção de ciclo no servidor com o caminho na mensagem | — |
| V3 | H2 | Estados derivados (`bloqueada`/`pronta`) numa função pura, idêntica no app e no banco, com os mesmos casos de teste | — |
| V3 | H3 | `started_at` (botão Iniciar, atalho S); modo estrito/flexível com "forçar" auditado | — |
| V3 | H4 | Notificação de desbloqueio e de reabertura de pré-requisito | — |
| V3 | H5 | Campo "Depende de / Libera" no painel e atalho L | — |
| V3 | H6 | Sintaxe `^` na captura e no lote (`^2` por linha) | — |
| V3 | H7 | E2E "carvão → fogo", inclusive após sync offline | — |
| V3 | I1 | `task_events` (só inserção) gravado por trigger; aba Histórico na tarefa | — |
| V3 | I2 | Abas do Projeto: Lista (indicadores) · Fluxo · Pessoas · Linha do tempo | — |
| V3 | I3 | Visão Fluxo (grafo com layout automático, raias, "você está aqui", caminho crítico); alternativa em lista acessível | — |
| V3 | I4 | Visão Pessoas (fazendo / pronta / bloqueada / concluída) | — |
| V3 | I5 | Linha do tempo filtrável + exportação CSV; permissão `workflow.view_audit` | — |
| V3 | I6 | Indicadores (tempo por estado, espera, gargalos, atrasos) | — |
| V3 | I7 | Dependência entre páginas (X%) e vínculos "Relacionados" | — |
| V3 | J1 | `repeat_plan` + `task_progress` (conta por pessoa, `log_rep`, conclui no total, desfazer reabre); atalho `3x12`/`x8` na captura e no lote; botão "2/4" na linha e no card, "Quantas vezes" no painel e na criação avançada | D123 |
| V3 | J2 | Tabela `timers` com `ends_at` absoluto, um ativo por usuário, sincronizado: RPCs `start_timer`/`update_timer` (também offline, vence quem iniciou por último), mini-barra flutuante, início pela paleta, E2E com dois aparelhos | D124 |
| V3 | J3 | Timer de descanso: começa sozinho depois da série (desfazer cancela), +30/−30/Pular na mini-barra e em grande no painel, notificação local agendada para o fim (`expo-notifications`), vibração (`expo-haptics`), permissão pedida no primeiro timer (parcial) | D125 |
| V3 | J4 | Web: aviso pelo Service Worker (`public/sw.js`) com a aba escondida, `setTimeout` único para o fim, som por Web Audio, vibração onde houver, Wake Lock no descanso; limitações na D126 | D126 |
| V3 | J5 | Modo Treino em tela cheia (`/treino/[id]`, "Iniciar treino" nos cards): Espaço = série feita, R = pular descanso, carga −/+, mais uma série, anterior/pular, pausa, resumo (tempo, séries, volume, XP), offline, tela acesa | D127 |
| V3 | J6 | XP só na conclusão final, validado no servidor (pgTAP: séries do meio, desfazer/refazer, reenvio); XP pendente só na série que conclui; E2E de timer em segundo plano com o relógio do Playwright (parcial) | D128 |
| V3 | K1 | Pomodoro (config, ciclos, mini-barra, atalho P) usando os timers da J: fases no config do timer, aviso com sugestão de pausa e botão da fase seguinte, `pomodoro_settings`, `time_entries` + `actual_minutes`, foco só conta se o servidor vê o fim | D129 |
| V3 | K2 | Sugestões de pausa personalizáveis (`pomodoro_settings`): tela `/pomodoro` com durações, ciclos, iniciar sozinho e a lista (ordenar, tirar, adicionar, sortear/em ordem, padrão do idioma) | D130 |
| V3 | K3 | Cronômetro por tarefa (Shift+T), `time_entries`, lançamento manual ("1h30 ontem"), apagar o próprio, rollup no pai; `log_time`/`delete_time_entry` também offline | D131 |
| V3 | K4 | Estatísticas simples (hoje, 7 dias, por tarefa; tempo do projeto por lista e pessoa); XP de pomodoro (5, foco ≥ 15 min, até 4/dia) no servidor, revertido ao apagar o registro | D132 |
| V3 | L1 | `page_shares` + `page_share_links`, preset Executor, RLS + pgTAP (aluno A nunca vê o B; Executor não edita estrutura via API), stream `received`, ator Executor no app | D133 |
| V3 | L2 | Progresso por usuário: `share_checks` por tarefa, usuário e ciclo (`check_item`, offline), séries do aluno pelo `log_rep`, autor acompanha; app troca o estado pelo do aluno e tira as recebidas das listas gerais | D134 |
| V3 | L3 | "Enviar para…": link (30 dias, revogável) e e-mail (vários), modo ao vivo/cópia, quem recebeu com revogar; `/enviada/<token>` cria a conta e cai direto na página; cópia vai para "Recebidas" | D135 |
| V3 | L4 | Seção "Recebidas" na barra lateral e na aba Pastas, com convites pendentes (Receber/Recusar) via `my_pending_shares` | D136 |
| V3 | L5 | Painel "Alunos": ciclo atual, aderência, última atividade, observações; histórico por ciclo com cargas e evolução; observação do aluno; lembrete (1/dia, notificação) e arquivar | D137 |
| V3 | L6 | E2E treinador → 2 alunos (treino em lote, link ao vivo; a aluna marca offline, cada um só vê o seu; o treinador vê ciclo e cargas de cada um) | — |
| V3 | M1 | Adiar com 1 gesto: botão na linha (hoje/atrasada → amanhã, com Desfazer) e atalho Z | D138 |
| V3 | M2 | Reivindicar tarefa ("eu levo"): botão na linha da tarefa de projeto sem responsável; policy `task_assignees_claim` (só a si, só vaga) | D139 |
| V3 | M3 | Estimativa e peso: peso 1–5 no painel (dano até 2×, XP igual), progresso da mãe pelo peso; a estimativa já alimentava soma e caminho crítico | D140 |
| V3 | M4 | Meu dia (`my_day`, painel, atalho M, ordem, tempo disponível) + Próxima ação ("Fazer agora" no Início e na Hoje) | D141 |
| V3 | M5 | Campos personalizados por página (`page_fields` + `tasks.custom`, 6 tipos, painel e linha) | D142 |
| V3 | M6 | Automações "quando… então…": 5 gatilhos, 6 ações, até 20 por projeto, encadeamento até 3, uma vez por regra e tarefa, falha não desfaz; tela `/automacoes/[id]` | D143 |
| V3 | M7 | Tarefa do tipo Aprovação: pessoa, Gerente ou só o Dono conclui/reabre (guarda no servidor), marca na linha | D144 |
| V3 | PB0 | Recompensas personalizadas: já feitas no modo jogo (HB7, D201) | D201 |
| V3 | PB1 | Matriz de Eisenhower: aba Lista · Matriz na página de lista, quadrantes pela prioridade e pela data, mover de quadrante ajusta as duas; E2E `e2e/matriz.spec.ts` e Ajuda nos 3 idiomas | D221 |
| V3 | PB2 | Reações nas tarefas concluídas e nos comentários: `reactions` com RLS e pgTAP, na Atividade do projeto e no painel da tarefa, aviso para quem concluiu ou comentou, Realtime e exportação; E2E `e2e/reacoes.spec.ts` e Ajuda nos 3 idiomas | D222 |
| V3 | PB3 | Revisão semanal guiada: tela `/revisao` (concluí, ficou, parado, próxima semana), sugestão no Início e na paleta; E2E `e2e/revisao.spec.ts` e Ajuda nos 3 idiomas | D223 |
| V3 | PB4 | Lista de compras gerada do cardápio: ingredientes das subtarefas e das notas, iguais somados, destino escolhido, conferência na criação em lote; E2E `e2e/compras.spec.ts` e Ajuda nos 3 idiomas | D224 |
| V3 | PB5 | Racha de contas nos gastos do projeto: `split_among` (todos por padrão), acerto (`settle`) fora dos totais, quem deve a quem e "Registrar acerto", pgTAP; E2E `e2e/racha.spec.ts` e Ajuda nos 3 idiomas | D225 |
| **V4** | N1 | Storage + `task_attachments` + RLS | D150 |
| V4 | N2 | Anexar no painel, compressão WebP e miniatura no aparelho | D151 |
| V4 | N3 | Anexo offline (fila) | D152 |
| V4 | N4 | Limites e E2E | D153 |
| V4 | O1 | Boss diário no servidor | D161 |
| V4 | O2 | Calibragem do dano | D162 |
| V4 | O3 | Aviso com o dano nos bosses e limite atingido | D163 |
| V4 | O4 | Boss diário nas telas | D164 |
| V4 | V1 | Sessão que sobrevive ao servidor fora do ar (V4 §7.1, D179) | D179 |
| V4 | P1 | Raridade das conquistas, % de jogadores e progresso das séries | D180 |
| V4 | P2 | 35 conquistas novas (68 no total), 4 secretas, concessão pelas séries e textos nos 3 idiomas | D180 |
| V4 | P3 | Tela de conquistas com filtros, próximas da faixa, secretas e cores de raridade no tema | D180 |
| V4 | Q1 | Inventário (tela própria) e itens com 5 raridades no i18n e nos tokens | D181 |
| V4 | Q2 | Configurações só no Perfil (já estava); Perfil e Personagem levam a Inventário e Conquistas | D181 |
| V4 | R1 | Renascer: do nível 20, volta ao 1 com ouro, itens e conquistas; +5% de XP por renascimento até +25%; bosses solo recomeçam; conquistas próprias (19/10, D210) | D210 |
| V4 | S1 | Página de entrada: apresentação com capturas antes do login, formulário ao lado (computador) ou no fim (celular) (19/10, D211) | D211 |
| **V5** | U1 | Seletor de modo: Treino, Foco (pomodoro) e Descanso num lugar só | D159 |
| V5 | U2 | Painel da tarefa simples × completo | D158 |
| V5 | U3 | Sem foco automático (teclado) ao abrir telas no toque | D154 |
| V5 | U4 | Assistente de primeiro uso | D160 |
| V5 | U5 | Permissão de notificações no navegador (Perfil) | D156 |
| V5 | U6 | Vibrar ao fim do timer | D157 |
| V5 | U7 | APK para Android e botão de baixar no Perfil | D155 |
| V5 | X1 | Treino pela tela de bloqueio (Android 14+): notificação fixa com Feita, Pular descanso e +30 s | D173 |
| V5 | Y1 | Revisão de usabilidade: percorrer as tarefas principais e anotar os atritos (`docs/USABILIDADE.md`) | — |
| V5 | Y2 | Corrigir os atritos encontrados | D174 |
| V5 | Y3 | Medir toques e teste formal com 3 a 5 pessoas: dispensado pelo dono em 19/10 (o teste segue com os testers de verdade, 2 hoje, e um encontro com times no fim de semana) | — |
| V5 | Z1 | Segurança do servidor no PC: portão do `/supabase` e segredos próprios do Supabase local (`docs/OPERACOES.md`, "Segurança") | D175 |
| V5 | Z2 | Treino fecha sozinho com aviso de resumo; aviso preto fecha em 10 s sem reabrir | D176 |
| V5 | Z3 | Scripts para levar o app a um servidor com Linux Mint: empacotar e instalar (D177, `docs/SERVIDOR.md`) | D177 |
| V5 | Z5 | Segurança da web (V5 §3): CSP só relatando, testada para valer sem violação, e CORS do `/supabase` e `/powersync` só para o próprio endereço (19/10, D212) | D212 |
| V5 | Z6 | LGPD (V5 §4): termos de uso, política completa, aceite registrado no cadastro e para contas antigas, pedidos do titular com prazo, plano de incidente, backup diário, idade mínima de 13 (19/10, D213) | D213 |
| V5 | Z4 | Ambientes: alpha no servidor (segue a main), produção por tag (`npm run promover`) e lab no PC (`npm run lab`) (D178, `docs/AMBIENTES.md`) | D178 |
| V5 | W1 | Esqueci minha senha e olhinho na senha | D165 |
| V5 | W2 | Bloco Projetos fixo com "+", configurações de projetos (Times sai do jogo) | D166 |
| V5 | W3 | Anotações simples (bloco acima de Pastas e Projetos; no Início no celular) | D167 |
| V5 | W3.1 | Anotações em Markdown: barra de formatação, visualização com `react-native-marked`, editor ocupando a tela; reabrir logo depois de criar não fica mais em branco | D187 |
| V5 | W10 | Ajuda: artigos como botões que abrem o texto no lugar, "?" das telas com o artigo aberto | D188 |
| V5 | W11 | Revisão das telas: rolagem principal com `ScreenScroll` (a barra de rolagem fica na margem, fora do texto) e telas de detalhe até 1024 px | D189 |
| V5 | W12 | Treino em grupo: o seletor "quem treina junto" aparece desde o grupo novo, e sozinho oferece o convite | D193 |
| V5 | W4 | Descrição em tarefas e hábitos ("+ adicionar descrição", até 4.000 caracteres) | D168 |
| V5 | W5 | Painel da tarefa mais largo; busca de Relacionar legível | D169 |
| V5 | W6 | Clicar fora do painel fecha e salva | D170 |
| V5 | W7 | Modo Treino fácil de achar | D171 |
| V5 | W8 | `ESCOPO_V5.md`: relógio, tela de bloqueio, usabilidade, HTTPS, LGPD, e-mail, restauração de conta | — |
| V5 | W9 | HTTPS: mandar `http://` para `https://` e cabeçalhos de segurança | D172 |
| V5 | CD1 | Hábito bom/ruim com o + à esquerda e o − à direita | D227 |
| V5 | CD2 | Peso da tarefa com seis níveis nomeados: Trivial, Baixo, Médio, Alto, Muito alto, Extremo | D226 |
| V5 | CD3 | Menu Novo: pelo botão não passa do fim da janela (abre para cima); pelo Alt+N, no meio da tela | D228 |
| V5 | CD4 | Arte do jogo leve nas telas: miniaturas de 192 px para avatares e listas, sem esmaecer as pequenas (D229, parte do TR5) | D229 |
| **V6** | AC0 | Decisões do V6, app para quem treina, lista de tarefas e tipos comuns | — |
| V6 | AC1.1 | `profiles.gym_enabled` (null = não respondeu; só pela RPC `set_gym_mode`) e `profiles.ui_prefs` (objeto, até 4 KB), com pgTAP | D182 |
| V6 | AC1.2 | `lib/sidebar-blocks.ts`: ordem padrão, ordem salva (bloco novo entra no lugar certo), subir/descer, esconder (feito pelo Claude: a fila local foi parada) | — |
| V6 | AC1.3 | `lib/move-sibling.ts`: nova posição para subir/descer entre irmãs (feito pelo Claude) | — |
| V6 | AC1.4 | Componente `GymQuestion` com os textos nos 3 idiomas (feito pelo Claude) | — |
| V6 | AC1.5 | Pasta de sistema Academia (`folders.is_gym`, uma por conta, não vira projeto nem subpasta), criada ao ligar; `tree.gym` | D182 |
| V6 | AC1.6 | Bloco Academia na barra lateral e na aba Pastas (acima de Projetos, com os treinos direto), "+ Novo treino" cria página de cards com reinício semanal | D182 |
| V6 | AC1.7 | Perfil → "Barra lateral": subir, descer e esconder blocos (salvo em `ui_prefs`, vale em todos os aparelhos); a barra lateral e a aba Pastas seguem a ordem | D182 |
| V6 | AC1.8 | "Mover para cima / para baixo" no menu de pasta e página (irmãs do mesmo bloco ou da mesma pasta-mãe) e Alt+↑/↓ na pasta ou página aberta | — |
| V6 | AC1.9 | "Vai usar para treinar?" no Início (uma vez, depois da introdução, enquanto `gym_enabled` é nulo) e o interruptor Modo academia no Perfil; E2E `e2e/academia.spec.ts` e Ajuda nos 3 idiomas | — |
| V6 | AC10.1 | Sessão de treino no servidor (`workout_sessions`, `workout_session_members`): convite com aviso e push, entrar/sair, série do grupo (`log_group_set`, quem marca a última conclui), exercício atual e descanso iguais nos aparelhos pelo Realtime; E2E `e2e/treino-junto.spec.ts` | D183 |
| V6 | AC10.2 | Seletor "Quem está treinando junto agora?" no Modo Treino de pasta compartilhada | D183 |
| V6 | AC10.3 | `lib/gym/leaderboard.ts`: dias ativos (um por dia), pontos opcionais, empates dividindo a posição, sequência atual e maior; `challengeProgress` (feito pelo Claude, tirado da fila local) | — |
| V6 | AC10.4 | Desafios de projeto ou time (`start_challenge` com duração em dias, `challenge_board`), dia de treino no servidor (`workout_days`: página de treino concluída ou 30 min ou mais na sessão), mural e chat (`group_posts`, reações, foto no bucket `group-photos`), RLS e pgTAP | D184 |
| V6 | AC10.5 | Tela Treino em grupo (`/grupo/projeto\|time/<id>`: Desafios com ranking e "Iniciar novo desafio", Mural com check-in, foto, reações e comentários, Chat), botão no projeto e no time, aviso `challenge_started`; E2E `e2e/desafios.spec.ts` e Ajuda nos 3 idiomas | D184 |
| V6 | AC10.6 | Correções do dono (18/10): grupo de treino no bloco Academia (`folders.gym_group`, convite pelo link, treinos do grupo, seletor de quem treina junto), Séries · Repetições · Carga · Descanso no painel do exercício gravando o plano do Modo Treino (descanso e aviso na tela de bloqueio de volta), sem pomodoro e cronômetro em página de treino; pgTAP, E2E `e2e/grupo-treino.spec.ts` e Ajuda nos 3 idiomas | D186 |
| V6 | TR1 | Descanso entre um exercício e o próximo no Modo Treino (o "depois" do plano ou o das séries), também em grupo | D216 |
| V6 | TR2 | Continuar o treino ao voltar (sem o seletor de novo, mesma sessão no servidor, botão "Continuar treino"); "Próximo exercício" num exercício já feito; aviso do treino pausado | D216 |
| V6 | TR3 | Séries avançadas: interruptor no painel do exercício, "+" no fim da linha, repetições e carga por série no Modo Treino | D217 |
| V6 | TR4 | Bateria E2E de usabilidade do Modo Treino (`e2e/treino-bateria.spec.ts`) | D216 |
| **V8** | HB0 | Identidade visual: símbolo limpo no ComfyUI (FLUX.2 klein) e redesenhado em vetor (`assets/brand/`, gerador `gerar.py`); ícone, ícone adaptativo e monocromático do Android, splash claro/escuro, favicon, peças da Google Play; `BrandMark` no login e na barra lateral | D190 |
| V8 | HB0.1 | Acento laranja da marca nos tokens do app: `#A94604` no claro (AA), `#FF8A3D` no escuro | D192 |
| V8 | HB0.2 | Ícones da web como app: manifesto, ícones 192/512/maskable, apple-touch-icon, theme-color | D198 |
| V8 | HB1 | Hábitos: − e + lado a lado na direita (`hábito  \|−\| \|+\|`), no bom/ruim e no contador | D191 |
| V8 | HB2 | Força do hábito bom/ruim (barra de cor pelo valor, regra do Habitica) e hábito só bom ou só ruim | D194 |
| V8 | HB3 | Três níveis de jogo no Perfil: Desligado, Leve e Completo | D195 |
| V8 | HB4 | Início como acampamento no Completo: personagem, bosses com fala, missões do dia | D196 |
| V8 | HB5 | Vida e diárias, "o que você fez ontem?", taverna, poção; morte: vida por 500 de ouro ou recomeçar do nível 1 | D197, D199 |
| V8 | HB6 | Mana, 4 habilidades por classe e dia perfeito | D200 |
| V8 | HB7 | Recompensas personalizadas e baú encantado | D201 |
| V8 | HB8 | Mascotes e montarias: drops, chocar, alimentar, estábulo | D202 |
| V8 | HB9 | Missões com história, sozinho ou com o clã | D203 |
| V8 | HB10 | Retrato pintado sobre cenário, equipamento de batalha com atributos e fantasia | D204 |
| V8 | HB11 | Arte no ComfyUI (79 imagens), vocabulário de jogo, celebrações e sons | D205 |
| V8 | LB1 | Horário nas tarefas e lembretes (servidor, celular e web; feed .ics com hora) | D206 |
| **V9** | GA1 | Tabela `expenses`, permissão `expense.write`, RLS, sync, Realtime, lixeira, exportação de dados, fotos no bucket `receipts`, pgTAP | D218 |
| V9 | GA2 | Página do tipo Gastos: totais do período, orçamento, por categoria, lançamento rápido, planilha e painel do lançamento | D218 |
| V9 | GA3 | Exportar CSV e XLSX (gerado no app, sem dependência) | D218 |
| V9 | GA4 | Edge Function `read-photo` com o Gemini (chave no servidor, leitor de exemplo sem chave), limite do mês, portão, política de privacidade | D219 |
| V9 | GA5 | Foto da nota → conferir → lançamento (ou um por item), foto guardada, aviso de nota repetida | D219 |
| V9 | GA6 | Foto de uma lista → criação em lote (o OCR do ESCOPO §11 e V3 §6 C) | D219 |
| V9 | GA7 | Ajuda nos 3 idiomas, E2E (`e2e/gastos.spec.ts`) | D218, D219 |
| **V10** | AM1 | Nick, amizades, link de amizade, RPCs, avisos, RLS, pgTAP, LGPD (política e termos novos) | D230 |
| V10 | AM2 | Tela Amigos e página do link `/amigo/<token>`; E2E `e2e/amigos.spec.ts` e Ajuda nos 3 idiomas | D230 |
