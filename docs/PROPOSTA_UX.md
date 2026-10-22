# Proposta de UX — arrumar a casa (v2, 22/10/2026)

Pedido do dono em 22/10: *"o app tem MUITAS funcionalidades, mas muitas ficam escondidas ou espalhadas, e algumas são bem difíceis de achar. Revise documentos e telas, veja o que está onde e, como especialista de UX, reformule telas, botões e funcionalidades; proponha melhorias visuais e conceituais. Não mexa no código ainda."* Depois: *"repense com mais calma e de um jeito mais profundo, preciso de uma certeza maior"*, *"o Início e a aba Hábitos foram pedidos meus, mas podemos mudar"* e *"o Depende de foi corrigido porque não aparecia em lugar nenhum; para mim faz sentido ele ser um dos primeiros campos de um projeto; o Relacionados parece não fazer muita coisa"*.

Esta é a segunda versão. A primeira era uma leitura de código e de capturas antigas; esta foi **medida no app rodando**. Nada aqui está decidido nem implementado.

---

## 0. Como esta versão foi feita (e o quanto dá para confiar)

1. **Auditoria do app rodando.** Um roteiro do Playwright (fora do repositório) criou uma conta nova com uma pasta, uma lista, três tarefas e a Academia ligada. Em cada tela, no celular (Pixel 7, 412 px) e no computador (1280×800), ele gravou a árvore de acessibilidade (todo botão, link, aba e campo, com o nome) e uma captura. São **16 telas × 2 tamanhos**.
2. **De onde cada tela é aberta**, conferido no código (todo `router.push`/`href` de cada rota).
3. **Decisões e relatos**: as decisões que criaram cada tela (D68, D69, D76, D158, D159, D166, D171, D174, D221...) e os relatos do dono ("não achei o botão de modo treino", D171; "a usabilidade em alguns momentos parece debilitada", ESCOPO_V5 §2).
4. **Regras do servidor**: o que muda de verdade se uma tela ou um conceito mudar (ex.: o `kanban` não tem regra própria no banco; o `cards` tem).
5. **Referências externas**: guias de plataforma e apps do mesmo tipo (fontes no §10).

Cada achado leva uma marca de evidência:

| Marca | Significa |
|---|---|
| **[visto]** | Aconteceu no app rodando, com captura |
| **[código]** | Confirmado lendo o código ou o banco |
| **[relato]** | O dono relatou |
| **[guia]** | Diretriz de plataforma ou padrão de mercado |
| **[opinião]** | Julgamento de UX, sem medição: é o que o teste com pessoas (§8) precisa confirmar |

**O que não deu para medir:** o uso real (quantas pessoas usam cada função). A leitura em produção foi bloqueada pelas permissões desta sessão. A consulta pronta, só com contagens, está no Apêndice A, para o dono rodar no servidor. É a peça que mais aumentaria a certeza das prioridades.

---

## 1. Os números

| Medida | Celular | Computador |
|---|---|---|
| Destinos fixos na barra de navegação | **6 abas** + botão "+" flutuante | 7 atalhos + 4 blocos + **8 ícones sem texto** no rodapé |
| Controles só na barra lateral | — | **27** (33 com a Academia) |
| Controles na tela Perfil | **~50** numa rolagem só | **~48** (fora a barra lateral) |
| Painel da tarefa no modo **Simples** | **~30 controles**, **1,9 telas** de altura | ~29 (fora a barra lateral) |
| Formas de criar algo visíveis na tela Pastas (com Academia) | 6 ("Nova pasta", 3 "+", "Novo treino", botão flutuante) | 6 (inclui um globo sem rótulo, que é a Comunidade) |
| Funções **sem nenhum caminho visível** | Busca/paleta, Biblioteca, Peso e medidas, Estatísticas de treino, Revisão semanal (fora do aviso), lista de Anotações | Revisão semanal (fora do aviso e da paleta) |
| Telas do jogo | 9 (Personagem, Loja, Inventário, Conquistas, Clã, Estábulo, Recompensas, acampamento e a faixa do boss) | idem |

Referência: o Material Design recomenda **de 3 a 5 destinos** na barra de baixo; acima disso, gaveta ou outra solução **[guia]**. O próprio escopo V2 §12.3 pedia "4 destinos com o + no meio"; a D76 manteve 6 por causa dos pedidos da Fase 7 **[código]**.

---

## 2. Achados, do mais grave ao mais leve

