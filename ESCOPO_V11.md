# Questlist — Escopo V11: funções do Obsidian nas anotações e nas tarefas (instruções para o Claude Code)

Pedido do dono em 24/10/2026:

> "adicionar no escopo 11 funcionalidades do obsidian https://github.com/obsidianmd/obsidian-releases - https://obsidian.md/"

O repositório `obsidian-releases` não tem o código do Obsidian, que é fechado: guarda as versões do app e as listas de plugins e temas da comunidade (`community-plugins.json`, `community-css-themes.json`). Então a referência são as **funções** do Obsidian (site, documentação e os plugins mais usados: Dataview, Tasks, Kanban, Calendar, Outliner, Templater, Excalidraw), não código para reaproveitar. Nada aqui copia arte, nome ou marca do Obsidian.

Em conflito com escopos anteriores, este vence. Decisões tomadas sem o dono ficam marcadas com **(padrão)** e voltam na tabela do §11.

## 0. O que o Questlist já tem

| Obsidian | No Questlist hoje |
|---|---|
| Notas em Markdown | Anotações em Markdown, só de quem escreveu, com barra de formatação e funcionando sem internet (D167, D187) |
| Tags (`#etiqueta`) | Etiquetas nas tarefas, inclusive pela escrita rápida (`#casa`); as anotações não têm |
| Tarefas dentro da nota | Caixinhas do Markdown (☐/☑) nas anotações, que não são tarefas de verdade |
| Paleta de comandos | Ctrl+K com busca e ações (`command-palette.tsx`) |
| Kanban, Calendar (plugins) | Quadro (D54) e Calendário com feed .ics (C1, D185) |
| Graph (grafo) | Grafo de dependências das tarefas no Fluxo (React Flow + dagre, Fase I), só para tarefas |
| Templates | Modelos prontos e salvos (D46) e a Comunidade (V10 §4) |
| Sync com histórico | PowerSync sem internet (Fase D) e histórico das tarefas (`task_events`); as anotações não têm versões |
| Shared vaults | Projetos com cargos (D74, D94); as anotações não são compartilhadas |
| Temas | Claro/escuro e os fundos do escuro (D55, D271) |
| Publish | Página enviada ao vivo ou como cópia (D133) e perfil público das tarefas (V10 §2); a anotação não sai da conta |

O que falta é a parte de **ligar ideias**: link entre anotações (e entre anotação e tarefa), backlinks, propriedades, consultas e uma visão espacial.

## 1. Links entre anotações, tarefas e listas (wikilinks)

- **`[[...]]` na anotação:** ao digitar `[[` aparece o autocomplete (anotações, listas, pastas, projetos e tarefas, as recentes primeiro), como o `@nome` (D41). O link guarda o **id**, não o título: `[[Título|n:<id>]]` no Markdown, mostrado só como "Título". Renomear não quebra.
- **Prefixos do id:** `n:` anotação, `t:` tarefa, `p:` lista, `f:` pasta ou projeto. Link para algo que a pessoa não pode ver aparece como "(sem acesso)", sem o título.
- **Link para o que ainda não existe:** `[[Nova ideia]]` sem id vira um link apagado; tocar cria a anotação com esse título (como no Obsidian).
- **Âncora de título** `[[Anotação#Seção]]` rola até o título. A referência de bloco (`^id`) fica para depois.
- **Na tarefa:** o campo de notas da tarefa também aceita `[[...]]` (a mesma marcação), e a seção **Ligações** do painel (D264) mostra as anotações que citam a tarefa.
- **Prévia ao passar o mouse** (web): cartão com as primeiras linhas; no celular, toque longo.
- **Dados (padrão):** a marcação fica no texto (`notes.body`, `tasks.notes`) e uma tabela `links` (origem, destino, tipo) é refeita por trigger ao salvar, para os backlinks serem uma consulta e não uma busca no texto. A tabela entra no sync, porque sem internet os backlinks precisam vir do aparelho.

## 2. Backlinks e menções sem link

- **Painel "Citado em"** na anotação, na lista e na tarefa: quem aponta para cá, com a frase em volta do link.
- **Menções sem link:** anotações que têm o título escrito sem `[[ ]]`, com **Ligar** para virar link. Só nas anotações da própria pessoa (busca no aparelho).
- **Links que saem:** a lista do que esta anotação cita, inclusive os que não existem ainda.

## 3. Propriedades e etiquetas nas anotações

- **Propriedades** (o frontmatter do Obsidian): campos com tipo (texto, número, data, caixinha, lista, link) num quadro no alto da anotação. Guardadas numa coluna `props jsonb` da `notes`, não no Markdown, para a consulta do §5 não ter que interpretar texto. A exportação em Markdown (§8) as escreve como frontmatter YAML.
- **Etiquetas** nas anotações com `#etiqueta` no texto e etiquetas aninhadas (`#treino/perna`). A tela de etiquetas junta as das tarefas e as das anotações.
- **Apelidos** (aliases): outros nomes que o autocomplete do `[[` e as menções sem link também reconhecem.
- Os campos personalizados das listas (D142) continuam valendo para tarefas; **(padrão)** as propriedades das anotações são um recurso à parte, sem misturar os dois.

