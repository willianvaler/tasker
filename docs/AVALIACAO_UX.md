# Avaliação de UX (25/11/2026)

Pedido do dono depois da reforma de usabilidade 2: "atue como um especialista em UX e avalie como
está o design e a usabilidade do sistema: posição de botões, como usar cada coisa e afins". Base:
47 capturas de uma conta nova (computador 1280 px e celular Pixel 7, tema claro), feitas na versão
v2026.11.25.2, mais o uso no emulador Android durante o R1.4.

**Resumo:** o visual é coeso e calmo (a paleta "Caderno de bolso", a tipografia serifada nos títulos,
o espaçamento generoso), e as telas de índice (Mais, Pessoas, Planejar, Configurações) são claras. O
que mais pesa contra a praticidade não é a falta de recurso, é **o excesso de coisas disputando a
mesma atenção** e **alguns gestos que não fazem o que a pessoa espera**. Abaixo, por gravidade.

## 1. Alta (atrapalha o uso todo dia)

| # | O quê | Onde | Por que atrapalha | Proposta |
|---|---|---|---|---|
| A1 | **Clicar no nome da tarefa entra em renomear**, em vez de abrir | Listas (computador e celular) | No Notion, no Todoist e no Things, clicar abre. Aqui o clique seleciona o texto para editar, e abrir exige achar a setinha `>` no fim da linha | Clique abre o painel; renomear por F2, duplo clique ou dentro do painel |
| A2 | **Anotações não estão na barra de baixo do celular** (Hoje · Planejar · + · Pastas · Mais) | Celular | Para um app que quer substituir o Notion, a anotação fica a 2 toques (Mais → Anotações). A Caixa de entrada também | Posição padrão da barra: Hoje · Anotações · + · Pastas · Mais (Planejar dentro de Hoje ou do Mais); a escolha de posições já existe (D258), falta o padrão |
| A3 | **"Apagar" vermelho no alto da anotação** | Anotação (computador e celular) | É o botão mais visível do cabeçalho, ao lado do ⋯, e no celular aparece realçado. Ação destrutiva no lugar mais nobre | Mover para o ⋯ (com a confirmação que já existe); no alto, só o que se usa sempre |
| A4 | **Três árvores separadas na barra lateral** (Anotações, Pastas, Projetos) | Barra lateral | A pessoa precisa decidir em que caixa algo mora antes de criar; no Notion é uma árvore só de páginas | Ver §4 (organização, a R4 da reforma): ao menos, Anotações dentro das pastas na mesma árvore |
| A5 | **Visualizar × Editar** na anotação | Anotação | Com o editor de blocos, a diferença confunde: o texto já aparece formatado nos dois modos, mas consulta, botão e incorporar só funcionam no Visualizar | Abrir sempre editando (como o Notion) e desenhar consulta, botão e incorporar dentro do editor (o "resultado" no lugar da caixa crua) |

## 2. Média (confunde ou esconde)

| # | O quê | Onde | Proposta |
|---|---|---|---|
| M1 | **Hoje começa com o jogo e o treino**: barra de XP e vida, "Vai usar o Questlist para treinar?" e, no computador, uma coluna inteira de bosses. A lista do dia fica em terceiro plano | Hoje | Conta nova começa no modo jogo **Discreto** (só o nível pequeno na barra lateral), a pergunta do treino vira um cartão da Introdução, e os bosses ficam na tela Jogo |
| M2 | Ícones sem rótulo no alto da Hoje do celular (busca, nota do dia, sino, ajuda) e na barra da anotação (link, imagem, sumário, código) | Celular, anotação | Rótulo curto embaixo ou só os 2 mais usados visíveis e o resto no ⋯; o ícone de nota do dia não diz o que é |
| M3 | A linha de dicas da captura rápida (`amanhã · !! · #etiqueta · @pessoa · ^depende de`) em fonte de código | Listas | Trocar por uma dica que aparece ao focar o campo, em texto comum ("amanhã, !! prioridade, #etiqueta…"), e só nas primeiras semanas |
| M4 | **Base mostra a frase da consulta** numa caixa grande, com "Aplicar" desligado, acima da tabela; o **Filtros e ordem** fica pequeno | Base | Inverter: os filtros e a ordem como chips acima da tabela (como o Notion), e a frase escondida em "Avançado" |
| M5 | **Rodapé de totais "Total Total Total Soma 2"** na Base | Base | Só mostrar total nas colunas em que a pessoa ligou um total; o resto vazio |
| M6 | Nova automação: **19 gatilhos numa parede de chips** | Automações | Agrupar (Tarefas · Tempo · Anotações · Jogo · De fora) e começar pelos modelos |
| M7 | Callout: **"Tip" no editor e "Dica" na leitura** | Anotação | O nome do tipo traduzido nos dois (e um seletor de tipo ao clicar no título do callout) |
| M8 | Contador **"0/1000000"** no rodapé da anotação | Anotação | Mostrar só as palavras; o limite aparece perto do fim (acima de 90%) |
| M9 | **Lista de tarefas na leitura com marcador e caixinha** ("• ☐ Terminar") | Anotação (Visualizar) | Tirar o marcador quando o item é tarefa |
| M10 | **"Modo"** como primeiro item da barra lateral, acima de Hoje | Barra lateral | Mover para o rodapé (perto do tema) ou para o ⋯; a primeira coisa é Hoje |
| M11 | Texto técnico em telas de uso comum: "Uso desta hora: 0 de 600", "Funções: processos que outros chamam, com entradas e saídas", "Diferente da aba Fluxo…" | Automações, Processos | Mostrar uso só perto do limite; Funções dentro de "Avançado" |
| M12 | Campo de captura da Hoje mostra **"Carregando…"** na primeira abertura | Hoje | Mostrar o campo normal e desligado até a árvore chegar |

