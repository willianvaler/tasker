# ESCOPO V16 — Editor de anotações avançado e Processos (BPM leve)

> Instruções para o Claude Code. Leia `CLAUDE.md`, `AGENTS.md`, os escopos V11, V12, V13 e V14 e o `docs/DECISIONS.md` antes de começar. Em conflito, **este escopo vence** os anteriores, **exceto** no motor de automação do V14, que este escopo **reaproveita** e não substitui.

> **Pedido do dono (24/11/2026):** "um editor de texto/anotações ainda mais robusto que o do Notion, conectando páginas e anotações e permitindo automações através dos fluxos, quase como um BPM customizável que pode rodar pequenas rotinas e funções."

**Convenção (padrão):** decisão tomada sem o dono. Todas voltam na tabela do §12.

O documento tem duas partes:

- **Parte A — Editor e conhecimento** (ED, CL): editor, ligações entre páginas, propriedades tipadas e desempenho.
- **Parte B — Processos** (PR, FN): fluxos executáveis com tarefas humanas, esperas, decisões e funções reutilizáveis.

As duas partes se encontram em **PR7** (anotações e páginas disparam e recebem processos).

---

## 0. O que já existe (a confirmar em ED0) e o que falta

| Tema | Situação | Consequência |
|---|---|---|
| Anotações em **Markdown canônico**, links `[[ ]]`, `#tags`, backlinks, tabela `links` | V11 (OB1, OB4) | Base do editor. **Não trocar o formato** |
| Editor em blocos e comando `/` | **V12 §0 diz que existem; V11 §0 fala de Markdown com barra de formatação.** Os dois escopos divergem | **ED0 faz o inventário** antes de qualquer decisão |
| Bancos e visões (tabela, quadro, calendário), propriedades, fórmulas | V12 (fórmulas, `lib/formula/`), V11 (consultas, `lib/query/`) | ED3 **estende**, não refaz |
| Aba **Fluxo** = grafo de **dependências de tarefas** (React Flow + dagre, só leitura no celular) | Existe | **Não muda.** Processos entra em aba **separada** (V16-1) |
| Motor de automação (regras, gatilhos, ações, esperas, webhooks) | V14 | PR2 e PR7 **reaproveitam** o registro de tipos (V14 §6.3) |
| Linguagem fechada de expressões | `lib/query/` (V11) e `lib/formula/` (V12 §8) | PR3 reutiliza o *parser* de `lib/formula/` em módulo puro compartilhado |
| Campos calculados (D318) | Excluídos de consulta e automação | **Vale também aqui:** rollups e fórmulas **não** são gatilho nem condição de processo |
| Código do usuário e de terceiros | V11 §9: **fora** | **Continua fora.** "Funções" aqui são **processos declarativos reutilizáveis** (FN) |
| Colaboração em tempo real (vários cursores) | Não vi em nenhum escopo | CL1 opcional, **com portão** |
| IA no texto | V12-8: fora | Continua fora. Opcional só pelo V15 AI1 |

### 0.1 O que "mais robusto que o Notion" significa aqui

"Mais robusto" não é medível. Fica **convertido em quatro eixos com critério de aceite**, e o dono pode trocar qualquer um (V16-2):

1. **Offline de verdade:** abrir, editar, buscar e **executar processos com tarefas humanas** sem rede, e sincronizar depois sem perder edição.
2. **Formato aberto e sem perda:** a anotação **é Markdown**, e a exportação **reimporta idêntica** (round-trip).
3. **Processos executáveis com prazo e responsável:** o que o Notion faz só com automações simples e integrações externas.
4. **Desempenho medido** com volume real (ED5), em vez de promessa.

Fica **fora de comparação** (o Notion é melhor ou não vale o custo): colaboração em tempo real com muitos cursores (CL1, opcional), ecossistema de integrações prontas, IA embutida.

---

## 1. Princípios

1. **Banco é a fonte da verdade** (CLAUDE.md). O **Markdown da anotação** é a representação canônica. Estruturas derivadas (`links`, `blocks_index`, `cards`) são **refeitas por trigger** e podem ser reconstruídas do texto.
2. **Sem código do usuário.** Nada de JavaScript, SQL, WASM ou *plugin* rodando. Lógica é **dado declarativo** executado por motor próprio (V11 §9).
3. **Execução no servidor, determinística e repetível.** O motor de Processos usa as mesmas garantias do V14: idempotência, `FOR UPDATE SKIP LOCKED`, limites e auditoria.
4. **O processo executa como a pessoa dona da definição**, e cada tarefa humana respeita `can()` de **quem a executa**. **Revogar** acesso durante a execução **interrompe** o passo (V16-8).
5. **Processo nunca concede XP, ouro, dano ou item** (V14 §1). Tarefa humana **não rende XP por padrão**; a pessoa pode ligar por definição, e aí vale a regra normal do servidor (V8).
6. **Nada de escrita em massa sem limite.** Toda ação tem teto (linhas, tamanho, passos).
7. **Dados sensíveis do V15 (§1.3)** (`saude.*`, `local.*`, `camera.*`, `dispositivo.*`) **não** podem ser lidos por processo nem por bloco de botão sem liberação campo a campo.
8. **A versão de uma instância não muda:** uma instância em andamento **fica presa à versão** da definição com a qual nasceu (PR1).

