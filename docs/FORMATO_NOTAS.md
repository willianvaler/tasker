# Formato das anotações (ED1, ESCOPO_V16, D345)

**A anotação é Markdown**, gravado em `notes.body` exatamente como foi digitado. O app não normaliza
o texto ao abrir nem ao salvar: abrir uma anotação antiga e sair não grava nada. Só a **importação**
troca o fim de linha do Windows (`\r\n`) por `\n` (`normalizar`, em `lib/note-format.ts`).

O teto é **1 milhão de caracteres** por anotação (V16-18), com o mesmo limite no banco e no app.

Toda extensão do Questlist **vira texto legível** em qualquer leitor de Markdown e passa intacta pelo
Obsidian.

## Blocos

`lib/note-format.ts` lê o texto em blocos **por posição**, sem reescrever nada.
- **Tipos de bloco:** título, parágrafo, lista (com as linhas recuadas), citação e callout, tabela, código (com cerca), fórmula `$$`, consulta, botão, régua e o cabeçalho de dados.
- **Separação:** uma linha vazia separa blocos.
- **Garantia:** remontar os blocos, com as linhas vazias entre eles, devolve o texto idêntico para qualquer entrada. Isso é testado com 1.000 entradas aleatórias e com o corpus em `tests/fixtures/notas/`.

## O que já existia (V11 a V13)

| Construção | Sintaxe | Decisão |
|---|---|---|
| Link | `[[Título\|n:<id>]]` (n anotação, t tarefa, p lista, f pasta), `[[Título#Seção\|n:<id>]]`, `[[Título]]` | D286 |
| Incorporar | `![[...]]` sozinho na linha | D291 |
| Callout | `> [!tip] Título` (`+`/`-` recolhe) | D288 |
| Destaque, rodapé | `==texto==`, `[^1]` e `[^1]: texto` | D288 |
| Tabela | GFM | D288 |
| Consulta | cerca ` ```questlist ` | D292 |
| Fórmula | `$…$`, `$$…$$` | D323 |
| Imagem | `![texto](qlimg:<anotação>/<id>.<ext>)` | D324 |
| Etiqueta | `#etiqueta` no texto e `tags` nas propriedades | D289 |

## Extensões do V16

| Construção | Sintaxe | Observação |
|---|---|---|
| **ID de bloco** | `^abc123` no fim do bloco, ou numa linha logo abaixo dele (para código, fórmula, tabela, citação e régua) | Letras, números e hífen, até 32. **Só entra quando alguém referencia o bloco** (ED2). Cerca que não fecha não ganha ID |
| **Referência a bloco** | `[[Título#^abc123\|n:<id>]]` | Link (ED2) |
| **Transclusão** | `![[Título#^abc123\|n:<id>]]` sozinho na linha | Só leitura, até 3 níveis (ED2, V16-5) |
| **Botão** | cerca ` ```questlist-button ` com JSON: `{"rotulo": "…", "acao": {"tipo": "criar_tarefa", …}, "confirmar": true}` | Ação do registro do V14 (ED4). JSON inválido aparece como código e não roda |
| **Cabeçalho de dados** | `---` YAML no começo | Na exportação e na importação: a anotação guarda as propriedades em `notes.props` (D289) |

## O que o app não conhece

Fica **idêntico**: HTML cru, shortcodes, cercas de linguagem desconhecida e qualquer outra coisa. Na
leitura aparece como texto ou código; na ida e volta, nada muda.
