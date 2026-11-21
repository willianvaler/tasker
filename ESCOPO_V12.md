# Questlist — Escopo V12: agenda, reuniões, gestão de projetos e visões da lista (instruções para o Claude Code)

Pedido do dono em 20/11/2026:

> "ve o que a gente consegue 'roubar' de funcionalidades desses reps https://github.com/AppFlowy-IO/AppFlowy https://github.com/calcom/cal.diy https://github.com/opf/openproject"
>
> "sim, escreva o escopo 12 mas ainda nao comece nada"

A referência são as **funções** dos três projetos, não o código: o AppFlowy é Flutter/Rust, o Cal.diy é Next.js e o OpenProject é Rails, e nada disso se encaixa no Expo + Supabase daqui. Os READMEs são rasos; o que segue junta o que eles dizem com o que os produtos fazem. Nada aqui copia nome, arte ou marca deles.

- **Cal.diy** (fork pessoal do Cal.com, sem os recursos de empresa): página pública de horários, tipos de evento, disponibilidade, integração com agendas.
- **OpenProject**: projetos e portfólio, Gantt, quadros ágeis, versões e roadmap, tempo e custo, orçamento, reuniões com pauta e ata, wiki e fórum, integração com GitHub/GitLab.
- **AppFlowy** (estilo Notion): bancos de dados com várias visões (grade, quadro, calendário), a linha como página, propriedades, documentos em blocos, IA.

Em conflito com escopos anteriores, este vence. Decisões tomadas sem o dono ficam marcadas com **(padrão)** e voltam na tabela do §12.

## 0. O que o Questlist já tem

| Nos três projetos | No Questlist hoje |
|---|---|
| Calendário e agenda | Calendário mês/semana com feed .ics para o Google Agenda (C1, D185); horário e lembrete na tarefa (D206) |
| Página pública de reserva | Não tem. Os links fora do login são só de convite, página enviada e anotação publicada |
| Gantt | Gantt editável com início, arrastar e setas das dependências (PC3, D308), dependência entre projetos (PC2, D307) |
| Quadros ágeis | Quadro (kanban) por estado (D54); não agrupa por outro campo |
| Versões e roadmap | Marcos (`milestones`, E6) com progresso na visão geral; não há tela de roadmap |
| Tempo e custo | Tempo registrado, pomodoro e cronômetro (K, D129 a D132); gastos com orçamento por lista (D218); não há valor da hora |
| Reuniões | Não tem. Uma "reunião" é só uma tarefa com horário |
| Wiki | Anotações com links, backlinks, consultas, Bases, grafo, canvas e publicação (V11 inteiro) |
| Banco de dados com visões | Bases (OB8: tabela e cartões de uma consulta) e campos personalizados (M5, D142); a lista comum tem um tipo só (lista, cards, hábitos...) |
| Documento em blocos e menu "/" | Comandos de barra nas anotações (OB3) |
| Linha como página | O painel da tarefa (notas com Markdown e `[[links]]`, comentários, anexos, histórico) |
| Integração com GitHub | Não tem. O dono acompanha o desenvolvimento num projeto do app, gerado dos docs |

O que falta, em resumo: **a agenda que os outros usam** (reservar um horário com você), **reuniões** e a parte de **planejar e medir** um projeto (linha de base, roadmap, custo). Do AppFlowy sobra pouco, porque o V11 já trouxe Bases e o menu "/": as **visões salvas** da mesma lista e **fórmulas** nos campos.

## 1. Disponibilidade e página de reservas (do Cal.diy)