---

# PARTE A — EDITOR E CONHECIMENTO

## ED0 — Inventário e spike do editor (pré-requisito de ED1 a ED7)

Documento `docs/SPIKE_EDITOR.md`, aprovado pelo dono antes do resto da Parte A:

1. **Inventário do que existe hoje:** qual é o editor (blocos ou texto Markdown com barra), quais blocos, atalhos, `/`, tabelas, imagens, código, listas de tarefa, e **onde V11 §0 e V12 §0 divergem**. Resolve a divergência por escrito.
2. **Biblioteca atual:** nome, versão, licença e como serializa de e para Markdown.
3. **Teste de ida e volta:** 200 anotações reais do dono (ou geradas) passam por Markdown → editor → Markdown. Registrar **quais construções perdem informação**.
4. **Medição de desempenho** do editor atual nos orçamentos do ED5, **nos aparelhos de referência escolhidos pelo dono** (V16-3). O registro diz **onde já passa e onde reprova**.
5. **Decisão com portão:** manter e estender a biblioteca atual **ou** trocá-la. O padrão é **manter** (V16-4). A troca só com número de ED0 mostrando que a atual não atinge ED5, e **com** o custo da migração descrito (a anotação continua Markdown, então o dado não migra).
6. **Lista de limitações da web e do celular** (teclado, seleção, arrastar, IME).

## ED1 — Markdown canônico com extensões

- **Sintaxe de extensão** definida em `docs/FORMATO_NOTAS.md`, sempre degradando a texto legível em qualquer leitor de Markdown:
  - **ID de bloco:** `^abc123` no fim do bloco (como no Obsidian). Gerado só quando o bloco é **referenciado** (não polui anotação nenhuma que ninguém referencia).
  - **Referência a bloco:** `[[Página#^abc123]]` (link) e `![[Página#^abc123]]` (transclusão, ED2).
  - **Propriedades da página** em cabeçalho de dados no topo (`---` YAML restrito a tipos simples), alinhadas com o que o V12 já guarda.
  - **Bloco de botão** (ED4) em cerca de código com linguagem `questlist-button`, conteúdo em JSON validado.
- **Construção desconhecida é preservada** (ida e volta sem perda): o editor mostra como bloco de texto "não suportado" e **reescreve idêntico**.
- **Teste de propriedade (obrigatório):** para qualquer Markdown gerado (fuzz), `parse → serialize → parse` é **estável** e `serialize(parse(x)) == normalizar(x)`. Falha reprova a tarefa.
- Normalização única (final de linha, espaços, lista) documentada. **A primeira abertura de uma anotação antiga não a modifica** a menos que a pessoa edite (evita *diffs* fantasmas e conflito de sync).

## ED2 — Referências de bloco e transclusão

- Referenciar um bloco gera `^id` (ED1) e uma linha em `links` com `target_block`.
- **Transclusão `![[Página#^id]]`:** mostra o bloco de origem **somente leitura** dentro da outra página, com link "ir para a origem". Editar acontece **na origem**.
- Profundidade máxima **3**, com detecção de ciclo (mostra aviso, não trava).
- Origem apagada ou sem permissão: mostra "bloco indisponível", **sem vazar o texto**.
- **Backlinks por bloco:** a origem mostra onde é referenciada (já respeitando RLS).
- Fora: edição na transclusão (V16-5). Se o dono quiser, é tarefa futura.

## ED3 — Propriedades tipadas, relações e rollups

Estende o que o V12 já tem, **sem criar um segundo sistema**.

- **Tipos de propriedade:** texto, número, data, seleção, multisseleção, caixa, pessoa, URL e **relação** (para outra página ou banco), conforme o que o V12 já cobre. A relação é **tipada** (aponta para um banco específico) e **bidirecional opcional** (cria a propriedade inversa).
- **Rollup:** campo **calculado** sobre as páginas relacionadas (contagem, soma, média, mínimo, máximo, "% concluído", lista). Usa o motor de fórmulas do V12.
- **Regra D318 mantida:** rollups e fórmulas **não entram** em filtro de automação, gatilho nem condição de processo. A tela diz isso quando a pessoa tenta.
- **Visões:** tabela, quadro e calendário já existem no V12. Aqui só se acrescenta **agrupar por relação** e **mostrar rollup** nas visões existentes.
- Limites: 50 propriedades por banco, 500 relações por página, rollup sobre até 5.000 páginas relacionadas (acima disso mostra "muitas relações" e não calcula).

## ED4 — Botões e modelos

