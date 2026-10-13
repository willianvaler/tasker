# Tasker — Escopo V3 (instruções para o Claude Code)

Este documento **complementa** `ESCOPO.md` e `ESCOPO_V2.md`. Onde houver conflito, **o mais recente vence** (V3 > V2 > V1).

Antes de começar: releia `CLAUDE.md`, `DECISIONS.md` e `docs/STATUS.md`. Ao concluir cada item, atualize `docs/STATUS.md`. Decisões novas vão em `DECISIONS.md`. Todo texto novo nasce nos 3 idiomas (pt-BR, en, es) e todo atalho novo entra no registro central e na página de Ajuda.

---

## 0. PRIORIDADE ZERO — Correção do design

**Problema relatado pelo usuário:** o resultado visual da V2 parece "front-end feito por dev de back-end": estranho, sem acabamento, sem hierarquia. A causa mais provável é implementar visual **a partir de texto**, sem referência visual. Portanto, daqui em diante:

### 0.1 Processo obrigatório

1. **Referência visual primeiro.** Antes de refazer qualquer tela, criar mockups **estáticos em HTML/CSS** em `docs/mockups/` (um arquivo por tela-chave, claro e escuro, desktop 1280 px e celular 390 px). O usuário aprova os mockups **antes** de qualquer implementação em React. *(O usuário pode fornecer mockups prontos; se existirem em `docs/mockups/`, são a fonte da verdade.)*
2. **Ciclo de revisão com captura de tela.** Para cada tela implementada: abrir no Playwright, capturar em 1280 px e 390 px (claro e escuro), **comparar com o mockup lado a lado**, listar as diferenças e corrigir. Repetir até ficar visualmente equivalente. Salvar em `docs/screenshots/`.
3. **Componentes antes de telas.** Construir e validar na página `/design` (somente dev): botão, campo, linha de tarefa, checkbox, chip/etiqueta, item de sidebar, popover, painel lateral, folha inferior (mobile), toast, estado vazio, linha de pessoa/avatar. Só depois montar as telas com eles.
4. **Proibido** estilizar com valores soltos. Tudo vem de tokens (cores, espaçamento, tipografia, raios, sombras, durações).

### 0.2 Erros típicos de "visual de back-end" a eliminar

- Controles com aparência padrão do navegador ou do Tailwind sem acabamento (inputs, selects, checkboxes, scrollbars).
- Muitos tamanhos de fonte e pesos diferentes; títulos e textos com quase o mesmo peso visual.
- Espaçamentos irregulares, itens desalinhados, margens "quase iguais".
- Bordas em tudo; caixas dentro de caixas; barras de ferramentas lotadas.
- Botões de tamanhos e estilos variados; links azuis padrão; ícones de tamanhos misturados.
- Falta de estados: hover, foco, ativo, desabilitado, carregando, vazio, erro.
- Informação sem agrupamento nem ritmo; tudo com a mesma importância.
- Tabelas/listas cruas sem altura de linha consistente.

### 0.3 Especificações concretas (base; refinar nos mockups)

| Item | Regra |
|---|---|
| Escala de espaçamento | 4 · 8 · 12 · 16 · 24 · 32 · 48 px (nenhum outro valor) |
| Escala tipográfica | 12 (metadados/mono) · 14 (texto da UI) · 16 (texto de leitura) · 20 (título de seção) · 28 (título de página). **Só esses 5.** |
| Pesos | 400 e 600 (títulos serifados podem usar 500). Nenhum outro. |
| Altura da linha de tarefa | 40 px desktop (compacta) / 52 px celular. Fixa e consistente. |
| Alvos de toque | ≥ 44 px no celular |
| Ícones | 16 px (inline) e 20 px (navegação/botões); traço de 1,5 px; um único conjunto |
| Botões | 2 variantes apenas: **primário** (fundo `--accent`) e **fantasma** (sem fundo, hover sutil). Altura 32 px desktop / 44 px celular. |
| Raios | 4 px (controles) e 8 px (painéis). Nenhum outro. |
| Bordas | 1 px `--line`. Preferir **espaço** a borda para separar grupos. |
| Sidebar | 256 px, fundo `--surface`, item 32 px, seção com rótulo em 12 px caixa-alta espaçada |
| Painel de detalhes | 400 px de largura, desliza da direita (150 ms) |
| Área de leitura | máx. 760 px centralizada |
| Foco | anel de 2 px `--accent` com offset de 2 px, sempre visível no teclado |
| Movimento | 100–180 ms, `ease-out`; respeitar `prefers-reduced-motion` |