- **Disponibilidade:** em Configurações → Agenda, os horários em que a pessoa aceita compromissos, por dia da semana (ex.: seg a sex, 9h–12h e 14h–18h), no fuso do perfil. Exceções por data (folga, viagem) e "bloquear o dia inteiro". Tabela `availability` (dona só), RLS e pgTAP.
- **Tipos de compromisso:** nome, duração (15, 30, 45, 60 min ou outra), intervalo antes e depois, antecedência mínima (ex.: 4 h), até quantos dias à frente, limite por dia e perguntas para quem reserva (nome e e-mail sempre; telefone e texto livre opcionais). Cada tipo tem um link próprio: `/agenda/<apelido>/<tipo>`.
- **Página pública, fora do login** (como `invite/[token]`): mostra os dias com horário livre e, num dia, os horários. Livre = dentro da disponibilidade, menos as tarefas da pessoa com horário naquele dia (`due_time` + duração estimada, ou 30 min **(padrão)**), menos as reservas já feitas e os intervalos. **Quem vê a página não vê o que ocupa o horário**, só que está ocupado: a conta é de uma RPC `security definer` que devolve só os horários livres (`booking_slots`), nunca as tarefas.
- **Reservar:** RPC `book_slot` (anônima, com limite por IP e por e-mail no `serve.mjs`, D177) confere de novo que o horário está livre, na mesma transação (dois reservando o mesmo horário: o segundo recebe "esse horário acabou de ser ocupado"). A reserva vira **uma tarefa** na lista **Agenda** da pessoa (página de sistema nova, como `tree.inbox`), com data, horário, duração e as respostas nas notas, e um aviso no app e por push.
- **Quem reservou** recebe por e-mail a confirmação com um `.ics` e um link para **remarcar ou cancelar** (token por reserva). E-mail depende do provedor que está em `PUBLICACAO.md` (pendente do dono): enquanto não houver, a página mostra a confirmação e o botão "Adicionar à agenda" (.ics), sem e-mail **(padrão)**.
- **Dono da agenda:** confirmar automático **(padrão)** ou pedir aprovação; cancelar avisa quem reservou; remarcar oferece novos horários.
- **Privacidade:** dado pessoal novo (nome, e-mail e telefone de quem não tem conta): atualizar a política (D213, `LEGAL_VERSION`), retenção de 1 ano depois do compromisso **(padrão)**, export e exclusão da conta levam junto.
- **Sem internet:** a página pública é do servidor; no app, a lista Agenda funciona offline como qualquer lista. Configurar a disponibilidade pede conexão.
- **Integração com o Google Agenda (mão dupla)** para contar os compromissos de lá como ocupados fica para depois (OAuth, D185 já deixou isso de fora).

## 2. Achar horário em grupo (do Cal.diy, com o que o Questlist tem de colaborativo)

- Num projeto, time ou clã: **"Achar horário"** escolhe as pessoas e a duração, e mostra os horários em que todas estão livres nos próximos dias (pela disponibilidade e pelas tarefas com horário de cada uma). Quem não configurou disponibilidade entra como "sem agenda" e não limita.
- Cada pessoa vê só **livre/ocupado** das outras, nunca o que é. A conta é de uma RPC para membros do grupo.
- Escolher um horário cria o compromisso para todos: uma tarefa no projeto com as pessoas como responsáveis, ou uma **reunião** (§3) quando ela existir.
- **Enquete de horário** (para quem não está no app): propor 3 a 5 horários, mandar o link, cada um marca os que servem, o dono fecha. Fica como segunda etapa **(padrão)**.

## 3. Reuniões: pauta, ata e ações (do OpenProject)

- **Reunião** é um tipo novo de lista (`view_type = 'meeting'`) dentro de uma pasta ou projeto, com data, horário, duração, lugar ou link da chamada e participantes (membros do projeto, ou nomes livres).
- **Pauta:** itens com título, quem apresenta, tempo previsto e notas; um item pode **apontar para uma tarefa** do projeto (`[[t:...]]`, OB1), e aí mostra o estado dela ao vivo.
- **Durante a reunião:** "Começar" mostra o item atual com o tempo dele (timer pelo `start_timer`, D124), passar para o próximo, anotações por item (Markdown, com `[[links]]` e `@nome`).
- **Ata:** "Encerrar" congela a pauta e as notas como ata (só leitura, com quem esteve presente) e oferece mandar por aviso aos participantes. Ata é uma anotação gerada, então entra em busca, backlinks e versões (V11) sem código novo.
- **Ações:** em qualquer nota, `[ ] fazer X @Ana até sexta` vira **tarefa de verdade** no projeto (pela escrita rápida e `create_tasks_batch`, D16), com o link de volta para a reunião. Na próxima reunião da série, a pauta começa com "Ações da última reunião" e o estado de cada uma.
- **Reunião que se repete** (semanal, quinzenal): cada ocorrência é uma reunião nova, criada a partir da anterior (pauta fixa + ações em aberto).
- Permissões novas no `can()` e em `permission_presets()`: `meeting.manage` (criar, editar pauta, encerrar) e quem participa comenta. Tabela de itens com RLS por `has_permission`, sync e Realtime (é de projeto).

## 4. Linha de base no Gantt (do OpenProject)

