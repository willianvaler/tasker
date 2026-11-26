# Testes manuais do V15

O que só se confere num aparelho ou num app de terceiros. Cada linha diz o que foi feito, onde e quando; o que falta fica com **pendente**.

## CT5: apps de automação chamando o Questlist (D387)

Artigo da Ajuda: `content/help/*/27-apps-de-automacao.md`. O critério do ESCOPO_V15 pede **pelo menos duas receitas testadas em apps reais**.

### Feito no PC de desenvolvimento (26/11/2026)

O caminho HTTP das receitas, com o `scripts/serve.mjs` local (porta 8097) e o Supabase local, numa conta e numa automação de teste apagadas depois:

| Pedido (o mesmo que os apps mandam) | Resposta | Resultado |
|---|---|---|
| `POST /hooks/<token>`, `Content-Type: application/json`, `{"titulo":"Comprar pão (JSON)"}` | 202 | Tarefa "Comprar pão (JSON)" criada na Caixa de entrada pela regra "Chamada de fora → Criar tarefa `{{hook.titulo}}`" |
| `POST /hooks/<token>`, formulário, `titulo=Regar as plantas (form)` | 202 | Tarefa "Regar as plantas (form)" criada |
| `POST` com token inexistente | 202 | Nada acontece (igual ao válido, nada a sondar) |
| `GET /hooks/<token>` | 405 | — |

Achado: a ação **Criar tarefa** sem lista falha com "Escolha a lista onde criar a tarefa" (o editor já exige a lista; a receita diz para escolher).

O link `/r/<token>` (receita 2) é o do CT4, coberto pelo E2E `automacoes-link.spec.ts`; o app de automação só abre o endereço.

### Pendente no aparelho do dono

Os apps padrão do escopo são o **Automate** e as **Rotinas da Samsung** (Bixby Routines). As Rotinas não têm ação de pedido HTTP; abrir site depende da versão do One UI. Sugestão: **Automate** (receitas 1 e 2) e **Rotinas da Samsung** (receita 2, se abrir site), ou **MacroDroid** no lugar das Rotinas.

| App | Receita | Situação | Data | Observação |
|---|---|---|---|---|
| Automate | 1: POST JSON cria tarefa | pendente | | |
| Automate | 2: abrir o link roda a automação | pendente | | |
| Rotinas da Samsung | 2: abrir o link (se houver a ação) | pendente | | |
| MacroDroid (alternativa) | 1 e 2 | pendente | | |

Como testar a receita 1: criar a automação (Chamada de fora (webhook) → Criar tarefa na Caixa de entrada com título `{{hook.titulo}}`), **Gerar endereço**, montar no app o `POST` com o corpo JSON e conferir a tarefa e o histórico da automação. Receita 2: automação **Só quando eu mandar** com **Gerar link**, abrir o link pelo app com o celular logado no Questlist (no navegador) e conferir o histórico.