- **Bloco de botão** (ED1) que executa uma **ação do V14** (criar tarefa, anexar a anotação, atualizar propriedade, **iniciar processo**). Só ações do registro (V14 §6.3). Mostra confirmação quando a ação mexe em dispositivo ou webhook.
- **Modelos de página** com variáveis `{{data}}`, `{{pessoa}}`, `{{cursor}}` e **seletor de modelo** ao criar. Os modelos já existentes do V11/V12 continuam valendo; esta tarefa só acrescenta variáveis e botões, se faltarem.
- **Modelo recorrente:** "criar a página de reunião toda segunda às 9 h" é uma **regra do V14**, não função nova do editor.

## ED5 — Orçamentos de desempenho (valem como critério de aceite)

Medidos no aparelho de referência do dono (V16-3). Valores abaixo são o **padrão** (V16-3) e o dono pode ajustar.

| Cenário | Orçamento |
|---|---|
| Abrir anotação com **5.000 blocos** (web e celular de referência) | ≤ **800 ms** até editável |
| Digitar em anotação de **20.000 palavras** | latência p95 ≤ **50 ms** por tecla |
| **Buscar** em **100.000 anotações** (texto completo) | ≤ **300 ms** até o primeiro resultado |
| Abrir lista de um banco com **10.000 páginas** | ≤ **500 ms** até a primeira tela, com paginação virtual |
| Colar **1 MB** de Markdown | ≤ **2 s** sem travar a interface |
| Sincronizar uma edição entre dois aparelhos online | ≤ **3 s** |

- **Teste de carga reprodutível** em `scripts/bench-editor.*`, com gerador de dados determinístico. O resultado entra em `docs/DESEMPENHO_EDITOR.md`.
- Onde a busca em 100 mil anotações não atinge o orçamento com o índice atual, descrever o que falta (índice trigrama ou *full-text* do Postgres) **antes** de implementar, e conferir compatibilidade com o que o projeto já usa.
- Reprovação em um orçamento **bloqueia** a tarefa que o afetou.

## ED6 — Edição offline e conflito

- Edição offline vai pela fila do PowerSync. **Conflito em texto:** hoje vence a última escrita? Registrar em ED0.
- **Objetivo mínimo:** nenhuma edição some em silêncio. Se duas pessoas editarem a mesma anotação offline, a perdedora vira **versão em conflito** salva e sinalizada para mesclar (o histórico de versões do V11 já existe? confirmar em ED0).
- Mesclagem de três vias **por bloco** (não por caractere) é aceitável nesta fase.
- Edição simultânea com cursores é CL1.

## ED7 — Exportação sem perda e importação

- **Exportar** uma página ou um espaço inteiro como pasta de arquivos `.md` + anexos, com a mesma sintaxe do ED1 (**round-trip**: reimportar reproduz o conteúdo e as ligações).
- **Importar** o ZIP exportado pelo próprio Questlist **sem perdas** (teste obrigatório).
- Importação de Notion e Obsidian: **já coberta por escopos anteriores?** Confirmar em ED0. Se existir, só **adaptar** ao ED1. Se não existir, **não faz parte** desta tarefa (V16-6).
- Imports longos rodam com o sinalizador de carga em lote do V14 (`questlist.bulk`), sem disparar milhares de eventos.

## CL1 — Colaboração em tempo real (opcional, com portão)

- **Fora até o dono pedir** (V16-7). Se pedir:
  - **CL1-A, spike:** CRDT de texto estilo Yjs sobre a infraestrutura atual, com o **banco como verdade** (o CRDT guarda estado de sessão e **grava Markdown** no banco ao pausar). Descreve custo, latência, tamanho de estado, licença e como convive com o PowerSync.
  - **CL1-B:** cursores e presença em anotações compartilhadas, só entre membros de um projeto.
- Sem decisão do dono, **não faz nada** e a edição em conjunto continua pela versão em conflito (ED6).

---

# PARTE B — PROCESSOS (BPM LEVE)

> Aba **Processos**, separada da aba **Fluxo** (V16-1). Fluxo continua sendo o grafo das **dependências de tarefas** e **não** executa nada.

## B.0 Modelo mental

Um **processo** é um diagrama de passos que **dura** (horas, dias, semanas), tem **estado**, **responsável** e **prazo**, e **espera** pessoas ou o tempo. É diferente de uma **regra de automação** do V14, que é "quando X, faça Y" e termina em segundos.

| | Regra (V14) | Processo (V16) |
|---|---|---|
| Duração | segundos | horas a meses |
| Estado | só variáveis da execução | **instância** com variáveis, passo atual e histórico |
| Pessoas | só notifica | **tarefa humana** com responsável, prazo e escalonamento |
| Estrutura | gatilho → ações com SE/SENÃO | **diagrama** com portões, paralelismo, temporizador, subprocesso |
| Versionamento | simples | **definição versionada**, instância presa à versão |

**Regra de ouro:** tudo o que um passo **automático** faz é uma **ação do registro do V14**. O Processos **não** cria um segundo catálogo de ações.

## PR1 — Modelo de dados

