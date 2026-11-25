# Proposta: reforma de usabilidade 2 (prático como o Notion)

**Pedido do dono (25/11/2026), depois de testar as anotações e os exemplos:** "estamos caminhando para
algo muito bom, porém extremamente complexo de se usar. O objetivo é ter algo superior ao Notion,
porém tão prático ou ainda mais prático que o próprio Notion." Decisões do mesmo dia (D368): **o V15
fica pausado** até esta reforma, e **o editor de anotações passa a ser de blocos** (o V16-4/D345 tinha
deixado como opcional).

## 1. O que o dono apontou

| # | Problema | Causa |
|---|---|---|
| P1 | O editor só tem botões simples, sem atalho para criar os componentes que o app suporta | O editor é um campo de texto Markdown (D345); callout, tabela, consulta, botão, fórmula e incorporar só existem como texto que é preciso saber escrever |
| P2 | A consulta tem uma lupa que sugere busca, mas não busca nada | O bloco de consulta usa o ícone de busca |
| P3 | Não dá para ordenar a tabela da consulta; não se entende de onde veio o "ordenar por" | A ordem só existe na linguagem escrita da consulta; a tabela não tem cabeçalho clicável (a Base tem) |
| P4 | Coisas escondidas ou difíceis de achar | Muita função entrou por sintaxe (texto) e por menus "⋯", sem um lugar que mostre o que existe |
| P5 | Atalho D "perdido" depois de selecionar tarefa numa anotação | Corrigido (CD54): a lista fora de foco não vale mais para os atalhos |

## 2. Princípios

1. **Tudo que o app sabe fazer aparece onde a pessoa está:** o `/` (e o `+` ao lado do bloco) lista
   **todos** os componentes, com nome, ícone e uma linha de explicação, nos 3 idiomas.
2. **Escrever é ver:** o editor mostra o resultado enquanto se escreve (título é título, callout é
   caixa, tabela é tabela). O Markdown continua sendo o que se grava, então exportar para o Obsidian,
   sync, histórico e conflitos não mudam.
3. **Sintaxe é atalho, nunca o único caminho:** `## `, `- [ ]`, `[[`, `$$` continuam valendo para
   quem sabe, mas toda construção tem um caminho por menu.
4. **Consulta é uma visão, não um texto:** filtro, ordem, agrupamento e "mostrar como" em controles
   (como as visões de banco do Notion); a linguagem escrita vira o modo avançado.
5. **Nada de ícone que promete o que não faz.**

## 3. Frentes

### R1 — Editor de blocos (a maior)

- **R1.0 Spike** (`docs/SPIKE_EDITOR_BLOCOS.md`): TipTap/ProseMirror × Lexical (licença MIT, peso,
  teclado no celular); como roda no celular (WebView, o `react-native-webview` já está no app) e na web
  (direto no DOM); **ida e volta sem perda** com o corpus do ED1 (`tests/fixtures/notas/`) e as mil
  entradas aleatórias do `note-format`: o que o editor não conhece vira um **bloco cru**, guardado
  byte a byte; desempenho no Moto E14 (abrir, digitar, 1 MB).
- **R1.1 Blocos básicos:** parágrafo, títulos, listas, tarefas, citação, callout, código, régua,
  tabela, imagem, fórmula; atalhos de Markdown ao digitar; Ctrl+B/I/K; arrastar o bloco pela alça.
- **R1.2 Menu `/` e `+`:** todos os componentes, com busca por nome nos 3 idiomas.
- **R1.3 Blocos do Questlist:** link `[[ ]]` com autocompletar, incorporar e transclusão, consulta
  (com o construtor da R2), botão (com formulário em vez de JSON), propriedades no alto.
- **R1.4 Celular:** a mesma página do editor numa WebView, com a barra acima do teclado.

### R2 — Consultas e bases como visões

- Construtor visual: **Filtro** (campo, condição, valor), **Ordenar** (campo, ↑↓), **Agrupar**,
  **Mostrar como** (lista, tabela, quadro, contagem), **Limite**; a frase escrita aparece como resumo e
  como modo avançado, editável dos dois jeitos.
