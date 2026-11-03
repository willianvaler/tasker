# Pastas, projetos e listas

- **Lista** é onde ficam as coisas: compras, treino, roteiro da viagem. O tipo pode ser **Tarefas**, **Rotina** (checklist em cards que reinicia; bom para treino), **Hábitos**, **Quadro**, **Gastos**, **Base** ou **Canvas** (veja em Anotações). Toda lista de tarefas também abre como **Quadro** (aba no topo). No quadro, arraste o card para outra coluna (no celular, segure o card antes de arrastar) ou use as setas do card. Para abrir a tarefa, toque no lápis do card.
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

No computador, arraste a **borda direita** da barra para mudar a largura, e a **linha entre os atalhos** (Hoje, Planejar…) **e os blocos** para dar mais lugar às pastas e anotações: os atalhos encolhem e rolam por dentro. Duplo clique na linha volta a mostrar todos.

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

### Nota do dia e modelos

**Nota do dia** (o botão do caderno na Hoje, em Anotações, no Ctrl+K ou `Alt+D`; se o navegador usar o `Alt+D`, `G D`) abre a anotação de hoje, com o dia no título (`2026-11-03`), e cria se ainda não existir. Embaixo dela, ao visualizar, aparecem as tarefas **concluídas** e **criadas** naquele dia, como um diário automático. No **Calendário**, os dias com nota ganham um ponto, e a lista do dia tem o botão para abrir (ou escrever) a nota.

Um **modelo** é uma anotação que serve de ponto de partida. Em Anotações → **Modelos**, **Novo modelo**; ou, numa anotação, **Mais opções** → **Transformar em modelo**. Os modelos não aparecem nas listas. No texto do modelo, `{{data}}`, `{{hora}}` e `{{titulo}}` viram o dia, a hora e o título quando ele é usado. **Do modelo** (em Anotações) cria uma anotação a partir de um deles, e **Usar na nota do dia** faz cada nota do dia nova começar com ele.

### Consultas