- **Definições:** `process_definitions` (nome, dono, ativa) e `process_versions` (definição, número, **grafo em JSON validado**, publicada em, autor). **Versão publicada é imutável.** Editar cria rascunho; publicar cria a próxima versão.
- **Instâncias:** `process_instances` (versão, estado `em_andamento|concluida|cancelada|falhou|suspensa`, iniciada por, origem, variáveis em JSON de até 32 KB, início, fim).
- **Passos:** `process_steps` (instância, nó, estado, tentativas, início, fim, responsável, prazo, resultado), **append-only** no histórico, com um registro por passada (laços geram várias).
- **Tokens de execução:** `process_tokens` (instância, nó atual, escopo), para suportar **paralelismo** (PR2).
- **Mensagens e sinais pendentes:** `process_waits` (instância, tipo `mensagem|temporizador|humana`, chave de correlação, vencimento).
- RLS: definição e versões são da dona (e membros do projeto, se vinculadas a um). Instância visível à dona da definição e aos **responsáveis de tarefas humanas** (só os dados do passo deles).
- Cliente **não escreve** em `process_steps`, `process_tokens` e `process_waits` (só o servidor). Sincronização no PowerSync só para o que a UI mostra.
- Tudo entra na **exportação** e na **exclusão de conta** (V4).

## PR2 — Vocabulário de nós (BPMN simplificado)

Usa nomes e símbolos conhecidos do BPMN, **sem** implementar o padrão inteiro.

| Nó | Função | Observação |
|---|---|---|
| **Início** | manual, por regra (V14), por evento de página (PR7), por webhook (V14 §7.2), por horário | um por definição, no mínimo |
| **Fim** | encerra o caminho (ou o processo, conforme o tipo) | "fim com erro" marca a instância como `falhou` |
| **Tarefa de serviço** | executa **uma ação** do registro do V14 | tem política de falha: tentar de novo (1/5/30 min), seguir pelo caminho de erro, ou falhar |
| **Tarefa humana** | cria uma **tarefa do Questlist** para um responsável e **espera a conclusão** | prazo, escalonamento, formulário (PR6) |
| **Portão exclusivo (XOR)** | segue **um** caminho, pelo primeiro cuja condição for verdadeira, com caminho **padrão** obrigatório | |
| **Portão paralelo (AND)** | divide em caminhos simultâneos e **junta** quando todos chegam | |
| **Temporizador** | espera um tempo (`PT2H`, formato ISO) ou até uma data | grava `process_waits` |
| **Evento de mensagem** | espera um **sinal** (webhook de entrada, ação "enviar sinal", conclusão de tarefa) com chave de correlação | com *timeout* opcional |
| **Subprocesso / chamada de função** | chama **outra definição publicada** (FN) | |
| **Laço limitado** | repete até a condição ou até **N vezes** (máx. 50) | |
| **Multi-instância** | executa o mesmo subprocesso para **cada item de uma lista** (máx. 100), em paralelo ou em sequência | |
| **Caminho de erro** | liga uma tarefa de serviço ao tratamento da falha | |

- **Fora:** portão inclusivo (OR), portão baseado em evento, eventos de compensação, transações, *swimlanes* completas, ligações entre processos por mensagem arbitrária (V16-9).
- **Validação ao salvar e ao publicar** (PR5): início único, todo nó alcançável, todo caminho chega a um fim, XOR com padrão, AND balanceado (todo *split* paralelo tem *join*), sem laço sem saída, sem passar do limite de nós (**200** por definição).

## PR3 — Variáveis e expressões (linguagem fechada)

- Cada instância tem **variáveis** (`texto`, `numero`, `booleano`, `data`, `lista` e `objeto` com limite de profundidade 3) e leitura do **gatilho** (`inicio.*`) e da **página** vinculada (`pagina.*`, `pagina.prop.*`).
- **Módulo puro compartilhado `lib/expr/`**: reaproveita o *parser* e as funções de `lib/formula/` (V12 §8) para evitar uma terceira linguagem. Roda **no app** (validação e simulação) e **na Edge Function** (execução). **Mesmo código, mesmos resultados**, provado por teste de paridade.
- Expressões **sem efeito colateral**, sem laço livre, sem acesso à rede e com **custo máximo** (1.000 operações) por avaliação, e estouro falha o passo.
- **Mapeamento de dados** entre passos: cada nó declara `entradas` e `saidas` (nome → expressão). Variável não declarada é erro de validação.
- Funções permitidas: as de `lib/formula/` (texto, número, data, lógica, listas) e **nenhuma** que leia o banco livremente (V16-10). Leitura de dados só por **ação de leitura do registro** com limite (padrão: até 50 itens).
- **Interpolação** `{{variavel}}` nos campos de ações com os mesmos filtros do V14 (§2).

## PR4 — Motor de execução