## 4. Nota do dia e modelos de anotação

- **Nota do dia:** um toque na Hoje (e o atalho Alt+D) abre ou cria a anotação do dia (`2026-10-24`), pelo `useToday()` (fuso do perfil). Na anotação do dia, as tarefas concluídas e criadas naquele dia aparecem embaixo (só leitura), como um diário automático.
- **Calendário:** dias com nota ganham um ponto; tocar abre a nota.
- **Modelos de anotação** com variáveis (`{{data}}`, `{{hora}}`, `{{titulo}}`): "Nova anotação a partir de modelo", e um modelo padrão para a nota do dia. Os modelos ficam numa pasta de sistema de modelos (como os de lista, D46) e podem ir para a Comunidade.
- Nota da semana e do mês ficam para depois.

## 5. Consultas e "Bases" (Dataview, Tasks e Bases)

- **Bloco de consulta** dentro da anotação, numa cerca de código ` ```questlist `, com uma linguagem pequena e fechada (nada de JavaScript, como o Dataview tem):
  - `tarefas onde etiqueta = casa e vence <= hoje+7 ordenar por vencimento`
  - `anotações onde etiqueta = leitura e props.nota >= 4`
  - `tarefas da lista "Mercado" não concluídas`
- O resultado aparece como lista (tarefas com a caixinha de verdade, que conclui pelo `useToggleTask`), tabela ou contagem. A consulta roda no **aparelho** (SQLite do sync, D86) e sempre com um filtro seletivo (página, pasta, etiqueta ou data), para não varrer o banco (D70). Sem o filtro, o editor avisa e não roda.
- **Bases** (visão de banco de dados): uma tela que mostra anotações e tarefas filtradas como **tabela** (colunas = propriedades ou campos, ordenar, agrupar, editar a célula) ou **cartões**. Salva como um tipo novo de lista (`base`), com o filtro e as colunas no lugar das tarefas.
- **Parser e executor puros** em `lib/query/` (como o `lib/parser/`), com testes nos três idiomas das palavras-chave.

## 6. Grafo e Canvas

- **Grafo** (`/grafo`): anotações, listas e tarefas como pontos e os links do §1 como linhas, com zoom, arrastar e filtros (por pasta, etiqueta, tipo, "só o que está ligado a esta"). **Grafo local** no painel da anotação: só os vizinhos até 2 passos. Reaproveita o React Flow do Fluxo; acima de algumas centenas de pontos, layout de força simples sem animação (`d3-force`, MIT, a avaliar).
- **Canvas** (quadro branco infinito, `/canvas/[id]`): cartões de anotação, tarefa, lista, imagem (anexo) ou texto solto, ligados por setas com rótulo, em grupos coloridos. Arrastar uma tarefa para o canvas não a copia: é a mesma tarefa, com a caixinha valendo. Guardado como um tipo de lista (`canvas`) com os nós e as setas em JSON (o formato aberto JSON Canvas, MIT, para exportar e importar).
- **(padrão)** O canvas é pessoal ou do projeto, com o cargo de sempre (`page.manage` para mexer).

## 7. Edição e leitura

- **Callouts** (`> [!dica]`, `> [!aviso]`, `> [!nota]`), recolhíveis, com as cores do tema.
- **Incorporar** com `![[...]]`: a outra anotação, uma lista (tarefas marcáveis) ou um anexo de imagem aparecem dentro da anotação.
- **Comandos de barra** (`/` no começo da linha): título, lista, tarefa, callout, consulta, link, imagem, tabela.
- **Sumário** (outline) da anotação pelos títulos, no lado direito no computador.
- **Notas de rodapé**, **tabelas** do Markdown e **destaque** (`==texto==`). Fórmulas (LaTeX) e diagramas (Mermaid) ficam para depois, porque pesam no celular.
- **Tela dividida** no computador: duas anotações lado a lado, ou anotação e lista.
- **Favoritos** (bookmarks) de anotações, listas e buscas, no alto da barra lateral. O `pinned` da `notes` já existe no banco (D167).
- **Busca com operadores** na paleta: `tag:`, `em:` (pasta), `tipo:nota`, `"frase exata"`, `-palavra`.
- **Anotação aleatória** e **contagem de palavras** (no rodapé do editor).

## 8. Versões, compartilhar, publicar e importar

- **Histórico de versões da anotação:** uma versão a cada sessão de edição (no máximo uma a cada 10 minutos), guardada por 1 ano (o Obsidian Sync guarda 1 ano), com ver a diferença e restaurar. Tabela `note_versions`, só da dona, que entra na exportação e na exclusão de conta (LGPD). Passa pela lixeira (D84).
- **Compartilhar anotação** com pessoas ou com um projeto (ler ou editar), pelo modelo de cargos de sempre; edição ao mesmo tempo por duas pessoas é a "notas colaborativas (CRDT)" do V3 §6 C e continua lá. **(padrão)** Até lá, a última gravação vence e a outra pessoa vê o aviso "mudou enquanto você editava".
- **Publicar** uma anotação ou um conjunto (com os links entre elas) num endereço só de leitura (`/p/<token>`), fora do login, com senha opcional; desfazer a qualquer hora. Perfil e privacidade como no V10 §2.
- **Web Clipper** (depois): pelo Compartilhar do celular (o Share Target do V3 §6 B) e por uma extensão de navegador, salvar uma página como anotação com o link de origem.
- **Importar do Obsidian:** um `.zip` do cofre (pasta de `.md`) vira anotações, com os `[[links]]` resolvidos por título, as tags e o frontmatter virando propriedades. Os anexos vão para os anexos (com o limite de espaço, D229). **Exportar para o Obsidian:** o inverso, um `.zip` com um `.md` por anotação, links `[[Título]]` e frontmatter, para a pessoa nunca ficar presa no app.

## 9. Fora deste escopo

- **Plugins da comunidade** e API aberta: o Questlist não roda código de terceiros no app (segurança, RLS, lojas). A API e os webhooks do V3 §6 C cobrem integrações.
- **Arquivos locais como fonte da verdade:** no Questlist o banco é a fonte da verdade (CLAUDE.md); o aparelho é cache e fila. A exportação e a importação em Markdown (§8) dão a portabilidade.
- **CSS próprio** (snippets): os temas ficam nos fundos escolhidos (D271), para manter o contraste AA.
- Criptografia de ponta a ponta das anotações: avaliar depois. Ela tira a busca, as consultas e o compartilhamento do servidor.

## 10. Ordem sugerida

| Id | Tarefa | Depende de |
|---|---|---|
| OB1 | Links `[[...]]` com autocomplete e id, tabela `links` por trigger (RLS, pgTAP, sync), link para o que não existe | — |
| OB2 | Painel "Citado em", links que saem e menções sem link | OB1 |
| OB3 | Callouts, comandos de barra, sumário, rodapé, tabelas, destaque, contagem de palavras | — |
| OB4 | Etiquetas e propriedades nas anotações (`props`), etiquetas aninhadas, apelidos | — |
| OB5 | Nota do dia (Hoje, Alt+D, calendário) e modelos de anotação com variáveis | OB4 |
| OB6 | Incorporar `![[...]]` (anotação, lista marcável, imagem) e prévia ao passar o mouse | OB1 |
| OB7 | Linguagem de consulta (`lib/query/`, pura e testada nos 3 idiomas) e o bloco ` ```questlist ` | OB4 |
| OB8 | Bases: lista do tipo `base`, em tabela e cartões, com edição na célula | OB7 |
| OB9 | Grafo global e local | OB1 |
| OB10 | Canvas (tipo `canvas`, JSON Canvas, cartões de verdade) | OB1 |
| OB11 | Histórico de versões da anotação (`note_versions`, diferença, restaurar, LGPD) | — |
| OB12 | Favoritos, busca com operadores, tela dividida no computador, anotação aleatória | — |
| OB13 | Importar e exportar cofre do Obsidian (`.zip` de Markdown) | OB1, OB4 |
| OB14 | Compartilhar e publicar anotações (`/p/<token>`) | OB1, OB11 |
| OB15 | Web Clipper (Share Target e extensão) | V3 §6 B |

Cada tarefa: Ajuda nos 3 idiomas, i18n, E2E e o registro de sempre (STATUS, PENDENTES, FEITOS, DECISIONS). Tabela nova: RLS e pgTAP (dona acessa, estranho não vê, leitor não grava), privilégio por coluna, publicação do sync e do Realtime quando for de projeto.

## 11. Decisões do dono

| # | Pergunta | Padrão até a resposta |
|---|---|---|
| V11-1 | Por onde começar: links e backlinks (OB1, OB2), consultas e Bases (OB7, OB8) ou Canvas (OB10)? | Links e backlinks: o resto depende deles |
| V11-2 | As propriedades das anotações e os campos personalizados das listas ficam separados? | Separados (§3) |
| V11-3 | Compartilhar anotação antes do CRDT, com "a última gravação vence"? | Sim, com o aviso (§8) |
| V11-4 | Anotação publicada aberta para quem não tem conta, ou só para quem tem? | Aberta, só leitura, com senha opcional (como o Obsidian Publish) |
| V11-5 | Guardar as versões por 1 ano conta no espaço de anexos da pessoa? | Não conta (é texto) |