Aplicar a direção "Caderno de bolso" (papel, tinta, um acento) da V2. Se os mockups aprovados divergirem desta tabela, **os mockups vencem** e a tabela é atualizada em `docs/DESIGN.md`.

---

## 1. Subtarefas e estrutura WBS

### 1.1 Regras

- Tarefas podem ter subtarefas formando uma árvore (WBS: *Work Breakdown Structure*).
- **Limite de profundidade:** padrão **4 níveis** (a tarefa raiz é o nível 1, então ela + 3 níveis de subtarefas). Configurável por **projeto/página** entre **2 e 6**. **Teto absoluto global: 6** (desempenho e usabilidade).
- Constantes em `config/limits.ts` (`DEFAULT_MAX_DEPTH = 4`, `HARD_MAX_DEPTH = 6`, `MAX_CHILDREN_PER_TASK = 50`). **Validar no cliente e no servidor**; o servidor é a autoridade (rejeita mutation que ultrapasse o limite).
- Mover um galho que faria a árvore passar do limite é **bloqueado** com mensagem clara ("Isso passaria de 4 níveis. Suba um nível ou aumente o limite do projeto.").
- Reduzir o limite do projeto abaixo da profundidade existente é bloqueado (informar quais tarefas excedem).
- **Criação em lote:** indentação além do limite é **achatada** no último nível permitido, com aviso na pré-visualização.
- Sem ciclos na árvore (um item não pode ser filho do próprio descendente).

### 1.2 Comportamento

- **Tarefas-pai são agrupadoras** ("pacotes"); só as **folhas** (tarefas sem filhos) são executáveis e geram XP (evita farm de XP criando subtarefas).
- **Progresso do pai** = % de folhas concluídas (opcionalmente ponderado por `weight` ou `estimate_minutes`). Exibir como régua fina.
- Pai **não** pode ser concluído enquanto houver filho pendente. Configuração por projeto: *concluir automaticamente o pai quando todos os filhos terminarem* (padrão: ligado). Ação "Concluir tudo" pede confirmação.
- **Herança:** subtarefa herda responsável e etiquetas por padrão (editável). Data do filho acima da data do pai gera aviso (não bloqueio).
- **Estimativas e custos** do pai = soma dos filhos (rollup somente leitura).
- **Código WBS opcional:** numeração automática `1`, `1.1`, `1.1.2` com toggle "Mostrar códigos". Exportável.
- **Dependência e árvore:** depender de um pai = depender de **todos** os seus descendentes concluídos. Um filho **herda os bloqueios do pai** (não fica "pronto" enquanto o pai estiver bloqueado).
- **Teclado:** `Tab` indenta (vira subtarefa do item acima), `Shift+Tab` desindenta, `Ctrl/Cmd+↑↓` move, `→/←` expande/recolhe. Respeitar o limite (mostrar aviso discreto, não erro agressivo).
- **Visão "Estrutura":** árvore recolhível com códigos WBS, progresso e responsável por linha.
- Ordenação por **fractional indexing** (V2) também na árvore; conflitos de "mover para outro pai" resolvem por última escrita, validando limite e ciclo no servidor (rejeitada → desfaz localmente).

---

## 2. Dependências e fluxo de trabalho (BPM-lite)

> **Escopo:** acompanhamento de fluxo com dependências, estados, responsáveis, auditoria e automações simples. **Não é** um motor BPMN completo (sem gateways complexos, sem simulação).

### 2.1 Dependências entre tarefas

- Uma tarefa pode ter **pré-requisitos** ("só pode começar depois de…").
- Tipo padrão: **término → início** (B só começa quando A termina). Campo opcional de **atraso** (`lag_minutes`, ex.: "30 min depois" para a carne descansar).
- Modo por tarefa: `deps_mode = 'all'` (todos os pré-requisitos) ou `'any'` (basta um). Padrão `all`.
- **Sem ciclos:** validar no cliente e no servidor (detecção em grafo); mensagem clara mostrando o caminho circular.
- Dependências entre tarefas **do mesmo projeto** na V3. Entre projetos diferentes fica para o backlog (envolve permissões cruzadas).
- Exemplo-alvo: *"Acender o fogo (Willian)"* depende de *"Comprar carvão (Greg)"*. Quando Greg conclui, Willian recebe: "O carvão foi comprado — já pode acender o fogo."

### 2.2 Estados derivados

Estado de execução de uma tarefa:

`bloqueada` → `pronta` → `em andamento` → `concluída` (+ `cancelada`, `aguardando` opcional)

