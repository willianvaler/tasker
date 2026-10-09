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
