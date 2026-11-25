# Spike do editor de blocos (R1.0, reforma de usabilidade 2, D370)

Pedido do dono em 25/11/2026 (D368): o editor de anotações passa a ser de blocos, como o do Notion,
sem perder o formato do ED1 (o Markdown gravado em `notes.body`).

## 1. Candidatas

| | TipTap 3 (ProseMirror) | Lexical |
|---|---|---|
| Licença | MIT (`@tiptap/core`, `@tiptap/pm`, `prosemirror-*`) | MIT |
| Versão conferida | 3.35.0 | 0.53.0 |
| Celular | WebView (o `react-native-webview` já está no app); há precedente público (o `@10play/tentap-editor`, MIT, é o TipTap numa WebView) | WebView também (não há Lexical nativo para React Native) |
| Nós próprios | `Node.create` com *node view* (React ou DOM), regras de digitação (`## ` vira título), atalhos | `DecoratorNode`, transformadores de Markdown |
| Markdown | `prosemirror-markdown` (MIT), mas não usado para gravar (ver §3) | `@lexical/markdown`, com perda no que não conhece |
| Maturidade | ProseMirror tem mais de 8 anos, composição de teclado (IME) do Android tratada | Mais novo; IME do Android teve problemas conhecidos |

**Decisão: TipTap 3 sobre ProseMirror.** Os dois são MIT e os dois pedem WebView no celular; o que
decide é a maturidade com o teclado do Android e o modelo de documento do ProseMirror, que deixa
guardar o texto original de cada bloco (§3).

## 2. Medidas (protótipo descartável, Chromium do Playwright, 25/11)

Documento com blocos variados (títulos, listas com negrito, citações, código, parágrafos). "CPU 6×" é
o Chromium desacelerado 6 vezes, para imitar um celular de entrada; o Moto E14 de verdade fica para
o R1.4 (APK novo).

| | 500 blocos | 2.000 blocos | 5.000 blocos |
|---|---|---|---|
| Pacote | 393 KB minificado, **125 KB com gzip** (TipTap + StarterKit) | | |
| TipTap, abrir (CPU 1× / 6×) | 44 / 241 ms | 54 / 341 ms | 129 / 865 ms |
| TipTap, digitar por tecla (1× / 6×) | 1,2 / 10,5 ms | 2,4 / 28,7 ms | 6,4 / 75,6 ms |
| `<textarea>` de hoje, abrir (1× / 6×) | 23 / 60 ms | 53 / 325 ms | 106 / 654 ms |
| `<textarea>` de hoje, digitar (1× / 6×) | 1,3 / 8,4 ms | 4,4 / 38,5 ms | 12,8 / 106,1 ms |

- Os números do TipTap são com `content-visibility: auto` nos blocos (o navegador pula o layout do
  que está fora da tela). Sem isso, digitar com 5.000 blocos e CPU 6× ia a 151 ms por tecla.
  **Correção no R1.1 (D371):** esse CSS quebra o cursor do Chromium dentro do `contenteditable` com a
  digitação rápida (o texto ia para o parágrafo errado), então saiu; documento muito grande pede outra
  solução (virtualização), a rever.
- **Digitar fica igual ou melhor que o campo de hoje**; abrir custa mais nos documentos pequenos
  (241 contra 60 ms com CPU 6×), ainda dentro do orçamento do ED5 (800 ms).
- Acima de uns 2.000 blocos, os dois pioram. A anotação comum tem bem menos (o teto antigo, de 20 mil
  caracteres, dava uns 500 blocos).

## 3. Ida e volta sem perda (o ponto que barrava, D345)

O editor **não converte o documento inteiro para Markdown ao salvar**. O documento do editor é feito
dos blocos do `lib/note-format.ts` (que já reparte o texto por posição e remonta byte a byte, testado
com mil entradas aleatórias):

1. **Abrir:** cada bloco do `note-format` vira um nó do editor e guarda o **texto original** dele
   (`src`) e as linhas vazias que o separavam do anterior.
2. **Blocos que o editor conhece** (título, parágrafo, lista, tarefa, citação, callout, código, régua,
   tabela, fórmula, imagem, consulta, botão, incorporar) aparecem formatados.
3. **O que ele não conhece** (HTML cru, cercas de linguagem desconhecida, qualquer outra coisa) vira um
   **bloco cru**: mostra o texto como está e edita como texto, sem converter.
4. **Salvar:** bloco **não mexido** devolve o `src` exato; só o bloco editado é escrito de novo em
   Markdown (por um serializador nosso, um por tipo de nó, com teste).

Abrir e salvar sem mexer dá o texto idêntico por construção, e mexer num bloco só muda aquele bloco.
Sync, histórico de versões, conflitos (ED6), links, backlinks, etiquetas e a exportação para o
Obsidian continuam lendo o mesmo Markdown. **Teste obrigatório do R1.1:** o corpus
`tests/fixtures/notas/` e as mil entradas aleatórias do `note-format` passam pelo editor (abrir e
salvar) sem nenhuma diferença.

## 4. Como entra no app

- **Web:** o editor roda direto na página (um componente `.web.tsx`).
- **Celular:** a mesma página do editor, empacotada num HTML só (esbuild, como o leitor de PDF em
  `assets/`), numa WebView, com uma ponte de mensagens (abrir o texto, devolver o bloco mudado,
  pedir o menu de links `[[`, enviar imagem) e a barra acima do teclado. Muda o APK.
- **Leitura:** continua com o leitor de hoje até o editor ser o mesmo nos dois modos (R1.3).

## 5. Riscos e o que falta medir

- Teclado do Android na WebView (composição, autocorretor, colar): medir no aparelho no R1.4.
- O Moto E14 de verdade (abrir, digitar, memória da WebView): R1.4.
- Peso do pacote no APK (125 KB com gzip, mais os nós próprios): aceitável.
- O serializador por tipo de nó precisa produzir o mesmo Markdown que o leitor entende: teste de ida
  e volta por tipo (editar e reabrir dá o mesmo nó).
