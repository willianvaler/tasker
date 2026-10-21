import { describe, expect, it } from '@jest/globals';

import { captureContext, captureTargetId } from '../capture-target';

const pages = [
  { id: 'inbox', folder_id: 'sys' },
  { id: 'a1', folder_id: 'A' },
  { id: 'a2', folder_id: 'A' },
  { id: 'sub1', folder_id: 'A-sub' },
  { id: 'treinoD', folder_id: 'B' },
];
const folderIds = (id: string) => (id === 'A' ? ['A', 'A-sub'] : [id]);

describe('captureContext', () => {
  it('lê a página ou a pasta da rota', () => {
    expect(captureContext('/page/p1')).toEqual({ page: 'p1' });
    expect(captureContext('/folder/f1')).toEqual({ folder: 'f1' });
    expect(captureContext('/')).toEqual({});
    expect(captureContext('/today')).toEqual({});
    expect(captureContext(undefined)).toEqual({});
  });
});

describe('captureTargetId', () => {
  it('fora de pasta não usa a última página visitada', () => {
    expect(captureTargetId({}, pages, folderIds, 'treinoD')).toBeUndefined();
  });
  it('na página aberta, ela', () => {
    expect(captureTargetId({ page: 'a2' }, pages, folderIds, 'treinoD')).toBe('a2');
  });
  it('na pasta, a última página se for dela (inclusive subpasta), senão a primeira', () => {
    expect(captureTargetId({ folder: 'A' }, pages, folderIds, 'treinoD')).toBe('a1');
    expect(captureTargetId({ folder: 'A' }, pages, folderIds, 'sub1')).toBe('sub1');
    expect(captureTargetId({ folder: 'B' }, pages, folderIds, 'a1')).toBe('treinoD');
  });
  it('pasta sem página ou página desconhecida: sem destino', () => {
    expect(captureTargetId({ folder: 'vazia' }, pages, folderIds, null)).toBeUndefined();
    expect(captureTargetId({ page: 'sumiu' }, pages, folderIds, null)).toBeUndefined();
  });
});
