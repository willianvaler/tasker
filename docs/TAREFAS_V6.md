# Tarefas do ESCOPO_V6 (academia)

Quem faz:
- **Local**: modelos locais do dono (`scripts/delegar/delegar.sh`). Funções puras com testes, componentes pequenos, textos nos 3 idiomas e scripts. A spec de cada uma fica em `.delegar/fila/<id>.md` (fora do git); as marcadas com ✉ já estão na fila.
- **Claude**: banco, permissões (RLS), RPCs, sync, tempo real, segurança, e a ligação das peças nas telas.

Tipos comuns: `src/lib/gym/types.ts` (exercício, série, sessão, regra de progressão); busca de texto: `src/lib/gym/text.ts` (`normalize`, `tokens`). Tarefa que depende de outra Local só entra na fila depois de a anterior ser aplicada (cada uma roda numa cópia isolada do código já aplicado). Funções puras novas ficam em `src/lib/gym/`, com teste em `src/lib/gym/__tests__/`.

Depois de uma tarefa Local aprovada: `scripts/delegar/aplicar.sh <id>`, verificação e um commit por tarefa (ver o skill `delegar`). Status no `docs/STATUS.md`.

## AC1. Para quem treina: modo academia e barra lateral (V6 §15.1, §15.2)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC1.1 | `profiles.gym_enabled` e `profiles.ui_prefs` (ordem e blocos escondidos da barra lateral), com RPC/grant e teste | Claude | |
| AC1.2 | ✉ `lib/sidebar-blocks.ts`: ordem padrão, aplicar a ordem salva, subir/descer, esconder | Local | |
| AC1.3 | ✉ `lib/move-sibling.ts`: nova posição para subir/descer um item entre irmãos | Local | |
| AC1.4 | ✉ Componente `GymQuestion`: a pergunta "Vai usar para treinar?" (sim/agora não), com textos | Local | |
| AC1.5 | Pasta de sistema Academia (como a Caixa de entrada), criada ao ligar o modo; `tree.gym` | Claude | AC1.1 |
| AC1.6 | Bloco Academia na barra lateral e na aba Pastas, acima de Projetos; "+ Novo treino" | Claude | AC1.5 |
| AC1.7 | Perfil → "Barra lateral": reordenar e esconder blocos (usa AC1.2) | Local | AC1.1, AC1.2 |
| AC1.8 | "Mover para cima / para baixo" no menu de pasta e página, Alt+↑/↓ (usa AC1.3) | Claude | AC1.3 |
| AC1.9 | Pergunta no primeiro acesso e o interruptor no Perfil (usa AC1.4) | Claude | AC1.1, AC1.4 |

## AC2. Criar exercício sem ruído (V6 §15.3)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC2.1 | ✉ `lib/gym/fields.ts`: quais campos aparecem no item de uma página de treino (e quais vão para "Mais opções") | Local | |
| AC2.2 | Captura, criação avançada e painel usando AC2.1 em páginas de treino | Claude | AC2.1, AC1.5 |

## AC3. Biblioteca de exercícios (V6 §2)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC3.1 | ✉ `scripts/exercicios/montar-base.mjs`: baixa a free-exercise-db e o dataset MIT, junta os dados técnicos sem duplicar, grava `data/exercicios/base.json` | Local | |
| AC3.2 | ✉ `scripts/exercicios/traduzir.mjs`: nomes e instruções reescritas em pt-BR e es pelo modelo local, retomável | Local | AC3.1 |
| AC3.3 | Rodar AC3.2 (horas, na máquina do dono) e revisar uma amostra | Dono + Claude | AC3.2 |
| AC3.4 | ✉ `lib/gym/exercise-match.ts`: normalizar nomes e achar o exercício a partir do que foi digitado | Local | |
| AC3.5 | ✉ `lib/gym/exercise-filter.ts`: busca e filtros por equipamento, parte do corpo e músculo | Local | |
| AC3.6 | Tabelas `exercises` (catálogo) e `user_exercises` (próprios), carga da base, RLS, sync | Claude | AC3.3 |
| AC3.7 | Tela Biblioteca (lista, filtros, ficha) | Local | AC3.5, AC3.6 |
| AC3.8 | `tasks.exercise_id`, sugestão na captura e no lote (usa AC3.4) | Claude | AC3.4, AC3.6 |
| AC3.9 | `NOTICE.md` com os créditos e licenças das bases | Claude | AC3.1 |

