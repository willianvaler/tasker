# Processos

Um **processo** é um fluxo que dura: horas, dias ou semanas. Ele cria tarefas para pessoas, espera prazos e sinais, decide o caminho e faz passos automáticos sozinho. É diferente de uma **automação** (que é "quando X, faça Y" e acaba em segundos) e da aba **Fluxo** do projeto (que só mostra as dependências das tarefas). Abra em **Configurações → Abrir os processos**.

## Glossário

- **Processo:** o desenho (os passos e as ligações). Cada **publicação** cria uma **versão**; o que já está rodando continua na versão em que começou.
- **Instância:** uma vez em que o processo roda, com as suas **variáveis** e a sua **linha do tempo**.
- **Passo:** cada caixa do desenho.
- **Portão:** a **decisão** (segue o primeiro caminho cuja condição é verdadeira, ou o padrão) e o **paralelo** (divide em caminhos ao mesmo tempo e junta quando todos chegam).
- **Função:** um processo que outros chamam, com **entradas** e **saídas**.

## Os passos

**Início**, **fim** (ou fim com erro), **passo automático** (as mesmas ações das automações: avisar, criar tarefa, mudar a tarefa, webhook…), **tarefa para alguém**, **decisão**, **paralelo**, **esperar um tempo** (`PT2H`, `P1D`), **esperar um sinal**, **chamar função**, **repetir** (até 50 vezes) e **para cada item** (até 100).

A **tarefa para alguém** é uma tarefa normal: aparece na Hoje com o distintivo **Processo**. Ela pode ter **escolhas** ("Aprovar", "Rejeitar"), um **formulário** (o que a pessoa preenche vira variável) e um **prazo**, com lembrete antes e, se vencer, um caminho próprio, outra pessoa ou só um aviso. Quem recebeu pode **devolver ao grupo**. Se a pessoa sair do projeto, a tarefa volta ao grupo ou a você. Ela **não rende XP**, a não ser que você ligue "conta como tarefa normal".

## Editar, testar e publicar

O desenho se edita na web: os botões **+** adicionam passos, você liga arrastando ou pelo formulário **Ligar dois passos** (que funciona só com o teclado), e o painel do lado mostra as propriedades do passo ou da ligação. **Desfazer**, **Refazer**, **Duplicar** e **Arrumar sozinho** ajudam. Os erros aparecem na hora, cada um apontando o passo, e um processo com erro **não publica**. **Simular** percorre o desenho com variáveis de teste e mostra o caminho e as variáveis, sem fazer nada de verdade (nem aviso, nem webhook). No celular, o desenho é só para ver.

As condições e os cálculos usam a mesma linguagem do campo calculado, com `{var.nome}` (variáveis), `{inicio.*}` (quem iniciou) e `{retorno.*}` (o que a última espera devolveu). Toda variável usada precisa ser declarada.

## Limites

Até 200 passos por desenho, 2.000 passos por instância, 365 dias, 500 processos em andamento, 60 inícios por hora e 5 funções uma dentro da outra. Um passo que falha pode tentar de novo (1, 5 e 30 min), seguir pelo caminho de erro ou parar o processo; parado, **Repetir o passo com falha** tenta outra vez. **Pausar todas** (nas Automações) também pausa os processos.
