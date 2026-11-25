import { describe, expect, it } from '@jest/globals';

import {
  formatDayInput,
  nextMaintenance,
  parsePastDay,
  planStatus,
  sortPlans,
  type MaintenancePlan,
} from '../maintenance';

const plan = (o: Partial<MaintenancePlan>): MaintenancePlan => ({
  id: 'p',
  equipment_id: 'e',
  name: 'Limpar o filtro',
  every_n: 90,
  unit: 'dias',
  last_done_on: null,
  page_id: null,
  paused: false,
  next_on: null,
  task_id: null,
  ...o,
});

describe('próxima manutenção (mesmos casos do pgTAP equipamentos.test.sql)', () => {
  it('conta a partir do último feito', () => {
    expect(nextMaintenance('2026-09-01', 90, 'dias', '2026-11-25')).toBe('2026-11-30');
  });
  it('sem último feito, é hoje', () => {
    expect(nextMaintenance(null, 3, 'meses', '2026-11-25')).toBe('2026-11-25');
  });
  it('em meses, o fim do mês se ajusta como no Postgres', () => {
    expect(nextMaintenance('2026-01-31', 1, 'meses', '2026-01-31')).toBe('2026-02-28');
    expect(nextMaintenance('2024-02-29', 12, 'meses', '2024-02-29')).toBe('2025-02-28');
  });
});

describe('situação e ordem', () => {
  const today = '2026-11-25';
  it('atrasado, hoje, em breve, tranquilo e parado', () => {
    expect(planStatus(plan({ next_on: '2026-11-20' }), today)).toBe('late');
    expect(planStatus(plan({ next_on: today }), today)).toBe('today');
    expect(planStatus(plan({ next_on: '2026-12-01' }), today)).toBe('soon');
    expect(planStatus(plan({ next_on: '2027-01-10' }), today)).toBe('ok');
    expect(planStatus(plan({ next_on: '2026-11-20', paused: true }), today)).toBe('paused');
  });
  it('sem a data do servidor, usa a conta local', () => {
    expect(planStatus(plan({ last_done_on: '2026-09-01' }), today)).toBe('soon');
  });
  it('o que pede atenção vem primeiro', () => {
    const ids = sortPlans(
      [
        plan({ id: 'ok', next_on: '2027-01-10' }),
        plan({ id: 'parado', paused: true, next_on: '2026-01-01' }),
        plan({ id: 'atrasado', next_on: '2026-11-01' }),
        plan({ id: 'breve', next_on: '2026-11-28' }),
      ],
      today,
    ).map((p) => p.id);
    expect(ids).toEqual(['atrasado', 'breve', 'ok', 'parado']);
  });
});

describe('data digitada (último feito, compra)', () => {
  const today = '2026-11-25';
  it('aceita os formatos comuns', () => {
    expect(parsePastDay('hoje', today)).toBe(today);
    expect(parsePastDay('2026-09-01', today)).toBe('2026-09-01');
    expect(parsePastDay('1/9', today)).toBe('2026-09-01');
    expect(parsePastDay('01/09/26', today)).toBe('2026-09-01');
    expect(parsePastDay('15/03/2024', today)).toBe('2024-03-15');
  });
  it('o campo preenchido ao editar volta a mesma data', () => {
    expect(parsePastDay(formatDayInput('2026-09-01'), today)).toBe('2026-09-01');
  });
  it('dia e mês sem ano no futuro é do ano passado', () => {
    expect(parsePastDay('25/12', today)).toBe('2025-12-25');
  });
  it('recusa data inválida, futura ou vazia', () => {
    expect(parsePastDay('31/02/2026', today)).toBeNull();
    expect(parsePastDay('2027-01-01', today)).toBeNull();
    expect(parsePastDay('', today)).toBeNull();
    expect(parsePastDay('ontem à noite', today)).toBeNull();
  });
});