| # | Achado | Evidência | Gravidade |
|---|---|---|---|
| A1 | No celular, **a busca (Ctrl+K) não tem botão**: a paleta, que é o "acha qualquer coisa" do app, só existe para quem tem teclado | [visto] [código] | Alta |
| A2 | No celular, **Biblioteca, Peso e medidas e Estatísticas de treino não têm caminho**: só existem no bloco Academia da barra lateral, que o celular não mostra. A tela Pastas no celular só oferece "Novo treino" e "Novo grupo de treino" | [visto] [código] | Alta |
| A3 | **A Revisão semanal só abre pelo aviso** do Início (quando ele decide aparecer) ou pela paleta | [código] | Alta |
| A4 | **No Início, a mesma tarefa aparece duas vezes**, sob "FAZER AGORA" e "PARA FAZER AGORA" (rótulos quase iguais). E tudo o que a Hoje mostra também está no Início | [visto] | Alta |
| A5 | **No Início do celular, as tarefas de hoje só começam no último quarto da tela**: antes vêm a contagem, o "Fazer agora", o cartão do jogo, "Anotações" vazia e "Hábitos de hoje" vazio. O "+" flutuante cobre o link "Calendário" | [visto] | Alta |
| A6 | **O Perfil mistura três coisas**: ajustes (nome, tema, avisos), **atalhos para outras telas** (Projetos, Amigos, Times, Pomodoro, Lixeira, Sincronização, Personagem, Loja, Inventário, Conquistas, Clã) e o painel do jogo. São ~50 controles numa rolagem. No celular, Amigos, Times, Clã, Loja, Inventário, Conquistas e Lixeira **só** se acham ali | [visto] | Alta |
| A7 | **Rodapé da barra lateral com 8 ícones sem texto** (Perfil, Notificações, Comunidade, Amigos, Times, Clã, Loja, Ajuda). Em 1280 px **não cabe**: o "?" da Ajuda sai cortado e o ponto de sincronização some. O escudo do Clã e o globo da Comunidade não se adivinham | [visto] | Alta |
| A8 | **Na página de lista há dois ícones iguais (sliders)** a um dedo de distância: um configura a página, o outro abre a criação avançada | [visto] | Média |
| A9 | **O painel "Simples" ainda tem 1,9 telas** no celular, com "Quem vê", "Repetição" e "Anexos" antes das **Subtarefas**. O "Depende de" vem em primeiro lugar até numa lista pessoal de mercado (ele subiu de propósito, no CD16; ver §5.4) | [visto] [relato] | Média |
| A10 | **"Completo" quer dizer duas coisas na mesma tela do Perfil**: "Mostrar no painel: Simples/Completo" e "Gamificação: Desligado/Leve/Completo". E "modo" quer dizer cinco: o botão Modo, o Modo Treino, o Modo academia, o modo jogo e o modo do painel | [visto] | Média |
| A11 | **A mesma ação tem dois nomes**: na pasta Academia, a barra lateral diz "Criar o primeiro treino" e a tela Pastas diz "Criar a primeira página". Em projeto é "lista", em pasta é "página" | [visto] | Média |
| A12 | **O "Modo academia" está sob o título "Barra lateral"** no Perfil, mas liga uma pasta, o Modo Treino e um bloco inteiro | [visto] | Média |
| A13 | **O menu "…" da página tem 9 itens soltos** (configurar, duplicar, enviar, campos, automações, relacionar, publicar, mover, apagar), sem grupos, e muda conforme o tipo | [visto] | Média |
| A14 | **"Relacionados" não tem efeito nenhum**: é um vínculo só informativo (D122). Disputa espaço e atenção com "Depende de", que tem efeito | [código] [relato] | Média |
| A15 | **Kanban é "tipo de página", mas Matriz é "aba"**, e no banco o `kanban` não tem regra própria (conta como lista). Já `cards` tem (rotina: dano menor, bônus de página inteira). Ou seja: um tipo com nome de visual (Cards) e um visual com cara de tipo (Kanban) | [código] | Média |
| A16 | **Elementos flutuantes se cobrem**: a barra do descanso cobre o boss no Perfil e a lista na tela Pastas; o aviso "Desfazer" cobre "Pular exercício" no Modo Treino; o "+" cobre o link do Início | [visto] | Média |
| A17 | **"Salvar" desabilitado parece ativo** (laranja claro) no Perfil | [visto] | Baixa |
| A18 | **"Vai usar para treinar?" ocupa a primeira dobra** do Início no computador | [visto] | Baixa |
| A19 | **Emojis em botões** ("🎁 Recompensas", "🐾 Estábulo") e **avatar em emoji** ao lado de bosses pintados, contra o próprio `DESIGN.md` | [código] [visto] | Baixa |
| A20 | **Origem em fonte mono em toda linha** ("Caixa de entrada", "Mercado"): parece código e repete a informação quando a tela já é daquela lista | [visto] | Baixa |

**Correções baratas, sem mudar a estrutura:** A1, A2, A7, A8, A10, A11, A12, A16, A17 e A19. Ver UX1 a UX4 no §9.

---

## 3. O princípio organizador: frequência × importância

A arrumação certa não sai de "onde cabe", e sim de **com que frequência cada coisa é usada e quanto atrapalha não achar**. O que se usa várias vezes ao dia fica a 1 toque; o que se usa por semana, a 2 toques e **num lugar previsível**; o que é raro pode ficar a 3, desde que esteja no índice.

