# Tasker — Escopo V4 (instruções para o Claude Code)

Este documento **complementa** `ESCOPO.md`, `ESCOPO_V2.md` e `ESCOPO_V3.md`. Onde houver conflito, **o mais recente vence** (V4 > V3 > V2 > V1).

Antes de começar: releia `CLAUDE.md`, `DECISIONS.md` e `docs/STATUS.md`. Ao concluir cada item, atualize `docs/STATUS.md`; decisões novas vão em `DECISIONS.md`. Texto novo nasce nos 3 idiomas (pt-BR, en, es); atalho novo entra no registro central e na Ajuda. Cada bloco abaixo vira uma fase no `docs/CRONOGRAMA.md`, com um commit por tarefa.

Origem: pedidos do dono do projeto em 14/10/2026, depois de usar o app no dia a dia ("eu vou ser um heavy user dessa aplicação").

---

## 1. Jogo: bosses, dano e progressão

### 1.1 Boss diário (novo)

- Além do boss semanal (solo e do clã), existe um **boss diário**: nasce à meia-noite no fuso do perfil e vai até o fim do dia.
- HP calibrado para um dia normal de uso (ex.: 5 a 8 tarefas comuns), crescendo com o nível do boss diário (bosses diários derrotados), como os outros.
- Recompensa menor que a do semanal (XP, ouro e chance de item), mas que conta para conquistas e sequências próprias ("derrotou o boss diário N dias seguidos").
- Todo golpe vale para os bosses ativos ao mesmo tempo (diário, semanal e o do clã), como já acontece com o semanal e o do clã.
- Aparece no Início, na Hoje e no Personagem, acima do semanal.

### 1.2 Calibragem do dano

- Relato: "antes estava muito alto, agora está muito baixo". O boss semanal pede uns 5 dias de uso, o que faz sentido, mas o golpe individual parece fraco.
- Revisar a fórmula (`_attack`, `lib/character.ts`) com números de um usuário intenso: o golpe deve "sentir" (um golpe médio tira algo perceptível da barra do boss diário) sem derrubar o semanal no primeiro dia.
- Mostrar no aviso de conclusão o dano no boss diário e no semanal.
- A mudança é feita nos dois espelhos (banco e app), com os mesmos casos de teste.

### 1.3 Limites anti-farm (manter, explicar)

- **Como está e fica:** cada hábito "bom e ruim" vale XP, dano e ouro em até **10 "+" por dia** (`habitPlusDailyCap`). Tarefas concluídas em até 5 minutos depois de criadas somam no máximo **50 XP e 20 de dano por dia**, e em menos de 30 segundos valem 0 XP (o golpe no boss continua valendo).
- Isso explica por que "alguns hábitos param de dar XP e dano": não tem a ver com o nível 1. Decisão do dono: **manter assim por enquanto**.
- Novo: quando um limite é atingido, o aviso de conclusão diz isso ("limite diário deste hábito atingido") em vez de simplesmente não dar nada.

### 1.4 Rebirth (renascer)

- O personagem pode **renascer** a partir de um nível mínimo (proposta: 20): o nível volta a 1 e os níveis de dificuldade dos bosses (solo, diário; o do clã não) voltam ao início.
- O que fica: conquistas, itens da loja e do inventário, ouro (a decidir: fica todo ou uma parte), histórico.
- O que se ganha: contador de renascimentos visível no perfil e no personagem, um **bônus permanente pequeno por renascimento** (ex.: +5% de XP ou de dano, com teto) e conquistas próprias.
- Confirmação forte: diálogo que explica o que se perde, pedindo para digitar o nome do personagem ou "renascer".
- No servidor: uma RPC que zera o que precisa e grava o evento no ledger (para auditoria e para as conquistas).

---

## 2. Conquistas

- **Raridade** em todas as conquistas: comum, incomum, rara, épica e lendária, com cor e selo próprios (sem depender só da cor: o nome da raridade aparece escrito). A raridade sai da dificuldade real; se der, mostrar a porcentagem de jogadores que têm a conquista.
- **Muitas conquistas novas**, pensadas para uso intenso. As 33 de hoje continuam. Faixas novas (exemplos):
  - Volume: 2.500, 5.000, 10.000 e 25.000 tarefas; 1.000 e 5.000 hábitos marcados.
  - Sequência: 30, 60, 100, 180 e 365 dias.
  - Bosses: 10, 50 e 100 bosses semanais; 30, 100 e 365 bosses diários; boss diário N dias seguidos; derrotar o boss do clã como maior contribuidor.
  - Níveis: 30, 40, 50, 75 e 100; primeiro renascimento, 5 e 10 renascimentos.
  - Projetos e times: concluir 10 e 50 projetos; 100 tarefas delegadas concluídas; criar um time; time com 10 pessoas.
  - Árvore e fluxo: concluir uma árvore de 5 níveis; 100 tarefas com estimativa; terminar um projeto antes do prazo.
  - Secretas: algumas escondidas até serem conquistadas (com dica vaga).
- Tela de conquistas com filtro por raridade e por categoria, e o progresso até a próxima de cada faixa.

---

## 3. Personagem, inventário e configurações

