import type { Role } from './queries/projects';

// Permissões como dados. Um cargo é só um conjunto de permissões
// atômicas; nada de `if (role === 'x')` espalhado. O banco tem o mesmo catálogo em
// public.permission_presets() (o teste compara) e é a autoridade; no app, can() só esconde e
// desabilita controles.

export const PERMISSIONS = [
  // V2
  'project.view',
  'project.delete',
  'comment.create',
  'task.create',
  'task.complete',
  'task.edit',
  'task.delete',
  'task.assign',
  'page.manage',
  'member.manage',
  // V3
  'task.start',
  'task.force_unblock',
  'dependency.manage',
  'workflow.view_audit',
  'automation.manage',
  'item.check',
  'item.log',
  'page.share',
  'page.view_progress',
  'timer.use',
  'settings.max_depth',
  // V9: lançar e editar gastos (ver é project.view)
  'expense.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissões que um cargo pode ter só sobre o que é "seu": `:own` vale para as tarefas atribuídas
 * a si (ou criadas por si, no caso de apagar).
 */
export const OWN_RULE = {
  'task.complete': 'assigned',
  'task.start': 'assigned',
  'item.check': 'assigned',
  'item.log': 'assigned',
  'timer.use': 'assigned',
  'task.delete': 'created',
  'expense.write': 'created',
} as const satisfies Partial<Record<Permission, 'assigned' | 'created'>>;
type OwnPermission = keyof typeof OWN_RULE;
export type Grant = Permission | `${OwnPermission}:own`;

const ALL = [...PERMISSIONS];
const without = (...excluded: Permission[]) => ALL.filter((p) => !excluded.includes(p));

export const PRESETS = {
  /** Dono: tudo, inclusive excluir o projeto. */
  owner: ALL,
  /** Gerente: tudo menos excluir o projeto (só o Dono). */
  manager: without('project.delete'),
  /** Editor: trabalha em tudo, mas não mexe em pessoas, automações nem no limite de níveis. */
  editor: without('project.delete', 'member.manage', 'automation.manage', 'settings.max_depth'),
  /** Colaborador: cria e trabalha nas tarefas atribuídas a si; apaga só as que criou. */
  contributor: [
    'project.view',
    'comment.create',
    'task.create',
    'task.complete:own',
    'task.start:own',
    'task.delete:own',
    'item.check:own',
    'item.log:own',
    'timer.use:own',
    'expense.write:own',
  ],
  /** Leitor: vê e comenta. */
  viewer: ['project.view', 'comment.create'],
  /** Executor: marca, registra e usa timers na própria página. */
  executor: ['project.view', 'comment.create', 'item.check', 'item.log', 'timer.use'],
} as const satisfies Record<string, readonly Grant[]>;
export type Preset = keyof typeof PRESETS;

/** Papéis que existem hoje no banco (folder_role) → preset. */
export const ROLE_PRESET: Record<Role, Preset> = {
  owner: 'owner',
  manager: 'manager',
  editor: 'editor',
  contributor: 'contributor',
  viewer: 'viewer',
};

/** O recurso, quando a permissão depende de ser "seu". */
export type Resource = { createdBy?: string | null; assigneeIds?: readonly string[] };

/** Quem age: pelo preset do cargo ou pelas permissões de um cargo personalizado do time. */
export type Actor = { userId?: string } & (
  { preset: Preset; grants?: undefined } | { grants: readonly string[]; preset?: undefined }
);

/** O que um cargo personalizado pode ter: o catálogo, com ":own" onde há regra; nunca excluir o projeto. */
export const GRANTABLE = PERMISSIONS.filter((p) => p !== 'project.delete');

/** A função única de permissão. */
export function can(actor: Actor, permission: Permission, resource?: Resource): boolean {
  const grants: readonly string[] = actor.grants ?? PRESETS[actor.preset];
  if (grants.includes(permission)) return true;
  if (!(permission in OWN_RULE) || !grants.includes(`${permission as OwnPermission}:own`))
    return false;
  if (!actor.userId || !resource) return false;
  return OWN_RULE[permission as OwnPermission] === 'assigned'
    ? !!resource.assigneeIds?.includes(actor.userId)
    : resource.createdBy === actor.userId;
}

/** Atalho para quem só tem o papel da pasta (sem recurso "seu"). */
export function roleCan(role: Role | undefined, permission: Permission): boolean {
  return !!role && can({ preset: ROLE_PRESET[role] }, permission);
}

/** Como roleCan, para quem pode ter cargo personalizado. undefined: ainda carregando. */
export function actorCan(actor: Actor | undefined, permission: Permission): boolean {
  return !!actor && can(actor, permission);
}
