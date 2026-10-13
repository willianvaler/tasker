# Decisões

Registro das decisões de produto e de técnica. A mais nova fica no fim. Formato: data, decisão, motivo.

## 2026-10-08 — Fase 0

**D1. Expo (React Native) no lugar de Next.js + PWA.** Um código para Android, iOS e web (react-native-web). O uso principal é no celular e um app nativo de verdade (haptics, notificações, ícone na tela) pesa mais que um PWA. Detalhes da stack na seção 2 do `ESCOPO.md`.

**D2. Supabase local primeiro.** Desenvolvimento com `supabase start` (Docker/Podman). O projeto na nuvem fica para quando formos publicar. Migrações em SQL versionado em `supabase/migrations/`.

**D3. Web como SPA (`web.output = "single"`).** O app inteiro fica atrás do login e não precisa de SEO. Com renderização estática, o código rodaria no Node na hora do export, sem `localStorage` para a sessão. Reavaliar se houver página pública (ex.: landing ou convite sem login).

**D4. Sessão no nativo com o `localStorage` do `expo-sqlite`; na web, o `localStorage` do navegador.** É o que o guia do Expo para Supabase recomenda. Escolha por arquivo de plataforma (`src/lib/storage.ts` e `storage.web.ts`).

**D5. NativeWind 4 (Tailwind 3).** É a versão estável. O NativeWind 5 (Tailwind 4) ainda é release candidate. Cores do tema em variáveis CSS (`src/global.css`), com o modo escuro seguindo o sistema por enquanto. A troca manual de tema entra na tela de Configurações.

**D6. React Native Reusables fica para quando a UI crescer.** Na Fase 0 só existem `Button` e `Input` próprios, em `src/components/ui/`. Os componentes do Reusables (estilo shadcn) entram pela CLI dele conforme a necessidade, na mesma pasta.

**D7. O cliente só grava colunas permitidas (privilégio por coluna no Postgres).** Além da RLS, `authenticated` só tem `insert`/`update` nas colunas editáveis. Ficam de fora: `tasks.folder_id` (trigger), `tasks.status`/`completed_*` (RPC `complete_task`/`uncomplete_task` da Fase 1, que vão calcular XP na Fase 3), `profiles.xp`/`level`/`coins`/`streak*`, `folders.owner_id`/`is_inbox`/`is_shared`, `pages.is_inbox`. Mexer nisso direto dá erro `42501`.

**D8. Caixa de entrada = pasta de sistema (`folders.is_inbox`) com uma página (`pages.is_inbox`).** Criadas no cadastro pelo trigger `handle_new_user`. Assim a Caixa de entrada é uma página como qualquer outra (mesma RLS, mesmo componente), sem caso especial nas tarefas. Não pode ser apagada nem movida, e a pasta não aparece na árvore de pastas.

**D9. Membros ficam na pasta raiz.** Subpasta não tem membros próprios: `is_folder_member()` resolve pela raiz (`folder_root()`). Mudar uma pasta de lugar (`parent_id`) não é permitido por enquanto, porque mudaria quem tem acesso.

**D10. Subtarefa tem um nível só e fica na página da mãe.** O trigger força o `page_id` da subtarefa a ser o da mãe e recusa subtarefa de subtarefa. Mover a mãe leva as subtarefas.

**D11. IDs gerados no cliente (`expo-crypto` `randomUUID`).** Para a atualização otimista: a tarefa aparece na lista com o id definitivo antes do servidor responder.

**D12. Testes:** Jest (`jest-expo`) para unidade, pgTAP (`supabase test db`) para RLS e regras do banco, Playwright para E2E na web (perfis celular e desktop). Maestro (E2E no nativo) entra quando houver build nativo.

## 2026-10-09 — Fase 1

**D13. Vencimento é data sem hora (`tasks.due_date date`), no lugar do `due_at timestamptz` do rascunho.** "Hoje" e "Atrasadas" comparam datas de calendário no fuso do perfil, sem conta de horário. Horário volta junto com lembretes (backlog).

**D14. Etiquetas como `tasks.labels text[]`** (com índice GIN), no lugar das tabelas `labels`/`task_labels` do rascunho. Mover tarefa entre pastas e projetos compartilhados não precisa remapear nada. O banco normaliza (minúsculas, sem `#`, sem repetidas, até 20 por tarefa). Se um dia precisar de cor por etiqueta, cria-se uma tabela de cores por pasta sem mexer nas tarefas.