- **`bloqueada` e `pronta` são DERIVADAS** dos pré-requisitos (não armazenadas como verdade). Calcular **localmente a partir do banco local** para funcionar offline; o servidor recalcula para notificações e auditoria.
- `em andamento` = `started_at` preenchido (botão "Iniciar", atalho `S`).
- Tarefa **bloqueada**: mostra um cadeado e "Aguardando: *Comprar carvão* (Greg)". Não pode ser iniciada nem concluída por Editor/Colaborador. **Modo estrito** (padrão) vs **modo flexível** (configurável por projeto): no flexível, Gerente/Editor pode "forçar" com aviso e registro na auditoria.
- Ao desbloquear (todos os pré-requisitos atendidos e `lag` vencido), gerar evento `ready` e **notificar os responsáveis**.
- Se um pré-requisito já concluído for **reaberto**, os dependentes voltam a `bloqueada` (e quem já estava em andamento recebe aviso).
- Conclusão em cascata: concluir um pai/pré-requisito nunca conclui dependentes automaticamente.

### 2.3 Dependência entre páginas

- Uma página pode depender de outra: **só libera quando a página anterior chegar a X% concluída** (padrão 100%, configurável).
- Enquanto bloqueada, a página mostra um aviso no topo e suas tarefas ficam como `bloqueadas`.
- Exemplo (reforma): página "Acabamento" depende de "Alvenaria e elétrica".

### 2.4 Vínculos informativos (não bloqueiam)

- **"Relacionados":** ligação simples entre páginas/tarefas/projetos (ex.: página "Cardápio" ↔ página "Treinos"). Aparece como chips "Relacionados" no cabeçalho. Não afeta estado nem permissão.
- Respeita permissões: o usuário só vê o título do item vinculado se tiver acesso a ele.

### 2.5 Criar dependências rápido

- **Na criação/edição de tarefa:** campo "Depende de" com busca/autocomplete (digitar parte do título). Chips removíveis. Também "Libera:" (lista de dependentes) somente leitura com atalho para abrir.
- **Sintaxe rápida:** `^trecho do título` no campo de captura. Ex.: `Acender o fogo @willian ^carvão`. Abre autocomplete ao digitar `^`.
- **Em lote:** `^` referencia por trecho de título ou por número da linha (`^2`) **dentro do mesmo lote** (resolvido na pré-visualização, destacando ambiguidades).
- **Na visão Fluxo:** arrastar de uma tarefa para outra cria a ligação.
- Atalho no painel: `L` abre "ligar a…".

### 2.6 Visualizações do projeto

O Projeto ganha abas: **Lista · Fluxo · Pessoas · Linha do tempo**.

1. **Lista:** linhas com indicadores discretos (cadeado se bloqueada, ponto verde se pronta, relógio se em andamento).
2. **Fluxo (grafo):** nós = tarefas, setas = dependências, organizado da esquerda para a direita; **raias por pessoa** (opcional); cor/forma por estado; destaque "**você está aqui**" na fronteira ativa; caminho crítico realçado (se houver estimativas); recolher galhos concluídos. Biblioteca sugerida: **React Flow (xyflow)** + layout automático (**dagre** ou **ELK**). Em celular: modo leitura, com zoom e toque no nó abrindo o painel.
3. **Pessoas:** colunas por pessoa com "fazendo agora / pronta para fazer / bloqueada / concluída", respondendo "quem está fazendo o que".
4. **Linha do tempo:** auditoria cronológica (seção 2.7).

### 2.7 Auditoria do fluxo

- Tabela `task_events` (**só inserção**): `created, assigned, ready, started, blocked, unblocked, completed, reopened, reassigned, forced, dependency_added, dependency_removed, moved, deleted`, com usuário, data/hora e dados.
- Por tarefa: aba "Histórico" com os eventos.
- Por projeto: linha do tempo filtrável por pessoa, tipo e período; exportação CSV.
- **Indicadores** (somente leitura, na visão do projeto): tempo médio em cada estado, **tempo esperando bloqueio**, **gargalos** (tarefas que mais bloqueiam outras), **caminho crítico**, atrasos por pessoa. Linguagem simples, sem painel poluído.
- Acesso à auditoria por permissão (`workflow.view_audit`), padrão: Gerente e Editor.

### 2.8 Automações simples (fase final do bloco)

Regras "**quando** X **então** Y", configuradas na criação avançada do projeto/página:

- Gatilhos: tarefa concluída, tarefa ficou pronta, página concluída, prazo vencido, tarefa atribuída.
- Ações: criar tarefa (a partir de modelo), atribuir a alguém, notificar, mudar etiqueta, mover de página, iniciar cronômetro de descanso.
- Limites: no máximo N regras por projeto; proteção contra laço infinito (profundidade máxima de encadeamento e deduplicação).
- **Etapa de aprovação:** tipo de tarefa "Aprovação" que só pode ser concluída por um cargo/pessoa definidos (ex.: o dono aprova o orçamento antes da compra).

---

## 3. Projetos simplificados — "Página enviada" (Treinador → Aluno)

### 3.1 Conceito

Para casos em que **não faz sentido um projeto completo com time**: uma pessoa monta uma **página** e a envia para outra, que **só executa** (marca os itens e registra o que fez).

Exemplos: personal trainer → aluno; nutricionista → paciente (cardápio/hábitos); professor → aluno (lição de casa); pais → filhos (tarefas da casa); gestor → colaborador (checklist de rotina); prestador de serviço → cliente.

### 3.2 Funcionamento

- Em qualquer página: botão **"Enviar para…"** (também no menu `...` e na paleta de comandos).
- Escolher destinatário(s) por **link** (compartilhável por WhatsApp etc.) ou e-mail. Quem não tem conta cria uma em poucos passos e **cai direto na página**, sem ver nada além dela.
- **Dois modos de envio:**
  - **Ao vivo:** o autor continua editando e o destinatário vê as mudanças (treinador ajusta o treino).
  - **Cópia:** o destinatário recebe uma cópia que passa a ser dele.
- **Envio para vários:** a mesma página para N alunos, cada um com **seu próprio progresso** independente (conclusões e registros por usuário, não por tarefa).
- O destinatário vê a página numa seção **"Recebidas"** da sidebar; não vê pastas, projetos ou outras páginas do autor.
- Funciona **offline** (o treino precisa funcionar na academia sem sinal), sincronizando depois.

### 3.3 Papéis e permissões

Preset **Executor** (para destinatário em modo ao vivo), construído com permissões atômicas:

- Pode: ver a página, **marcar/desmarcar itens**, registrar **valores realizados** (carga, repetições, observações), comentar, usar o modo treino e os timers.
- Não pode: criar/editar/excluir itens, reordenar, alterar descanso, ver outros alunos.
- O autor tem o preset **Gerente da página**.
- Permissões novas: `item.check`, `item.log`, `page.share`, `page.view_progress`.
- Isolamento testado: aluno A **nunca** vê progresso do aluno B.

### 3.4 Painel do autor ("Alunos")

- Lista de destinatários com: última atividade, % da semana concluída, **aderência** (sessões feitas vs. previstas), comentários novos.
- Ao abrir um aluno: histórico por data, valores registrados (ex.: cargas por exercício, com gráfico simples de evolução) e observações ("senti dor no ombro").
- Ações: ajustar a página (modo ao vivo), duplicar para outro aluno, arquivar aluno, **lembrete** ("não vejo treino há 5 dias").
- Mensagens de contexto na própria página (comentário por item), sem chat geral.

### 3.5 Modelo de dados

- `page_shares(id, page_id, owner_id, recipient_id, mode 'live'|'copy', role, status 'pending'|'active'|'revoked', created_at)`
- `task_progress(task_id, user_id, done_reps, logged_values jsonb, updated_at)` e `task_completions` por **(tarefa, usuário, ciclo)**.
- Em modo ao vivo, a tarefa (definição) é única; o **progresso é por destinatário**.

---

## 4. Repetições, descanso e temporizadores

### 4.1 Tarefas com repetição (conclusão só após N repetições)

Plano de repetição (`repeat_plan` JSON) configurável na criação avançada (e por atalho rápido, ex.: `3x12` ou `x5`):