- **Máquina de estados durável** no Postgres, no mesmo molde do V14: `FOR UPDATE SKIP LOCKED`, Edge Function `process-run` acionada por `pg_net` e por **varredor de 1 min** (para temporizadores e esperas vencidas).
- **Idempotência:** chave por (instância, token, nó, tentativa). Reentregar um evento **não** repete efeito. Cada tarefa de serviço usa a chave de idempotência do V14.
- **Atomicidade:** avançar o token e gravar o histórico acontece na **mesma transação**. Efeitos externos (webhook, dispositivo) usam o *outbox* do V14, nunca dentro da transação.
- **Limites (padrão):**

| Limite | Valor |
|---|---|
| Passos por instância | **2.000** (laços incluídos) |
| Duração máxima de uma instância | **365 dias** |
| Instâncias em andamento por pessoa | **500** |
| Início de instâncias por hora, por definição | **60** |
| Tempo ativo por execução da Edge Function | **30 s** |
| Variáveis por instância | **32 KB** |
| Profundidade de subprocessos | **5** (V16-11) |
| Instâncias suspensas por falha repetida | auto-suspende após **5** falhas consecutivas |

- **Recuperação:** instância presa (nenhum token ativo e sem espera) é detectada pelo varredor e marcada `falhou` com motivo.
- **Cancelar** uma instância cancela tarefas humanas abertas e esperas, e **não** desfaz efeitos já ocorridos (sem compensação, §10).
- **Pausa geral** do V14 ("Pausar todas") vale também para Processos.
- **Desempenho:** **10.000 instâncias paradas** (esperando tempo ou pessoa) **não** podem aumentar o custo do varredor além de uma consulta indexada por vencimento (teste de carga).

## PR5 — Editor visual (só web)

- Aba **Processos** com tela de edição baseada em **React Flow** em **modo edição** (a aba Fluxo continua só leitura no celular e inalterada). **Disposição automática** com dagre.
- Paleta de nós, arrastar, conectar, painel de propriedades por nó, **desfazer e refazer**, copiar e colar nós, zoom e mini-mapa.
- **Validação em tempo real** (PR2) com lista de erros clicável.
- **Simulação:** executa o diagrama **no navegador**, com variáveis de teste, passo a passo, sem efeitos reais (ações de serviço viram "simuladas"). Mostra o caminho percorrido e as variáveis em cada passo.
- **Celular:** **visualiza** definições e instâncias (grafo estático com destaque do passo atual) e **executa tarefas humanas**, mas **não edita** o diagrama (V16-12).
- Acessibilidade: operável por teclado (selecionar, conectar, mover) e com descrição textual alternativa da estrutura (lista de passos). Detalhar em ED0/PR5 o que o React Flow já oferece.
- Limites de interface: avisar acima de **100** nós.

## PR6 — Tarefas humanas

- Um nó de tarefa humana **cria uma tarefa normal do Questlist** (com `origem = 'processo'`, vínculo com a instância e o nó), atribuída a: pessoa fixa, **papel/grupo** (alguém do grupo "assume") ou **expressão** (variável da instância).
- **Formulário opcional** no nó: campos tipados (texto, número, data, seleção, caixa) que a pessoa preenche ao concluir. As respostas voltam como variáveis. Validação no servidor.
- **Resultado** na conclusão: `concluida` ou, se o nó definir, escolhas nomeadas ("Aprovar", "Rejeitar") que alimentam um XOR.
- **Prazo e escalonamento:** prazo relativo (`PT48H`) ou fixo. Ao vencer: **lembrete** (notificação) em N horas e **escalonar** (reatribuir, notificar outra pessoa ou seguir caminho alternativo). Tudo por temporizador de limite (PR2).
- **Delegar e devolver:** quem recebeu pode **delegar** para outra pessoa com permissão ou **devolver ao grupo**. O histórico guarda tudo.
- **XP:** a tarefa humana **não rende XP por padrão**. A definição pode ligar "conta como tarefa normal", e aí vale a regra do V8, **sem** duplicação com automação (V16-13).
- A tarefa aparece em **Hoje** e nos filtros como qualquer outra, com distintivo "Processo" e link para a instância.
- Se a pessoa **perder acesso** (removida do projeto), a tarefa volta ao **grupo** ou ao dono da definição, por escolha na definição.

## PR7 — Ligação com anotações e páginas

- **Gatilhos de início** (usam o registro do V14 §3): `pagina.criada`, `pagina.propriedade_mudou` (**só propriedades armazenadas**, não calculadas; D318), `pagina.tag_adicionada`, `pagina.movida` e `pagina.marcada_como` (botão ED4).
- **Ações sobre páginas** (entram no **registro do V14** e valem também para regras do V14): `pagina.criar_de_modelo`, `pagina.anexar_texto` (**só acrescenta** ao fim, com limite de 10 KB), `pagina.definir_propriedade`, `pagina.adicionar_tag`, `pagina.mover`.
- **Sem sobrescrita:** nenhuma ação **substitui** o texto de uma anotação. Escrever no meio de uma anotação que a pessoa edita causaria conflito (V16-14).
- A **instância** guarda o **ID da página** que a originou (`pagina.*`) e a página mostra um **cartão "Processos desta página"** (instâncias em andamento e concluídas).
- Página de modelo pode ter **botão "Iniciar processo X"** (ED4).
- **Anti-laço:** uma ação do processo que altera uma página **não** pode reiniciar o mesmo processo (usa a profundidade e o marcador de origem do V14 §6.4).