| Trabalho da pessoa | Frequência (estimada [opinião]; o Apêndice A mede) | Hoje | Onde deve ficar |
|---|---|---|---|
| Anotar algo rápido | várias vezes ao dia | "+" ✓ | "+" no meio da barra |
| Ver e marcar o que é para hoje | várias vezes ao dia | Hoje e Início (duplicado) | **Hoje**, 1 toque |
| Marcar hábito do dia | diária | Hoje, Início e Hábitos | **Hoje** |
| Treinar | 3 a 5× por semana | Pastas → Academia → treino → Iniciar, ou Modo | 2 toques, sempre no mesmo lugar |
| Esvaziar a Entrada / dar datas | diária ou semanal | aba Entrada | Planejar |
| Ver a semana / calendário | semanal | só pelo Início (celular) | Planejar |
| Revisão semanal | semanal | só pelo aviso | Planejar |
| Mexer numa lista/pasta/projeto | diária | Pastas | Espaços |
| Gerir hábitos (criar, editar) | rara | aba Hábitos | Espaços → Hábitos (ou na barra, se a pessoa quiser) |
| Jogo (personagem, loja, estábulo) | varia muito por pessoa | 9 telas | Um hub "Jogo" (na barra para quem joga no RPG) |
| Amigos, times, clã, comunidade | rara | 6 lugares | Um lugar: Pessoas |
| Ajustes, lixeira, sincronização | rara | Perfil | Configurações, a partir de "Mais" |

A frequência varia **por pessoa**: quem treina abre o treino todo dia; quem joga no RPG abre o personagem todo dia; quem não faz nenhum dos dois nunca abre. Por isso a resposta não é uma barra fixa melhor, e sim **uma barra com padrão bom e posições escolhidas pela pessoa** (§4.1). É o que o Todoist e o TickTick fazem **[guia]**, e o Questlist já tem a peça: os blocos da barra lateral configuráveis (V6 §15.2).

---

## 4. Decisões estruturais

Cada uma: problema → alternativas → recomendação → confiança → custo → como validar.

### 4.1 Barra de navegação do celular

**Problema:** 6 abas mais um botão flutuante, acima do máximo de 5 da plataforma; funções inteiras sem caminho (A1, A2, A3); o "+" flutuante cobre conteúdo (A16).

**Alternativas:**

| | Proposta | A favor | Contra |
|---|---|---|---|
| a | Manter 6 abas e só pôr os caminhos que faltam | barato | continua acima do guia; o "+" segue cobrindo coisas; as 6 abas não incluem Planejar, Bem-estar nem Pessoas |
| b | 5 posições fixas (Hoje · Planejar · + · Espaços · Você) | simples, previsível | quem treina ou joga todo dia perde o atalho dele |
| **c** | **5 posições: Hoje e "Mais" fixos, "+" no meio, duas posições escolhidas pela pessoa** | resolve o "cada um usa um app diferente"; respeita os pedidos do Início e dos Hábitos sem impor a todos; padrão do Todoist/TickTick | uma tela de ajuste a mais; o E2E precisa fixar a barra |

**Recomendação: (c).**

```
┌───────────────────────────────────────────────┐
│  Hoje   [posição 2]   ( + )   [posição 4]  Mais│
└───────────────────────────────────────────────┘
padrão:   Hoje · Planejar · + · Espaços · Mais
quem treina (escolhido na introdução):   Hoje · Treino · + · Espaços · Mais
quem joga no RPG:   Hoje · Jogo · + · Espaços · Mais
opções para as posições 2 e 4: Planejar · Entrada · Hábitos · Espaços · Treino (Bem-estar) · Jogo · Pessoas · Foco
```

- **"Mais"** (avatar da pessoa) é o **índice completo**, como o "Browse" do Todoist: Entrada, Hábitos, Planejar, Espaços, Bem-estar, Pessoas, Jogo, Anotações, Notificações, Configurações, Ajuda, Lixeira. O que está na barra some de lá. **Garantia: qualquer função fica a no máximo 2 toques de qualquer aba.**
- **Busca** no topo de toda tela principal (ícone), abrindo a mesma paleta do Ctrl+K, que passa a funcionar no toque.
- **Sino** no topo, como hoje. O botão de tema sai do topo (ajuste raro → Configurações).

**Confiança:** alta no problema; média-alta na solução (padrão de mercado, mas não testado com quem usa o Questlist).
**Custo:** médio (barra customizável, tela "Mais", ajuste no E2E `openTab`).
**Validar:** teste de árvore (§8) com a barra atual e a proposta.

### 4.2 Início e Hoje

**Problema:** tudo o que a Hoje mostra também está no Início; a mesma tarefa aparece duas vezes no Início (A4); no celular, as tarefas aparecem tarde (A5).

**O que cada uma tem hoje [código]:**

| Conteúdo | Início | Hoje |
|---|---|---|
| Contagem (atrasadas, hoje, hábitos, sem data) | ✓ | — |
| Próxima ação ("Fazer agora") | ✓ | — |
| Atrasadas + de hoje | ✓ | ✓ |
| Hábitos de hoje | ✓ | ✓ |
| Captura para hoje | — | ✓ |
| Próximos 7 dias | ✓ | — |
| Entrada sem data | ✓ | — |
| Atribuídas a mim | ✓ (com projeto) | — |
| Anotações (3) | ✓ (celular) | — |
| Jogo | coluna/cartão; acampamento no RPG | faixa |
| Avisos (academia, revisão) | ✓ | — |

