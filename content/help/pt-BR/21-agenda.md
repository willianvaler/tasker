# Agenda e disponibilidade

A **disponibilidade** diz em que horários você aceita compromissos. Fica em **Configurações → Agenda → Disponibilidade** e vale no fuso do seu perfil. A página de reservas (para alguém marcar um horário com você) e o **Achar horário** em grupo usam esses horários, e quem vê de fora enxerga só **livre** ou **ocupado**, nunca o que você tem marcado.

## A semana

Cada dia tem um campo. Escreva um ou mais trechos separados por vírgula: `9-12, 14-18`, `9h às 12h`, `9:00–12:00` ou `9am to 5pm`. Ao sair do campo, ele mostra como ficou (`09:00–12:00, 14:00–18:00`). Trechos que se encostam ou se sobrepõem viram um só. Dia vazio é dia sem horário. Para ir até a meia-noite, use `24` no fim (`20-24`).

**Copiar segunda para os dias úteis** repete os horários de segunda de terça a sexta. Depois, **Salvar**. Embaixo aparecem as horas da semana e os **próximos 7 dias** como vão ficar, já com as exceções.

## Exceções

Para folga, viagem ou um compromisso de fora do app, adicione uma **exceção**: a data de começo (`24/12`, `amanhã`, `sexta`), a de fim se for mais de um dia, e um **horário** se for só um trecho (`14-16`; vazio bloqueia o dia inteiro). O motivo é opcional e só você vê. O **×** tira a exceção. As que já passaram somem da lista.

## Página de reservas

Em **Configurações → Agenda → Compromissos** você cria os **tipos de compromisso** (ex.: "Conversa de 30 min"): duração, intervalo antes e depois, antecedência mínima, até quantos dias à frente, limite por dia, se pede telefone e "sobre o que é", e se a reserva **pede a sua aprovação**. Cada tipo tem um link (`/agenda/<seu nick>/<tipo>`), e o link da agenda (`/agenda/<seu nick>`) mostra todos os tipos abertos.

Quem abre o link **não precisa de conta**: escolhe o dia e o horário (no fuso dela), escreve o nome e o e-mail e confirma. Os horários livres são os da sua semana menos as exceções, as reservas já feitas e as **tarefas com horário** (a duração é a estimativa da tarefa, ou 30 min). Se duas pessoas tentarem o mesmo horário, a segunda recebe o aviso de que ele acabou de ser ocupado.

A reserva vira uma **tarefa** na lista **Reservas**, da pasta **Agenda** (criada na primeira reserva), com o horário, a duração e as respostas na descrição, e você recebe um aviso. Com aprovação, a reserva fica pendente (o horário já fica guardado) até você **Aprovar** ou **Recusar** em Compromissos; **Cancelar** tira a tarefa (ela vai para a lixeira).

Quem reservou recebe na tela o botão **Adicionar à agenda (.ics)** e um link para **remarcar** ou **cancelar**. A pessoa também recebe **por e-mail** a confirmação (com o convite .ics e o link), o pedido aguardando aprovação, a recusa, a remarcação e o cancelamento. Os dados de quem reservou somem 1 ano depois do compromisso.

## Achar horário em grupo

Num **projeto**, num **time** ou no **clã**, o botão **Achar horário** escolhe as pessoas (todas já vêm marcadas), a duração (30 min, 1 h, 1 h 30) e os próximos 7 ou 14 dias, e mostra os horários em que **todas estão livres**: dentro da semana de cada uma e fora do que cada uma já tem (tarefas com horário, reservas e exceções). Ninguém vê o que ocupa a agenda dos outros, só que o horário não serve. Quem não configurou a disponibilidade aparece como **sem agenda** e não limita; se ninguém configurou, a busca vai das 9h às 18h.

Escolhido o horário, **Criar compromisso** cria a tarefa com o horário e lembrete 15 min antes: no projeto, numa das listas, com as pessoas como responsáveis; no time e no clã, na sua Caixa de entrada.

## Enquete de horário

Para marcar com quem não está no app: **Configurações → Agenda → Enquetes de horário → Nova enquete**. Dê um título, a duração, um recado se quiser (lugar, link da chamada) e de 2 a 5 horários: toque nos seus horários livres dos próximos dias ou escreva um (`25/11 14:00`, `25/11 às 9`). Mande o **link da enquete**. Quem abre não precisa de conta: põe o nome (o e-mail é opcional), marca os horários que servem, no fuso de quem abre, e pode mudar a resposta enquanto a enquete estiver aberta. A página mostra os nomes de quem já respondeu em cada horário, nunca o e-mail; os e-mails só você vê.

Você recebe um aviso a cada pessoa nova. Na enquete, cada horário mostra quantos podem (o mais votado em destaque); **Fechar neste horário** cria a tarefa com horário na lista da agenda (a mesma das reservas), com quem marcou nas notas, e o link passa a mostrar o horário escolhido com **Adicionar à agenda (.ics)**. Quem deixou o e-mail recebe o horário escolhido com o convite .ics; quem não deixou vê pelo link. A enquete some 1 ano depois de fechada.

## Sem internet

Configurar a disponibilidade precisa de conexão. Ela entra na **exportação dos seus dados** e sai junto com a conta.
