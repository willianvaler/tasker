# Questlist — Escopo V10: amigos, visibilidade, comunidade e o bloco Bem-estar (instruções para o Claude Code)

Pedido do dono em 20/10/2026:

> "vamos adicionar a possibilidade de adicionar amigos, por nick, por email e por link. adicionar marcadores de tarefas publicas, tarefas privadas e tarefas visiveis somente para amigos. no montar times, treinos e afins (tudo que tiver grupos e times), vamos adicionar a opção de vincular diretamente da lista de amigos. adicionar uma aba de comunidade onde pessoas possam compartilhar projetos, treinos, modelos, templates."

> "cardápio seria para um bloco de dieta, seria um complemento ao academia, um bloco fitness (preciso de um nome mais amigável) que agruparia academia, dieta e vida saudável -> adicionar no escopo_v10"

Em conflito com escopos anteriores, este vence. Decisões tomadas sem o dono ficam marcadas com **(padrão)** e voltam na tabela do §7.

## 1. Amigos

- **Nick** (`profiles.username`): único, 3 a 20 caracteres, letras minúsculas, números, `_` e `.`; sem diferenciar maiúsculas. Escolhido no Perfil; a conta que ainda não tem recebe uma sugestão a partir do nome (`ana.souza`, `ana.souza2`). O nome de exibição continua livre.
- **Adicionar por nick:** busca exata (`@ana.souza`) mostra a pessoa (nome, nick, avatar) e o botão **Pedir amizade**.
- **Adicionar por e-mail:** o e-mail exato envia o pedido se houver conta; a resposta é sempre a mesma ("se houver uma conta com esse e-mail, o pedido foi enviado"), para não revelar quem usa o app.
- **Por link:** cada pessoa tem um link de amizade (`/amigo/<token>`, fora do login como os convites). Quem abre e entra vira amigo na hora: quem compartilhou o link já concordou. O link pode ser trocado (o antigo para de valer).
- **Pedido:** aceitar ou recusar; avisos `friend_request` e `friend_accepted` (no 🔔 e no push). Desfazer amizade a qualquer hora, sem avisar a outra pessoa. Bloquear fica para depois.
- **Tela Amigos** (`/amigos`, na barra lateral, no Perfil e na paleta): amigos, pedidos recebidos e enviados, adicionar por nick ou e-mail, meu link.
- Dados: `friendships` (par ordenado de pessoas, estado, quem pediu, datas), `friend_links` (token por pessoa). RLS: cada um vê só as próprias linhas; tudo muda por RPC. Entra na exportação e na exclusão de conta (LGPD) e na política de privacidade (dado novo: o nick e a lista de amigos).

## 2. Visibilidade das tarefas

- Marcador por tarefa: **Privada** (padrão: só quem já vê a pasta), **Amigos** (os amigos também veem) e **Pública** (qualquer pessoa com conta vê).
- Onde amigos e público veem: no **perfil da pessoa** (`/perfil/<nick>`): em andamento, concluídas nos últimos 7 dias e as próximas, com título, data, estado e nome da página. Não vê notas, anexos, comentários nem quem mais está na tarefa.
- **(padrão)** Só em pastas pessoais. Em projeto vale quem é do projeto: uma tarefa do projeto não sai dele pelo marcador de uma pessoa.
- No painel da tarefa (seção Visibilidade) e na linha (🌐 pública, 👥 amigos; privada não mostra nada). Na escrita rápida: `+publica`, `+amigos` (e em inglês e espanhol).
- **(padrão)** A leitura de fora não abre a RLS de `tasks`: passa por uma RPC `security definer` (`profile_tasks`) que devolve só as colunas acima e confere amizade e marcador. Assim nenhuma consulta de tarefas fica mais lenta (D70) e nada além do título vaza.
- Página inteira com visibilidade (todas as tarefas dela) fica para depois.

## 3. Vincular da lista de amigos

Em tudo que tem grupo, um seletor **Amigos** ao lado do link de convite:

- **Projeto** (Pessoas/Compartilhar) e **grupo de treino** (é um projeto, D186): adiciona como membro com o cargo escolhido (padrão Colaborador).
- **Time** (Pessoas do time): adiciona como membro.
- **Clã:** adiciona se o amigo não estiver em outro clã.
- **Treinar junto agora** e **desafios:** os amigos que já são do grupo aparecem primeiro; os outros, com "adicionar ao grupo".
- **(padrão)** Adicionar amigo é **direto** (a amizade já é o consentimento), com aviso `added_to_group` para quem foi adicionado, que pode sair quando quiser. Só quem já pode convidar naquele grupo (`member.invite` ou Admin do time) vê o seletor.

## 4. Comunidade