- **Inventário** (tela própria): tudo o que a pessoa tem (itens da loja, drops de boss, cosméticos), com filtro por espaço (cabeça, corpo, acessório…), raridade e onde equipar. A loja continua sendo o lugar de comprar; o inventário é o lugar de ver e equipar.
- **Separar configurações da tela de Personagem**: o Personagem mostra classe, atributos, habilidades, bosses e equipamento atual; as configurações (ligar/desligar o jogo, avisos, idioma, tema, privacidade) ficam só no Perfil/Configurações.
- Itens ganham raridade (a mesma escala das conquistas).

---

## 4. Anexos

- Anexar arquivos e imagens a tarefas (e, depois, a comentários): foto do recibo, PDF, print.
- Armazenamento no Supabase Storage, com RLS igual à da tarefa (quem vê a tarefa vê o anexo; quem edita pode anexar e remover).
- Limites: tamanho por arquivo (proposta: 10 MB) e espaço por conta (a definir junto com os planos da seção 6).
- Pré-visualização de imagens no painel da tarefa; os outros arquivos como link para baixar.
- No celular: câmera e galeria. Offline: o anexo fica na fila e sobe quando a conexão voltar.
- Prioridade: **cedo** ("anexos poderíamos adicionar logo").

---

## 5. Página de entrada (antes do login)

- Quem abre o app sem conta vê uma **página de apresentação** listando as funcionalidades (captura rápida, projetos e times, árvore de tarefas, offline, jogo) com capturas de tela, e só então o botão de entrar ou criar conta.
- Rápida e acessível, nos 3 idiomas, com o visual do app (`docs/DESIGN.md`).
- Os links de convite (projeto, time, clã) continuam abrindo direto a prévia do convite.

---

## 6. Monetização e assinaturas

- **Planos (tipos de assinatura):** proposta inicial de grátis, pessoal e time. O que muda entre eles fica a definir (ex.: número de projetos ou de pessoas por time, espaço de anexos, histórico, automações).
- **Assinaturas:** mensal e anual, com **validade** (início, fim, renovação, período de carência quando o pagamento falha, cancelamento que vale até o fim do período pago).
- **Membro founder:** quem apoia no início ganha o selo de founder (permanente, visível no perfil) e condições especiais (ex.: preço travado, plano vitalício ou benefícios exclusivos), a definir.
- Pagamentos por um provedor externo (Stripe na web; compras dentro do app nas lojas, que exigem as regras da Apple e do Google). O servidor é a fonte de verdade do plano (webhook do provedor → tabela de assinaturas → permissões).
- O que já é de graça hoje não deixa de ser sem aviso; os limites dos planos entram junto com um plano de migração para quem já usa.

---

## 7. Acabamento visual (pedidos já feitos em 14/10/2026)

Já feitos no commit `9e03581`: telas mais largas no computador (listas até 1152 px), barra lateral redimensionável, espaço entre a contagem do hábito bom/ruim e o nome da página, e respiro no hover dos bosses no Início. Continuar revendo as telas no computador para aproveitar a largura (duas colunas onde fizer sentido).

## 7.1 Sessão que sobrevive ao servidor fora do ar (pedido do dono em 17/10/2026)

Hoje, quando o APK não consegue falar com o servidor (servidor desligado, reiniciando, túnel caído), o app **desloga** e a pessoa precisa entrar de novo. O certo:

- **Não sair da conta por falta de servidor.** Só sai por "Sair" ou quando o servidor responde de fato que a sessão acabou (senha trocada, conta apagada, sessão revogada). Erro de rede, tempo esgotado, 5xx ou túnel fora do ar **não** contam.
- **Continuar usando com o que está no aparelho:** o banco local (PowerSync) e a fila já existem (D86). Criar, marcar e editar seguem gravando no aparelho, com o aviso "sem conexão com o servidor".
- **Sincronizar sozinho quando o servidor voltar:** renovar o token assim que der e enviar a fila, sem pedir login. Token vencido sem servidor não é motivo para sair: espera e tenta de novo (com intervalo crescente).
- **Mostrar o estado:** distinguir "sem internet" de "servidor fora do ar", e "sessão expirada, entre de novo" (só quando o servidor disse isso).
- Aceite: com o servidor parado por 1 h (mais que a validade do token), o app aberto e fechado várias vezes continua logado e usável; ao religar o servidor, tudo o que foi feito sobe sem login.

---

## 8. Decisões em aberto (perguntar quando chegar a hora)

1. Boss diário: HP base e recompensa.
2. Rebirth: nível mínimo, o que acontece com o ouro, tamanho e teto do bônus.
3. Raridades: critério (dificuldade fixa ou % de jogadores).
4. Anexos: limite por arquivo e por conta antes de existirem os planos.
5. Planos: o que cada um libera, preços, e o que o founder ganha.
6. Provedor de pagamento e se haverá compra dentro do app nas lojas desde o início.

## 9. Ordem sugerida

Anexos (4) → boss diário e calibragem do dano (1.1 a 1.3) → conquistas com raridade (2) → inventário e separação das configurações (3) → rebirth (1.4) → página de entrada (5) → monetização (6). Fica depois das fases da V3 já planejadas (H a M), a não ser que o dono do projeto peça para adiantar (anexos é candidato).
