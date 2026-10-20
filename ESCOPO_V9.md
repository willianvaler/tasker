# Questlist — Escopo V9: gastos e fluxo de caixa no projeto, com leitura de notas por foto (instruções para o Claude Code)

Pedido do dono em 19/10/2026: "No gerenciamento de projetos, adicionar a possibilidade de adicionar uma página de controle de gastos e fluxo. Deve ser possível fazer lançamentos de gastos a partir de fotos de notas, identificar os gastos com uma OCR (ou alguma coisa assim) e adicionar na 'planilha'. Permitir exportar os gastos em CSV e XLSX." E: "já existe uma especificação de OCR pendente, podemos juntar as coisas e adicionar a parte de gastos junto e finalizar logo."

A "especificação de OCR pendente" eram duas linhas de backlog: **ESCOPO §11** ("Import de listas por foto/áudio (OCR / voz → lote)") e **ESCOPO_V3 §6 item C** ("Captura por foto (OCR): foto de uma lista de papel vira tarefas"). Este escopo junta as duas coisas num **leitor de foto só**, com duas saídas: **lançamentos de gasto** (nota, recibo, cupom) e **tarefas** (lista de papel → criação em lote). Também absorve o item B do V3 "Custos e orçamento" na parte de gastos do projeto (o racha de contas fica opcional, §6). Em conflito com escopos anteriores, este vence.

## 1. Página de gastos

- Tipo de página novo, **Gastos**, ao lado de lista, cards e hábitos (menu Novo → Página). Pode existir em qualquer pasta, mas o caso principal é **dentro de um projeto** (reforma, viagem, evento, obra).
- A página é uma **planilha**: uma linha por lançamento, com **data**, **descrição**, **categoria**, **valor**, **tipo** (saída ou entrada: o "fluxo"), **quem pagou** (membro do projeto), **forma de pagamento** (opcional), **nota anexada** (foto) e **observação**.
- Edição na própria linha, como uma planilha: Tab passa de campo, Enter cria o próximo lançamento, setas navegam; no celular, toque abre o lançamento numa folha.
- Topo da página: **saldo** (entradas − saídas), **total gasto no período**, **orçamento** (opcional) com barra de quanto já foi, e **por categoria** (barras). Filtro por período (mês, todo o projeto, intervalo), categoria e quem pagou.
- **Categorias** por projeto, com um conjunto inicial (Material, Mão de obra, Transporte, Alimentação, Hospedagem, Serviços, Outros), editável.
- Lançamento pode ser **ligado a uma tarefa** do projeto ("Comprar piso" → R$ 1.840,00), e a tarefa mostra o valor gasto; o projeto soma.
- **Moeda:** uma por projeto (padrão do idioma: BRL em pt-BR). Valores em centavos inteiros no banco, nunca ponto flutuante.

## 2. Lançar a partir da foto da nota

- Botão **Foto da nota** na página de gastos (e no menu Novo, quando a pessoa estiver numa página de gastos): câmera ou galeria; várias fotos de uma vez.
- O app lê a nota e propõe o lançamento: **estabelecimento** (descrição), **data**, **valor total**, **forma de pagamento** quando aparecer, **CNPJ** e, quando der, os **itens** (cada um com valor). A pessoa confere numa pré-visualização (como a criação em lote, D16), corrige o que estiver errado, escolhe a categoria e salva. Nada entra sem confirmação.
- Opção **um lançamento por nota** (padrão) ou **um por item** (útil em compra grande de material).
- **Nota fiscal eletrônica (NFC-e) brasileira:** a maioria dos cupons tem um **QR Code** com a chave de acesso. Ler o QR primeiro dá a chave (CNPJ do emitente, estado, mês) com 100 % de acerto e serve para **não lançar a mesma nota duas vezes**; o valor e os itens continuam vindo da leitura da foto (consultar a SEFAZ é diferente em cada estado e fica fora).
- A foto vira **anexo** do lançamento (bucket `attachments`, D150 a D153: mesma redução de imagem, mesmos limites, mesma lixeira).
- **Sem internet:** a foto fica na fila e é lida quando voltar a conexão; o lançamento pode ser digitado na mão a qualquer hora.
- Leitura que não achou nada útil diz isso e abre o lançamento em branco com a foto anexada.

