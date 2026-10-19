# Habitica: engenharia reversa das regras (ESCOPO_V8)

Lido do código aberto do Habitica (`HabitRPG/habitica`, branch `develop`, 19/10/2026): `website/common/script/ops/scoreTask.js`, `website/server/libs/cron.js`, `fns/crit.js`, `fns/randomDrop.js`, `ops/revive.js`, `libs/statsComputed.js`, `content/spells.js`.

**Licença:** o código do Habitica é GPL v3 e a arte é CC BY-NC-SA (não comercial). **Não copiar código nem arte**: aqui ficam só as regras e as contas, que reimplementamos do nosso jeito no banco (D33) com espelho em `lib/`. Os nomes de habilidade e de item são nossos.

## 1. Valor da tarefa (a "cor")

Toda tarefa e hábito tem um `value` (começa em 0), limitado a **[−47,27; 21,27]**.

- Marcar (+): `delta = 0,9747 ^ value`. Valor baixo (tarefa "vermelha", esquecida) rende muito; valor alto (tarefa "azul", fácil de manter) rende pouco. `value += delta`.
- Desmarcar o que foi marcado por engano: o inverso exato (acha o valor anterior por iteração), para não dar para ganhar e perder em ciclo.
- Falhar (−, hábito ruim ou diária não feita na virada): `delta = −(0,9747 ^ value)`, `value += delta`.
- **Cores** pelo valor: < −20 vermelho escuro · −20..−10 vermelho · −10..−1 laranja · −1..1 amarelo · 1..5 verde · 5..10 azul-claro · > 10 azul.
- **Hábito só bom ou só ruim**: na virada, o valor **cai pela metade** (zera abaixo de 0,1), para não ficar azul para sempre sem uso.
- **Contadores** dos hábitos zeram por dia, semana ou mês (já temos: `count_key`, D68).
- Subtarefas (checklist): em pendente, multiplicam o ganho por `1 + feitas`; em diária, a parte feita reduz o dano.

**Questlist hoje:** XP fixo por tipo (`gamification.config.ts`), sem valor por tarefa. **HB2** traz o `value` por tarefa e hábito, calculado no servidor (`habit_tick`, `complete_task`, `refresh_cycles`) e a cor na linha.

## 2. Recompensa ao marcar

Com `delta` do §1, `prioridade` (0,1 / 1 / 1,5 / 2) e `crit`:

- **XP** = `round(delta × (1 + INT × 0,025) × prioridade × crit × 6)`
- **Ouro** = `delta × prioridade × crit × (1 + PER × 0,02)`, com bônus de sequência `× (1 + sequência/100)` (mínimo +1).
- **Mana** em hábito: ±`max(0,25; 0,25% da mana máx.)`; em diária: ±`max(1; 1% da mana máx.)`.
- **Crítico**: chance `3% × (1 + FOR/100)`; multiplicador `1,5 + 4×FOR/(FOR+200)`.
- **Dano no boss** (missão): pendente/diária `ceil(delta × crit × (1 + FOR/200))`; hábito `ceil(delta × crit × (0,5 + FOR/400))`.

**Questlist hoje:** XP, ouro e dano com regras próprias (D33, D60 a D63) e crítico pela AGI (D61). O §1 entra como multiplicador do que já existe (decisão no HB2: `delta` multiplica o XP base em vez de trocar a tabela), para não desequilibrar o anti-farm (D34).

## 3. Vida, diárias e a virada do dia (cron)