**D15. Dia da semana na sintaxe rápida conta o próprio dia.** "sexta" escrito numa sexta vence hoje. "15/10" que já passou vai para o ano seguinte. Só nomes completos viram data ("sexta", "sexta-feira"); abreviações como "ter" e "qua" são palavras comuns e ficam no título. Abreviações valem só na recorrência (`/seg,qua,sex`). Uma preposição logo antes da data ("para sexta", "até 15/10") sai junto.

**D16. Toda criação passa pelo RPC `create_tasks_batch`, inclusive a de uma tarefa só.** Um caminho só para lote e captura rápida; `[x]` do lote já nasce concluído (o status não é gravável pelo cliente, D7). Limite de 500 itens por chamada. O rate limit de verdade fica para quando houver Edge Functions.

**D17. `complete_task` / `uncomplete_task` só mudam o status nesta fase.** O histórico (`task_completions`) entra na Fase 2 e o XP na Fase 3, dentro dessas mesmas funções.

**D18. Recorrência é só guardada na Fase 1** (`tasks.recurrence`, formato do parser: `{type: 'daily'|'weekly'|'monthly'}` ou `{type: 'weekdays', days: [0-6]}`). Gerar a próxima ocorrência é da Fase 2.

**D19. Arrastar para reordenar fica para a Fase 2**, junto com a view de cards. Na Fase 1 a ordem é a de criação; mover entre páginas é pelo painel da tarefa.

**D20. Offline v1 = cache do TanStack Query persistido** (`questlist-cache` no armazenamento local, 7 dias) + campos e botões desativados sem conexão. Sair da conta apaga o cache e as preferências.

**D21. Tema segue o sistema.** Trocar manualmente exige `darkMode: 'class'` no NativeWind 4, que na web só aplica a classe `dark` no `<html>` e não trata a opção "Sistema". Fica para a tela de Configurações (Fase 6), com a opção "Sistema" obrigatória.

**D22. Busca global e as visões "Próximos 7 dias", "Atribuídas a mim" e "Concluídas" ficam para depois.** A Fase 1 entrega as três telas pedidas no escopo (Hoje, Caixa de entrada, Página).

**D23. Hospedagem da web precisa de regra de SPA:** qualquer rota (`/inbox`, `/page/...`) devolve o `index.html`. Sem isso, recarregar fora da raiz dá 404. O E2E usa `serve --single` pelo mesmo motivo.

## 2026-10-10 — Fase 2

**D24. Ciclos pelo "tipo de ciclo" da tarefa, calculados no banco.** Hábitos seguem a recorrência de cada item (diário por padrão; semanal; mensal; dias da semana = ciclo diário). Cards e listas seguem o `reset_cycle` da página (diário, semanal com a semana ISO começando na segunda, ou manual com contador `pages.manual_cycle`). O resto nunca expira. A chave do ciclo é calculada no fuso do dono da pasta e guardada em `tasks.done_cycle_key` ao concluir. `refresh_cycles()` reabre o que ficou num ciclo passado: roda pelo `pg_cron` a cada 15 minutos e o app chama antes de ler as listas, então a virada aparece na hora.

**D25. Tarefa recorrente comum (fora de hábitos e de páginas com reset) é uma linha só.** Concluir grava o histórico com a data anterior e avança o `due_date` para a próxima ocorrência; a tarefa continua aberta. Desfazer apaga essa conclusão e volta a data. A próxima data nunca cai em hoje ou antes, para concluir atrasado não empilhar ocorrências. O cálculo existe no banco (`next_due_date`) e no app (`nextDueDate`, só para a atualização otimista), com os mesmos casos de teste nos dois.

**D26. Histórico em `task_completions`** (uma linha por tarefa e ciclo, `unique(task_id, cycle_key)`). Desmarcar apaga a conclusão do ciclo atual. A sequência (streak) dos hábitos é calculada no app a partir desse histórico (`habitStreak`); o período atual ainda sem marcação não quebra a sequência. A Fase 3 vai somar o XP nas mesmas funções.

**D27. Séries, repetições e carga ficam em `tasks.meta` (`{sets, reps, weight}`).** Em páginas de cards, "4x12" e "20kg" no texto viram meta (na captura e no lote). Não há colunas próprias de academia: o meta é genérico (ESCOPO 4.3).

**D28. Arrastar para reordenar com `react-native-sortables`** (funciona no nativo e na web), pela alça ⠿ para não brigar com o toque no item. A posição nova fica no meio das vizinhas (`positionAfterMove`), então só a tarefa movida é gravada. Não há reordenação por teclado ainda (Fase 6, acessibilidade).

**D29. Duplicar página copia tarefas e subtarefas, todas abertas, e o histórico não vai junto.** "Treino A" sugere "Treino B".

**D30. Depois de restaurar o cache do disco, o app revalida tudo.** O cache serve para abrir rápido e offline, mas pode estar velho (o ciclo virou, ou a última gravação não chegou ao disco antes de fechar).

