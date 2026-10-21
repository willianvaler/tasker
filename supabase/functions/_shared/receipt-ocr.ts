// Texto do OCR (Tesseract) de uma nota → os mesmos campos que o Gemini devolvia (D254), para o
// `lib/photo-read.ts` do app conferir como antes. Feito para o cupom brasileiro (NFC-e, SAT, cupom
// fiscal), mas não depende dele: o que não acha fica nulo e a pessoa completa na revisão.
// Sem imports: roda no Node/Metro (testes) e no Deno (Edge Function `read-photo`).

export type ReceiptRead = {
  readable: boolean;
  store: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  payment_method: string | null;
  tax_id: string | null;
  access_key: string | null;
  category: string | null;
  items: { description: string; amount: number }[];
};

/** Maiúsculas sem acento, para comparar ("CARTÃO" → "CARTAO") */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// "1.234,56", "87,90", "87.90"; o último da linha é o valor
const MONEY = /(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[,.]\d{2}(?!\d)/g;

/** "1.234,56" → 1234.56 */
export function parseAmount(s: string): number | null {
  const digits = s.replace(/[^\d,.]/g, '');
  const m = /^(.*)[,.](\d{2})$/.exec(digits);
  if (!m) return null;
  const n = Number(`${m[1].replace(/[,.]/g, '')}.${m[2]}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lastAmount(line: string): number | null {
  const found = line.match(MONEY);
  return found ? parseAmount(found[found.length - 1]) : null;
}

// Linhas que nunca são o nome da loja
const NOT_STORE =
  /CNPJ|CPF|\bIE\b|INSCR|\bRUA\b|\bR\.|\bAV\b|AVENIDA|RODOVIA|ESTRADA|CEP|BAIRRO|DOCUMENTO|CUPOM|NFC|NF-?E|NOTA FISCAL|DANFE|EXTRATO|\bSAT\b|FONE|TEL|CONSUMIDOR|ELETRONIC|\d{4,}/;

// Do mais forte ao mais fraco: o total pago, não o subtotal nem a contagem de itens
const TOTAL_LABELS = [
  /(VALOR|TOTAL)\s*A\s*PAGAR/,
  /VALOR\s*TOTAL|TOTAL\s*(R\$|GERAL)|^\s*TOTAL\b/,
  /VALOR\s*PAGO/,
];
const NOT_TOTAL = /ITENS|QTD|QUANT|SUBTOTAL|SUB-TOTAL|TRIBUTO|IMPOSTO|DESCONTO|ACRESC|LEI\s*12/;

const PAYMENTS: [RegExp, string][] = [
  [/\bPIX\b/, 'pix'],
  [/CART[AO]|CREDITO|DEBITO|\bVISA\b|MASTER|\bELO\b|MAESTRO/, 'card'],
  [/DINHEIRO|ESPECIE/, 'cash'],
  [/BOLETO/, 'boleto'],
  [/TRANSFER|\bTED\b|\bDOC\b/, 'transfer'],
];

const CATEGORIES: [RegExp, string][] = [
  [
    /CONSTRU|MATERIA(L|IS)|FERRAG|TINTAS|MADEIR|ELETRIC|HIDRAUL|LEROY|TELHA|CIMENTO|HOME CENTER/,
    'material',
  ],
  [
    /MERCAD|SUPERM|ATACAD|PADARIA|PANIFIC|RESTAURANTE|LANCHONETE|PIZZ|BAR\b|CAFE|ACOUGUE|HORTI|FOOD|ALIMENT/,
    'food',
  ],
  [
    /POSTO|COMBUST|GASOLINA|ETANOL|DIESEL|ESTACION|PEDAGIO|UBER|99\s*POP|ONIBUS|PASSAGE/,
    'transport',
  ],
  [/HOTEL|POUSADA|HOSTEL|MOTEL|AIRBNB/, 'lodging'],
];

function findStore(lines: string[], folded: string[]): string | null {
  // O nome vem antes do CNPJ; sem CNPJ, nas primeiras linhas
  const cnpjAt = folded.findIndex((l) => /CNPJ/.test(l));
  const end = cnpjAt > 0 ? cnpjAt : Math.min(lines.length, 6);
  for (let i = 0; i < end; i++) {
    const letters = folded[i].replace(/[^A-Z]/g, '');
    if (letters.length >= 3 && !NOT_STORE.test(folded[i])) return clean(lines[i]).slice(0, 200);
  }
  return null;
}

function findDate(folded: string[]): string | null {
  const re = /\b(\d{2})[/.-](\d{2})[/.-](\d{4}|\d{2})\b/;
  // Prefere a linha da emissão; senão a primeira data válida
  const order = [
    ...folded.filter((l) => /EMISS|DATA/.test(l)),
    ...folded.filter((l) => !/EMISS|DATA|VALID|VENC/.test(l)),
  ];
  for (const line of order) {
    const m = re.exec(line);
    if (!m) continue;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) continue;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

function findTotal(folded: string[]): number | null {
  for (const label of TOTAL_LABELS) {
    for (let i = 0; i < folded.length; i++) {
      if (!label.test(folded[i]) || NOT_TOTAL.test(folded[i])) continue;
      // O valor às vezes vai na linha de baixo
      const value = lastAmount(folded[i]) ?? (folded[i + 1] ? lastAmount(folded[i + 1]) : null);
      if (value) return value;
    }
  }
  return null;
}

function findAccessKey(folded: string[]): string | null {
  // 44 dígitos, em geral em grupos de 4 numa ou mais linhas depois de "CHAVE DE ACESSO"
  const keyAt = folded.findIndex((l) => /CHAVE/.test(l));
  const starts = keyAt >= 0 ? [keyAt, ...folded.keys()] : [...folded.keys()];
  for (const start of starts) {
    let digits = '';
    for (let i = start; i < folded.length && i < start + 5; i++) {
      const line = folded[i];
      if (i > start && /[A-Z]{3,}/.test(line)) break;
      digits += line.replace(/\D/g, '');
      if (digits.length >= 44) break;
    }
    if (digits.length === 44) return digits;
  }
  return null;
}

function findPayment(folded: string[]): string | null {
  // Primeiro depois de "FORMA DE PAGAMENTO"; senão no cupom inteiro
  const at = folded.findIndex((l) => /PAGAMENTO|PAGTO/.test(l));
  const zones = at >= 0 ? [folded.slice(at), folded] : [folded];
  for (const zone of zones) {
    const text = zone.join('\n');
    for (const [re, method] of PAYMENTS) if (re.test(text)) return method;
  }
  return null;
}

const UNIT = '(UN|UND|UNID|KG|G|L|LT|ML|PC|PCT|CX|M|M2|M3|FD|DZ)';
const IS_UNIT = new RegExp(`^${UNIT}$`, 'i');
const IS_QTY_UNIT = new RegExp(`^\\d+(?:[.,]\\d+)?${UNIT}$`, 'i');
const IS_NUMBER = /^\d+(?:[.,]\d+)?$/;
const IS_PRICE_OR_X = /^(?:[xX*]|(?:\d{1,3}(?:\.\d{3})+|\d+)[.,]\d{2,3}|R\$)$/;

/** Tira do fim o preço, o "X" e UMA quantidade ("1 UN", "0,532KG", "2"): o "500G" do nome fica. */
function itemName(rest: string): string {
  const tokens = rest.split(' ');
  while (tokens.length && IS_PRICE_OR_X.test(tokens[tokens.length - 1])) tokens.pop();
  const last = tokens[tokens.length - 1] ?? '';
  if (IS_UNIT.test(last) && IS_NUMBER.test(tokens[tokens.length - 2] ?? '')) tokens.splice(-2);
  else if (IS_QTY_UNIT.test(last) || IS_NUMBER.test(last)) tokens.pop();
  while (tokens.length && IS_PRICE_OR_X.test(tokens[tokens.length - 1])) tokens.pop();
  // código de barras logo depois do número do item
  if (/^\d{6,14}$/.test(tokens[0] ?? '')) tokens.shift();
  return tokens.join(' ');
}

/** "001 7891234567890 CAFE TORRADO 500G 1 UN X 32,90 32,90" → { CAFE TORRADO 500G, 32.90 } */
function findItems(lines: string[]): { description: string; amount: number }[] {
  const items: { description: string; amount: number }[] = [];
  for (const raw of lines) {
    const m = /^(\d{1,4})\s+(.+)$/.exec(clean(raw));
    if (!m) continue;
    const found = m[2].match(MONEY);
    const amount = found ? parseAmount(found[found.length - 1]) : null;
    if (!amount) continue;
    const description = clean(itemName(m[2]));
    if (/[A-Za-zÀ-ú]{2,}/.test(description))
      items.push({ description: description.slice(0, 200), amount });
  }
  return items.slice(0, 100);
}

function guessCategory(text: string): string | null {
  for (const [re, category] of CATEGORIES) if (re.test(text)) return category;
  return null;
}

export function parseReceiptText(text: string): ReceiptRead {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const folded = lines.map(fold);
  const store = findStore(lines, folded);
  const total = findTotal(folded);
  const items = findItems(lines);
  const cnpj = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.exec(folded.join('\n'));
  return {
    // Sem nenhum valor não é nota (ou não deu para ler): o app pede para lançar à mão
    readable: Boolean(total || items.length),
    store,
    date: findDate(folded),
    total,
    currency: /R\$/.test(text) ? 'BRL' : null,
    payment_method: findPayment(folded),
    tax_id: cnpj ? cnpj[0].replace(/\D/g, '') : null,
    access_key: findAccessKey(folded),
    category: guessCategory(fold(`${store ?? ''}\n${items.map((i) => i.description).join('\n')}`)),
    items,
  };
}