## 3. Baixa (acabamento)

- **Nomes**: o menu Novo diz "Lista", a paleta diz "Nova lista"; "Projetos e convites" em Pessoas e "Projetos" na barra; "Mais" mostra o nome da pessoa no título (parece perfil). Padronizar verbos e nomes.
- **Toques pequenos**: o `>` de abrir tarefa e o ⋯ de pasta na barra lateral ficam abaixo de 40 px no computador.
- **Coluna larga vazia**: Base e listas no computador ocupam 60% da largura e deixam a direita em branco (o D214 pede usar a largura).
- **Placeholders de exemplo** ("Ex.: Lembrar das atrasadas") em cinza claro com contraste baixo no modo claro.
- **Configurações** é uma página longa: um índice (Conta, Aparência, Avisos, Recursos, Agenda, Automações, Dados) no alto ajuda a achar.

## 4. Organização (a conversar: R4)

O modelo hoje tem **pasta, projeto, lista (8 tipos) e anotação**, cada um com tela, árvore e menu
próprios. Para ser tão prático quanto o Notion sem perder o que o Questlist faz melhor (tarefas de
verdade, jogo, sync offline), a proposta é **uma árvore só**:

1. **Pasta e projeto** viram a mesma coisa ("Pasta"; projeto é uma pasta compartilhada ou com marcos,
   um interruptor, não um tipo).
2. **Anotação mora na pasta** como qualquer lista (já é possível desde as anotações em pastas; falta a árvore mostrar junto).
3. **Lista é uma "visão"** da pasta (Lista, Quadro, Tabela, Calendário, Canvas), como os bancos do
   Notion, e não um tipo escolhido na criação.
4. **Barra lateral**: Hoje, Caixa de entrada, Buscar, e a árvore de pastas com anotações e listas
   dentro; Hábitos, Bem-estar, Jogo e Pessoas no Mais.

## 5. O que está bom e deve ficar

- A **paleta Ctrl+K** e o **menu Novo** com letras (T, P, F, J, H, A, U): rápidos e descobríveis.
- **Planejar** como resumo do que vem (próximos 7 dias, sem data) e a **Revisão semanal**.
- O **editor de blocos** com o `/`, o **Inserir** e o aviso da primeira vez: no teste, criar callout,
  tabela e lista de tarefas ficou em poucos toques, inclusive no celular.
- Os **estados vazios** que explicam o que fazer ("Nada por aqui. Digite uma tarefa acima, ou cole uma lista").
- A **Ajuda contextual** (?) em toda tela.

## 6. Ordem sugerida

1. A1 (clique abre a tarefa), A3 (Apagar no ⋯), M12, M7, M8, M9, M10: pequenos, efeito imediato.
2. A2 (Anotações na barra de baixo) e M1 (Hoje sem o jogo em primeiro plano para conta nova).
3. A5 + M4 + M5 (anotação sempre editando; Base com filtros por chips).
4. M2, M3, M6, M11 (rótulos, dicas, agrupar gatilhos, esconder o técnico).
5. §4 (organização), depois de decidir com o dono.
