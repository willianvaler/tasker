import { describe, expect, it } from '@jest/globals';

import { parseAmount, parseReceiptText } from '../../../supabase/functions/_shared/receipt-ocr';
import { normalizeReceipt } from '../photo-read';

// Texto como o Tesseract (tesseract-wasm, modelo por) devolveu de uma foto de cupom, com os erros
// de leitura de verdade ("901" no lugar de "001")
const CUPOM = `SUPERMERCADO BOM PRECO LTDA
CNPJ: 12.345.678/0001-90
RUA DAS FLORES, 123 - CENTRO

ITEM DESCRICAO QTD  VL TOTAL
901 CAFE TORRADO 500G 1 UN 32,90
002 PAO DE FORMA 1 UN 12,50

003 QUEIJO MUSSARELA 1 KG 42,50

QTD. TOTAL DE ITENS 3
VALOR TOTAL R$ 87,90
FORMA DE PAGAMENTO VALOR PAGO
PIX 87,90

EMISSAO: 18/10/2026 14:32:10
CHAVE DE ACESSO

3526 1012 3456 7800 0190 6500
1000 0123 4510 0012 3456
`;

const NFCE = `LEROY MERLIN CIA BRASILEIRA DE BRICOLAGEM
CNPJ 01.438.784/0012-34 IE 123456789
AV. DAS NAÇÕES UNIDAS, 1000
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
# CÓDIGO DESCRIÇÃO QTD UN VL UNIT VL TOTAL
1 7891234567895 PISO CERÂMICO 60X60 20 M2 X 90,00 1.800,00
2 7899876543210 REJUNTE 1KG 3 UN X 13,50 40,50
QTD. TOTAL DE ITENS 2
VALOR TOTAL R$ 1.840,50
DESCONTOS R$ 0,00
VALOR A PAGAR R$ 1.840,50
FORMA PAGAMENTO VALOR PAGO R$
CARTÃO DE CRÉDITO 1.840,50
Consulte pela Chave de Acesso em
www.nfce.fazenda.sp.gov.br
3526 1001 4387 8400 1234 6500 1000 0123 4510 0012 3456
NFC-e n 000012345 Série 001 18/10/26 10:15:00`;

describe('parseAmount', () => {
  it.each([
    ['87,90', 87.9],
    ['1.840,50', 1840.5],
    ['R$ 12.50', 12.5],
    ['0,00', null],
    ['abc', null],
  ])('%s', (s, v) => expect(parseAmount(s)).toBe(v));
});

describe('parseReceiptText', () => {
  it('cupom lido pelo Tesseract', () =>
    expect(parseReceiptText(CUPOM)).toEqual({
      readable: true,
      store: 'SUPERMERCADO BOM PRECO LTDA',
      date: '2026-10-18',
      total: 87.9,
      currency: 'BRL',
      payment_method: 'pix',
      tax_id: '12345678000190',
      access_key: '35261012345678000190650010000123451000123456',
      category: 'food',
      items: [
        { description: 'CAFE TORRADO 500G', amount: 32.9 },
        { description: 'PAO DE FORMA', amount: 12.5 },
        { description: 'QUEIJO MUSSARELA', amount: 42.5 },
      ],
    }));

  it('NFC-e com código de barras, milhar, total a pagar e cartão', () =>
    expect(parseReceiptText(NFCE)).toEqual({
      readable: true,
      store: 'LEROY MERLIN CIA BRASILEIRA DE BRICOLAGEM',
      date: '2026-10-18',
      total: 1840.5,
      currency: 'BRL',
      payment_method: 'card',
      tax_id: '01438784001234',
      access_key: '35261001438784001234650010000123451000123456',
      category: 'material',
      items: [
        { description: 'PISO CERÂMICO 60X60', amount: 1800 },
        { description: 'REJUNTE 1KG', amount: 40.5 },
      ],
    }));

  it('total na linha de baixo e sem itens', () =>
    expect(
      parseReceiptText('POSTO SERRA AZUL\nGASOLINA COMUM\nTOTAL\n250,00\nDINHEIRO'),
    ).toMatchObject({
      store: 'POSTO SERRA AZUL',
      total: 250,
      payment_method: 'cash',
      category: 'transport',
      items: [],
    }));

  it('subtotal e quantidade de itens não são o total', () =>
    expect(
      parseReceiptText('LOJA X\nSUBTOTAL 50,00\nQTD TOTAL DE ITENS 2\nTOTAL R$ 45,00').total,
    ).toBe(45));

  it('foto sem valor nenhum não é nota', () =>
    expect(parseReceiptText('um gato dormindo\nno sofá')).toMatchObject({
      readable: false,
      total: null,
      items: [],
    }));

  it('chave de acesso pela metade fica de fora', () =>
    expect(parseReceiptText('CHAVE DE ACESSO\n3526 1012 3456').access_key).toBeNull());

  it('passa pela conferência do app como o Gemini passava', () =>
    expect(normalizeReceipt(parseReceiptText(CUPOM), '2026-10-21')).toMatchObject({
      readable: true,
      description: 'SUPERMERCADO BOM PRECO LTDA',
      amount_cents: 8790,
      spent_on: '2026-10-18',
      method: 'pix',
      category: 'food',
      items: [
        { description: 'CAFE TORRADO 500G', amount_cents: 3290 },
        { description: 'PAO DE FORMA', amount_cents: 1250 },
        { description: 'QUEIJO MUSSARELA', amount_cents: 4250 },
      ],
    }));
});
