import { describe, expect, it } from '@jest/globals';

import {
  crc32,
  excelDate,
  expensesCsv,
  expensesXlsx,
  zipStore,
  type ExportLabels,
  type ExportRow,
} from '../export-expenses';

const labels: ExportLabels = {
  date: 'Data',
  description: 'Descrição',
  category: 'Categoria',
  kind: 'Tipo',
  amount: 'Valor',
  currency: 'Moeda',
  payer: 'Quem pagou',
  method: 'Forma de pagamento',
  note: 'Observação',
  out: 'Saída',
  in: 'Entrada',
  settle: 'Acerto',
  entries: 'Lançamentos',
  summary: 'Resumo',
  spent: 'Gasto',
  received: 'Entradas',
  balance: 'Saldo',
  month: 'Mês',
  noCategory: 'Sem categoria',
};

const rows: ExportRow[] = [
  {
    spent_on: '2026-10-02',
    description: 'Leroy Merlin; piso',
    category: 'Material',
    kind: 'out',
    amount_cents: 184050,
    currency: 'BRL',
    payer: 'Willian',
    method: 'Pix',
    note: 'nota "fiscal"',
  },
  {
    spent_on: '2026-10-10',
    description: 'Reembolso',
    category: null,
    kind: 'in',
    amount_cents: 5000,
    currency: 'BRL',
    payer: null,
    method: null,
    note: null,
  },
];

describe('CSV', () => {
  it('pt: ponto e vírgula, vírgula decimal, BOM e aspas onde precisa', () =>
    expect(expensesCsv(rows, labels, true)).toBe(
      '﻿Data;Descrição;Categoria;Tipo;Valor;Moeda;Quem pagou;Forma de pagamento;Observação\r\n' +
        '2026-10-02;"Leroy Merlin; piso";Material;Saída;1840,50;BRL;Willian;Pix;"nota ""fiscal"""\r\n' +
        '2026-10-10;Reembolso;;Entrada;50,00;BRL;;;\r\n',
    ));
  it('en: vírgula e ponto decimal', () =>
    expect(expensesCsv(rows, labels, false).split('\r\n')[1]).toBe(
      '2026-10-02,Leroy Merlin; piso,Material,Saída,1840.50,BRL,Willian,Pix,"nota ""fiscal"""',
    ));
});

describe('XLSX', () => {
  it('data do Excel', () => {
    expect(excelDate('1900-01-01')).toBe(2);
    expect(excelDate('2026-10-19')).toBe(46314);
  });
  it('crc32 conhecido', () =>
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926));

  it('zip com os arquivos, legível de volta', () => {
    const zip = zipStore([
      ['a.txt', new TextEncoder().encode('olá')],
      ['b/c.xml', new TextEncoder().encode('<x/>')],
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // Fim do diretório central: 2 arquivos
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(2);
    expect(new TextDecoder().decode(zip)).toContain('olá');
  });

  it('planilha com lançamentos, moeda e resumo', () => {
    const text = new TextDecoder().decode(expensesXlsx(rows, labels, 'BRL'));
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<sheet name="Lançamentos"');
    // Data como número de série com estilo de data; valor como número com estilo de moeda
    expect(text).toContain('<c r="A2" s="2"><v>46297</v></c>');
    expect(text).toContain('<c r="E2" s="3"><v>1840.5</v></c>');
    expect(text).toContain('nota &quot;fiscal&quot;');
    expect(text).toContain('formatCode="&quot;R$ &quot;#,##0.00"');
    // Resumo por mês: saldo 50 − 1840,50
    expect(text).toContain('<v>-1790.5</v>');
  });
});
