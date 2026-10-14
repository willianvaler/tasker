import { describe, expect, test } from '@jest/globals';

import { can, GRANTABLE, OWN_RULE, PERMISSIONS, PRESETS, roleCan } from '../permissions';
import ptBR from '../../i18n/locales/pt-BR.json';

declare const require: (id: string) => unknown;

const ana = 'ana';
const bia = 'bia';

describe('can() (mesmos casos do pgTAP v2_permissoes)', () => {
  test.each([
    ['owner', 'project.delete', true],
    ['manager', 'project.delete', false],
    ['manager', 'member.manage', true],
    ['editor', 'member.manage', false],
    ['editor', 'task.edit', true],
    ['editor', 'automation.manage', false],
    ['editor', 'workflow.view_audit', true],
    ['contributor', 'task.create', true],
    ['contributor', 'task.edit', false],
    ['viewer', 'comment.create', true],
    ['viewer', 'task.create', false],
    ['executor', 'item.check', true],
    ['executor', 'task.create', false],
  ] as const)('%s → %s: %s', (preset, permission, expected) => {
    expect(can({ preset }, permission)).toBe(expected);
  });

  test('colaborador conclui só a tarefa atribuída a si', () => {
    const actor = { userId: ana, preset: 'contributor' } as const;
    expect(can(actor, 'task.complete', { assigneeIds: [ana, bia] })).toBe(true);
    expect(can(actor, 'task.complete', { assigneeIds: [bia] })).toBe(false);
    expect(can(actor, 'task.complete')).toBe(false);
  });

  test('colaborador apaga só o que criou (atribuída não basta)', () => {
    const actor = { userId: ana, preset: 'contributor' } as const;
    expect(can(actor, 'task.delete', { createdBy: ana })).toBe(true);
    expect(can(actor, 'task.delete', { createdBy: bia, assigneeIds: [ana] })).toBe(false);
  });

  test('":own" não vale para permissão sem regra de dono', () => {
    expect(can({ userId: ana, preset: 'contributor' }, 'task.edit', { createdBy: ana })).toBe(
      false,
    );
  });

  test('papéis de hoje: owner e editor escrevem, viewer não; sem papel, nada', () => {
    expect(roleCan('owner', 'task.edit')).toBe(true);
    expect(roleCan('editor', 'task.edit')).toBe(true);
    expect(roleCan('viewer', 'task.edit')).toBe(false);
    expect(roleCan(undefined, 'project.view')).toBe(false);
  });
});

describe('cargo personalizado (mesmos casos do pgTAP cargos_personalizados)', () => {
  const comprador = [
    'project.view',
    'task.create',
    'task.assign',
    'comment.create',
    'task.complete:own',
  ];

  test('vale o que o cargo tem, e só isso', () => {
    expect(can({ grants: comprador }, 'task.assign')).toBe(true);
    expect(can({ grants: comprador }, 'task.edit')).toBe(false);
    expect(can({ grants: comprador }, 'page.manage')).toBe(false);
  });

  test('":own" do cargo vale sobre o que é seu', () => {
    const actor = { userId: ana, grants: comprador };
    expect(can(actor, 'task.complete', { assigneeIds: [ana] })).toBe(true);
    expect(can(actor, 'task.complete', { assigneeIds: [bia] })).toBe(false);
  });

  test('excluir o projeto nunca entra em cargo personalizado', () => {
    expect(GRANTABLE).not.toContain('project.delete');
    expect(GRANTABLE).toHaveLength(PERMISSIONS.length - 1);
  });

  test('toda permissão tem nome na tela', () => {
    const labels = (ptBR as { perm: Record<string, string> }).perm;
    for (const permission of GRANTABLE) expect(labels[permission.replace('.', '_')]).toBeTruthy();
  });
});

describe('catálogo', () => {
  test('todo preset só usa permissões do catálogo', () => {
    for (const grants of Object.values(PRESETS))
      for (const grant of grants) {
        const [permission, scope] = grant.split(':');
        expect(PERMISSIONS).toContain(permission);
        if (scope) expect(Object.keys(OWN_RULE)).toContain(permission);
      }
  });

  test('é igual ao public.permission_presets() da migração mais nova (quem decide é o banco)', () => {
    // Sem @types/node no projeto: o Jest roda no Node, então o require existe
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    const dir = 'supabase/migrations';
    const latest = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))
      .filter((sql) => sql.includes('function public.permission_presets()'))
      .pop();
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(latest ?? '')?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? '{}')).toEqual({ presets: PRESETS, own: OWN_RULE });
  });
});
