// Exportar os gastos (ESCOPO_V9 §4): CSV e XLSX, funções puras (a tela só salva o arquivo). O
// XLSX é montado aqui mesmo (SpreadsheetML mínimo dentro de um zip sem compressão): duas abas,
// lançamentos (valor como número com formato de moeda, data como data) e resumo.

export type ExportRow = {
  spent_on: string;
  description: string;
  category: string | null;
  kind: string;
  amount_cents: number;
  currency: string;
  payer: string | null;
  method: string | null;
  note: string | null;
};

/** Cabeçalhos e palavras no idioma da tela (o módulo é puro: quem chama traduz). */
export type ExportLabels = {
  date: string;
  description: string;
  category: string;
  kind: string;
  amount: string;
  currency: string;
  payer: string;
  method: string;
  note: string;
  out: string;
  in: string;
  /** Aba de resumo */
  entries: string;
  summary: string;
  spent: string;
  received: string;
  balance: string;
  month: string;
  noCategory: string;
};

const kindLabel = (row: ExportRow, labels: ExportLabels) =>
  row.kind === 'in' ? labels.in : labels.out;

/**
 * CSV que o Excel abre direto: BOM UTF-8 (acentos), e em pt/es separador ";" com vírgula decimal;
 * em en, "," e ponto. Valor sempre positivo; a coluna Tipo diz se é saída ou entrada.
 */
export function expensesCsv(rows: ExportRow[], labels: ExportLabels, decimalComma: boolean) {
  const sep = decimalComma ? ';' : ',';
  const cell = (value: string) =>
    /["\n\r]/.test(value) || value.includes(sep) ? `"${value.replace(/"/g, '""')}"` : value;
  const amount = (cents: number) => {
    const text = (cents / 100).toFixed(2);
    return decimalComma ? text.replace('.', ',') : text;
  };
  const header = [
    labels.date,
    labels.description,
    labels.category,
    labels.kind,
    labels.amount,
    labels.currency,
    labels.payer,
    labels.method,
    labels.note,
  ];
  const lines = rows.map((r) =>
    [
      r.spent_on,
      r.description,
      r.category ?? '',
      kindLabel(r, labels),
      amount(r.amount_cents),
      r.currency,
      r.payer ?? '',
      r.method ?? '',
      r.note ?? '',
    ]
      .map(cell)
      .join(sep),
  );
  return `﻿${[header.map(cell).join(sep), ...lines].join('\r\n')}\r\n`;
}

// ---- XLSX ----

const xml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de controle não são XML válido
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** "2026-10-19" → número de série do Excel (dias desde 30/12/1899). */
export function excelDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** Formato de moeda do Excel ("R$ 1.234,56" no Excel em português). */
function currencyFormat(currency: string) {
  const symbol: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€', GBP: '£' };
  return `"${symbol[currency] ?? currency} "#,##0.00`;
}

const column = (n: number) => String.fromCharCode(65 + n);

type Cell = { s: string } | { n: number; style?: number } | null;

function sheetXml(rows: Cell[][], widths: number[]) {
  const cols = widths.map(
    (w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
  );
  const body = rows
    .map((cells, r) => {
      const content = cells
        .map((c, i) => {
          if (!c) return '';
          const ref = `${column(i)}${r + 1}`;
          if ('s' in c)
            return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(c.s)}</t></is></c>`;
          return `<c r="${ref}"${c.style ? ` s="${c.style}"` : ''}><v>${c.n}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${content}</row>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols.join('')}</cols><sheetData>${body}</sheetData></worksheet>`
  );
}

// Estilos: 0 normal, 1 cabeçalho (negrito), 2 data, 3 moeda
const STYLE = { date: 2, money: 3 } as const;

function stylesXml(currency: string) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="${xml(currencyFormat(currency))}"/></numFmts>` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs></styleSheet>'
  );
}

/** Resumo: por categoria (saídas) e por mês (saídas, entradas, saldo). */
function summaryRows(rows: ExportRow[], labels: ExportLabels): Cell[][] {
  const categories = new Map<string, number>();
  const months = new Map<string, { out: number; in: number }>();
  for (const r of rows) {
    const month = months.get(r.spent_on.slice(0, 7)) ?? { out: 0, in: 0 };
    if (r.kind === 'in') month.in += r.amount_cents;
    else {
      month.out += r.amount_cents;
      const key = r.category || labels.noCategory;
      categories.set(key, (categories.get(key) ?? 0) + r.amount_cents);
    }
    months.set(r.spent_on.slice(0, 7), month);
  }
  const money = (cents: number): Cell => ({ n: cents / 100, style: STYLE.money });
  const out: Cell[][] = [[{ s: labels.category }, { s: labels.spent }]];
  for (const [category, cents] of [...categories].sort((a, b) => b[1] - a[1]))
    out.push([{ s: category }, money(cents)]);
  out.push([]);
  out.push([
    { s: labels.month },
    { s: labels.spent },
    { s: labels.received },
    { s: labels.balance },
  ]);
  for (const [month, v] of [...months].sort((a, b) => a[0].localeCompare(b[0])))
    out.push([{ s: month }, money(v.out), money(v.in), money(v.in - v.out)]);
  return out;
}

/** Planilha .xlsx (bytes) com as abas de lançamentos e de resumo. */
export function expensesXlsx(
  rows: ExportRow[],
  labels: ExportLabels,
  currency: string,
): Uint8Array {
  const entries: Cell[][] = [
    [
      { s: labels.date },
      { s: labels.description },
      { s: labels.category },
      { s: labels.kind },
      { s: labels.amount },
      { s: labels.currency },
      { s: labels.payer },
      { s: labels.method },
      { s: labels.note },
    ],
    ...rows.map((r): Cell[] => [
      { n: excelDate(r.spent_on), style: STYLE.date },
      { s: r.description },
      r.category ? { s: r.category } : null,
      { s: kindLabel(r, labels) },
      { n: r.amount_cents / 100, style: STYLE.money },
      { s: r.currency },
      r.payer ? { s: r.payer } : null,
      r.method ? { s: r.method } : null,
      r.note ? { s: r.note } : null,
    ]),
  ];
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      head +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      head +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      head +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>` +
        `<sheet name="${xml(labels.entries.slice(0, 31))}" sheetId="1" r:id="rId1"/>` +
        `<sheet name="${xml(labels.summary.slice(0, 31))}" sheetId="2" r:id="rId2"/>` +
        '</sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      head +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${rel}/worksheet" Target="worksheets/sheet2.xml"/>` +
        `<Relationship Id="rId3" Type="${rel}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ],
    ['xl/styles.xml', stylesXml(currency)],
    ['xl/worksheets/sheet1.xml', sheetXml(entries, [12, 36, 18, 10, 14, 8, 18, 14, 30])],
    ['xl/worksheets/sheet2.xml', sheetXml(summaryRows(rows, labels), [20, 16, 16, 16])],
  ];
  return zipStore(files.map(([name, text]) => [name, utf8(text)]));
}

// ---- zip sem compressão ----

const utf8 = (text: string) => new TextEncoder().encode(text);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Zip (método 0, "store") com os arquivos dados. Basta para o Excel e o LibreOffice. */
export function zipStore(files: [string, Uint8Array][]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = utf8(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