Uma cerca ` ```questlist ` (ou o comando `/consulta`) mostra, dentro da anotação, tarefas ou anotações que batem com uma pergunta escrita em palavras:

```
tarefas onde etiqueta = casa e vence <= hoje+7 ordenar por vencimento
tarefas da lista "Mercado" não concluídas
anotações onde etiqueta = leitura e props.nota >= 4 como tabela
tarefas da pasta "Trabalho" onde prioridade >= alta como contagem
```

Comece com **tarefas** ou **anotações**. Depois, em qualquer ordem: **da lista "…"** ou **da pasta "…"**; **onde** campo sinal valor, juntando com **e** (campos: etiqueta, vence, prioridade, título, status, criada, atualizada e `props.nome` para as propriedades; sinais: `=`, `!=`, `<`, `<=`, `>`, `>=` e **contém**; datas: `hoje`, `hoje+7`, `ontem`, `amanhã` ou `2026-12-01`); **concluídas** ou **não concluídas**; **ordenar por** campo (com **desc** para inverter); **limite** número; e **como lista**, **como tabela** ou **como contagem**. As palavras também valem em inglês e espanhol. Na lista, as tarefas têm a caixinha de verdade. A consulta roda no aparelho, também sem internet, e precisa de um filtro (lista, pasta, etiqueta ou data) para não ler tudo: sem ele, ela avisa e não roda.

### Links entre anotações, tarefas e listas

Escreva `[[` (ou toque no botão de link da barra) e comece a digitar: aparecem as suas anotações (as mais recentes primeiro), tarefas, listas e projetos. Escolha um e o link entra no texto. Ao visualizar, ele aparece só com o nome, e tocar abre o item. Renomear o item não quebra o link. Também dá para ir a um título da anotação com `[[Anotação#Título]]`.

A última opção cria um link para o que **ainda não existe** (`[[Nova ideia]]`). Ele aparece apagado, e tocar nele cria a anotação com esse nome.

Embaixo da anotação, **Citado em** mostra as anotações e tarefas que têm link para ela, com a frase em volta. **Links que saem** lista o que ela cita. **Menções sem link** mostra as suas anotações que escrevem o nome dela sem `[[ ]]`, e **Ligar** transforma a menção em link. A descrição de uma tarefa também aceita `[[`, e o painel da tarefa e o alto de uma lista mostram o **Citado em**. Funciona sem internet.

**Incorporar:** uma linha só com `![[...]]` (o `!` antes do link, ou o comando `/incorporar`) mostra o item dentro da anotação: outra anotação (inteira, ou só um trecho com `![[Anotação#Título]]`), uma lista com as caixinhas de verdade (concluir ali conclui na lista), uma tarefa, ou uma imagem dos anexos das suas tarefas pelo nome do arquivo (`![[foto.jpg]]`). No computador, parar o mouse sobre um link mostra uma prévia com as primeiras linhas; no celular, toque e segure.

### Bases

Uma lista do tipo **Base** mostra, numa tela só, as tarefas ou anotações que batem com uma consulta (a mesma linguagem do bloco ` ```questlist `, acima), como **Tabela** ou **Cartões**. Ela nasce com `tarefas onde vence <= hoje+7 não concluídas`; troque o texto e toque em **Aplicar** (ou `Ctrl+Enter`). **Colunas** escolhe o que aparece (nas anotações, as propriedades também viram colunas), **Agrupar** junta por status, lista, etiqueta, prioridade ou uma propriedade, e tocar no nome da coluna ordena (crescente, decrescente e de volta à ordem da consulta). Na tabela, toque numa célula para editar: título, vencimento (`2026-12-01`), prioridade (`0` a `3` ou `!!`) e etiquetas nas tarefas; título e propriedades nas anotações (a caixinha troca com um toque). As tarefas têm a caixinha de verdade, e a seta no fim da linha abre o item. A configuração fica guardada na lista e vale para todo mundo do projeto; quem só lê vê, mas não muda.

### Grafo

**Grafo** (em Anotações, no Mais ou no Ctrl+K) desenha as anotações, tarefas, listas e pastas como pontos e os links `[[...]]` como linhas; quanto mais citado, maior o ponto, e o link para o que ainda não existe aparece vazado. Filtre pelo tipo, pela etiqueta, pela pasta ou projeto, e esconda as **Soltas** (sem nenhum link). **Procurar no grafo** põe o foco num item e mostra só o que está ligado a ele, a 1, 2 ou 3 passos. No computador, a roda do mouse aproxima, arrastar move a tela e os pontos, e clicar abre o item (o vazado cria a anotação); no celular, role e use os botões de aproximar. Embaixo de cada anotação, ao visualizar, o **Grafo local** mostra os vizinhos até 2 passos, com **Abrir no grafo**.

### Canvas

Uma lista do tipo **Canvas** é um quadro branco infinito. No computador: **Texto** cria um cartão de texto (dois cliques edita), **Cartão** põe uma anotação, tarefa, lista ou pasta de verdade (a tarefa no canvas é a mesma tarefa, e a caixinha conclui), **Endereço** mostra um link ou uma imagem da internet e **Grupo** cria uma área com nome para juntar cartões. Arraste para mover, puxe a borda do cartão selecionado para mudar o tamanho e puxe uma seta da bolinha na borda de um cartão até outro; dois cliques na seta dão um rótulo. Com algo selecionado, escolha a **Cor** ou **Tirar do canvas** (ou `Delete`). **Exportar .canvas** e **Importar .canvas** usam o formato aberto JSON Canvas, o mesmo do Obsidian. No celular o canvas aparece em lista, por grupo, com as tarefas marcáveis. Mexer no canvas pede poder configurar a lista.

### Histórico de versões

Cada anotação guarda versões sozinha: uma por sessão de edição, no máximo uma a cada 10 minutos. Em **Mais** (os três pontos no alto da anotação) → **Histórico de versões**, escolha uma data para ver o que muda se voltar a ela (− linhas que só ela tem, + linhas que só o texto de agora tem) e toque em **Restaurar esta versão**; o texto de agora fica guardado no histórico, então dá para desfazer. As versões ficam 1 ano, só você vê (mesmo numa anotação de projeto) e **contam no seu espaço de anexos**; para liberar espaço, apague uma versão no histórico ou todas em **Configurações → Dados**. Ver e restaurar precisa de internet. Anotação apagada vai para a **Lixeira** com as versões e volta inteira.

### Favoritos, busca, tela dividida e aleatória

**Favoritos:** em **Mais** na anotação, ou no menu da lista, **Adicionar aos favoritos**; eles aparecem no alto da barra lateral e na tela de Anotações (o **×** tira). Uma busca também pode ser favorita: escreva no Ctrl+K e escolha **Salvar a busca nos favoritos**. **Busca com operadores** no Ctrl+K (procura nas anotações, tarefas, listas e pastas): `tag:casa` (ou `#casa`, as filhas também contam), `em:Trabalho` (pasta ou projeto), `tipo:nota`, `tipo:tarefa`, `tipo:lista`, `tipo:pasta`, `"frase exata"` e `-palavra` para tirar; os nomes valem em português, inglês e espanhol (`in:`, `type:`, `etiqueta:`). **Tela dividida** (computador, janela larga): em **Mais** na anotação, **Abrir ao lado** põe outra anotação ou uma lista à direita; o **×** fecha o lado. **Anotação aleatória** está na tela de Anotações e no Ctrl+K.

## Lista de compras do cardápio

Numa lista de cardápio (do tipo Tarefas ou Rotina), cada prato é uma tarefa e os ingredientes são as **subtarefas** dele ou as linhas com `-` nas **notas** ("- 500 g de carne moída", "- 2 ovos"). No menu da lista, **Gerar lista de compras** junta tudo numa lista só, somando o que se repete (500 g + 300 g de carne viram 800 g; kg e litros também contam), e pergunta onde pôr: numa lista da mesma pasta, numa lista nova "Compras" ou na Caixa de entrada. Antes de criar, a lista aparece na criação em lote para você conferir. Pratos já concluídos ficam de fora (se todos estiverem concluídos, entram todos).