- **"Salvar linha de base"** no Gantt guarda as datas de início e fim de cada tarefa naquele momento, com nome e data ("Plano aprovado 20/11"). Até 5 por projeto **(padrão)**.
- **Comparar:** escolher uma linha de base desenha a barra antiga, fina e apagada, embaixo da atual, com o atraso em dias ("+3 d") e as tarefas que entraram ou saíram depois dela. Nos indicadores (Fase I): quantas tarefas atrasaram em relação ao plano e o atraso somado.
- Também dá para comparar com uma **data do histórico** sem ter salvado, reconstruindo pelas mudanças de data em `task_events` (Fase I) **(padrão: só a salva; a do histórico fica para depois)**.
- Tabela `baselines` (+ itens), do projeto, RLS, pgTAP e sync; quem pode salvar: `project.manage`.

## 5. Roadmap por marco (do OpenProject)

- Os **marcos** (E6) ganham uma tela de roadmap: em ordem de data, cada marco com as tarefas ligadas a ele, o progresso, o que está atrasado e o que está bloqueado (estado derivado, D108). Marco passado com tarefa aberta fica em destaque.
- **Ligar a tarefa ao marco** (coluna `tasks.milestone_id`, no sync), pelo painel, pelo lote e pela escrita rápida (`~Marco`, se não colidir com outro símbolo: conferir em `lib/parser/quick.ts`).
- No Gantt, o marco vira um losango na data dele; arrastar muda a data.
- **"Notas da versão":** ao concluir o marco, um texto gerado com as tarefas feitas, para copiar ou publicar como anotação (OB14).

## 6. Custo da hora e orçamento do projeto (do OpenProject)

- **Valor da hora** por pessoa no projeto (definido por quem gerencia, `project.manage`) e um padrão do projeto. Tempo registrado (`time_entries`) × valor = **custo do trabalho**, em centavos inteiros (`lib/expenses.ts`).
- **Orçamento do projeto** = trabalho + gastos (D218), com o previsto (estimativa das tarefas × valor e orçamento das listas de gastos) e o realizado. Tela no projeto com as duas barras, por lista e por pessoa, e exportar CSV.
- **Privacidade:** o valor da hora de cada pessoa só é visto por quem gerencia e por ela mesma; os outros membros veem só o total **(padrão)**.
- Fica de fora: faturamento, nota fiscal e impostos.

## 7. Visões salvas da mesma lista (do AppFlowy)

- Hoje a lista tem um tipo só. A ideia é a mesma lista (as mesmas tarefas) poder ser vista como **Lista, Quadro, Tabela, Calendário e Gantt**, em abas no topo, sem copiar nada.
- Cada **visão** guarda filtro, ordem, agrupamento e colunas visíveis (em `pages.config.views`, no sync). Ex.: "Quadro por Fase" (agrupando por um campo de seleção, D142, e não só pelo estado), "Tabela das atrasadas", "Calendário de entregas".
- **Quadro por campo:** arrastar o cartão de coluna muda o valor do campo (pelo `useUpdateTask`, otimista e offline). Agrupar por responsável, prioridade, etiqueta ou campo de seleção.
- **Tabela:** reaproveita a tabela das Bases (OB8), com edição na célula; a diferença é que mostra a própria lista, sem consulta.
- Tipos que não são de tarefa comum (hábitos, gastos, treino, canvas, base) ficam como estão; as visões valem para a **lista comum e a de cards**.
- Visão pessoal × do projeto: cada pessoa pode ter as suas; as do projeto são salvas por quem tem `page.manage` **(padrão)**.

## 8. Fórmulas e totais nos campos (do AppFlowy)

- **Rodapé da tabela:** soma, média, mínimo, máximo e contagem por coluna numérica ou de moeda; contagem por valor nos campos de seleção. Vale nas visões (§7) e nas Bases.
- **Campo calculado:** tipo novo em `page_fields`, com uma fórmula pequena e fechada (como a linguagem das consultas, OB7, sem JavaScript): `{Valor} * {Quantidade}`, `dias_ate({vencimento})`, `se({Fase} = "Compra", 1, 0)`. Calculado no app, nunca guardado (o banco é a fonte dos valores, a fórmula é só leitura). Parser e executor puros em `lib/formula/`, com testes nos 3 idiomas dos nomes das funções.
- **Total das subtarefas na mãe** (rollup): soma de um campo numérico ou do tempo das filhas, mostrada na tarefa agrupadora.

## 9. Commits e PRs do GitHub nas tarefas (do OpenProject; opcional)