## AC4. Registro por série (V6 §3)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC4.1 | ✉ `lib/gym/units.ts`: kg ↔ lb, arredondar ao degrau, formatar no idioma | Local | |
| AC4.2 | ✉ `lib/gym/effort.ts`: RIR ↔ RPE, passo do seletor, médias | Local | |
| AC4.3 | Tabela `workout_sets` (cada série como aconteceu), RPC `log_set` offline (run_once), sync, conta por pessoa | Claude | AC3.6 |
| AC4.4 | Componente `SetRow`: carga e reps (ou tempo, ou cardio) com −/+, aquecimento, esforço | Local | AC4.1, AC4.2 |
| AC4.5 | Modo Treino grava a série detalhada; kg/lb e esforço no Perfil | Claude | AC4.3, AC4.4 |
| AC4.6 | Histórico por exercício (tela) | Local | AC4.3 |

## AC5. Recordes e 1RM (V6 §4)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC5.1 | ✉ `lib/gym/one-rm.ts`: 1RM estimado, melhor série, tabela de porcentagens | Local | |
| AC5.2 | `lib/gym/records.ts`: que recordes uma série nova bate | Local | AC5.1 |
| AC5.3 | Aviso de recorde no Modo Treino e no resumo; crítico garantido no boss (servidor) | Claude | AC4.5, AC5.2 |
| AC5.4 | Gráfico de evolução do 1RM e calculadora (tela) | Local | AC5.1, AC4.3 |

## AC6. Progressão automática (V6 §5)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC6.1 | ✉ `lib/gym/progression.ts`: leitura honesta da sessão, linear e progressão dupla | Local | |
| AC6.2 | Greyskull, mais tempo e deload (estende AC6.1) | Local | AC6.1 |
| AC6.3 | Regra por treino e por exercício (colunas), prescrição ao abrir o treino, "por quê" na tela | Claude | AC6.2, AC4.3 |

## AC7. Peso e medidas (V6 §6)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC7.1 | Tabela `body_metrics` (dado sensível: só a pessoa), consentimento, exportar e excluir | Claude | |
| AC7.2 | ✉ `lib/gym/body-trend.ts`: média móvel, distância da meta, se aproximou ou afastou | Local | |
| AC7.3 | Tela Peso e medidas (registro, meta, gráfico) | Local | AC7.1, AC7.2 |

## AC8. Estatísticas (V6 §7)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC8.1 | ✉ `lib/gym/heatmap.ts`: grade do ano (semanas × dias) com nível 0 a 4 | Local | |
| AC8.2 | ✉ `lib/gym/muscle-volume.ts`: volume por músculo no período e os não treinados | Local | |
| AC8.3 | Contornos do corpo (MuscleMap, MIT) convertidos para JSON + crédito | Local | |
| AC8.4 | Componente `BodyMap` (frente e costas, cores do tema) | Local | AC8.2, AC8.3 |
| AC8.5 | Tela Estatísticas de treino | Claude | AC8.1, AC8.4, AC4.3 |

## AC9. Montar e executar (V6 §8)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC9.1 | ✉ `lib/gym/plates.ts`: anilhas por lado | Local | |
| AC9.2 | ✉ `lib/gym/warmup.ts`: séries de aquecimento sugeridas | Local | |
| AC9.3 | Calculadora de anilhas (componente) | Local | AC9.1 |
| AC9.4 | Supersets e circuitos (grupo no banco, Modo Treino alterna e descansa no fim do grupo) | Claude | AC4.5 |
| AC9.5 | Plano da semana, remarcar o treino do dia, lembrete em dia de treino | Claude | AC1.6 |

## AC10. Treinar junto e competir (V6 §15.4, §15.5)

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC10.1 | `workout_sessions` e participantes, marcar série de outro participante, tempo real, convite no celular | Claude | AC4.3 |
| AC10.2 | Componente seletor "Quem está treinando junto?" | Local | |
| AC10.3 | ✉ `lib/gym/leaderboard.ts`: dias ativos, pontos, empates, sequência | Local | |
| AC10.4 | Desafios, check-ins com foto, chat do grupo (tabelas, RLS, tempo real) | Claude | AC1.5 |
| AC10.5 | Telas de ranking, mural e chat | Local | AC10.3, AC10.4 |

## AC11 a AC14

| Id | Tarefa | Quem | Depende |
|---|---|---|---|
| AC11 | Conquistas de academia e recorde crítico no jogo | Claude | AC5.3 |
| AC12.1 | Planos prontos (JSON) e montar a página a partir deles | Local | AC3.6 |
| AC12.2 | Importadores Strong, Hevy e FitNotes (precisa de arquivos de exemplo do dono) | Local | AC4.3 |
| AC13 | Painel do treinador com recordes, 1RM e estagnação | Claude | AC5.2, AC6.3 |
| AC14 | Avaliar custo por token e modelos (texto e imagem) para o treinador por IA | Claude | |
