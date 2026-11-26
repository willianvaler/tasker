# Revisar cartões (repetição espaçada)

Qualquer anotação pode ter cartões de estudo. Escreva uma linha com a **pergunta**, `?::` e a **resposta**:

```
Capital da França ?:: Paris
- Organela da energia ?:: Mitocôndria
```

Cada linha assim vira um cartão quando a anotação é salva. O começo de lista (`-`, `1.`) não entra na pergunta, e o que está dentro de um bloco de código não vira cartão. Apagar a linha apaga o cartão e as revisões dele. Mudar só a **resposta** (ou a ordem das linhas) mantém o histórico; mudar a **pergunta** começa um cartão novo.

## A revisão do dia

Em **Mais → Revisar cartões** (ou no Ctrl+K) fica a sessão de hoje, com "Hoje: N cartões" no alto: primeiro os que **venceram**, do mais atrasado, depois os **novos**, na ordem das anotações. No **⋯** de uma anotação com cartões, **Revisar cartões** abre só os dela.

Pense na resposta, toque em **Mostrar resposta** e diga como foi. Cada botão mostra quando o cartão volta:

- **Errei**: volta amanhã e aparece de novo no fim desta sessão.
- **Difícil**, **Bom** ou **Fácil**: o intervalo cresce (1 dia, 6 dias, depois o intervalo anterior multiplicado pela facilidade do cartão). **Fácil** aumenta a facilidade; **Difícil** diminui.

A conta é a do **SM-2** (o algoritmo do SuperMemo, de domínio público), com um ajuste: errar tira pouco da facilidade, para o cartão difícil não ficar preso.

## Limites do dia

Por padrão, **20 cartões novos** e **200 revisões** por dia. Mude em **Limites do dia** (o botão no alto da tela). O que passar do limite fica para amanhã, e a tela diz quantos.

## Sem internet e em dois aparelhos

A revisão funciona sem internet. Cada resposta é guardada com o horário, e o estado do cartão é sempre refeito em ordem de horário: revisar no celular e no computador, mesmo sem conexão, chega ao mesmo resultado quando os dois sincronizam. Os cartões de uma anotação nova ou editada sem internet aparecem depois que ela sincroniza.

Em anotações de um projeto, quem é do projeto vê os cartões, e cada pessoa tem as **próprias** revisões.

## Estudo e jogo

Com o jogo ligado, cada **10 cartões diferentes** revisados no dia fecham uma **sessão de estudo**: **+5 XP**, até **3 sessões por dia**. O XP é por sessão, não por cartão (rever o mesmo cartão não conta de novo), e o dia com uma sessão conta na **sequência**. A tela mostra quanto falta para a próxima sessão. Quem dá o XP é o servidor, quando a revisão chega: a feita sem internet vale se sincronizar até o dia seguinte. Sessão de estudo não dá ouro nem dano no boss, e automações não concedem esse XP.
