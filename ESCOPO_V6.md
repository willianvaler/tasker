# Questlist — Escopo V6: academia (instruções para o Claude Code)

Este documento **complementa** `ESCOPO.md` e `ESCOPO_V2.md` a `ESCOPO_V5.md`. Onde houver conflito, **o mais recente vence** (V6 > V5 > V4 > V3 > V2 > V1). O que falta do V4 e do V5 continua valendo; a ordem entre eles é decisão do dono.

Antes de começar: releia `CLAUDE.md`, `DECISIONS.md` e `docs/STATUS.md`. Ao concluir cada item, atualize `docs/STATUS.md`; decisões novas vão em `DECISIONS.md`. Texto novo nasce nos 3 idiomas; um commit por tarefa, com o id (`AC1`, `AC2`...).

Origem: pedido do dono em 18/10/2026: trazer para o Questlist as funcionalidades de academia do [openGym](https://github.com/alexpcosta/opengym) (fork de [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym), com o "AI Coach"), que ele e o Greg usam como referência de app de treino.

---

## 0. Licenças: o que pode e o que não pode vir de lá

Avaliado em 18/10/2026.

| O quê | Licença | Como usar |
|---|---|---|
| Código do openGym | **AGPL v3** | **Não copiar.** Copiar código obrigaria a publicar o Questlist inteiro (inclusive o servidor) sob AGPL, o que conflita com os planos pagos (V4 §6). Daqui só saem **ideias e comportamentos**, reescritos do zero no nosso modelo. Nem "olhar e redigitar" trechos: escrever a partir da descrição deste escopo. |
| Contornos do corpo para o mapa muscular ([MuscleMap](https://github.com/melihcolpan/MuscleMap), de Melih Colpan) | **MIT** | Pode usar, mantendo o aviso de copyright e a licença num `NOTICE.md` nosso. |
| Base de 1.324 exercícios ([hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)): nomes, músculo-alvo, sinergistas, equipamento, instruções | **MIT** (dados e textos) | Pode usar, com o aviso de copyright. As instruções existem em 10 idiomas, **sem português**: a tradução para pt-BR é nossa (revisada). |
| Animações e imagens dos exercícios | **© Gym visual**, licença própria | **Não usar** sem comprar licença da Gym visual. Alternativas na decisão 1. |

Regra para qualquer fonte nova: conferir a licença antes, registrar no `NOTICE.md` e em `DECISIONS.md`.

## 1. O que o Questlist já tem (não refazer)

- Página de **cards** como treino ("Treino A"), item com séries × repetições e carga (`4x12 20kg`), **reinício semanal** dos checks, duplicar página.
- **Séries contadas por pessoa** (`log_rep`, `task_progress`, valores por série em `logged_values`), descanso que começa sozinho, +30 s, pular.
- **Modo Treino** em tela cheia (Feita, carga −/+, mais uma série, pular, resumo, fecha sozinho), tela acesa, **tela de bloqueio** no Android (X1).
- **Página enviada** treinador → aluno, com painel "Alunos": aderência, cargas por ciclo e evolução (Fase L).
- Timers absolutos, pomodoro, avisos no celular, jogo (XP, bosses, conquistas, itens).

O V6 transforma isso num **diário de treino de verdade**: cada exercício sabe o que é, cada série guarda o que aconteceu, e o app usa esse histórico para sugerir a próxima carga e mostrar a evolução.

## 2. Biblioteca de exercícios

- Catálogo global de exercícios (tabela `exercises`, só leitura para o usuário): nome nos 3 idiomas, parte do corpo, músculo-alvo, sinergistas, equipamento, instruções passo a passo; base inicial a partir do dataset MIT (§0).
- **Exercícios próprios**: nome e parte do corpo bastam (descrição opcional); funcionam como os do catálogo em todo lugar. Por pessoa, ou do projeto/time quando criados lá.
- **Ligar item a exercício** (`tasks.exercise_id`, opcional): ao digitar "Supino reto 4x10 40kg" na captura ou no lote, o app sugere o exercício do catálogo (busca por nome nos 3 idiomas, com sinônimos comuns: "supino", "bench press"); aceitar liga, ignorar mantém como texto.
- Busca e **filtro por equipamento** (só o que a pessoa tem: halteres, barra, máquinas, peso do corpo...), por parte do corpo e por músculo.
- Mídia: ver decisão 1. Sem mídia licenciada, a ficha mostra os músculos no mapa (§7) e as instruções.

## 3. Registro por série (o diário)

- Cada série feita guarda **o que aconteceu de verdade**: carga e repetições reais (o Modo Treino já vem preenchido com o previsto; mudar é um toque), e a data.
- **Três jeitos de registrar**, por item:
  - **Repetições**: carga × reps (o atual);
  - **Tempo**: prancha, isometria, carregada; um cronômetro de trabalho conta a série (separado do descanso) e grava o tempo que segurou; pode ter carga;
  - **Cardio**: tempo + velocidade ou distância.
- **Série de aquecimento** marcada à parte (não conta para recorde nem progressão).
- **Esforço por série (opcional, desligado por padrão)**: RIR (repetições que sobraram) ou RPE (escala até 10), escolhido no Perfil. Cada série guarda a escala em que foi registrada; trocar a escala não reescreve o passado. Esforço é informação: não muda progressão nem 1RM.
- **Unidade** kg ou lb no Perfil; conversão só na tela.
- **Histórico por exercício**: todas as sessões, com as séries de cada uma, a partir do item ou da ficha do exercício.
- Tudo funciona sem internet (fila do aparelho, como o `log_rep`), e a conta continua sendo de cada pessoa (num treino compartilhado, cada um tem o seu diário).

## 4. Recordes e 1RM

- **Recorde pessoal (PR)** detectado na hora da série: maior carga, maior número de reps numa carga, maior volume numa sessão, maior 1RM estimado. O Modo Treino comemora (aviso curto) e o resumo do fim lista os recordes do dia.
- **1RM estimado** por exercício, a partir da melhor série válida (fórmula a escolher, ex.: Epley; diz qual série usou); **não estima acima de 12 reps**. Curva de evolução do 1RM e calculadora (carga × reps → 1RM; 1RM → cargas por porcentagem).
- No jogo: recorde vale um **golpe crítico garantido** no boss e conquistas próprias (§9).

## 5. Progressão automática

- Uma **regra por treino** (página), com exceção por exercício:
  - **Nenhuma**: a carga fica como está;
  - **Linear**: fez todas as reps de todas as séries → sobe um degrau;
  - **Progressão dupla**: trabalha numa faixa de reps (ex.: 8–12) na mesma carga; chegou ao topo em todas as séries → sobe a carga e volta ao começo da faixa;
  - **Greyskull LP**: duas séries normais e a última até a falha; passou da meta na última → sobe (dobra o degrau se dobrar as reps); uma falha → volta 10 %;
  - **Mais tempo**: para exercícios por tempo, segurou todas → +5 s.
- **Degrau padrão** por parte do corpo (2,5 kg em cima, 5 kg em pernas, costas e quadril; 5/10 lb), ajustável por exercício; carga sempre arredondada para o que dá para montar.
- **Leitura honesta da sessão**: série não marcada ou com menos reps = falha; nunca sobe carga numa sessão que não deu certo. Falhas seguidas (3 na linear e na dupla, 1 no Greyskull) → **deload** de 10 %. Exercício com peso do corpo progride em reps.
- **A próxima carga já vem preenchida** quando o treino abre, e cada número diz **por quê** ("subiu 2,5 kg: fez 4×10 na última"). Sugestão auditável, não mágica.
- A prescrição é **derivada do histórico** (função pura, a mesma em todos os aparelhos e com testes); corrigir uma série errada já corrige a próxima sugestão. Nada de contador guardado que sai de sincronia.
- Depois (decisão 4): programação por **porcentagem do training max** (5/3/1 e parecidos).

## 6. Peso corporal e medidas

- Registro de **peso** (opcional, com pergunta rápida no início do treino, desligável), **meta** e gráfico com a linha da meta; ganho e perda coloridos conforme aproximam ou afastam da meta.
- **Medidas** (cintura, braço, peito, quadril, coxa...) com gráfico por medida.
- Dado de saúde: **dado pessoal sensível pela LGPD** (art. 11). Fica só com a pessoa (nem o treinador vê, a não ser que ela libere), entra na exportação e na exclusão da conta, e o consentimento é pedido na primeira vez (ver V5 §4).
- Depois: importar do Health Connect (Android) e do Apple Health.

## 7. Estatísticas de treino

- **Mapa de calor do ano** (estilo GitHub), tom pelo tempo treinado no dia.
- **Mapa muscular** frente e costas (figura masculina ou feminina, à escolha), sombreado pelo trabalho de cada músculo na semana, no mês ou desde sempre; lista os músculos **não treinados** no período; mostra o que um treino trabalha enquanto é montado e o que acabou de ser treinado no resumo. Contornos do MuscleMap (MIT, §0), desenhados com as cores do tema.
- **Volume** (carga × reps) por semana e por grupo muscular; tempo de treino; frequência.
- Com esforço ligado: média por semana ao lado do volume (volume subindo com esforço subindo = cansaço acumulando).

## 8. Montar e executar o treino

- **Supersets e circuitos**: agrupar 2 ou mais exercícios; o Modo Treino alterna entre eles e o descanso vem só depois do grupo.
- **Séries de aquecimento sugeridas** antes da primeira série pesada (ex.: 40 %, 60 %, 80 %), opcionais.
- **Calculadora de anilhas**: que anilhas pôr de cada lado para chegar à carga (barra e anilhas disponíveis configuráveis).
- **Plano da semana**: qual treino em qual dia (usando a recorrência que já existe); **remarcar** o treino de hoje para outro dia sem mexer no plano (doente, faltou, semana mais curta).
- **Lembrete** no celular em dia de treino planejado sem registro, desligável.
- Observação por exercício ("banco no furo 4", "pegada fechada"), visível no Modo Treino.

## 9. No jogo

- Treino conta como hoje (cada série é golpe; o exercício concluído dá XP), mais: **recorde = crítico garantido**; volume da semana alimenta o boss de forma limitada (anti-farm igual ao das tarefas).
- Conquistas de academia (P1 a P3 já dão a estrutura): primeiro recorde, 10/50/100 recordes, 50/100/365 treinos, 10/100 toneladas levantadas, todos os grupos musculares numa semana, 1RM = peso do corpo no supino, sequência de semanas cumprindo o plano.

## 10. Planos prontos, importar e compartilhar

- **Planos prontos** (modelos): corpo inteiro 3×, superior/inferior, empurrar/puxar/pernas, 5×5, e depois 5/3/1. Viram páginas de cards ligadas aos exercícios, com a regra de progressão já escolhida.
- **Importar histórico** de FitNotes, Strong e Hevy (CSV), com o RPE que eles guardam: nomes casados com a biblioteca; o que não casar vira exercício próprio (nada se perde). Peso corporal do Apple Health.
- **Compartilhar plano**: a "página enviada" (L) e os modelos já fazem isso dentro do app; acrescentar **PDF para imprimir** e arquivo para quem não usa o Questlist.

## 11. Treinador e aluno (evolui a Fase L)

- Painel "Alunos" ganha recordes, 1RM e volume por aluno, aderência ao plano da semana e alerta de estagnação (3 sessões sem progresso num exercício).
- O treinador pode definir a regra de progressão e a carga inicial de cada aluno; o aluno vê "definido pelo treinador".

## 12. Treinador por IA (opcional, por último)

- Uma entrevista curta (objetivo, dias por semana, equipamento, experiência, restrições) gera um **plano completo**, que a pessoa ajusta em linguagem natural.
- Sob pedido ou de tempos em tempos, a IA lê estagnações, esforço, aderência e peso, e propõe **mudanças separadas e explicadas**, aceitas uma a uma; nada muda sem aprovação, e todo conjunto de mudanças pode ser desfeito.
- A progressão de carga (§5) continua com a regra; a IA mexe no plano, não na carga de cada sessão.
- Desligada por padrão; quem roda o servidor escolhe o provedor (decisão 5) e cada pessoa consente antes. Dados de saúde só vão para o provedor com consentimento explícito.

---

## 13. Ordem sugerida (fase AC)

| Id | Tarefa |
|---|---|
| AC1 | Biblioteca de exercícios: tabela, carga do dataset MIT com tradução pt, busca e filtros, exercícios próprios |
| AC2 | Ligar item a exercício (captura, lote, painel) |
| AC3 | Registro por série: reps reais, modos tempo e cardio, aquecimento, kg/lb |
| AC4 | Histórico por exercício, recordes e 1RM (com aviso no Modo Treino) |
| AC5 | Progressão automática: as 5 regras, deload, "por quê", testes iguais no app e no servidor se precisar |
| AC6 | Esforço por série (RIR/RPE) |
| AC7 | Peso corporal e medidas, com consentimento (LGPD) |
| AC8 | Estatísticas: mapa de calor, mapa muscular, volume |
| AC9 | Supersets, aquecimento sugerido, calculadora de anilhas, observação por exercício |
| AC10 | Plano da semana, remarcar, lembrete em dia de treino |
| AC11 | Jogo: recorde crítico e conquistas de academia |
| AC12 | Planos prontos e importação (FitNotes, Strong, Hevy) |
| AC13 | Painel do treinador com recordes, 1RM e estagnação |
| AC14 | Treinador por IA (depois das decisões 5 e da LGPD do V5 §4) |

AC1 a AC5 são o núcleo (sem eles o resto não tem dados); AC6 a AC13 podem ir na ordem que o dono preferir.

## 14. Decisões em aberto (do dono)

1. **Mídia dos exercícios**: (a) gerar ilustrações próprias no ComfyUI, no mesmo estilo do Modo Jogo (V5 §7), (b) licenciar as da Gym visual, (c) procurar outra base com licença livre, ou (d) sem mídia (mapa muscular + instruções).
2. **Tradução das instruções** para pt-BR: feita por nós (IA + revisão) e mantida no repositório?
3. Unidade e regra de progressão padrão para quem começa (proposta: kg e progressão dupla).
4. Programação por porcentagem (5/3/1) entra no V6 ou fica para depois?
5. **Treinador por IA**: provedor (API do Claude, modelos locais no servidor, ou os dois) e se é recurso de plano pago.
6. Peso e medidas: o treinador pode pedir para ver? (padrão proposto: só com a pessoa liberando, por treinador).