**Alternativas:**
- (a) Manter as duas e diferenciar: o Início vira "painel" sem a lista de hoje. *Contra:* duas telas para a mesma pergunta ("o que eu faço?"), e o painel vira um lugar de passagem.
- **(b) Uma tela "Hoje"** com o melhor das duas: Próxima ação, atrasadas, hoje, hábitos do dia e captura. *Próximos 7 dias*, *Entrada* e *Atribuídas* vão para **Planejar**; *Anotações* para Espaços (com atalho no "+"); o jogo vira uma **linha** (nível, XP, HP dos bosses), com o toque abrindo o Jogo.
- (c) Só a Hoje, sem a Próxima ação. *Contra:* perde o que o Início tem de bom.

**Recomendação: (b).** O acampamento do modo RPG (pedido no V8) não se perde: vira a capa do **Jogo**, e quem joga põe o Jogo na barra (4.1).

```
SEG, 22 OUT                                  🔍  🔔
Hoje
nv 4 ▬▬▬──  320/500 XP   ⚔ dia 49/60 · semana 289/300    ← uma linha; toque abre o Jogo
FAZER AGORA  Pagar a conta de luz              [⏱ Foco]
+ Nova tarefa para hoje…
ATRASADAS 2  ·  HOJE 3                                    ← seções vazias não aparecem
HÁBITOS DE HOJE                                  Todos ›
```

**Confiança:** alta no problema ([visto]); alta na solução para o celular; média para o computador (lá a coluna da direita dá espaço para os dois, e a dor é menor).
**Custo:** médio. Validar: teste de árvore + medir quantos toques até marcar a 1ª tarefa do dia.

### 4.3 "Mais": Perfil, Configurações, Jogo, Pessoas

**Problema:** A6, A7, A10, A12. O Perfil é ao mesmo tempo ajuste, atalho e jogo.

**Recomendação (confiança alta):** separar pelo tipo de coisa, sem tela nova de dados:

| Destino | O que tem | Hoje está em |
|---|---|---|
| **Configurações** | Conta · Aparência · Navegação (barra de baixo e blocos da lateral) · **Recursos** (§4.8) · Avisos · Foco (pomodoro) · Treino · Dados (exportar, **lixeira**, **sincronização**, excluir conta) · Sobre (APK, termos, privacidade). No celular, uma lista com subtelas; no computador, colunas | Perfil |
| **Perfil público** | nome, nick, avatar, link de amizade, visibilidade padrão | Perfil + Amigos |
| **Jogo** (só com o jogo ligado) | Hub com abas: Herói · Bosses e missões · Loja e inventário · Estábulo · Recompensas · Conquistas. A capa é o acampamento | 9 telas |
| **Pessoas** | Pedidos · Amigos · Times · Clã · Grupos e desafios · Comunidade | rodapé da lateral + Perfil + Pastas |

No computador, o rodapé da barra lateral fica com **3 alvos**: o cartão do avatar (nível e XP, abrindo o menu Mais), o sino e a ajuda. Resolve o corte do A7.

**Custo:** médio (reorganiza telas que já existem). **Validar:** teste de árvore ("onde fica a lixeira? seus amigos? a loja?").

### 4.4 Painel da tarefa (inclui o "Depende de" e o "Relacionados")

**Problema:** A9, A10, A14. O modo Simples/Completo pede que a pessoa entenda o modo antes de usar a tarefa, e mesmo o Simples tem quase duas telas.

**Sobre o "Depende de" (pedido do dono):** concordo que, **em projeto**, ele é um dos campos principais: é o que move o fluxo, os estados (pronta, bloqueada) e as abas Fluxo e Linha do tempo. O problema visto foi outro: ele aparece em primeiro lugar **também numa lista pessoal** de mercado, onde quase nunca se usa. A posição deve depender do contexto, não de um modo escondido.

**Sobre o "Relacionados":** ele não muda nada no app (D122), e o dono não viu valor. Recomendo **juntar os dois numa seção "Ligações"**, no padrão de Jira e Linear: um campo de busca e um seletor de tipo, **Depende de** (padrão) · **Libera** · **Relacionado a**. O banco já tem as duas tabelas (`task_dependencies` e `relations`); muda só a tela.

**Proposta (layout de propriedades, padrão de Linear/Things/Todoist):**

```
CASA / MERCADO                                      [⏱ Foco] […] [×]
☐ Leite
[📅 Amanhã] [!! Média] [#mercado] [☀ Meu dia] [+ Responsável]      ← chips; vazio = apagado
───────────────
EM PROJETO: LIGAÇÕES  Depende de: Comprar carvão ✓   [+ ligação]   ← logo aqui, em projeto
───────────────
Descrição
SUBTAREFAS 2/5                                                     ← sobe
───────────────
[+ Adicionar ▾]  Ligações · Repetição · Séries/vezes · Tempo · Campos · Peso · Visibilidade · Anexo · Aprovação
───────────────
ATIVIDADE  [Comentários | Histórico]
```

