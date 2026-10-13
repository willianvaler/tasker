# Design — "Caderno de bolso"

Direção da V2 §12.2 com as regras concretas da V3 §0.3. Papel, tinta e **um** acento. Interface de ferramenta séria e calma: linhas em vez de caixas, gamificação como marcação discreta. Referência visual: `docs/mockups/` (HTML estático) e a página `/design` do app (só em desenvolvimento). Se um mockup aprovado divergir desta página, o mockup vence e esta página é atualizada.

**Regra de ouro:** nenhum valor solto em componente. Cor, tamanho de fonte, peso, espaço, raio e duração vêm daqui. O teste `src/lib/__tests__/design-tokens.test.ts` barra cor hexadecimal e classes fora da escala.

## Cores

Definidas uma vez em `src/global.css` (variáveis RGB) e espelhadas em `src/lib/tokens.ts` para o que não aceita classe (tema da navegação, placeholder, traço de SVG). O teste compara os dois.

| Token (classe) | Uso | Claro | Escuro |
|---|---|---|---|
| `paper` | fundo da tela | `#F6F2EA` | `#1B1A17` |
| `surface` | barra lateral, painéis, folhas | `#FBF8F2` | `#23211D` |
| `wash` | hover / pressionado / seleção sutil | `#EDE7DB` | `#2C2A25` |
| `ink` | texto | `#1F1D1A` | `#ECE6DA` |
| `ink-muted` | metadados, rótulos, placeholder | `#6B655B` | `#9B9487` |
| `line` | divisórias e bordas (1 px) | `#E2DBCD` | `#34312B` |
| `accent` | estado ativo, foco, progresso, botão primário | `#D8452B` | `#F0644A` |
| `accent-soft` | fundo de destaque leve (chip ativo, aviso) | `#F6D9D2` | `#3A2420` |
| `on-accent` | texto sobre `accent` | `#FBF8F2` | `#1B1A17` |
| `ok` | concluído, sincronizado | `#3F7D4E` | `#6DB27D` |
| `warn` | atraso, atenção | `#C58A12` | `#E0A93A` |
| `danger` | erro e ação destrutiva | `#B3261E` | `#F2766B` |

- Fundo nunca branco puro nem preto puro; escuro é carvão quente, não azul-marinho.
- **No máximo um acento por tela** em uso forte. `danger` só para erro e "apagar".
- Cor de marcador de pasta/projeto: paleta curada de 10 tons terrosos (`MARKER_COLORS` em `src/lib/tokens.ts`), usada numa barrinha lateral de 3 px e no ícone, nunca em fundo grande.

## Tipografia

| Papel | Família | Pesos |
|---|---|---|
| Títulos de página e nomes de pasta/projeto | **Fraunces** (serifada) | 500 |
| Interface e leitura | **Instrument Sans** | 400, 600 |
| Números, atalhos, metadados, XP/HP | **JetBrains Mono** | 400 |

Fontes empacotadas no app (`@expo-google-fonts/*`), sem CDN. No React Native, cada peso é uma família própria. Por isso todo texto usa o `Text` de `src/components/ui/text.tsx`, que escolhe a família pelas classes `font-serif` / `font-mono` / `font-semibold`. Nunca importe `Text` direto do `react-native`.

Escala (só estes 5):

| Classe | Tamanho / linha | Uso |
|---|---|---|
| `text-xs` | 12 / 16 | metadados, mono, rótulo de seção (caixa-alta, `tracking-wide`) |
| `text-sm` | 14 / 20 | texto da interface (padrão) |
| `text-base` | 16 / 24 | texto de leitura (notas, ajuda) |
| `text-lg` | 20 / 28 | título de seção |
| `text-xl` | 28 / 34 | título de página (serifado) |

Pesos: `font-normal` (400) e `font-semibold` (600); `font-serif` já vem em 500. Nenhum outro.

## Espaço, raio, borda, sombra

- **Espaçamento** (padding, margin, gap): 4 · 8 · 12 · 16 · 24 · 32 · 48 px = classes `1 · 2 · 3 · 4 · 6 · 8 · 12`. Nenhum outro valor. Largura e altura usam a escala normal do Tailwind.
- **Raios:** `rounded` (4 px, controles) e `rounded-lg` (8 px, painéis). `rounded-full` só para avatar e ponto de status.
- **Bordas:** 1 px `border-line`. Preferir **espaço** a borda para separar grupos; nada de caixa dentro de caixa.
- **Sombra:** nenhuma em cartão. Painel lateral e folha inferior usam borda; só o popover tem uma sombra mínima para descolar do fundo.

## Medidas fixas

| Item | Desktop | Celular |
|---|---|---|
| Linha de tarefa | 40 px | 52 px |
| Botão | 32 px | 44 px |
| Alvo de toque | — | ≥ 44 px |
| Ícone | 16 px inline, 20 px navegação/botões; traço 1,5 px (Lucide) | igual |
| Barra lateral | 256 px, fundo `surface`, item 32 px, rótulo de seção 12 px caixa-alta | — (barra inferior) |
| Painel de detalhes | 400 px, desliza da direita em 150 ms | folha de baixo para cima |
| Área de leitura | máx. 760 px centralizada | largura toda, margem 16 px |
| Foco | anel 2 px `accent`, offset 2 px | — |

## Componentes

Só **duas** variantes de botão: **primário** (fundo `accent`, texto `on-accent`) e **fantasma** (sem fundo, hover `wash`). "Apagar" é um botão primário dentro de um diálogo de confirmação (o próprio diálogo diz o que vai acontecer).

Todos os estados existem: hover, foco, pressionado, desabilitado (opacidade 40 %), carregando, vazio, erro.

Elementos de assinatura:
- **Concluir = carimbo + risco.** A caixa vira um "X traçado à mão" em `accent` (SVG) e um risco de caneta atravessa o título (180 ms). Com "reduzir movimento", aparece direto, sem animação.
- **Progresso como régua:** linha de 2 px em `line` com o trecho feito em `accent`; nada de barra gorda arredondada.
- **Boss:** faixa estreita no topo da Hoje com nome, linha de HP de 2 px e `HP 640/900` em mono.
- **XP/nível:** número pequeno em mono no cabeçalho + fio de 2 px.
- **Estado vazio:** uma frase com humor leve (nos 3 idiomas) e um traço simples; nunca "Sem dados".

## Movimento

100–180 ms, `ease-out`. Constantes em `src/lib/tokens.ts` (`DURATION.fast = 100`, `base = 150`, `slow = 180`). Respeitar `prefers-reduced-motion` (Reanimated: `useReducedMotion`).

## Checklist anti "cara de IA" (antes de fechar cada tela)

- [ ] Sem gradiente, glow, blur, glassmorphism.
- [ ] Sem emoji decorativo em título, botão ou navegação (emoji só como ícone escolhido pelo usuário e no personagem do jogo).
- [ ] Um acento forte por tela, no máximo.
- [ ] Sem sombra "flutuante" em cartões; linhas e espaço em vez de caixas.
- [ ] Hierarquia por tamanho, peso e posição, não por caixas.
- [ ] Só tamanhos e espaços da escala; alinhamentos batendo na grade de 4 px.
- [ ] Todos os estados (hover, foco, vazio, erro, carregando).
