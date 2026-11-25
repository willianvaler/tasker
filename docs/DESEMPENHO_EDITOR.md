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