**D31. Ícone padrão da página pelo tipo:** 📄 lista, 🃏 cards, 🔥 hábitos.

## 2026-10-09 — Navegação de pastas

**D32. Barra lateral própria em tela larga, fora da pilha de telas** (`components/sidebar.tsx`, renderizada em `(app)/_layout.tsx`). A barra de abas do React Navigation na lateral só mostrava "Pastas" e sumia ao abrir uma página. Agora, como os projetos no Claude web, ela tem "Nova tarefa", os atalhos, a seção PASTAS com botão + e a árvore recolhível (pastas abertas ficam em `prefs`). Os itens são links de verdade (`aria-current`), não abas. A aba Pastas virou grade de cards com as páginas dentro (continua em 2 toques até a página), e cada pasta tem a tela `folder/[id]`. Criar pasta abre a pasta nova. Diálogos de pasta/página em `useFolderActions` (`components/folder-actions.tsx`). Favoritos ficam para depois.

## 2026-10-09 — Fase 3

**D33. Dano ao boss = XP ganho** (pergunta 1 do ESCOPO 14). Reaproveita o ledger e o anti-farm: cada evento com XP > 0 vira uma linha em `boss_damage`; reverter o evento apaga o dano. O dano conta mesmo depois do boss derrotado, para desmarcar uma tarefa antiga não o ressuscitar se as seguintes cobrem o HP. Se desmarcar tira o golpe final na mesma semana, o boss volta e a recompensa (50 XP) é revertida. HP = max(100 + 15 × nível, 0,8 × média semanal de XP das últimas 4 semanas). O boss nasce na primeira leitura da semana (`game_state` ou primeira conclusão); o da semana anterior foge sem punição (cron de hora em hora marca `escaped`).

**D34. Chave de XP diferente da chave do ciclo em dois casos.** Reset manual usa `'d:' || dia` e recorrente comum usa `'r:' || dia`. Sem isso, "reiniciar e marcar de novo" e "concluir a recorrente várias vezes" (cada vez avança a data) gerariam XP infinito. O evento guarda `completion_id`; desfazer reverte exatamente o evento daquela conclusão (e o bônus da página no mesmo ciclo).

**D35. Anti-farm além do escopo.** (a) Itens criados já como `[x]` no lote são sempre relâmpago (0 XP), também em cards e hábitos. (b) O teto diário de 50 XP para o que foi concluído menos de 5 min depois de criado vale para todo tipo de página, inclusive o bônus de página nova. Sem isso, criar card → marcar → apagar → repetir rendia XP sem limite. (c) Bônus de página exige ao menos 3 cards.

**D36. Valores em `src/lib/gamification.config.ts` com espelho em `public.xp_rules()`.** Quem concede XP é o banco; um teste do Jest compara o JSON da migração com o arquivo. A curva de nível existe nos dois (`levelFromXp` / `level_for_xp`) com os mesmos casos.

**D37. Sequência global calculada do ledger, não incrementada.** Dias com ao menos uma conclusão (inclusive relâmpago; bônus e recompensa não contam). Congelamento automático: um dia sem nada é coberto se a semana ISO dele ainda não usou o congelamento e o dia seguinte teve atividade (ou é hoje). Recalculada a cada conclusão e na leitura (`game_state`), então desmarcar também a desfaz. O bônus dos hábitos e recorrentes (+1 por dia, até +20) usa essa sequência global.

**D38. Conquistas não são retiradas ao desmarcar e não valem XP** (logo não há o que farmar). Desligar a gamificação só esconde da tela: o ledger continua sendo gravado, e religar mostra tudo em dia.

**D39. `complete_task` / `uncomplete_task` devolvem `{task, xp, level, level_up, boss_defeated, achievements}`.** A recompensa entra no mesmo aviso do "Desfazer" (`+10 XP · 🎉 Nível 3!`). Moedas ficam para depois (ESCOPO: opcional).

## 2026-10-09 — Fase 4

**D40. Projeto = pasta raiz com `is_shared`** (ESCOPO 3, sem entidade paralela). Vira projeto ao gerar o primeiro convite ou ao nascer de modelo pronto. Membros ficam sempre na raiz; subpasta não se compartilha sozinha, Caixa de entrada nunca.

**D41. O `@nome` é resolvido no app, só em página de projeto.** O app compara com os membros (nome inteiro, primeiro nome ou apelido; sem acento, maiúscula nem pontuação: `nameKey`) para poder mostrar a ambiguidade na pré-visualização do lote e deixar escolher. Um compatível: atribui. Nenhum: responsável pendente. Mais de um: não atribui (no campo rápido, um aviso pede para escolher nos detalhes). O banco só confere que o `user_id` é membro. A mesma regra existe no banco (`name_key`/`members_matching`) para as @menções dos comentários, com os mesmos casos de teste. Não há "@usuário" separado do nome de exibição na v1.