- Para quem acompanha código no app (o próprio dono, com o projeto do Questlist): um **webhook** do GitHub numa Edge Function nova (entra no `FUNCTIONS` do `scripts/supabase-gate.mjs`), com segredo por projeto.
- Commit ou PR cujo texto tem o código da tarefa entre colchetes (como `[CD40]`; o app não tem id curto, então o código fica num campo da tarefa, D142, escolhido nas configurações do webhook) vira **comentário** na tarefa com o link; PR mesclado com "fecha"/"closes" conclui a tarefa **(padrão: só comenta; concluir é opção do projeto)**.
- Aba **Código** no painel da tarefa com os commits e PRs ligados. GitLab fica para depois.

## 10. Fora deste escopo

- **IA no texto** (resumir, perguntar à wiki, escrever por você): o app já usa o Gemini só para ler foto (D219), por pedido explícito; levar as anotações e tarefas para um terceiro é mudança de privacidade grande. Avaliar à parte, se o dono quiser.
- **Fórum e notícias** do projeto (OpenProject): os comentários, a atividade e o feed do clã cobrem.
- **Portfólio de projetos, SAFe, BIM/BCF** e tipos de tarefa com fluxo de estados configurável: pesado para o público do app. O estado continua derivado (D108).
- **Vídeo integrado, CRM, Zoom e afins** (Cal.diy): na reunião (§3) vai só o link da chamada.
- **Pagamento na reserva** (Stripe): fora; não há cobrança no app.
- **SSO/SAML** e organizações: o Cal.diy tirou de propósito, e o Questlist não tem esse público.

## 11. Ordem sugerida

| Id | Tarefa | Depende de |
|---|---|---|
| AG1 | Disponibilidade e exceções (Configurações → Agenda, `availability`, RLS, pgTAP) | — |
| AG2 | Tipos de compromisso, página pública `/agenda/<apelido>/<tipo>`, `booking_slots` e `book_slot`, lista de sistema Agenda, aviso, .ics, remarcar e cancelar; política atualizada | AG1 |
| AG3 | Achar horário em grupo (projeto, time, clã); depois, enquete de horário | AG1 |
| GP1 | Reuniões: tipo `meeting`, pauta com tarefas, timer por item, ata como anotação, ações viram tarefas, série | — |
| GP2 | Linha de base no Gantt (salvar, comparar, atraso nos indicadores) | — |
| GP3 | Roadmap por marco (`tasks.milestone_id`, tela, losango no Gantt, notas da versão) | — |
| GP4 | Valor da hora e orçamento do projeto (trabalho + gastos, previsto × realizado, CSV) | — |
| VS1 | Visões salvas da lista (Lista, Quadro por campo, Tabela, Calendário, Gantt) | — |
| VS2 | Totais no rodapé, campo calculado (`lib/formula/`) e total das subtarefas | VS1 |
| GP5 | Webhook do GitHub (comentário e, se ligado, conclusão) e aba Código (opcional) | — |

Cada tarefa: Ajuda nos 3 idiomas, i18n, E2E e o registro de sempre (STATUS, PENDENTES, FEITOS, DECISIONS). Tabela nova: RLS e pgTAP (dono acessa, estranho não vê, leitor não grava), privilégio por coluna, publicação do sync e do Realtime quando for de projeto. Rota pública nova: limite de pedidos no `serve.mjs` e nenhum dado além do necessário na resposta.

## 12. Decisões do dono

Respondidas em 21/11/2026 (D309): o dono aceitou todos os padrões ("vale o padrão, pode começar pela agenda"). A coluna **Padrão** é a decisão.

| # | Pergunta | Padrão |
|---|---|---|
| V12-1 | Por onde começar: agenda e reservas (AG), reuniões (GP1) ou visões da lista (VS1)? | **Agenda** (AG1, AG2): é o que mais acrescenta e não depende de nada |
| V12-2 | A página de reservas sai antes de ter e-mail (só confirmação na tela e .ics)? | **Sim**, e o e-mail entra quando o provedor do `PUBLICACAO.md` existir |
| V12-3 | Reserva confirma sozinha ou pede aprovação? | **Sozinha**, com a opção de aprovar por tipo de compromisso |
| V12-4 | Tarefa sem duração ocupa quanto tempo na agenda? | **30 min** (a estimativa da tarefa, quando houver) |
| V12-5 | Valor da hora visível só para quem gerencia e a própria pessoa? | **Sim**; os outros veem só o total |
| V12-6 | Visões do projeto (para todos) e pessoais (só minhas), ou só uma das duas? | **As duas**; as do projeto pedem `page.manage` |
| V12-7 | O GitHub (GP5) entra no escopo ou fica de fora? | **Entra como opcional**, por último |
| V12-8 | IA no texto (resumir, perguntar às anotações) fica mesmo de fora? | **Fora** (§10), por privacidade |