## PR8 — Modelos de processo internos

Entregar **4 modelos** que a pessoa copia e adapta (exemplos do que o motor consegue, e usados nos testes de ponta a ponta):

1. **Revisão semanal:** temporizador de sexta, tarefa humana "revisar a semana" com formulário, XOR (concluída ou adiada), anexa o resumo à anotação da semana.
2. **Aprovação:** tarefa humana com "Aprovar/Rejeitar", prazo de 48 h com escalonamento, XOR com os dois resultados.
3. **Integração de pessoa nova (onboarding):** paralelo (acessos, boas-vindas, apresentação), junta, notifica o responsável.
4. **Ciclo de estudo:** gatilho "página com propriedade `status = Estudando`", cria tarefas de revisão em 1, 3 e 7 dias (temporizadores), encerra ao marcar `Concluído`.

Os modelos são **dados internos** (JSON de definição), versionados no repositório. **Não há compartilhamento de processos entre pessoas** nesta fase (§10).

---

# FN — Funções reutilizáveis

- **"Função" = definição de processo marcada como chamável**, com **assinatura tipada** (entradas e saídas nomeadas, com tipo). É a forma de ter "pequenas rotinas e funções" **sem código**.
- **Chamada:** o nó **Subprocesso** passa entradas e recebe saídas. A função roda como **instância filha** presa à **versão publicada**.
- **Sem recursão** (direta ou indireta, detectada ao publicar) e **profundidade máxima 5**.
- **Funções "puras"** (só expressões, sem ações de serviço nem tarefas humanas) são executadas **em linha**, no mesmo passo, sem criar instância. Isso permite coisas como "calcular prazo" e "formatar texto" como biblioteca reutilizável, no mesmo `lib/expr/` (tarefa **FN0**: extrair o módulo puro, §11).
- **Biblioteca de funções** (tela dentro de Processos) com busca, descrição e exemplos de uso.
- **Compatibilidade de versão:** ao publicar nova versão de uma função, mostrar **quais definições a usam** e avisar se a **assinatura mudou** (quebra de contrato). Definições chamadoras ficam presas à versão que escolheram até que a pessoa atualize.
- **Teste de função:** a tela permite informar entradas e ver as saídas (usa a simulação do PR5).

---

## 9. Interface

- **Anotações:** a barra `/` e a barra de formatação existentes permanecem, e entram **referência de bloco**, **botão**, **propriedades** e **relação**, conforme o ED0 mostrar que faltam.
- **Aba Processos** (nova), com subtelas: **Definições**, **Instâncias**, **Funções** e **Modelos**.
- **Instância** mostra o diagrama com o passo atual, o **histórico** (linha do tempo), as **variáveis** e as ações **cancelar**, **suspender**, **retomar** e **repetir passo com falha** (só quem é dono da definição).
- **Hoje** mostra tarefas humanas pendentes com o distintivo de processo.
- **Textos** em pt, en e es (paridade em `parity.test.ts`). Termos: processo, instância, passo, portão, função (glossário na Ajuda).

---

## 10. Fora deste escopo

- **Código do usuário** (JavaScript, SQL, WASM, *plugins*) e **marketplace** de processos ou funções (V11 §9).
- **Importar ou exportar BPMN XML** e **DMN** (tabelas de decisão). DMN pode ser escopo futuro se o XOR ficar complexo (V16-15).
- **Compensação e transações distribuídas**, portão inclusivo e baseado em evento, *swimlanes* completas, mensagens livres entre processos.
- **Compartilhamento de processos** entre pessoas ou publicação na Comunidade (V16-16). O projeto (V10) pode ter definições compartilhadas **com os membros**, se o dono pedir depois.
- **Edição do diagrama no celular.**
- **IA** gerando diagramas ou texto (V12-8; V15 AI1 só para o assistente do dia).
- **Colaboração em tempo real** (CL1), salvo se o dono pedir.
- **Mudar o formato das anotações**: segue Markdown.
- **Gravação ou inspeção de qualquer dado sensível do V15** (§1.7).

---

## 11. Ordem sugerida e testes

