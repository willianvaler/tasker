# Desempenho do editor (ED0/ED5, ESCOPO_V16)

Bancada reproduzível: `npm run bench:editor`.
- **Busca:** `scripts/bench/editor-busca.test.ts`, em Node.
- **Web:** `e2e-bench/editor.spec.ts`, pelo Playwright (Chromium, perfil desktop).
- **Dados:** gerados por `src/lib/__tests__/fixtures/notas-geradas.ts`, com semente fixa.

## 25/11/2026 — este PC de desenvolvimento (web, Chromium sem interface)

| Cenário | Resultado |
|---|---|
| Anotação no teto (19.800 caracteres, 492 blocos, 3.095 palavras): abrir até ler | 651 ms |
| … de ler até editável | 179 ms |
| … digitar (do evento ao segundo quadro), 38 teclas | p95 34 ms, mediana 29 ms |
| … colar 20 KB num campo vazio | 727 ms |
| Busca da paleta em 100 mil anotações (`lib/search.ts`), 5 buscas | 308 a 668 ms |
| … com o texto sem acento guardado (preparo único: 728 ms) | 12 a 238 ms |

**Não medidos:**
- O celular de referência: faltam os modelos do dono (V16-3).
- A lista de banco com 10 mil páginas, que é do ED3.
- O sync entre dois aparelhos.
- Os cenários acima do teto de 20 mil caracteres (abrir 5.000 blocos, digitar em 20 mil palavras e colar 1 MB): hoje eles não existem.

## 25/11/2026 — ED5, com o teto de 1 milhão de caracteres (ED1) e a busca com o texto guardado

Mesmo PC: CachyOS, Ryzen 5 5600, RX 6750 XT, 32 GB, um dos dois aparelhos de referência (V16-3). A web roda no Chromium sem interface.

| Cenário do ED5 | Orçamento | Resultado | Situação |
|---|---|---|---|
| Abrir anotação com 5 mil blocos (206 mil caracteres, 32 mil palavras) | ≤ 800 ms até editável | 1,7 a 2,1 s até ler, mais 1,2 s até editar | **reprova** |
| Digitar em anotação de 20 mil palavras (119 mil caracteres) | p95 ≤ 50 ms | p95 51 a 55 ms (mediana 43); com 32 mil palavras, p95 70 a 83 ms | **reprova por pouco** |
| Buscar em 100 mil anotações | ≤ 300 ms | Busca comum: 60 a 130 ms. Uma palavra que está em quase todas: cerca de 400 ms | **passa** na busca comum, **reprova** no pior caso |
| Lista de banco com 10 mil páginas | ≤ 500 ms | não medido | depende do ED3 |
| Colar 1 MB | ≤ 2 s | 1,3 a 1,4 s | **passa** |
| Sincronizar uma edição entre dois aparelhos | ≤ 3 s | 514 ms depois de gravar (dois navegadores na mesma conta, PowerSync local) | **passa** |

**Moto E14**, o outro aparelho de referência: ainda não medido. Precisa do APK com o teto novo no aparelho do dono.

### O que foi feito

- **Busca:**
  - O texto sem acento de cada anotação fica guardado por versão (`foldedText`, chave id + `updated_at`).
  - As etiquetas só são lidas quando a busca pede.
  - A ordem usa o título já guardado.
  - Resultado nas cinco buscas da bancada: 308 a 668 ms antes, 60 a 400 ms depois.
- **Editor:** os links, o sumário e a contagem de palavras passaram para o `useDeferredValue`. Isso tirou essas contas da frente da tecla, mas não baixou o p95 da digitação.

### Plano para o que reprova (bloqueia o uso de anotações grandes no celular)

1. **Abrir:** a leitura desenha o texto inteiro de uma vez (`react-native-marked`). Passa a desenhar por blocos virtualizados (`lib/note-format.ts` já dá os blocos), com o sumário e os rodapés calculados à parte.
2. **Digitar:** o campo é controlado. A cada tecla, o texto inteiro volta para o `<textarea>` (no celular, para o `TextInput`). Acima de um tamanho (uns 50 mil caracteres), o campo passa a ser não controlado: o texto fica num `ref` e o estado só muda ao gravar ou ao chegar uma versão de outro aparelho.
3. **Busca no pior caso:** um índice de texto no SQLite do aparelho (FTS5, que o PowerSync suporta) em vez de varrer a lista em memória.