Regra de exibição, **no lugar do Simples/Completo**:
1. **Sempre:** título, linha de propriedades, descrição, subtarefas.
2. **Por contexto:** em projeto, Ligações e Responsáveis logo abaixo das propriedades; em treino, o bloco do exercício; em hábito, o contador e o histórico; em item recebido, a observação.
3. **Por uso:** qualquer seção com valor aparece (a regra de `lib/panel-sections.ts` já faz isso).
4. **O resto** fica no "+ Adicionar", com o nome à vista (não escondido atrás de um modo).

O "Iniciar" (fluxo) e "Iniciar pomodoro/cronômetro" viram **um botão "⏱ Foco"** com menu (Pomodoro · Cronômetro · Lançar tempo · Marcar em andamento).

**Alternativa barata:** manter o Simples/Completo e só reordenar (subtarefas para cima, Depende de em primeiro só em projeto, "Quem vê" para o fim). Resolve metade do A9 em uma tarde.

**Confiança:** alta no problema; média-alta no layout (padrão de mercado; precisa de teste no celular, onde os chips quebram linha).
**Custo:** alto (é a tela mais rica do app). **Validar:** medir toques para "dar data + prioridade + subtarefa" antes e depois.

### 4.5 Página: topo, tipo e visão

**Problema:** A8, A11, A13, A15.

**Topo da página (confiança alta, custo baixo):**

```
‹  CASA
   Mercado                        [Compartilhar]  […]
   Lista · Quadro · Matriz                         ← visões, como abas (a Matriz já é assim)
```

- Some o ícone de sliders do topo (a configuração vai para o "…"); o da captura fica, como criação avançada.
- **"…" agrupado:** *Arrumar* (renomear, ícone, mover, duplicar) · *Recursos* (campos, automações, lista de compras) · *Configurações da página* · *Exportar* · *Apagar*.
- **Compartilhar:** convidar (projeto), Enviar (cópia ou ao vivo), Publicar na Comunidade, Alunos.

**Tipo × visão (confiança média; custo médio):** no banco, só três tipos têm regra de verdade: `cards` (rotina: reinicia, dano de item, bônus de página), `habits` e `expenses`; `list` e `kanban` são iguais **[código]**. Proposta:

| Tipo (o que guarda; escolhido ao criar) | Visões (trocam a qualquer hora) |
|---|---|
| **Tarefas** (hoje: lista e kanban) | Lista · Quadro · Matriz |
| **Rotina** (hoje: cards; o treino é uma rotina na Academia) | Cards · Lista |
| **Hábitos** | Lista |
| **Gastos** | Geral · Gastos · Entradas (já existe, D255) |

Migração: `kanban` vira `list` com a visão Quadro lembrada; "Cards" muda de nome para **Rotina** (o que ela é), mantendo o desenho de cards. Esse é o ponto de menor certeza do documento; vale fazer depois do resto.

**Página ou lista? (A11)** Hoje o mesmo objeto se chama "página" em pasta e "lista" em projeto. **Recomendo "Lista" em tudo** (é como as pessoas falam; "lista de gastos", "lista de hábitos"); o treino continua "treino". O app ainda tem poucos usuários: é a hora mais barata de renomear. Custo: textos nos 3 idiomas, ajuda e E2E.

### 4.6 Um único lugar para criar

**Problema:** 6 formas de criar visíveis na tela Pastas; Modelos, lote e anotação fora do menu Novo.

**Recomendação (confiança alta, custo baixo):** o menu Novo vira o lugar de criar **tudo**:

```
Tarefa  T · Hábito  H · Anotação  A · Lista  L · Pasta  F · Projeto  J · Treino (com Bem-estar)
───
Várias de uma vez…   ·   A partir de um modelo…   ·   Com todos os campos…  Alt⇧N
```

Nas telas, um "+" por seção continua (é o atalho contextual), mas sai o botão "Nova pasta" duplicado e o globo sem rótulo vira o texto "Comunidade".

### 4.7 Glossário

| Hoje | Proposta |
|---|---|
| Página / Lista | **Lista** |
| Início + Hoje | **Hoje** |
| Caixa de entrada / Entrada | **Entrada** |
| Modo (botão) | **Foco e treino** |
| Modo academia | Recurso **Bem-estar** (já previsto no V10) |
| Gamificação Desligado / Leve / Completo | **Jogo**: Desligado / Discreto / RPG |
| Painel Simples / Completo | some (§4.4) |
| Cards | **Rotina** (§4.5) |
| Relacionados + Depende de | **Ligações** (§4.4) |

### 4.8 Recursos e introdução

**Problema:** A18; quem não usa treino, projeto ou jogo vê tudo isso mesmo assim.

**Recomendação (confiança média-alta, custo médio):** a pergunta "Vai usar para treinar?" (que já existe e funciona, D182) vira um passo da introdução: **"Para que você vai usar?"** (tarefas, sempre; hábitos; projetos com pessoas; treino e saúde; contas e gastos; jogo). A resposta liga os blocos, escolhe as posições da barra (4.1) e vira **Configurações → Recursos**. Quem já tem conta não responde: o que já usa fica ligado.

### 4.9 Uma "doca" para o que flutua

**Problema:** A16. **Recomendação (confiança alta):** o "+" entra na barra (4.1); timer e descanso viram uma **mini barra encaixada** acima da navegação, empurrando o conteúdo em vez de cobrir; o aviso "Desfazer" fica acima dela e, no Modo Treino, no topo.

