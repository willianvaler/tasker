# Pastas, projetos e listas

- **Lista** é onde ficam as coisas: compras, treino, roteiro da viagem. O tipo pode ser **Tarefas**, **Rotina** (checklist em cards que reinicia; bom para treino), **Hábitos**, **Quadro** ou **Gastos**. Toda lista de tarefas também abre como **Quadro** (aba no topo). No quadro, arraste o card para outra coluna (no celular, segure o card antes de arrastar) ou use as setas do card. Para abrir a tarefa, toque no lápis do card.
- **Pasta** junta listas suas. Exemplo: a pasta **Academia** com as listas Treino A e Treino B.
- **Projeto** é uma pasta para fazer **com outras pessoas**. Exemplo: o projeto **Churrasco** com as listas Compras e Dia, e cada amigo com as tarefas dele.

## Quando usar cada um

- Só você, assunto que se repete: **pasta**.
- Mais gente, algo com começo e fim: **projeto**.
- Um treino para um aluno, um cardápio para um paciente: **envie a lista** (veja "Enviar uma lista").

## Reinício

Uma lista pode **reiniciar** os checks todo dia, toda semana ou quando você mandar. Ótimo para treino semanal e rotinas.

## Mover

No menu da lista, **Mover para…** leva a lista (com as tarefas) para outra pasta ou projeto.

Para mudar a ordem sem arrastar, use **Mover para cima** e **Mover para baixo** no menu da pasta ou da lista (no teclado, **Alt+↑** e **Alt+↓** com ela aberta).

## Academia

Se você respondeu que vai usar o app para treinar (ou ligou o **Treino** em Configurações → Recursos), a barra lateral ganha o bloco **Academia**, com os seus treinos. **+ Novo treino** cria a lista de treino direto ali, já em cards e reiniciando toda semana. Desligar o modo não apaga nada: a pasta Academia volta para Pastas.

## Barra lateral

Em **Configurações → Navegação** você muda a ordem dos blocos (Anotações, Pastas, Academia, Projetos, Recebidas) e esconde os que não usa. Vale em todos os seus aparelhos.

No computador, o **clique direito** numa pasta (na barra lateral ou na aba Pastas), numa lista, num projeto, num marco ou num remédio abre o mesmo menu do botão **…** da linha.

## Anotações

**Nova anotação** (barra lateral, menu **+** ou Mais → Anotações) abre um texto livre, só seu. A barra de cima formata: **negrito**, _itálico_, título, lista, lista numerada e lista de tarefas. Também dá para escrever direto: `**negrito**`, `_itálico_`, `## título`, `- item`, `- [ ] tarefa`. **Visualizar** mostra o texto formatado; **Editar** volta ao texto. Salva sozinho.

Dentro de uma **pasta ou projeto**, a seção **Anotações** guarda textos da pasta (combinados, atas, ideias): quem é da pasta lê, e quem pode criar tarefas ali escreve. Elas não aparecem nas suas anotações pessoais.

### Comandos, callouts e mais

Escreva **/** no começo de uma linha para abrir os **comandos**: título, subtítulo, listas, tarefa, callout (nota, dica, aviso), tabela, link, destaque, nota de rodapé, bloco de código e divisória. Continue digitando para filtrar (`/tab` acha a Tabela) e confirme com Enter ou tocando.

- **Callout**: um quadro colorido. Escreva `> [!dica] Título` e, nas linhas de baixo, `> o texto`. Tipos: nota, dica, aviso, perigo, pergunta, informação, feito e citação (os nomes em inglês do Obsidian também valem). Com `-` depois do tipo (`> [!aviso]- Título`) ele começa fechado e abre ao tocar; com `+`, começa aberto e pode ser fechado.
- **Destaque**: `==texto==` fica marcado com fundo.
- **Nota de rodapé**: `[^1]` no texto e, em qualquer linha, `[^1]: a explicação`. A chamada vira um número pequeno e as notas aparecem no fim.
- **Tabela**: linhas com `|` separando as colunas e `| --- | --- |` embaixo do cabeçalho.

O **Sumário** lista os títulos da anotação: no computador fica ao lado do texto; no celular, no botão de sumário da barra. Tocar num título rola até ele. Embaixo do editor aparecem as **palavras** e os caracteres.

### Propriedades e etiquetas

Escrevendo, **Propriedade** (embaixo do título) acrescenta um campo à anotação: autor, nota, lido, prazo… Cada um tem um tipo: texto, número, data, caixinha, lista ou link (`[[Anotação]]`). Toque no nome para mudar o tipo ou remover. Duas têm sentido próprio: **tags** (etiquetas) e **aliases** (outros nomes da anotação, que o `[[` e as menções sem link também reconhecem).

Para etiquetar, escreva `#etiqueta` no texto ou ponha na propriedade tags. Use a barra para aninhar: `#treino/perna` fica dentro de `#treino`. Tocar numa etiqueta abre a tela **Etiquetas** (também em Mais e no Ctrl+K), que junta as das anotações e as das tarefas; a etiqueta mãe mostra também o que está nas filhas.

### Links entre anotações, tarefas e listas

Escreva `[[` (ou toque no botão de link da barra) e comece a digitar: aparecem as suas anotações (as mais recentes primeiro), tarefas, listas e projetos. Escolha um e o link entra no texto. Ao visualizar, ele aparece só com o nome, e tocar abre o item. Renomear o item não quebra o link. Também dá para ir a um título da anotação com `[[Anotação#Título]]`.

A última opção cria um link para o que **ainda não existe** (`[[Nova ideia]]`). Ele aparece apagado, e tocar nele cria a anotação com esse nome.

Embaixo da anotação, **Citado em** mostra as anotações e tarefas que têm link para ela, com a frase em volta. **Links que saem** lista o que ela cita. **Menções sem link** mostra as suas anotações que escrevem o nome dela sem `[[ ]]`, e **Ligar** transforma a menção em link. A descrição de uma tarefa também aceita `[[`, e o painel da tarefa e o alto de uma lista mostram o **Citado em**. Funciona sem internet.

## Lista de compras do cardápio

Numa lista de cardápio (do tipo Tarefas ou Rotina), cada prato é uma tarefa e os ingredientes são as **subtarefas** dele ou as linhas com `-` nas **notas** ("- 500 g de carne moída", "- 2 ovos"). No menu da lista, **Gerar lista de compras** junta tudo numa lista só, somando o que se repete (500 g + 300 g de carne viram 800 g; kg e litros também contam), e pergunta onde pôr: numa lista da mesma pasta, numa lista nova "Compras" ou na Caixa de entrada. Antes de criar, a lista aparece na criação em lote para você conferir. Pratos já concluídos ficam de fora (se todos estiverem concluídos, entram todos).