- Vida máxima **50**. Mana máxima **`30 + 2 × INT`**.
- Para cada diária devida e não feita: `dano = delta × max(0,1; 1 − CON/250) × prioridade × 2` (o `delta` é negativo; dano mínimo 1). Diária com subtarefas: só a parte não feita conta.
- **Diárias de projeto não tiram vida** (só pessoais).
- A soma das diárias perdidas, × prioridade, vira o **dano do boss na equipe** (`progress.down`): o boss revida em todos da party.
- **"Descansar na taverna"** (`preferences.sleep`): nada de dano nem de mana na virada; o dano no boss acumulado fica guardado.
- **Dia perfeito**: todas as diárias devidas feitas → buff de `ceil(nível/2)` em todos os atributos no dia seguinte, e conquista "Dia perfeito".
- **Mana na virada**: `max(10; 10% da mana máx.) × feitas / (feitas + perdidas)`.
- **Furtividade** (habilidade do ladino): cada carga evita uma diária perdida.
- **"O que você fez ontem?"** (Record Yesterday's Activity): antes do cron, a pessoa marca as diárias de ontem que esqueceu; só então o dano é calculado.

**Questlist hoje:** ciclos no servidor (`refresh_cycles`, D24), sequência e boss da semana/dia (D33, O1). Não há vida. **HB5** acrescenta tudo isto, só no nível Completo.

## 4. Morte

Vida zerada → reviver: vida 50, **XP do nível e ouro zerados, perde 1 nível, −1 ponto num atributo aleatório e 1 equipamento aleatório** (que pode ser recomprado).

**Proposta para o Questlist (decisão V8-2):** mais leve: perde o ouro do dia e o XP acumulado no nível, nunca nível, atributo ou item.

## 5. Drops

- Chance por tarefa: `min(|value − 21,27|; 37,5) / 150 + 0,02`, × prioridade × bônus de nível baixo (`1 + max(0; 80 − 5×nível)/100`) × sequência × PER × renascimentos × crítico × subtarefas, com retorno decrescente até 75%.
- Limite por dia: `5 + PER/25` (×2 para assinante).
- Sorteio: 40% comida; o resto, ovo ou poção de eclosão. Os primeiros drops são garantidos (um ovo e uma poção).
- Missão de coleta: a mesma chance soma itens da missão.

**Questlist hoje:** drop de item da loja com raridade (D64, V4 §2). **HB8** acrescenta ovos, poções e comida ao mesmo sorteio.

## 6. Habilidades (4 por classe, liberadas do nível 11 ao 14)

| Classe | Nv 11 | Nv 12 | Nv 13 | Nv 14 |
|---|---|---|---|---|
| Mago | golpe numa tarefa (10 de mana; XP e dano) | dar mana à equipe (30) | buff de INT da equipe (35) | **congelar sequências** por um dia (40) |
| Guerreiro | golpe numa tarefa (10; dano no boss) | buff de CON próprio (25) | buff de FOR da equipe (20) | buff de CON da equipe (15) |
| Ladino | roubar ouro de uma tarefa (10) | ataque pelas costas (15; XP e ouro) | buff de PER da equipe (25) | **furtividade**: evitar diárias perdidas (45) |
| Curandeiro | curar a si (15) | clarear tarefas: sobe o valor de todas (15) | buff de CON da equipe (30) | curar a equipe (25) |

Classe só a partir do nível 10. **Questlist hoje:** 4 classes próprias (D61) com uma habilidade do dia cada. **HB6** traz a mana e as 4 habilidades por classe, mapeadas para as nossas classes.

## 7. Outros sistemas (resumo)

- **Recompensas**: itens com preço em ouro, criados pela pessoa → HB7.
- **Baú encantado**: 100 de ouro por um equipamento aleatório de uma coleção própria (ou comida, ou XP) → HB7.
- **Mascotes**: ovo + poção = mascote; 5 comidas da preferida (ou 10 de outra) = montaria → HB8.
- **Missões**: pergaminho de chefão (vida, força do revide) ou de coleta; convite para a party, começa quando todos aceitam → HB9.
- **Avatar**: corpo, pele, cabelo, barba, fundo; equipamento de batalha × fantasia → HB10.
- **Renascer**: a partir do nível 50 (ou com gemas) volta ao nível 1 e mantém itens, mascotes e conquistas → V4 R1.
- **Bônus de login** (check-in): prêmios em dias de acesso acumulados → avaliar.
- **Desafios**: listas de tarefas que várias pessoas copiam, com vencedor → generalizar D184.