---

## 5. Antes e depois, em toques (celular)

"Antes" medido no app; "depois" é o desenho proposto com a barra padrão (Hoje · Planejar · + · Espaços · Mais).

| Tarefa | Antes | Depois |
|---|---|---|
| Ver e marcar o que é para hoje | 1 | 1 |
| Abrir o calendário | 1 (Início) + rolar + 1 | 1 |
| Fazer a revisão semanal | **sem caminho** (só o aviso) | 2 |
| Buscar uma tarefa | **sem caminho** | 1 |
| Abrir a Biblioteca de exercícios | **sem caminho** (só por um exercício: 4) | 2 (Mais → Bem-estar) ou 1 com Treino na barra |
| Registrar peso e medidas | **sem caminho** | 2 |
| Ver amigos | 1 (Perfil) + rolar + 1 | 2 (Mais → Pessoas) |
| Abrir a loja do jogo | 1 (Perfil) + rolar + 1 | 2 (Mais → Jogo) ou 1 com Jogo na barra |
| Abrir o clã | 1 (Perfil) + rolar muito + 1 | 2 |
| Recuperar algo da lixeira | 1 (Perfil) + rolar muito + 1 | 3 (Mais → Configurações → Dados) |
| Dar data, prioridade e uma subtarefa | abrir + rolar 1 tela + 3 | abrir + 3 (tudo na primeira dobra) |
| Começar o treino de hoje | 2 (Pastas → treino) + Iniciar | 1 com Treino na barra + Começar |

---

## 6. Melhorias visuais (mantendo o "Caderno de bolso")

A identidade (papel, tinta, um acento, Fraunces + Instrument Sans + JetBrains Mono) é boa e diferente. A proposta é **cumprir melhor o que o `DESIGN.md` já pede**.

1. **O jogo como linha na Hoje** (o `DESIGN.md` já fala em "faixa estreita"); a arte fica no Jogo e na coluna do computador. Hoje são 3 linhas grandes no topo da Hoje e um cartão no Início [visto].
2. **Seções vazias não aparecem** na Hoje (ex.: "Anotações" e "Hábitos de hoje" vazios empurrando as tarefas, A5). O estado vazio que ensina fica para as telas próprias.
3. **Metadados da linha:** origem só quando ajuda (outra lista que não a da tela), com o marcador de cor da pasta e na fonte da interface; mono só para números, datas e atalhos (A20). "Hoje" dentro da seção "Hoje" é redundante.
4. **Botões:** desabilitado = contorno + texto apagado, sem acento (A17); escolhas de um entre poucos (Tema, Idioma, Jogo) como **controle segmentado**, para não parecerem etiquetas.
5. **Ícone sozinho só para o universal** (busca, sino, voltar, fechar, "+", "…"); o resto com texto (A7, A8).
6. **Jogo coerente:** retratos pintados das classes pelo `art/gerar.py` (hoje o herói é um emoji ao lado de bosses pintados), sem emojis em botões, e a conta do dano do Personagem num "Como funciona" recolhido (A19).
7. **Avisos como linha, não cartão** (academia, revisão: A18).

---

## 7. Ideias conceituais (menor certeza, maior alcance)

1. **"Hoje é o centro; o resto alimenta o Hoje."** Planejar decide datas, Espaços guarda, Pessoas traz o que foi atribuído, o Jogo recompensa. Critério para toda função nova: *"como isso aparece no Hoje?"*
2. **O app do tamanho do uso de cada pessoa** (Recursos + barra configurável). Os recursos continuam todos lá para quem liga.
3. **Jogo é camada, não tela.** Discreto = só a linha e os avisos; RPG = a linha vira porta para o hub, que pode ir para a barra.
4. **Agrupamentos de pessoas demais:** time, clã, grupo de treino, desafio e projeto são cinco jeitos de juntar gente. Curto prazo: tudo dentro de Pessoas, com uma frase explicando cada um. Longo prazo, a avaliar: um "Grupo" único com finalidades (trabalho, jogo, treino).
5. **Descoberta:** dica curta, uma vez, no lugar onde a função mora ("dica: cole várias linhas para criar várias tarefas"), e "Novidades" na Ajuda.

---

## 8. O que ainda falta para ter certeza, e como descobrir

| Dúvida | Como responder | Custo |
|---|---|---|
| Quanto cada função é usada de verdade (para ordenar a barra padrão, o "+ Adicionar" e o "Mais") | Rodar o Apêndice A em produção (só contagens) | 5 min do dono |
| As pessoas acham as coisas na estrutura nova? | **Teste de árvore**: 5 a 8 pessoas, 10 perguntas ("onde você acharia a lixeira? o calendário? a loja? seus amigos? o peso?"), com a navegação atual e a proposta em papel ou num protótipo clicável, contando acertos e tempo. Sem código | 1 dia |
| O painel novo é melhor? | 5 pessoas fazendo "dar data, prioridade e uma subtarefa" e "ligar uma tarefa a outra no projeto", contando toques, com o painel atual e um protótipo | 1 dia |
| Melhorou depois de pronto? | Voltar a rodar esta auditoria (contagem de controles, funções sem caminho, alturas) e o `e2e/ux-tour.spec.ts` com tempo e toques | automático |