| Id | Tarefa | Pri. | Depende de |
|---|---|---|---|
| ED0 | Inventário e spike do editor | 1 | — |
| ED1 | Markdown canônico com extensões | 1 | ED0 |
| ED5 | Orçamentos de desempenho e bancada de testes | 1 | ED0 |
| ED2 | Referências de bloco e transclusão | 2 | ED1 |
| ED6 | Edição offline e conflito | 1 | ED0 |
| ED7 | Exportação sem perda e importação | 2 | ED1 |
| ED3 | Propriedades tipadas, relações e rollups | 2 | ED0, V12 |
| FN0 | Módulo puro `lib/expr/` e testes de paridade | 1 | V12 §8 |
| PR1 | Modelo de dados | 1 | V14 AU1 |
| PR4 | Motor de execução | 1 | PR1, FN0, V14 AU2–AU5 |
| PR2 | Vocabulário de nós e validação | 1 | PR1, FN0 |
| PR6 | Tarefas humanas | 1 | PR4 |
| PR5 | Editor visual e simulação | 2 | PR2 |
| PR7 | Ligação com anotações e páginas | 2 | PR4, ED1 |
| ED4 | Botões e modelos | 3 | PR7, V14 AU6 |
| FN | Funções reutilizáveis | 2 | PR4, PR2 |
| PR8 | Modelos de processo internos | 3 | PR5, PR6 |
| CL1 | Colaboração em tempo real | 3 | decisão V16-7 |

**Conferir colisão dos prefixos** (`ED`, `CL`, `PR`, `FN`) contra `STATUS.md` e `PENDENTES.md` antes de começar e renomear aqui se necessário. `PR` pode colidir com "pull request" em comentários e commits, e se for o caso renomear para `PC`.

**Requisitos de teste (valem para todas as tarefas):**

- Ajuda em três idiomas, i18n (`parity.test.ts`), E2E, registro em `STATUS`, `PENDENTES`, `FEITOS` e `DECISIONS`, um commit por tarefa com o ID no fim, `lint` e `typecheck`, pacotes só por `npx expo install` (CLAUDE.md e AGENTS.md).
- Tabela nova: RLS e pgTAP com **dono, estranho e leitor**, privilégio por coluna e publicação no sync.
- **Ida e volta do Markdown (ED1):** teste de propriedade com *fuzz* (mil entradas por execução), mais um **corpus fixo** de 200 anotações reais do dono em `tests/fixtures/notas/`.
- **Paridade de expressões (FN0):** os mesmos 500 casos rodam no app e na Edge Function, e os resultados são **idênticos**.
- **Repetição determinística (PR4):** executar a mesma instância com os mesmos eventos duas vezes produz o **mesmo histórico**.
- **Injeção de falha:** derrubar a Edge Function no meio de um passo, no meio de um paralelo e durante o avanço do token. Ao retomar, **nenhum passo repete efeito** e **nenhum passo se perde**.
- **Revogação de permissão no meio da execução (PR6):** retirar a pessoa do projeto com tarefa humana aberta aplica a regra de reatribuição.
- **Carga (PR4):** 10.000 instâncias paradas e 500 ativas por 10 min, com o custo do varredor medido e registrado.
- **Limites:** cada limite do PR4 tem teste que o estoura de propósito.
- **Privacidade:** teste de que variáveis sensíveis do V15 são recusadas em expressão, ação e botão sem liberação.
- **Anti-laço (PR7):** uma ação que altera a página que originou o processo **não** reinicia o processo.

---

## 12. Decisões do dono

Todas com resposta **(padrão)** até o dono responder.

| # | Pergunta | Padrão |
|---|---|---|
| V16-1 | Nome e lugar do BPM | Aba **Processos**, separada da aba **Fluxo** (que continua sendo o grafo de dependências) |
| V16-2 | Como medir "mais robusto que o Notion" | Os **4 eixos** do §0.1 |
| V16-3 | Aparelhos de referência e orçamentos do ED5 | Os valores do ED5, medidos no **celular e no computador do dono** (informar modelos em ED0) |
| V16-4 | Biblioteca do editor | **Manter** a atual e estender. Troca só com número de ED0 |
| V16-5 | Transclusão editável | **Não** (só leitura) |
| V16-6 | Importar Notion e Obsidian | Só o que já existir, adaptado ao ED1 |
| V16-7 | Colaboração em tempo real (CL1) | **Fora** até o dono pedir |
| V16-8 | Revogação de acesso no meio de um processo | **Interrompe o passo** e aplica a regra de reatribuição |
| V16-9 | Nós extras do BPMN (OR, compensação, eventos baseados em evento) | **Fora** |
| V16-10 | Leitura de dados dentro de expressões | **Só por ação de leitura** do registro, com limite. Nenhuma função lê o banco livremente |
| V16-11 | Profundidade de subprocessos | **5** |
| V16-12 | Edição de diagrama no celular | **Não** (visualiza e executa tarefa humana) |
| V16-13 | XP de tarefa humana | **Não rende** por padrão. Pode ligar por definição |
| V16-14 | Ações em páginas | **Só acrescentam** ou definem propriedade, tag e local. Nunca substituem o texto |
| V16-15 | DMN (tabelas de decisão) | **Fora** agora. Reavaliar se o XOR ficar complexo |
| V16-16 | Compartilhar processos | **Fora**. Só uso próprio. Compartilhar com o projeto pode vir depois |
| V16-17 | Limites do PR4 (2.000 passos, 365 dias, 500 instâncias, 200 nós) | Valores do PR4 |

---