**D42. Reivindicar um nome pendente o transforma em apelido do membro** (`folder_members.aliases`): os próximos `@gregory` já caem na pessoa, e o nome não fica pendente de novo. Reivindicar duas vezes dá erro ("já foi reivindicado"). Dono/editor vinculam outra pessoa pela tela Pessoas. Quem sai (ou é tirado) do projeto devolve as tarefas para um nome pendente com o nome dela.

**D43. Convite por link com token aleatório** (18 bytes, 24 caracteres), válido 14 dias, até 50 usos, cancelável. O mesmo link é reaproveitado enquanto vale. Rate limit: 20 links novos por hora por pessoa. A prévia (`invite_preview`) funciona sem login, porque o token já é o segredo; a tela `/invite/[token]` fica fora do `Stack.Protected` e cria a conta ali mesmo. Editor também convida (só como editor ou leitor); só o dono muda papéis e tira pessoas. Universal links / app links ficam para a publicação (Fase 6): o link é sempre da web (`EXPO_PUBLIC_WEB_URL` no app nativo), que abre o projeto sem bloquear.

**D44. Leitor só vê e comenta.** O banco barra (RLS e RPCs); no app, `useCanWrite(folderId)` (conexão + papel de dono/editor) desativa os controles. Telas que mostram uma pasta só usam `WriteScope`; linhas de tarefa passam a pasta da própria tarefa (a tela Hoje mistura pastas).

**D45. Atividade e notificações por triggers, só em projetos.** Atividade: conclusões (desfazer apaga a linha), criação em lote (uma linha por envio), comentários, entradas, vínculos de nome. Notificações in-app: atribuição, @menção em comentário, alguém entrou (para o dono). Ninguém é notificado do que ele mesmo fez. E-mail e push ficam para a Fase 6.

**D46. Tempo real = invalidar as consultas.** Um canal por usuário escuta `postgres_changes` das tabelas do projeto (a RLS filtra o que chega) e recarrega as listas afetadas, agrupando eventos de 300 ms. Sem aplicar os eventos campo a campo: mais simples e não diverge do servidor. Enquanto há mutação de tarefa própria em voo, não recarrega as tarefas (a mutação recarrega ao terminar).

**D47. Modelos prontos ficam no app** (`src/lib/templates.ts`, escritos como texto do lote) e os do usuário em `user_templates`. `create_from_template` cria pasta, páginas e tarefas numa transação. Modelos prontos nascem como projeto; os salvos pelo usuário, como pasta pessoal (dá para compartilhar depois). Salvar como modelo leva páginas e tarefas abertas, sem responsáveis, datas nem marcações.

**D48. "Minhas tarefas" é uma aba** (🙋, entre Caixa de entrada e Pastas): abertas e atribuídas a mim, agrupadas por vencimento. Responsável pendente não conta para ninguém.

## 2026-10-09 — Fase 5

**D49. Clã é entidade separada de projeto** (pergunta 2 do ESCOPO 14), com a lógica de boss reaproveitada. Uma pessoa, um clã. Convite por link igual ao do projeto (prévia sem login, cria a conta no próprio convite). Sem chat: só um feed com entradas, saídas, conquistas e boss derrotado. O feed **não** mostra títulos de tarefas, porque as pastas de cada membro são particulares. O dono que sai passa o clã para o membro mais antigo; o último a sair apaga o clã. Colegas de clã veem o nome e o nível uns dos outros.

**D50. Boss do clã: dano = XP ganho pelos membros.** É o mesmo evento do ledger que já bate no boss solo (`boss_damage` agora é único por boss e evento), então o anti-farm e o desfazer valem igual. Semanal, no fuso de quem criou o clã. HP = (100 + 15 × nível médio) × membros ativos (com conclusão nas últimas 2 semanas, mínimo 1). Todos que deram ao menos 1 de dano ganham a recompensa (50 XP). A lista de premiados acompanha o dano: quem entra depois e ataca também ganha; se desmarcar tira o golpe final, o boss volta e a recompensa sai de todos (`_sync_boss_rewards`). O XP de quem recebe é recalculado na hora, mesmo que ele não tenha feito nada naquele momento.