**O que já dá para fazer sem esperar o teste:** os itens de confiança alta e custo baixo (UX1 a UX4). Eles corrigem problemas vistos, não mudam a estrutura e não fecham nenhuma porta.

---

## 9. Perguntas para o dono e plano

### Perguntas

| # | Pergunta | Recomendação |
|---|---|---|
| UX-1 | Juntar Início e Hoje numa tela "Hoje" (o acampamento vira a capa do Jogo)? | Sim |
| UX-2 | Barra do celular com 5 posições (Hoje · 2 escolhidas · + · Mais) e "Mais" como índice completo? | Sim |
| UX-3 | Separar Configurações, Perfil, Jogo e Pessoas? | Sim |
| UX-4 | Painel por propriedades + "Adicionar", sem o seletor Simples/Completo? Ou só reordenar por enquanto? | Reordenar já (UX4); o painel novo depois do teste |
| UX-5 | Juntar "Depende de" e "Relacionados" em "Ligações", no alto em projeto? | Sim |
| UX-6 | "Página" → "Lista" em toda a interface? | Sim, agora que há poucos usuários |
| UX-7 | Kanban vira visão "Quadro"; Cards vira tipo "Rotina"? | Sim, por último |
| UX-8 | Nomes do jogo: Desligado / Discreto / RPG? | Sim |
| UX-9 | Rodar o Apêndice A em produção e fazer o teste de árvore antes do UX7? | Sim |

### Plano (ids UX1 a UX14; aprovado pelo dono em 22/10, D256)

| Id | O que | Confiança | Custo | Depende |
|---|---|---|---|---|
| **UX1** | Caminhos que faltam: busca no topo do celular; Biblioteca, Peso e Estatísticas na tela Pastas do celular; botão fixo da Revisão (no Início/Hoje e na Entrada) | Alta | Baixo | — |
| **UX2** | Rodapé da lateral com 3 alvos (avatar com menu, sino, ajuda) | Alta | Baixo | — |
| **UX3** | Rótulos e nomes: sliders do topo da página → "…"; globo → "Comunidade"; "Completo" do painel ≠ do jogo; "Modo academia" fora de "Barra lateral"; "treino"/"página" coerentes; "Salvar" desabilitado; emojis fora dos botões | Alta | Baixo | — |
| **UX4** | Painel: reordenar (subtarefas para cima; Depende de em primeiro só em projeto; Quem vê e Anexos para o fim) | Alta | Baixo | — |
| **UX5** | Menu Novo completo; um "Nova pasta" só | Alta | Baixo | — |
| **UX6** | Doca: mini barra do timer encaixada; aviso acima dela | Alta | Médio | — |
| UX7 | Configurações, Perfil, Jogo e Pessoas separados | Alta | Médio | UX-3, teste de árvore |
| UX8 | Hoje única + Planejar; barra de 5 posições configurável; "Mais" | Média-alta | Alto | UX-1, UX-2, teste de árvore |
| UX9 | Topo da página com Compartilhar, "…" agrupado e visões em abas | Alta | Médio | — |
| UX10 | Ligações (Depende de + Relacionados) | Média-alta | Médio | UX-5 |
| UX11 | Painel por propriedades + Adicionar | Média | Alto | UX-4, teste do painel |
| UX12 | Recursos e introdução "Para que você vai usar?" | Média-alta | Médio | UX8 |
| UX13 | "Página" → "Lista"; Kanban → Quadro; Cards → Rotina | Média | Alto | UX-6, UX-7 |
| UX14 | Retratos das classes; "Como funciona" no Personagem | Média | Médio | — |

Ordem: **UX1 → UX2 → UX3 → UX4 → UX5 → UX6** (rápidos e seguros) · Apêndice A + teste de árvore · **UX7 → UX9 → UX8 → UX10** · teste do painel · **UX11 → UX12 → UX13 → UX14**.

Cada item segue as regras de sempre: Ajuda nos 3 idiomas, i18n, E2E (os testes usam muito `openTab` e os nomes das abas; a mudança da barra pede ajustar o helper) e o registro em STATUS, PENDENTES e DECISIONS.

---

## 10. Fontes externas

