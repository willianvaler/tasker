# Spike do editor de anotações (ED0, ESCOPO_V16)

Levantado em 25/11/2026, na `main` em `3129572`. **Precisa da aprovação do dono antes do ED1 a ED7**
(ESCOPO_V16, ED0). Números de desempenho em `docs/DESEMPENHO_EDITOR.md`; bancada em
`npm run bench:editor`.

## 1. O que existe hoje

**O editor é um campo de texto Markdown**, não um editor de blocos. A divergência entre o V11 §0
("Markdown com barra de formatação") e o V12 §0 ("blocos e comando `/`") se resolve assim: **o V11 está
certo**. Há um comando `/`, mas ele só **insere marcação** no texto; não existem blocos como objetos.

| Peça | Onde | Como é |
|---|---|---|
| Edição | `src/app/(app)/nota/[id].tsx` | `TextInput` multilinha (web: `<textarea>`), com o texto Markdown cru; grava 800 ms depois de parar de digitar e ao sair |
| Barra de formatação | mesmo arquivo + `lib/markdown-edit.ts` | negrito, itálico, título, listas, caixinhas: funções puras que envolvem ou marcam as linhas (D187) |
| Comando `/` | `components/slash-commands.tsx` + `lib/note-blocks.ts` | insere callout, tabela, destaque, rodapé, fórmula, imagem, consulta, link (D288) |
| `[[` com sugestões | `components/note-links.tsx` + `lib/wikilinks.ts` | `[[Título|n:<id>]]` (n, t, p, f), âncora `#Seção`, incorporar `![[...]]` (D286, D291) |
| Leitura | `components/note-markdown.tsx` | `react-native-marked` 8.3.2 (MIT, sobre o `marked` 18.0.14), com o texto preparado antes por `lib/note-blocks.ts` (callouts, destaque, rodapé) e os incorporar, consultas, fórmulas (MathJax → SVG, D323) e imagens (D324) desenhados à parte |
| Propriedades | `components/note-properties.tsx` + `lib/note-props.ts` | `notes.props` (jsonb, 8 KB), tipo pelo valor; frontmatter só na exportação (D289) |
| Consultas, bases, grafo, canvas | `lib/query/`, `note-query.tsx` | V11 (D292 a D295) |
| Versões | `note_versions` | uma por sessão (10 min), feitas pelo servidor (D296) |
| Cofre do Obsidian | `lib/vault.ts` | importar e exportar `.zip` no aparelho (D298) |

**Blocos que a leitura entende:** títulos, parágrafos, listas (com níveis), caixinhas, citação, callout
(8 tipos, com recolher), tabela GFM, código com cerca, fórmula `$…$`/`$$…$$`, destaque `==…==`, nota de
rodapé, imagem `qlimg:`, `[[link]]`, `![[incorporar]]` (linha inteira), bloco ` ```questlist ` (consulta),
`#etiqueta`. **Não entende** (fica como texto, sem perder nada): HTML cru (`<details>`), ID de bloco
`^abc`, cerca de linguagem desconhecida é só código.

**Limites de hoje:** **20.000 caracteres por anotação** (`notes.body` com `check`, e `NOTE_MAX` no
app), o que dá cerca de 3 mil palavras e 500 blocos. Imagens à parte (cota de 1 GB por conta).

## 2. Biblioteca

Não há biblioteca de edição: o campo é o `TextInput` do React Native (o `<textarea>` na web). A leitura
usa `react-native-marked` 8.3.2 (MIT). **Serialização:** não há; o que se grava é exatamente o que se
digita (a barra e o `/` inserem texto).

## 3. Ida e volta

- **Editor:** a anotação **é** o Markdown digitado e nada normaliza o texto ao abrir ou gravar (abrir e
  sair sem mudar não grava). A ida e volta do editor é a identidade, para qualquer construção.
- **Cofre (exportar → importar), 200 anotações geradas** (`src/lib/__tests__/note-roundtrip.test.ts`,
  gerador determinístico em `fixtures/notas-geradas.ts`, com todas as construções acima, HTML cru, `^id`
  e propriedades): título e propriedades voltam iguais em todas; **as 87 sem link voltam byte a byte**.
  Das 113 com link, **112 mudam**, por duas perdas da importação:
  1. **Texto do link diferente do nome:** `[[Nota 4|n:<id da Nota 5>]]` exporta certo
     (`[[Nota 5|Nota 4]]`), mas a importação **descarta o apelido** e volta como `[[Nota 5|n:…]]`.
  2. **Incorporar com título escrito:** `![[Nota|n:<id>]]` volta como `![[Nome real|n:<id>]]`.
  Os dois são só o texto mostrado do link (o destino continua certo). **Corrigidos no ED7 (D347):** a ida e volta ficou exata.