**D51. Boss de projeto: HP = tarefas principais do projeto, 1 de dano por tarefa concluída.** Não usa o ledger: é calculado das próprias tarefas (status e `completed_by`) por trigger, então desmarcar, criar ou apagar tarefa ajusta o boss sozinho (tarefa nova depois da vitória faz o boss voltar). Contribuição = tarefas concluídas por cada um desde o início do boss. Um por vez por projeto, com prazo (fim do dia no fuso do dono); quem pode editar chama ou desiste. Passou do prazo sem vencer: foge, sem punição. Vale mesmo com a gamificação desligada para alguns membros (só some da tela de quem desligou). Conquista nova: "Missão cumprida".

**D52. Fila offline com a fila de mutações pausadas do TanStack Query, não com motor de sync.** Criar (inclusive em lote), marcar/desmarcar e editar/reordenar tarefas funcionam sem internet: a mutação fica pausada, vai para o disco junto com o cache e é reenviada na ordem ao reconectar, mesmo depois de fechar o app (`setMutationDefaults` em `registerOfflineTaskMutations`). Todas usam o mesmo `scope` ("tasks"), então uma vai depois da outra também online. Conflitos: a edição manda só os campos mudados (a última escrita vence por campo); concluir tarefa já concluída não faz nada (a conclusão do servidor vence); XP e boss são calculados pelo servidor no reenvio. Pastas, páginas, convites, comentários, clã e apagar tarefa continuam exigindo conexão. Motor de sync (PowerSync etc.) fica para quando a fila não bastar.

**D53. Exportar e excluir conta** (ESCOPO 9). Exportação em JSON (tudo o que é seu: perfil, pastas criadas por você com páginas e tarefas, tarefas que você criou em projetos dos outros, conclusões, ledger de XP, conquistas, comentários) e CSV das tarefas (separador ";" e BOM, para abrir certo no Excel em pt-BR). Excluir a conta pede para digitar EXCLUIR. Projetos com outras pessoas não somem: passam para o membro mais antigo (editor antes de leitor); tarefas que você criou neles ficam com o novo dono; as atribuídas a você voltam a ser o seu nome, pendente.

## 2026-10-09 — Fase 6

**D54. Kanban com três colunas fixas (A fazer / Fazendo / Feito), usando o `status` que a tarefa já tinha.** Mover é por botões ◀ ▶ em cada card (funciona com toque, teclado e leitor de tela), não por arrastar entre colunas. O RPC `set_task_status` é o único caminho: ir para Feito é `complete_task` (XP, bosses, histórico) e sair de Feito é `uncomplete_task`. Entra na fila offline. Página kanban nunca reinicia por ciclo. Colunas personalizadas ficam para depois.

**D55. Tema manual: Sistema, Claro ou Escuro** (resolve a pendência da D21). As cores escuras ficam em `.dark:root` no `global.css` (antes em `@media`). No celular, `colorScheme.set` do NativeWind troca o `Appearance` ("Sistema" volta a seguir o aparelho). Na web, o NativeWind só põe e tira a classe `dark` no `<html>`, então `providers/theme.tsx` resolve "Sistema" pelo `prefers-color-scheme` e acompanha a troca. A escolha é do aparelho (preferência local), não da conta: continua ao sair. A navegação usa o `useColorScheme` do NativeWind, que segue a escolha.

**D56. Onboarding em 3 passos, uma vez por conta** (`profiles.onboarded_at`): (1) anotar uma tarefa de verdade com a sintaxe rápida; (2) criar, se quiser, pastas iniciais prontas (treino em cards com reset semanal, casa, hábitos; reaproveita `create_from_template`, como pasta pessoal); (3) entender XP, sequência e boss, com o liga/desliga da gamificação. "Pular introdução" em todos os passos. Contas antigas e quem entra por convite (projeto ou clã) não veem: o convite já leva a pessoa a um contexto. O redirecionamento só decide com o perfil buscado do servidor nesta sessão, porque o cache do disco pode ser de antes de concluir a introdução.

**D57. Acessibilidade, animação e performance.** (a) Reordenar sem arrastar (pendência da D28): na web, foco na alça ⠿ e setas ↑ ↓; no celular, as ações "mover para cima/baixo" do TalkBack/VoiceOver. (b) Contorno de foco visível na web (`:focus-visible` com a cor primária). (c) O checkbox dá um pulso curto ao marcar (os cards já davam); o Reanimated respeita o "reduzir movimento" do sistema. (d) Performance: medida dentro da página, marcar numa lista de 500 tarefas atualiza a tela em ~40 ms (era ~120 ms). Para isso, `TaskRow` e `TaskCard` são memoizadas (tarefas que não mudaram mantêm o mesmo objeto; as subtarefas são comparadas pelo conteúdo), e listas com mais de 100 itens (`SORTABLE_LIMIT`) não usam a grade de arrastar, que refaz o layout de todos os itens; nelas, reordenar é pelo teclado ou pelo leitor de tela. Um E2E garante < 150 ms (com folga sobre a meta de 100 ms do ESCOPO 9). Virtualizar a lista (FlashList) fica para quando 500 não bastar.