- `total` (nº de repetições/séries, ex.: 4)
- `rest_seconds` (descanso entre repetições/séries)
- `rest_after_seconds` (descanso ao terminar este item antes do próximo)
- `mode`: `sets` (séries com descanso) · `count` (contador manual: 8 copos d'água) · `interval` (repetir a cada X tempo) · `timed` (cada repetição tem duração, ex.: 30 s por lado)
- Dados opcionais por série: reps, carga, duração, esforço percebido (RPE).

Comportamento:

- Cada toque em "série feita" incrementa `done_reps`. A tarefa só vira **concluída** ao atingir `total`.
- Em `sets`, ao registrar uma série **inicia automaticamente o descanso**.
- Desfazer uma série volta o contador (e cancela o descanso em curso).
- XP só é concedido na conclusão final (e proporcional por série, se configurado), sempre pelo servidor.

### 4.2 Descanso e temporizador

- Contagem regressiva grande e legível; botões **+30 s**, **−30 s**, **Pular**.
- Ao zerar: **vibração, som e notificação** ("Hora da próxima série: Supino reto, 3/4").
- **Confiabilidade em segundo plano (crítico):**
  - Guardar `ends_at` **absoluto** (timestamp) no timer; **nunca** depender apenas de `setInterval`. Ao voltar ao app, recalcular a partir do horário.
  - **App nativo (Capacitor):** agendar **Local Notifications** para o `ends_at` e usar **Haptics** para vibrar.
  - **Web/PWA:** `Notification` + Service Worker quando permitido, **Wake Lock** para manter a tela acesa durante o treino, som via Web Audio. Vibração via `navigator.vibrate` só onde suportada (não há no iOS Safari) — informar discretamente.
  - Pedir permissão de notificação **no momento certo** (ao iniciar o primeiro timer), explicando para quê.
- **Timer ativo é sincronizado** (tabela `timers`): iniciar no celular e ver no desktop; só **um timer ativo por usuário**.

### 4.3 Modo Treino (execução guiada)

- Botão "Iniciar treino" em páginas de cards: tela cheia, minimalista.
- Mostra: exercício atual, série `2/4`, carga/reps previstas, botão grande **"Feita"**, descanso automático, depois **avança para o próximo exercício**; barra de progresso do treino; tempo total.
- Controles: voltar, pular exercício, adicionar série, ajustar carga rapidamente, pausar.
- Ao final: resumo (tempo, volume, séries, XP) e confirmação. Funciona offline.
- Reutilizável para **qualquer sequência guiada** (alongamento, fisioterapia, rotina de estudo, receita passo a passo).

### 4.4 Brainstorm — usos de repetição/intervalo/temporizador

| Área | Ideia |
|---|---|
| Treino | Séries × reps com descanso; HIIT/Tabata (trabalho/descanso alternados); aquecimento e alongamento com tempo por lado; progressão de carga entre semanas |
| Saúde e rotina | Beber água (contador 8x com lembrete a cada 2 h); pausas para alongar a cada hora; exercícios de fisioterapia com séries e descanso (conforme orientação do profissional) |
| Estudo | Revisão espaçada (repetir em 1, 3, 7, 14 dias); blocos de foco; lição com N exercícios; leitura por páginas/capítulos |
| Casa | Rodízio de limpeza; regar plantas a cada X dias; cuidados com pet; troca de filtros e manutenção periódica |
| Cozinha | Receita guiada com cronômetro em cada passo (assar 40 min, descansar a massa 20 min); *meal prep* por etapas |
| Música/hobby | Praticar escala 5x com metrônomo de intervalo; sessões curtas diárias |
| Trabalho | Revisões periódicas, check-in diário, ciclos de entrega, "esperar 30 min antes de cobrar retorno" |
| Família | Tarefas das crianças com contador de repetições (guardar 5 brinquedos) e recompensa personalizada |
| Churrasco/eventos | Carne precisa descansar X min depois de sair do fogo (`lag` de dependência + timer) |

---

## 5. Pomodoro e tempo

### 5.1 Pomodoro

- Configurável: foco (padrão 25 min), pausa curta (5), pausa longa (15) após 4 ciclos; auto-iniciar próximo ciclo (opcional).
- Pode ser **associado a uma tarefa** ou rodar solto. Mini-barra flutuante discreta com o tempo restante (desktop) / notificação persistente (celular).
- **Ao terminar o foco:** notificação com **sugestão de pausa** escolhida de uma **lista personalizável** (padrões: *buscar um café ou chá · tomar um ar · beber água · alongar · olhar pela janela*). Usuário pode adicionar/remover/ordenar as suas; sorteio ou ordem sequencial.
- Contar pomodoros por tarefa (estimados vs. feitos) e por dia; estatísticas simples.
- Pausar/retomar/cancelar; ao concluir a tarefa, oferecer encerrar o ciclo.
- Mesma regra de confiabilidade em segundo plano da seção 4.2 (timestamps absolutos, notificações locais, sincronização do timer ativo).
- Atalho: `P` inicia pomodoro na tarefa selecionada; `Esc` na mini-barra pausa.
- Gamificação: bônus pequeno de XP por pomodoro concluído, **com limite diário** (anti-farm) e validação no servidor.

### 5.2 Registro de tempo

- Iniciar/parar cronômetro por tarefa (`Shift+T`), `actual_minutes` acumulado; comparar com `estimate_minutes`.
- Lançamento manual de tempo. Soma no pai (rollup WBS).
- Relatório simples por tarefa, página e projeto.

---

## 6. Brainstorm de funcionalidades extras (priorizado)

**Legenda:** **A** = entra na V3 · **B** = próxima versão · **C** = backlog

| Pri. | Funcionalidade | Descrição |
|:-:|---|---|
| A | **Meu dia** | Escolher, entre tudo que está pronto, o que fazer hoje; reordenar; mostra tempo estimado total vs. disponível |
| A | **Próxima ação** | Sugere o que fazer agora, respeitando dependências, prioridade, prazo e estado `pronta` |
| A | **Adiar (snooze)** | Adiar para depois/amanhã/próxima semana com 1 gesto |
| A | **Reivindicar tarefa** | Em projeto: botão "**eu levo**" em tarefa sem responsável (ótimo para churrasco/eventos) |
| A | **Estimativa e peso** | Tempo estimado e peso por tarefa (alimentam WBS, caminho crítico e dano ao boss) |
| A | **Campos personalizados por página** | Texto, número, seleção, data, pessoa, moeda (versão enxuta, estilo Notion-lite) |
| B | **Custos e orçamento** | Valor estimado vs. real por tarefa, somado por página/projeto (reforma, evento); **racha de contas** entre membros (churrasco) |
| B | **Lista de compras gerada** | De uma página de cardápio, gerar a lista de compras consolidada |
| B | **Kits por domínio** | Pacotes prontos: Treino, Cardápio semanal, Reforma (etapas dependentes + orçamento), Viagem, Estudos, Evento |
| B | **Registro de medidas** | Peso, cargas, medidas corporais, com gráfico de evolução (ligado a hábitos/treinos) |
| B | **Revisão semanal guiada** | Assistente: o que concluí, o que ficou, o que mover, o que arquivar |
| B | **Matriz de Eisenhower e Kanban** | Visões alternativas da mesma página |
| B | **Aprovações e handoff** | Passar tarefa para outra pessoa com nota; pedir revisão |
| B | **Reações e comentários curtos** | Reagir a tarefas concluídas (motivação em time) |
| B | **Recompensas personalizadas** | O usuário define um prêmio real ao bater uma meta ("pizza se fechar a reforma") |
| B | **Captura por voz e Share Target** | Falar uma lista e virar tarefas; compartilhar texto de outros apps direto para a Caixa de entrada |
| B | **Feed de calendário (.ics)** e exportação | Prazos no Google/Apple Calendar; exportar CSV/Markdown/PDF; imprimir listas |
| C | **Lembretes por local** | Notificar ao chegar/sair de um lugar |
| C | **Captura por foto (OCR)** | Foto de uma lista de papel vira tarefas |
| C | **Dependências entre projetos** | Com regras de permissão cruzada |
| C | **Gantt editável** | Barras de tempo arrastáveis sobre o fluxo |
| C | **Edição colaborativa de notas (CRDT)** | Texto em tempo real sem conflito |
| C | **Importar de Habitica/Todoist/CSV** | Migração facilitada |
| C | **Webhooks/API pública** | Integração com outras ferramentas |

> Itens "A" devem ser quebrados em tarefas pequenas pelo Claude Code e registrados em `docs/STATUS.md`. Itens "B" e "C" ficam documentados em `docs/BACKLOG.md`.

---

## 7. Modelo de dados — acréscimos

```sql
-- Árvore / WBS
tasks ADD COLUMN depth smallint NOT NULL DEFAULT 1,
              estimate_minutes int, actual_minutes int, weight numeric,
              cost_estimated numeric, cost_actual numeric,
              started_at timestamptz, deps_mode text DEFAULT 'all',  -- 'all' | 'any'
              repeat_plan jsonb, rest_seconds int, rest_after_seconds int;
pages ADD COLUMN max_depth smallint DEFAULT 4;   -- 2..6
containers(project) ADD COLUMN max_depth smallint DEFAULT 4, dependency_mode text DEFAULT 'strict';

-- Fluxo
task_dependencies(id, task_id, depends_on_task_id, kind text DEFAULT 'finish_to_start',
                  lag_minutes int DEFAULT 0, created_by, created_at, UNIQUE(task_id, depends_on_task_id))
page_dependencies(id, page_id, depends_on_page_id, threshold_pct smallint DEFAULT 100, UNIQUE(page_id, depends_on_page_id))
relations(id, from_type, from_id, to_type, to_id, kind text DEFAULT 'related')
task_events(id, task_id, user_id, kind, at, payload jsonb)           -- append-only
automation_rules(id, scope_type, scope_id, trigger jsonb, action jsonb, enabled bool, created_by)

-- Execução / tempo
task_progress(task_id, user_id, done_reps int, logged_values jsonb, updated_at, PRIMARY KEY(task_id, user_id))
timers(id, user_id, task_id null, kind text,  -- 'pomodoro'|'rest'|'stopwatch'|'countdown'
       started_at, ends_at, state, device_id, config jsonb)
time_entries(id, task_id, user_id, started_at, ended_at, minutes, source)
pomodoro_settings(user_id, focus_min, short_break_min, long_break_min, cycles, break_ideas jsonb)

-- Envio de página
page_shares(id, page_id, owner_id, recipient_id, mode, role, status, created_at)
```

Regras:
- Todas as tabelas seguem as regras de sync da V2 (IDs de cliente, `updated_at`, `deleted_at`, `version`, fractional index).
- Constraints no banco: sem auto-dependência; CHECK de profundidade validada em função/trigger **além** da validação na aplicação.
- Detecção de ciclo (dependências e árvore) em função de servidor, chamada em toda mutation relevante.
- `bloqueada/pronta` **não** são colunas autoritativas: calcular a partir de `task_dependencies` + estados; opcionalmente manter coluna de cache no servidor para consultas e notificações.

---

## 8. Permissões — acréscimos

Novas permissões atômicas (entram na função única `can()` e na matriz da V2):

`task.start`, `task.force_unblock`, `dependency.manage`, `workflow.view_audit`, `automation.manage`, `item.check`, `item.log`, `page.share`, `page.view_progress`, `timer.use`, `settings.max_depth`.

Presets:
- **Gerente:** todas.
- **Editor:** tudo exceto `automation.manage`, `settings.max_depth`.
- **Colaborador:** `task.start`, `item.check`, `item.log`, `timer.use` nas tarefas atribuídas a si; cria tarefas conforme regras da V2.
- **Leitor:** apenas leitura.
- **Executor (página enviada):** `item.check`, `item.log`, `timer.use`, comentar, ver a própria página.

---

## 9. Telas e interações novas

- **Painel da tarefa (avançado):** seções recolhíveis: Detalhes · **Depende de / Libera** · **Subtarefas** (com código WBS) · **Repetição e descanso** · **Tempo** (estimativa, cronômetro, pomodoros) · Histórico.
- **Projeto:** abas **Lista · Fluxo · Pessoas · Linha do tempo**; faixa de resumo com progresso, próximos desbloqueios e bloqueios críticos.
- **Página (cards/treino):** botão **Iniciar treino**, indicador de descanso, mini-timer persistente.
- **Mini-barra de timers** (pomodoro/descanso/cronômetro) fixa e discreta; só uma ativa.
- **Enviar para…** (modal leve/folha inferior): link, e-mail, modo (ao vivo/cópia), papel.
- **Alunos (painel do autor).**
- **Configurações:** limite de profundidade, modo estrito/flexível, pausas do pomodoro, sons/vibração, permissões de notificação.
- **Atalhos novos** (registrar no registro central e na Ajuda):

| Atalho | Ação |
|---|---|
| `Tab` / `Shift+Tab` | Indentar / desindentar subtarefa |
| `S` | Iniciar tarefa |
| `P` | Iniciar pomodoro na tarefa |
| `Shift+T` | Iniciar/parar cronômetro |
| `L` | Ligar a outra tarefa (dependência) |
| `G` depois `F` | Ir para a visão Fluxo |
| `W` | Mostrar/ocultar códigos WBS |
| `Space` (no modo treino) | Marcar série feita |
| `R` (no modo treino) | Pular descanso |

- **Ajuda/Wiki (3 idiomas):** novos artigos em linguagem simples: "Tarefas dependentes (o exemplo do churrasco)", "Subtarefas e níveis", "Enviar um treino para um aluno", "Descanso e repetições", "Pomodoro", "Entendendo o fluxo do projeto".
- **i18n:** estados (`bloqueada`, `pronta`…), mensagens de limite/ciclo, sugestões de pausa, notificações de desbloqueio e de timer, e parser de sintaxe (`^`, `3x12`) em pt/en/es.

---

## 10. Plano de entrega (V3)

**Fase 0 — Correção visual (obrigatória primeiro)**
- Mockups em `docs/mockups/` aprovados, tokens e componentes validados em `/design`, telas-chave refeitas com ciclo de captura/comparação (seção 0).
- *Aceite:* o usuário aprova visualmente Hoje, Página (lista e cards), Sidebar e Painel da tarefa.

**Fase G — Subtarefas e WBS**
- Árvore com limite configurável, rollup de progresso/estimativa, códigos WBS, teclado (`Tab`), visão Estrutura, lote com indentação limitada.
- *Aceite:* tentar criar o 5º nível (limite 4) é bloqueado com mensagem clara, no cliente e no servidor.

**Fase H — Dependências e estados**
- `task_dependencies`, estados derivados (offline), modo estrito/flexível, notificações de desbloqueio, sintaxe `^`, campo "Depende de/Libera", detecção de ciclo.
- *Aceite:* cenário "carvão → fogo": Willian vê a tarefa bloqueada; Greg conclui; Willian é notificado e a tarefa fica pronta, **também funcionando após sincronização offline**.

**Fase I — Fluxo, pessoas e auditoria**
- Visão Fluxo (grafo com raias), visão Pessoas, linha do tempo, `task_events`, indicadores, dependência entre páginas, vínculos "Relacionados".
- *Aceite:* num projeto com 20 tarefas e 4 pessoas, o usuário identifica em 10 segundos quem está fazendo o quê, o que está travado e por quê.

**Fase J — Repetições, descanso e Modo Treino**
- `repeat_plan`, timers com timestamps absolutos, notificações locais, vibração, Wake Lock, Modo Treino, sincronização do timer ativo.
- *Aceite:* iniciar descanso, bloquear a tela/trocar de app e **ser avisado no horário correto** (nativo e PWA com as limitações documentadas).

**Fase K — Pomodoro e tempo**
- Pomodoro com lista de pausas personalizável, registro de tempo, rollup, estatísticas simples.

**Fase L — Página enviada (Treinador → Aluno)**
- `page_shares`, preset Executor, progresso por usuário, envio para vários, painel "Alunos", modo offline do aluno.
- *Aceite:* treinador cria "Treino A" em lote, envia para 2 alunos; cada aluno marca no celular sem ver o outro; o treinador vê aderência e valores registrados.

**Fase M — Extras "A" e automações**
- Meu dia, Próxima ação, adiar, reivindicar tarefa, estimativa/peso, campos personalizados, regras "quando… então…", etapa de aprovação.

---

## 11. Testes obrigatórios (acréscimos)

- Detecção de ciclo (dependências e árvore) incluindo ciclos indiretos e via pai/filho.
- Limite de profundidade: criar, mover, lote, e redução do limite com dados existentes.
- Cálculo de estados derivados (`all`/`any`, `lag`, reabertura de pré-requisito, herança do pai) — **idêntico no cliente e no servidor**.
- Sincronização: dependência criada offline em dois dispositivos formando ciclo → servidor rejeita uma e o cliente desfaz com aviso.
- Timers: encerram corretamente após app em segundo plano/reinício; apenas um timer ativo por usuário.
- Progresso por usuário em página enviada: isolamento entre alunos; Executor não consegue editar estrutura (testar via API, não só UI).
- XP: não duplica ao reabrir/concluir repetidamente; só folhas geram XP; limites diários de pomodoro.
- E2E do cenário churrasco com dependência e do cenário treino enviado ao aluno.
- Acessibilidade do modo treino e do grafo (navegação por teclado; alternativa em lista ao grafo).

---

## 12. Fora de escopo (V3)

- Motor BPMN completo, simulação de processos, Gantt editável.
- Dependências entre projetos diferentes.
- Chat geral e chamadas de vídeo.
- Qualquer recomendação médica/nutricional automática: as páginas de treino e cardápio são **ferramentas de organização**, o conteúdo é do autor (profissional ou usuário).

---

## 13. Decisões em aberto (perguntar ao usuário quando chegar a hora)

1. Limite padrão de profundidade: 4 está bom? (Configurável de 2 a 6.)
2. Modo padrão de dependências: **estrito** (bloqueia de fato) ou **flexível** (avisa, mas deixa forçar)?
3. Biblioteca do grafo (React Flow + dagre/ELK) ou outra, conforme a stack real do repositório.
4. Em "Enviar página": modo padrão **ao vivo** ou **cópia**?
5. Nome final das visões (Fluxo, Pessoas, Linha do tempo) e dos itens dentro do Projeto.
6. Quais itens "B" do brainstorm sobem de prioridade.