- Não houve 200 anotações reais do dono neste PC (o banco local é de testes). O corpus fixo do ED1
  (`tests/fixtures/notas/`) precisa de anotações reais **exportadas pelo dono**, sem dado pessoal.

## 4. Desempenho (resumo; detalhe em DESEMPENHO_EDITOR.md)

| Cenário do ED5 | Orçamento | Medido (web, este PC) | Situação |
|---|---|---|---|
| Abrir 5.000 blocos | ≤ 800 ms | **Impossível hoje** (teto de 20 mil caracteres ≈ 500 blocos). Com 492 blocos: 651 ms até ler, +179 ms até editar | **reprova por limite** |
| Digitar em 20.000 palavras | p95 ≤ 50 ms | **Impossível hoje** (≈ 3 mil palavras). Com 3.095 palavras: p95 34 ms | passa no que cabe |
| Buscar em 100 mil anotações | ≤ 300 ms | **~600 ms** (a busca da paleta, em memória, sem acento a cada busca) | **reprova**; com o texto sem acento guardado: 12 a 238 ms |
| Lista de banco com 10 mil páginas | ≤ 500 ms | não medido (é do ED3) | — |
| Colar 1 MB | ≤ 2 s | **Impossível hoje** (teto). Colar 20 KB: 727 ms | **reprova por limite** |
| Sync entre dois aparelhos | ≤ 3 s | não medido (precisa de dois aparelhos com o PowerSync) | — |

**Celular não medido:** o ED5 pede o celular e o computador do dono (V16-3); faltam os modelos.

## 5. Decisão proposta (V16-4)

**Manter o campo de texto e estender** (o padrão). Motivos: (1) o formato é o Markdown e a ida e volta
do editor já é a identidade, que é o eixo 2 do §0.1; (2) as extensões do ED1 (`^id`, `![[…#^id]]`,
`questlist-button`) são texto e cabem no campo de hoje, como no Obsidian; (3) trocar por um editor de
blocos (ProseMirror/TipTap, Lexical) pede WebView no celular (módulo nativo, APK novo) e uma
serialização de e para Markdown que perde as construções que ele não conhece, o contrário do ED1.

**O que precisa mudar para atingir o ED5:**
1. **Teto da anotação** de 20 mil caracteres para algo como **1 MB** (decisão nova, V16-18): mexe no
   `check` do banco, no `NOTE_MAX`, na versão (`note_versions` guarda o texto inteiro), na tabela
   `links` (refeita a cada gravação) e no sync (linha grande no PowerSync). Sem isso, três cenários do
   ED5 não existem.
2. **Busca:** guardar o texto sem acento por anotação (no aparelho, calculado uma vez por versão) ou um
   índice de texto no SQLite do aparelho (FTS5) e no Postgres (`pg_trgm` ou `tsvector`) para a busca
   antes da primeira sincronização. Com o texto guardado, 100 mil anotações ficam entre 12 e 238 ms.
3. **Anotação grande no campo de texto:** com 1 MB, um `<textarea>` ainda digita bem na web, mas o
   `TextInput` do celular (e o leitor `react-native-marked`, que desenha tudo de uma vez) precisam ser
   medidos no aparelho; se reprovar, a leitura vira virtualizada por bloco (o texto continua o mesmo).

## 6. Conflito e offline (ED6)

- Na tela aberta, chegou outra versão com algo por gravar: aviso "ficar com a minha / a do outro"
  (`noteShare.conflict`). Sem algo por gravar, adota a nova.
- **Duas edições sem internet:** a última gravação vence no servidor. A perdedora só fica guardada se a
  última versão tiver mais de 10 minutos (`note_versions`). As tarefas têm `conflict_copies`
  (`set_task_notes` com a base); **as anotações não**. É o que o ED6 resolve.

## 7. Importação de outros apps (ED7, V16-6)

- **Obsidian:** existe (`lib/vault.ts`, D298), com as duas perdas do §3.
- **Notion:** **não existe**. Pelo V16-6 (padrão), não entra no V16.

## 8. Limitações da web e do celular

- Web: `<textarea>` não tem realce nem dobra; o sumário e a contagem vivem fora dele. Seleção e IME
  são as do navegador (funcionam).
- Celular: o `TextInput` multilinha do React Native não tem rolagem virtual; anotação muito grande
  pesa ao abrir e ao digitar. Arrastar bloco não existe (não há blocos); mover trecho é recortar e colar.
- Leitura e edição são modos separados (o botão Editar/Visualizar), não um editor ao vivo.