**D58. Push no celular pela API da Expo, disparado pelo banco; e-mail fica para depois.** Cada notificação in-app (D45) que nasce chama, por trigger com `pg_net`, a Edge Function `push`, que manda para os aparelhos do usuário e apaga tokens de aparelhos que não existem mais (`DeviceNotRegistered`). O texto do push é o mesmo da tela 🔔 (`supabase/functions/_shared/notification-text.ts`, usado pelo app e pela função). O endereço da função e o segredo ficam em `app_config`, que o cliente não lê; sem eles, nada é disparado (é o caso do banco local). O token é por aparelho: trocar de conta no mesmo celular move o token, e sair da conta ou desligar apaga só o deste aparelho. Requisitos: development build (o Expo Go não recebe push no Android desde o SDK 53) e o `projectId` do EAS; sem eles, o Perfil explica o motivo. Na web não há push: o sino 🔔 já atualiza em tempo real. **E-mail transacional não entrou**: precisa de um provedor (Resend, SES...) com chave e domínio verificado, uma decisão de conta/custo do dono do projeto. A mesma Edge Function pode ganhar o envio por e-mail quando houver provedor.

**D59. Publicação preparada, não executada.** `eas.json` com os perfis development (com `expo-dev-client`, para push e Supabase local), preview (APK interno) e production (versão automática, Android na trilha interna). Identificador `com.willianvaler.questlist` (só muda antes do primeiro envio). Política de privacidade pública em `/privacidade` (as lojas pedem o endereço). O passo a passo, a ficha das lojas e as respostas de segurança dos dados estão em `PUBLICACAO.md`. Ficam com o dono do projeto: contas Apple/Google/EAS, nome e ícone finais, domínio (universal links), SMTP e provedor de e-mail, e o teste em aparelho de verdade. Login com Google (Fase 0 do ESCOPO) não foi implementado e está listado lá.

## 2026-10-10 — Fase 7: RPG leve e redesign

Pedido do dono do projeto depois da Fase 6: tarefas dando dano no boss, + e − nos hábitos, mais conquistas, classes (só sabor), loja de visuais e drops de boss, níveis de personagem e de boss, atributos com impacto no dano, boss menos fácil no nível 1, interface que aproveite a tela do computador e atalho de claro/escuro. Revê o "sem classes na v1" do ESCOPO 4.6 (a pedido). Migração `20261017000000_rpg.sql`; testes em `fase7_rpg.test.sql` e `e2e/fase7.spec.ts`.

**D60. Dano separado do XP (substitui "dano = XP" da D33).** Cada evento do ledger guarda `damage`, `crit` e `gold`; o `boss_damage` recebe o `damage` do evento (no boss solo e no do clã), e reverter o evento tira os três. Motivo do pedido: tarefa concluída logo depois de criada (relâmpago, < 30 s) valia 0 XP e, portanto, 0 de dano; quem anota e já faz não via o boss apanhar. Agora o relâmpago continua com 0 XP e 0 ouro, mas o golpe vale. Anti-farm do dano: as conclusões rápidas (< 5 min, inclusive as relâmpago) somam no máximo 20 de dano por dia; `[x]` do lote não bate.

**D61. Atributos, classe e a conta do dano.** Atributos: Força, Agilidade, Inteligência e Constituição, todos começando em 1, mais o bônus da classe e 1 ponto por nível acima do 1 para distribuir (`allocate_attribute`; `reset_attributes` devolve tudo, de graça). Dano = base do tipo × (1 + 5% por ponto de Força nas tarefas ou de Inteligência nas rotinas + passiva/habilidade) × crítico (2% de chance por ponto de Agilidade, até 60%; ×2). Base: tarefa 4 (× prioridade), hábito/recorrente 3, card/subtarefa 2, página inteira 8, hábito bom 2. Constituição dá +3% de ouro e reduz a cura dos hábitos ruins. Classes (sabor + uma passiva + uma habilidade ativa por dia, que vale até o fim do dia): Lutador (primeiro golpe do dia ×2; Fúria), Mago (+2% por dia de sequência; Tempestade arcana), Arqueiro (crítico ×2,5; Mira certeira), Paladino (hábito ruim cura metade; Bênção), Ladino (+50% de ouro; Emboscada em atrasadas). Trocar de classe é livre. Tudo calculado no banco (`_attack`, `_gold_for`); `src/lib/character.ts` é o espelho para a ficha mostrar os números, com os mesmos casos do pgTAP. Valores em `gamification.config.ts` = `xp_rules()`.

