# Revisão de usabilidade (Y1, ESCOPO_V5 §2)

16/10/2026. Percurso das tarefas principais como uma pessoa nova, no celular (390 px) e no computador (1280 px), com captura de cada passo (`e2e/ux-tour.spec.ts`, roda com `UX_TOUR=1 npm run e2e -- e2e/ux-tour.spec.ts`; as capturas ficam em `test-results/ux-tour/`). Percurso: criar conta e introdução → Início → Hoje e captura rápida → abrir e fechar uma tarefa → criar pasta, página e itens → hábitos → Modo → projeto → Perfil e Ajuda.

Gravidade: **A** atrapalha a tarefa ou confunde; **M** incomoda; **B** acabamento.

| # | Onde | Atrito | Gravidade | Correção (Y2) |
|---|---|---|---|---|
| 1 | Celular, página aberta | A página abre por cima das abas e esconde a barra de baixo: para ir a Hábitos é preciso "Voltar" antes (o próprio roteiro travou aí) | M | Mantido (padrão de pilha do celular); o "Voltar" fica sempre no topo. Reavaliar com abas também nas páginas |
| 2 | Painel da tarefa | Botão **Iniciar** sozinho numa linha, com um vão grande, em tarefa comum: ninguém sabe para que serve | A | No Simples, só aparece em projeto, com dependências ou já em andamento |
| 3 | Celular, todas as telas | O ponto de sincronização flutua por cima do conteúdo (sobre os chips do painel) | M | No celular, só aparece quando há algo a dizer (sem conexão, enviando, erro) |
| 4 | Celular, Pastas | Título cortado ("Pa…") pelos botões do topo | M | "Usar modelo" vira só ícone no celular |
| 5 | Pasta e projeto | "0 PÁGINA" / "0 LISTA" no singular | B | "Nenhuma página" / "Nenhuma lista" |
| 6 | Nova página | O diálogo pede ícone, tipo, reinício e níveis de subtarefa antes de criar; quase sempre só o nome importa | A | Nome e tipo à vista; ícone, reinício e níveis em "Mais opções" |
| 7 | Celular, lista | O campo "Nova tarefa… (Enter para criar)" fica cortado | B | Texto curto no celular |
| 8 | Hábitos | As dicas do campo falam de data, prioridade e @pessoa, que não servem para hábito | M | Dicas próprias de hábito |
| 9 | Projeto novo | Antes da primeira lista, a tela mostra Relacionados, Progresso, Marcos, Boss, Automações e Níveis; o "Nova lista" fica pequeno no canto | A | Sem listas: o convite "Criar a primeira lista" em destaque e as configurações do projeto recolhidas em "Configurações do projeto" |
| 10 | Projeto, barra lateral | Dentro do projeto a barra diz "Nova página" e a tela diz "Nova lista" | B | "Nova lista" nos dois |
| 11 | Introdução, celular | O aviso de permissão bloqueada mistura instruções da web e do celular | B | Instrução só da plataforma em uso |

**Y2 (16/10):** corrigidos #2 a #11 (D174); #1 mantido. Na segunda passada do roteiro, as telas conferem: título "Pastas" inteiro, "Nenhuma página", diálogo de página com nome e tipo e "Mais opções", projeto novo com "Criar a primeira lista" em destaque.

Ficou de fora desta rodada: testar com 3 a 5 pessoas usando de verdade (observar sem ajudar) e medir tempo e toques antes e depois (ESCOPO_V5 §2).
