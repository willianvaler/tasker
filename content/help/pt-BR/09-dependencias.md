# Tarefas que dependem de outras

No churrasco, **acender o fogo** depende de **comprar carvão**. Ligue as duas: no painel do fogo, em **Depende de**, escolha "Comprar carvão" (ou escreva `^carvão` ao criar).

Enquanto o carvão não for comprado, o fogo fica **bloqueado** (cadeado) e mostra "Aguardando: Comprar carvão". Quando alguém comprar, o fogo fica **pronto** e quem cuida dele recebe um aviso.

## Escrevendo com ^

Ao criar a tarefa, `^` seguido de um pedaço do nome liga a nova tarefa à que já existe: `Acender o fogo ^carvão`. Enquanto você digita, aparecem as tarefas que batem; Enter escolhe. No lote, `^2` aponta para o item 2 da própria lista. Vale em projetos e nas suas pastas, entre tarefas da mesma pasta (e das subpastas dela).

O **Depende de** fica sempre à vista no painel da tarefa, na seção **Ligações** (no alto em projeto, depois das subtarefas numa pasta pessoal), junto com os **Relacionados**: "depende de" espera a outra terminar; "relacionado" é só um atalho entre as duas. A aba **Fluxo** da pasta mostra quem espera quem.

## Estrito ou flexível

No projeto, o modo **estrito** não deixa começar o que está bloqueado. O **flexível** deixa forçar, e registra quem forçou.

## Lista que espera lista

Uma lista inteira pode esperar outra chegar a 50%, 75% ou 100% (Configurar lista → Libera depois de).

## Atalhos

`L` liga a tarefa selecionada a outra. `S` inicia.