- Material Design, barra de navegação: de 3 a 5 destinos ([material.io](https://material.io/components/bottom-navigation); resumo do M3 no [SAP Fiori para Android](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-bar/usage)).
- Todoist, barra de navegação personalizável, com "Browse" como índice e as abas escolhidas saindo dele ([Todoist Help](https://www.todoist.com/help/articles/customize-the-todoist-navigation-bar-L4qpkI0xj)).
- TickTick, barra de abas personalizável (Calendário, Pomo, Hábitos, Busca): [blog, 2018](https://blog.ticktick.com/2018/10/31/ticktickcustomtabbar/) e [TickTick 5.0, hábitos na barra](https://blog.ticktick.com/?p=37); análise mais recente: [AppleInsider, 2023](https://appleinsider.com/articles/23/01/10/ticktick-6420-review-prioritized-to-do-list-with-focus-timer). As fontes do TickTick são antigas; os menus atuais podem ter mudado.

---

## Apêndice A — Uso real (para o dono rodar no servidor)

Só contagens: nenhum título, texto, nome ou e-mail sai do banco. Testada no banco local (os números de lá são das contas de teste automático e não valem como uso). No servidor de produção, com o container do banco de lá:

```bash
docker exec -i <container do banco> psql -U postgres -d postgres < uso-real.sql
```

```sql
-- Uso real por função, nos últimos 30 dias. Só contagens.
\pset footer off
\echo '== Contas'
select count(*) as contas,
       count(*) filter (where game_mode = 'off') as jogo_desligado,
       count(*) filter (where game_mode = 'light') as jogo_leve,
       count(*) filter (where game_mode = 'full') as jogo_completo,
       count(*) filter (where gym_enabled) as academia_ligada,
       count(*) filter (where ui_prefs ? 'review') as ja_abriu_revisao
from public.profiles;

\echo '== Atividade por tipo (ledger de XP, 30 dias)'
select kind, count(distinct user_id) as pessoas, count(*) as eventos
from public.xp_events where created_at > now() - interval '30 days' and not reverted
group by kind order by eventos desc;

\echo '== Funções: pessoas distintas que usaram em 30 dias (e quantas vezes)'
select 'tarefa criada' f, count(distinct created_by) pessoas, count(*) vezes from public.tasks where created_at > now() - interval '30 days'
union all select 'subtarefa criada', count(distinct created_by), count(*) from public.tasks where parent_task_id is not null and created_at > now() - interval '30 days'
union all select 'tarefa com prioridade', count(distinct created_by), count(*) from public.tasks where priority > 0 and created_at > now() - interval '30 days'
union all select 'tarefa com data', count(distinct created_by), count(*) from public.tasks where due_date is not null and created_at > now() - interval '30 days'
union all select 'tarefa recorrente', count(distinct created_by), count(*) from public.tasks where recurrence is not null and created_at > now() - interval '30 days'
union all select 'anotação', count(distinct user_id), count(*) from public.notes where updated_at > now() - interval '30 days'
union all select 'meu dia', count(distinct user_id), count(*) from public.my_day where created_at > now() - interval '30 days'
union all select 'tempo registrado', count(distinct user_id), count(*) from public.time_entries where created_at > now() - interval '30 days'
union all select 'modelo salvo', count(distinct owner_id), count(*) from public.user_templates where created_at > now() - interval '30 days'
union all select 'comentário', count(distinct author_id), count(*) from public.comments where created_at > now() - interval '30 days'
union all select 'reação', count(distinct user_id), count(*) from public.reactions where created_at > now() - interval '30 days'
union all select 'automação criada', count(distinct created_by), count(*) from public.automation_rules where created_at > now() - interval '30 days'
union all select 'página enviada', count(distinct owner_id), count(*) from public.page_shares where created_at > now() - interval '30 days'
union all select 'dependência', count(distinct created_by), count(*) from public.task_dependencies where created_at > now() - interval '30 days'
union all select 'relacionado', count(distinct created_by), count(*) from public.relations where created_at > now() - interval '30 days'
union all select 'gasto lançado', count(distinct created_by), count(*) from public.expenses where created_at > now() - interval '30 days'
union all select 'treino (Modo Treino)', count(distinct started_by), count(*) from public.workout_sessions where started_at > now() - interval '30 days'
union all select 'recompensa criada', count(distinct user_id), count(*) from public.user_rewards where created_at > now() - interval '30 days'
union all select 'post na comunidade', count(distinct author_id), count(*) from public.community_posts where created_at > now() - interval '30 days'
union all select 'amizade aceita', count(*) * 2, count(*) from public.friendships where status = 'accepted';

\echo '== Timers por tipo (30 dias)'
select kind, count(distinct user_id) pessoas, count(*) vezes
from public.timers where started_at > now() - interval '30 days' group by kind order by vezes desc;

\echo '== Páginas por tipo e quantas contas têm cada tipo'
select p.view_type, count(*) paginas, count(distinct f.owner_id) contas
from public.pages p join public.folders f on f.id = p.folder_id
where not p.is_inbox group by p.view_type order by paginas desc;

\echo '== Pastas x projetos'
select kind, count(*) pastas, count(distinct owner_id) contas from public.folders where not is_inbox group by kind;
```

O que olhar no resultado: o que quase ninguém usa (candidato a ir para o "+ Adicionar" ou para o "Mais"); quantas contas ligaram a academia e o jogo RPG (define o padrão da barra); se "relacionado" é perto de zero (confirma o §4.4); quantas contas têm projeto (define se Pessoas merece posição na barra).

## Apêndice B — Refazer a auditoria

O roteiro desta revisão (Playwright: conta nova, dados de exemplo, árvore de acessibilidade e captura de 16 telas nos dois tamanhos) ficou fora do repositório, na pasta temporária da sessão. Se o dono quiser, ele entra como `e2e/ux-audit.spec.ts` (só com `UX_AUDIT=1`, como o `ux-tour`), para medir o "antes e depois" de cada item da fase U.
