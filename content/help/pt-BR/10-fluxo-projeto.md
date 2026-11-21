# Entendendo o projeto

O projeto tem cinco abas:

- **Lista** — as listas, o progresso, os marcos, o boss do projeto e "como o fluxo está indo": o que mais segura o projeto, o caminho crítico e quem tem tarefas atrasadas.
- **Fluxo** — o mapa das dependências, da esquerda para a direita. **Você está aqui** marca o que já pode ser feito; "Sua vez" são as suas. Também em lista, para quem prefere.
- **Gantt** — uma barra por tarefa com data, do **início** ao **vencimento**, com as setas das dependências e a linha de hoje. Arraste a barra para mudar as duas datas, ou uma borda para mudar só o começo ou o fim; tocando na barra, um menu faz o mesmo de dia em dia (bom no celular, onde é preciso segurar antes de arrastar). Borda laranja: a tarefa começa antes de um pré-requisito terminar. Embaixo ficam as tarefas sem data: um toque põe para hoje. O início também se muda no painel da tarefa, em **Começa em**. **Salvar linha de base** guarda as datas de agora (até 5 por projeto, para quem mexe na estrutura); tocando numa linha de base, cada tarefa ganha embaixo a barra fina do plano e o atraso em dias ("+3 d"), e o resumo diz quantas atrasaram, quantas entraram e quantas saíram depois dela. Os indicadores comparam com a mais nova.
- **Pessoas** — cada pessoa com o que está **fazendo**, o que está **pronto**, o que está **esperando** e o que concluiu.
- **Linha do tempo** — quem fez o quê e quando, com filtros e exportação em CSV.

Cada tarefa tem também o **Histórico** dela, no painel.

## Marcos e roadmap

Os **marcos** do projeto (na visão geral, "Novo marco") ganham o **Roadmap**: os marcos em ordem de data, cada um com as tarefas ligadas, a barra de progresso, quantas estão atrasadas e quantas bloqueadas. Marco com a data já passada e tarefa aberta fica com a borda vermelha; embaixo aparece quantas tarefas abertas não têm marco.

Para ligar uma tarefa a um marco, escolha o marco no **painel da tarefa** (seção Marco) ou escreva `~nome` ao criar, como `Comprar o piso ~Entrega` (vale na escrita rápida e em Adicionar várias; o nome é comparado sem acento, espaço nem pontuação). Marco desconhecido não liga e avisa.

No **Gantt**, cada marco é um losango na data dele, no alto da grade; tocar abre o menu para mudar a data dia a dia ou abrir o Roadmap. Ao **concluir o marco** no Roadmap, **Notas da versão** cria uma anotação no projeto com o que foi feito e o que ficou para depois, pronta para copiar ou publicar.