## 13. Critérios de aceite por tarefa

**ED0** — `docs/SPIKE_EDITOR.md` existe, **resolve por escrito** a divergência V11 §0 × V12 §0, traz a medição de ED5 por cenário (passa ou reprova), lista as construções que perdem informação na ida e volta, e registra a decisão do dono sobre manter ou trocar a biblioteca.

**ED1** — Qualquer Markdown do corpus passa por ida e volta sem diferença após a normalização. Uma construção desconhecida volta **idêntica**. Abrir uma anotação antiga **não** gera escrita. `^id` só aparece em blocos referenciados. O arquivo `docs/FORMATO_NOTAS.md` descreve toda sintaxe de extensão.

**ED2** — Referenciar um bloco gera `^id` e um registro de link. A transclusão aparece em somente leitura e atualiza quando a origem muda. Ciclo mostra aviso e não trava. Origem sem permissão mostra "indisponível" **sem** vazar texto (teste de RLS). A 4ª camada de transclusão não é expandida.

**ED3** — Relação bidirecional cria a propriedade inversa. Um rollup "soma" sobre 1.000 páginas relacionadas fecha com o valor calculado por consulta direta. Acima de 5.000 relacionadas mostra "muitas relações". Rollup **não aparece** como opção de gatilho nem de condição.

**ED4** — Um botão com a ação "criar tarefa" cria a tarefa e registra o histórico. Botão com ação de dispositivo pede confirmação. Variável sensível do V15 é recusada.

**ED5** — Cada linha da tabela do ED5 tem resultado registrado em `docs/DESEMPENHO_EDITOR.md`, com a data e o aparelho. **Reprovação** bloqueia a tarefa que causou, com o plano de correção descrito.

**ED6** — Duas edições offline da mesma anotação geram uma **versão em conflito** visível, e **nenhuma** das duas edições se perde. A mesclagem por bloco funciona sem apagar o bloco da outra pessoa.

**ED7** — Exportar e reimportar uma pasta de 200 anotações com links, blocos referenciados e propriedades reproduz as anotações e as ligações. Anexos são mantidos. Importação grande não dispara eventos individuais (`questlist.bulk`).

**CL1** — (só se pedido) Duas pessoas editando o mesmo parágrafo veem os cursores em até 1 s e o Markdown gravado no banco é idêntico nos dois lados ao parar.

**FN0** — O módulo `lib/expr/` não importa nada de React, Expo nem Supabase. Os 500 casos de paridade passam nos dois ambientes. Estouro do custo máximo falha o passo com mensagem.

**PR1** — Uma versão publicada **não aceita** `update`. Uma instância continua usando a versão antiga depois de uma nova publicação (teste). O cliente não escreve em `process_steps`, `process_tokens` e `process_waits` (pgTAP). Exportação e exclusão de conta incluem as tabelas.

**PR2** — A validação recusa: dois inícios, nó inalcançável, XOR sem caminho padrão, *split* paralelo sem *join*, laço sem saída e definição com mais de 200 nós, cada um com mensagem clara apontando o nó.

**PR3** — Uma variável não declarada em `entradas` falha na validação. A expressão com mais de 1.000 operações falha o passo. A avaliação no app e na Edge Function dá o mesmo resultado.

**PR4** — Após derrubar a função no meio de um passo, a retomada não repete o efeito externo (uma chamada de webhook só sai uma vez). Um processo com paralelo de 3 caminhos só avança depois de os 3 chegarem. Uma instância passando de 2.000 passos para com `falhou` e motivo. 10.000 instâncias paradas não aumentam o tempo do varredor além do medido no teste de carga. "Pausar todas" suspende instâncias novas e retoma depois.

**PR5** — Um diagrama inválido **não publica**. A simulação percorre o caminho e mostra variáveis sem efeito real (teste: nenhum webhook sai). No celular, o diagrama abre em modo leitura e não há edição. Operar o editor por teclado permite criar e conectar dois nós.

**PR6** — Concluir a tarefa humana avança o processo. Prazo vencido lembra e depois escalona conforme configurado. Formulário recusa campo obrigatório vazio no servidor. Delegar registra no histórico. Remover a pessoa do projeto reatribui como definido. A tarefa humana **não** rende XP por padrão, e ligando a opção rende **uma vez**.

**PR7** — Mudar a propriedade `status` de uma página inicia o processo configurado. A ação `pagina.anexar_texto` acrescenta no fim e **nunca** apaga conteúdo. Uma ação do processo que altera a página de origem **não** reinicia o processo. O cartão "Processos desta página" lista as instâncias.

**FN** — Publicar uma função que se chama (direta ou indiretamente) é **recusado**. Profundidade 6 é recusada. Uma função pura roda em linha sem criar instância. Ao publicar uma versão com assinatura alterada, a tela lista as definições que a usam e avisa da quebra.

**PR8** — Cada um dos 4 modelos tem um teste de ponta a ponta que o percorre do início ao fim, incluindo o caminho de rejeição ou de expiração onde houver.