- Aba **Comunidade** (barra lateral; no celular, no alto da aba Pastas e na paleta): o que as pessoas publicaram, com busca, filtro por tipo (**Projeto**, **Treino**, **Cardápio**, **Lista/Modelo**, **Rotina de hábitos**) e idioma, ordenado por mais usados ou mais novos.
- **Publicar:** no menu de uma pasta, projeto, página (treino, cardápio, lista) ou de um modelo salvo → **Publicar na comunidade**: título, descrição curta, tipo, ícone. Vai uma **cópia** da estrutura no formato dos modelos (`user_templates.data`, D46): páginas, tarefas, subtarefas, plano de séries, recorrência, campos. **Não vai:** pessoas, responsáveis, comentários, anexos, gastos, datas concretas (viram relativas ou somem), histórico.
- **Usar:** "Usar" cria uma pasta com a cópia na conta de quem usou (pela mesma RPC dos modelos, `create_from_template`); conta um uso. **Curtir** (❤️) e contagem.
- O autor aparece pelo nick (link para o perfil); pode editar o texto e despublicar. **Denunciar** guarda o motivo; **(padrão)** com 3 denúncias de pessoas diferentes, a publicação some da lista até alguém do projeto revisar (não há moderação humana ainda).
- Dados: `community_posts` (autor, tipo, título, descrição, ícone, idioma, dados da cópia, usos, curtidas, oculto), `community_likes`, `community_reports`. Leitura para qualquer conta logada; escrita só do autor e por RPC.

## 5. Bloco Bem-estar (academia + dieta + vida saudável)

- **Nome (padrão): Bem-estar** (en *Wellness*, es *Bienestar*). Outras opções: Saúde em dia, Corpo & Mente, Vida saudável, Em forma. O dono escolhe (§7).
- Um bloco de sistema na barra lateral e na aba Pastas (no lugar do bloco Academia, D182), com três partes:
  - **Treino:** o que hoje é a Academia (treinos, grupo de treino, Modo Treino, desafios, V6 e V7).
  - **Dieta:** cardápios (página de lista ou cards em que cada tarefa é uma refeição/prato e as subtarefas ou as notas são os ingredientes, D224), **lista de compras gerada** do cardápio (PB4), cardápio da semana com reinício semanal, refeições como hábito ("comer fruta", "beber água"). Página de cardápio enviada por nutricionista ao paciente (página enviada, D133).
  - **Vida saudável:** hábitos de sono, água, passos, meditação, peso e medidas (V6 AC7), e o que vier das integrações (V7: Health Connect, Apple Saúde).
- Ligar o bloco continua sendo a pergunta "Vai usar para treinar?" (AC1.9), ampliada: "Quer organizar treino, dieta ou hábitos saudáveis?" com as três opções.
- Migração: a pasta `is_gym` passa a ser a parte Treino do bloco; nada se perde nem muda de lugar para quem já usa.

## 6. Ordem sugerida

| Id | Tarefa | Depende de |
|---|---|---|
| AM1 | Nick no perfil (único, sugestão, troca), `friendships`, `friend_links`, RPCs (pedir, aceitar, recusar, desfazer, link), avisos, RLS, pgTAP, LGPD | — |
| AM2 | Tela Amigos e página do link `/amigo/<token>`; nick no Perfil | AM1 |
| AM3 | Vincular amigo em projeto, grupo de treino, time e clã | AM1 |
| VI1 | Visibilidade da tarefa (coluna, painel, linha, escrita rápida) e `profile_tasks` | AM1 |
| VI2 | Perfil da pessoa `/perfil/<nick>` | VI1 |
| CM1 | Comunidade: tabelas, publicar, usar, curtir, denunciar, RLS, pgTAP | AM1 |
| CM2 | Aba Comunidade (busca, filtros) e "Publicar" nos menus | CM1 |
| BE1 | Bloco Bem-estar: nome, as três partes, migração da Academia | resposta do dono (V10-1) |
| BE2 | Dieta: cardápio da semana, refeições, lista de compras no bloco | BE1 |
| BE3 | Vida saudável: hábitos prontos, peso e medidas (AC7) | BE1 |

Cada tarefa: Ajuda nos 3 idiomas, i18n, E2E e o registro de sempre (STATUS, PENDENTES, FEITOS, DECISIONS).

## 7. Decisões do dono

| # | Pergunta | Padrão até a resposta |
|---|---|---|
| V10-1 | Nome do bloco que junta treino, dieta e vida saudável | **Bem-estar** |
| V10-2 | Amigo entra direto no grupo ou recebe convite para aceitar? | Direto, com aviso (§3) |
| V10-3 | Tarefa pública: qualquer conta vê, ou também quem não tem conta (perfil aberto na internet)? | Só quem tem conta |
| V10-4 | Visibilidade também em tarefas de projeto? | Não: só pastas pessoais (§2) |
| V10-5 | Moderação da comunidade: ocultar com 3 denúncias basta por enquanto? | Sim (§4) |