## 3. Foto de uma lista de papel vira tarefas (o OCR que estava pendente)

- Na captura rápida e na criação em lote: **Foto** → o texto lido vira o texto da criação em lote (com a sintaxe rápida de sempre: datas, `!`, `#etiqueta`, `@nome`, `3x12`), com a mesma pré-visualização. Lista de academia no papel vira página de treino do mesmo jeito.
- Usa o mesmo leitor do §2; só muda o que se pede a ele (texto em linhas, não uma nota).

## 4. Exportar

- **CSV** (separador `;` e vírgula decimal em pt-BR/es, `,` e ponto em en; UTF-8 com BOM para o Excel abrir acentuado) e **XLSX** (valores como número com formato de moeda, data como data, uma aba de lançamentos e uma de resumo por categoria e por mês).
- Exporta o que o filtro mostra (período, categoria, quem pagou). No celular, abre o Compartilhar (como a exportação de dados, `saveTextFile`); na web, baixa.
- Fotos das notas não entram no arquivo; opção de exportar um **.zip com as fotos** fica para depois.

## 5. Dados, permissão e sync

- Tabela `expenses` (página, pasta desnormalizada por trigger, data, descrição, categoria, valor em centavos, tipo, quem pagou, forma de pagamento, tarefa ligada, anexo, chave da NFC-e, dados da leitura, quem criou, datas) e `expense_categories` (por projeto). RLS por `has_permission(folder_id, ...)`, permissões novas `expense.view`/`expense.write` nos presets (Leitor vê, não lança; Colaborador lança e edita os seus; Gestor e Dono editam todos), em `can()` e em `public.permission_presets()`.
- Sincroniza pelo PowerSync (funciona offline, D86), entra no Realtime e no `AFFECTS`, na lixeira e na exportação/exclusão de conta (LGPD).
- Valor e totais: somas no banco (view ou RPC) e o mesmo cálculo puro no app para a tela offline, com os mesmos casos nos dois testes.

## 6. Depois (não entra na primeira entrega)

- **Racha de contas** entre os membros (quem deve a quem), do V3 item B.
- Gastos recorrentes (aluguel, assinatura) e lembrete de vencimento.
- Importar extrato do banco (OFX/CSV).
- Gráfico de fluxo por mês.

## 7. Decisões do dono

| # | Pergunta | Resposta |
|---|---|---|
| V9-1 | Quem lê a foto | **Gemini, com a chave gratuita do dono** (19/10), trocável por plano pago sem mudar código (D219) |
| V9-2 | Terceiro novo (LGPD) | Política atualizada nos 3 idiomas dizendo do plano gratuito; aceite de novo (D219) |
| V9-3 | Limite de leituras por conta | **Sem limite enquanto for teste** (19/10, D220): `photo_read_limit()` nulo; voltar a limitar é uma migração |
| V9-4 | Racha de contas já na primeira entrega? | Não (§6) |

## 8. Ordem sugerida

| Id | Tarefa | Depende |
|---|---|---|
| GA1 | Tabelas, RLS, permissões, sync, pgTAP | — |
| GA2 | Tipo de página Gastos: planilha, totais, filtros, categorias | GA1 |
| GA3 | Exportar CSV e XLSX (funções puras com teste + botão) | GA2 |
| GA4 | Leitor de foto (Edge Function ou aparelho, conforme V9-1), com limite e registro de uso | V9-1, V9-2 |
| GA5 | Foto da nota → pré-visualização → lançamento; QR da NFC-e para não duplicar | GA2, GA4 |
| GA6 | Foto de lista → criação em lote (o OCR do ESCOPO §11 e V3 §6 C) | GA4 |
| GA7 | Ajuda nos 3 idiomas, E2E, capturas | GA5, GA6 |