**D62. Bosses com nível; o do nível 1 ficou mais duro.** Nível do boss solo = 1 + bosses solo derrotados; do clã, 1 + bosses do clã derrotados. HP = 120 × 1,2^(nível − 1) (o solo nunca abaixo de 80% do dano médio semanal recente; o do clã, vezes os membros ativos). Com o dano base menor (D61), o boss do nível 1 pede ~30 golpes na semana (antes ~12). Recompensa: 50 XP, 20 + 10 × (nível − 1) de ouro e um item sorteado (D64). O boss da semana em curso não foi recalculado: as regras novas valem a partir do próximo.

**D63. Hábitos: marcar, contador ou bom/ruim** (`tasks.habit_kind`). Contador: meta por período (`habit_target`, 1 a 100); + soma, − tira; bater a meta conclui pelo `complete_task` de sempre (XP, dano, sequência do hábito) e cair abaixo desfaz. Bom/ruim (estilo Habitica, sem meta): + é um hábito bom (3 XP, dano e ouro, até 10 por hábito por dia; os outros são contados sem valer nada); − é um hábito ruim e cura o boss (3, menos com Constituição), sem tirar XP (ESCOPO: sem punição pesada); só cura o que o boss já apanhou e nunca um boss derrotado. As contagens do período ficam em `count_up`/`count_down`/`count_key`, mudam só por `habit_tick` e zeram no `refresh_cycles`. O toque usa um id gerado no app (idempotente), entra na fila offline e o aviso do bom/ruim tem "Desfazer" (`undo_habit_tick`). O "+" de hábito bom conta como dia ativo na sequência global.

**D64. Ouro, loja só de visual e drops.** Ouro = soma do `gold` do ledger − o que foi gasto (`user_items.price`); o `profiles.coins` é cache. Itens (`items`, catálogo público) em 5 espaços: cabeça, mão, companheiro, aura (fundo do personagem) e título. Comuns e alguns raros à venda; os melhores só caem de boss (`_roll_drop`: sorteio ponderado pela raridade, mais chance de épico/lendário quanto maior o nível do boss; sem item novo, +25 de ouro). O item de boss fica preso à recompensa: se o boss volta à vida, o item sai junto. Itens não mudam XP nem dano. O personagem é desenhado com emojis (figura da classe + itens em volta), sem arte nova.

**D65. Mais conquistas** (de 10 para 33): sequência de 3, 10/500/1000 tarefas, níveis 3 e 20, escolher classe, usar habilidade, crítico, golpe de 15+, 5 pontos distribuídos, primeira compra, primeiro drop, 10 itens, 500 de ouro, meta de contador, 50 hábitos bons, antes das 7h, depois das 23h, boss de clã, 5 e 25 bosses, boss de nível 5+. Continuam não sendo retiradas e não valendo XP (D38).

**D66. Personagem e Loja são telas próprias** (`/character`, `/shop`), na barra lateral e a partir do cartão do jogo (Hoje e Perfil). A Hoje mostra o personagem e o botão da habilidade do dia.

**D67. Redesign para tela larga.** `Screen` ganhou tamanhos: `narrow` (formulários), `medium` (listas: Caixa de entrada, Minhas, página de lista/hábitos, clã) e `wide` (Hoje, Pastas, pasta, cards/kanban, Personagem, Loja, Perfil). A Hoje, a partir de 1024 px, vira duas colunas: tarefas à esquerda; personagem, bosses e hábitos à direita. Pastas, páginas da pasta, classes e loja usam a `Grid` (colunas pela largura). Cards têm 3 colunas a partir de 1200 px; o Perfil, conta à esquerda e jogo/conquistas à direita. Tema: o claro/escuro já existia (D55) mas ficava escondido no Perfil; agora há um atalho ☀️/🌙 na barra lateral e no topo da Hoje no celular (troca para o oposto do que está na tela; "Sistema" continua no Perfil).

## 2026-10-10 — Fase 7, ajustes depois do primeiro teste

**D68. Hábitos têm lugar próprio, não viram pasta.** Cada conta ganha uma página de hábitos de sistema (`pages.is_habits`), na pasta escondida da Caixa de entrada, como a própria Caixa (D8): não se apaga, não se move, não muda de tipo nem se duplica. A tela **Hábitos** (aba e barra lateral) mostra os hábitos de todas as páginas de hábitos (os de pastas aparecem com o nome da página) e cria na página de sistema, com o tipo escolhido ao lado do campo (marcar, contador com meta, bom e ruim): `create_tasks_batch` aceita `habit_kind`/`habit_target` por item. O onboarding deixou de criar a pasta "Hábitos": oferece "Hábitos sugeridos" (água como contador, meditar, ler, "comer bem" como bom/ruim) na página de sistema. Pastas com páginas de hábitos continuam valendo (quem já tinha não perde nada).