- Tabela da consulta com **cabeçalho clicável** para ordenar (como a Base), sem gravar no texto até a
  pessoa pedir.
- O ícone do bloco deixa de ser a lupa (passa a ser o de banco de dados/tabela).
- A consulta dentro da anotação e a lista do tipo Base usam o **mesmo componente**.

### R3 — Achar as coisas

- Inventário de tudo que hoje só se acha por texto ou por "⋯" (`docs/USABILIDADE.md` ganha a lista) e,
  para cada um, um caminho visível.
- Estados vazios que ensinam (o que dá para pôr aqui, com o botão para fazer).
- Menu **Novo** e Ctrl+K com todas as criações, descritas.
- Medir: tempo para criar um callout, uma tabela, uma consulta ordenada e uma tarefa com data, antes
  e depois (como o §8 da primeira reforma).

### R4 — Organização (a discutir com o dono antes de fazer)

O Notion tem um conceito só (página, que contém outras páginas e bancos). O Questlist tem pasta,
projeto, lista (de vários tipos) e anotação. Opções para conversar: (a) manter os conceitos e só
juntar na navegação (a anotação e as listas de uma pasta lado a lado, como páginas); (b) a anotação
passar a poder **conter** listas e bases (como a página do Notion), sem mudar o banco das tarefas.

## 4. Ordem proposta

1. **R2 rápido** (ícone, cabeçalho que ordena na consulta) e o que a R3 achar de trivial.
2. **R1.0** spike, com a decisão da biblioteca registrada.
3. **R1.1 → R1.2 → R1.3 → R1.4**, cada um publicado no alpha para o dono testar.
4. **R2 construtor visual** (entra no editor novo como bloco).
5. **R4**, depois da conversa.

## 5. R3 feita (25/11, D375): o que estava escondido e o caminho de agora

| O quê | Antes (só por texto ou "⋯") | Agora |
|---|---|---|
| Callout, tabela, código, divisória | Escrever `> [!tip]`, `\| a \| b \|`, três crases, `---` | `/` ou **Inserir** → escolher pelo nome (com a explicação de cada um) |
| Consulta | Saber a linguagem (`tarefas onde … ordenar por …`) | `/consulta` cria um exemplo; **Filtros e ordem** monta tudo por controles; a tabela ordena pelo cabeçalho |
| Botão de automação | Escrever o JSON do `questlist-button` | `/botão` cria um modelo pronto para trocar o texto |
| Fórmula | Saber o `$$` | `/fórmula`, com o desenho aparecendo enquanto escreve |
| Link entre anotações | Saber o `[[` | `/link` ou `[[`, com a lista de sugestões ali mesmo |
| Incorporar | Saber o `![[…]]` | `/incorporar` |
| Editor de blocos | (não existia) | Aviso na primeira vez; "Escreva, ou digite / para inserir…" no espaço vazio; o rodapé lembra o `/` |
| Criar anotação, automação | Só pela barra lateral e menus | Também no **Ctrl+K** e no menu **Novo** (automação) |
| Automações, processos, agenda, compromissos, enquetes, Casa | Só pelo Mais/Configurações | Também no **Ctrl+K** |

**Passos para criar (contados no computador, a partir da anotação aberta e editando):**

| Tarefa | Antes | Agora |
|---|---|---|
| Um callout | Saber a sintaxe e digitar 2 linhas (~25 teclas) | `/cal` + Enter + texto (5 teclas + o texto) |
| Uma tabela 3 × 3 | Digitar 5 linhas com barras e traços (~40 teclas) | `/tab` + Enter (5 teclas), e escrever nas células |
| Uma consulta ordenada em tabela | Saber a linguagem e escrever a frase inteira | `/cons` + Enter → Visualizar → **Filtros e ordem** → 3 toques → Aplicar |
| Uma tarefa com data | Igual (a captura rápida já era curta) | Igual |