**D69. Início acima da Hoje.** `/` agora é o Início: números (atrasadas, hoje, hábitos, Caixa de entrada sem data), "para fazer agora", hábitos de hoje pendentes, próximos 7 dias, Caixa de entrada sem data e, para quem participa de projeto, "Atribuídas a mim"; no computador, o personagem e o boss na coluna direita. A Hoje foi para `/today`. Abas no celular: Início, Hoje, Entrada, Hábitos, Pastas, Perfil. "Minhas tarefas" virou **Atribuídas a mim** e só aparece (barra lateral, cartão do Início) para quem está em algum projeto; no celular não tem aba. Fora de foco, o Início não desenha as listas (as abas ficam montadas atrás da ativa e repetiriam as tarefas da Hoje). A captura rápida mostra os destinos agrupados por pasta, com quebra de linha, em vez de uma faixa com rolagem lateral.

**D70. Consulta de hábitos pelo id das páginas.** A lista de hábitos filtrava só pelo tipo da página; sem filtro seletivo na tabela de tarefas, o banco checava a permissão (RLS, `is_folder_member`) de todas as tarefas de todo mundo: ~1 s com 18 mil tarefas no banco local, e as buscas em fila deixavam a Hoje sem os hábitos por segundos (era a causa do E2E de hábitos que falhava às vezes). Agora busca por `page_id in (páginas de hábitos da árvore)`, que usa o índice. **Pendência:** outras consultas sem filtro seletivo (Atribuídas a mim; em menor grau a Hoje, que filtra por vencimento) têm o mesmo custo crescendo com o total de tarefas do banco. Antes de publicar, vale filtrar por pastas do usuário ou trocar a policy por uma forma que o Postgres resolva por índice.

## 2026-10-13 — V2/V3: plano e ajustes à stack

Plano em `docs/CRONOGRAMA.md`, andamento em `docs/STATUS.md`, retrato do código em `docs/AUDITORIA.md`.

**D71. Expo continua; sem Capacitor.** A V2 §2.1 sugere empacotar a web com Capacitor para ter SQLite nativo. O app já é nativo em Android e iOS pelo Expo, com o mesmo código da web, e o `expo-sqlite` já está instalado. Trocar de base não traria nada para o sync. O banco local do celular será o `expo-sqlite`; o da web sai do spike (A7).

**D72. Ordem das fases: A → B → C → D → E → G … M → F.** A correção visual (V3 §0) vem logo depois da fundação; i18n, `can()` e o registro de atalhos ficam na A porque toda tela nova depende deles, e o texto de cada tela vai para o i18n quando ela é redesenhada (cada tela é reescrita uma vez só). O sync (D) vem antes de times e da V3 para que as tabelas novas já nasçam com id de cliente, `deleted_at` e `version`. A Ajuda completa (F) vai para o fim, porque a V3 acrescenta artigos; a rota `/ajuda` com a tabela de atalhos nasce na C.

**D73. Um commit por tarefa do cronograma.** Conventional Commits em pt-BR, com o id da tarefa no fim (`[A3]`), e o `docs/STATUS.md` atualizado no mesmo commit (V2 §0.4). O trabalho da Fase 7, que estava sem commit, entrou em 9 commits por camada (banco, lib, ui, telas, e2e, docs), marcados com `[Fase 7]`.

**D74. Permissões como dados (A5).** Catálogo de permissões atômicas (V2 §4.3 + V3 §8) e presets em `src/lib/permissions.ts`, espelhado em `public.permission_presets()` (o teste do app compara, como o `xp_rules()`). Presets: `owner` (Dono: tudo), `manager` (Gerente: tudo menos excluir o projeto), `editor`, `contributor` (Colaborador), `viewer` (Leitor) e `executor` (página enviada, V3 §3.3). Permissão "só no que é seu" é a mesma permissão com `:own` (atribuída a si; para apagar, criada por si). Os papéis de hoje (`folder_role`) têm o mesmo nome dos presets. A função única é `can()` no app e `has_permission()` / `preset_can()` no banco. Nesta etapa só o app passou a usá-la (`canEdit`, gerenciar pessoas); as policies RLS continuam com `is_folder_member()` e migram junto com os cargos novos (Fase E). Diferença conhecida da matriz da V2: hoje o editor ainda pode convidar; fica assim até a Fase E.
