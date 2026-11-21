import { randomUUID } from 'expo-crypto';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import {
  newView,
  VIEW_COLUMNS,
  VIEW_KINDS,
  VIEW_SORTS,
  type ListView,
  type ScopedView,
  type ViewFilter,
  type ViewGroup,
  type ViewKind,
  type ViewScope,
} from '@/lib/list-views';
import type { PageField } from '@/lib/queries/fields';

const KIND = {
  list: 'views.kind.list',
  board: 'views.kind.board',
  table: 'views.kind.table',
  calendar: 'views.kind.calendar',
  gantt: 'views.kind.gantt',
} as const satisfies Record<ViewKind, string>;

const SORT = {
  position: 'views.sort.position',
  due: 'views.sort.due',
  priority: 'views.sort.priority',
  title: 'views.sort.title',
  created: 'views.sort.created',
} as const;

/** Nome das colunas fixas da tabela (as de campo usam o nome do campo) */
export const COLUMN_LABEL = {
  title: 'base.col.title',
  due: 'base.col.due',
  start: 'views.col.start',
  priority: 'base.col.priority',
  tags: 'base.col.tags',
  status: 'base.col.status',
  assignees: 'views.col.assignees',
  estimate: 'views.col.estimate',
  time: 'views.col.time',
} as const satisfies Record<(typeof VIEW_COLUMNS)[number], string>;

/**
 * Criar ou mudar uma visão: nome, tipo, para quem (só eu ou todo o projeto), filtro, ordem,
 * agrupamento e, na tabela, as colunas.
 */
export function ViewDialog({
  view,
  fields,
  labels,
  shared,
  manage,
  onSave,
  onDelete,
  onClose,
}: {
  /** A visão que se está mudando (sem ela, uma nova) */
  view?: ScopedView;
  fields: PageField[];
  /** Etiquetas em uso na lista (filtro) */
  labels: string[];
  /** A lista é de um projeto (há visões só minhas) */
  shared: boolean;
  /** Pode gravar as do projeto (`page.manage`) */
  manage: boolean;
  onSave: (view: ListView, scope: ViewScope) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ListView>(() => view ?? newView(randomUUID(), '', 'board'));
  // Fora de projeto, a lista é só de quem a tem: a visão fica na lista
  const [scope, setScope] = useState<ViewScope>(
    view?.scope ?? (shared && !manage ? 'personal' : 'project'),
  );
  const set = (patch: Partial<ListView>) => setDraft((d) => ({ ...d, ...patch }));
  const setFilter = (patch: Partial<ViewFilter>) =>
    setDraft((d) => ({ ...d, filter: { ...d.filter, ...patch } }));

  const changeKind = (kind: ViewKind) => {
    const base = newView(draft.id, draft.name, kind);
    set({
      kind,
      // Quadro sempre agrupa; trocar de tipo leva o padrão do outro onde não faz sentido manter
      group: kind === 'board' && draft.group === 'none' ? 'status' : draft.group,
      columns: kind === 'table' && !draft.columns.length ? base.columns : draft.columns,
    });
  };

  const groupable = fields.filter((f) => f.kind === 'select' || f.kind === 'person');
  const groups: { value: ViewGroup; label: string }[] = [
    ...(draft.kind === 'board' ? [] : [{ value: 'none' as const, label: t('views.group.none') }]),
    { value: 'status', label: t('views.group.status') },
    { value: 'priority', label: t('views.group.priority') },
    ...(shared ? [{ value: 'assignee' as const, label: t('views.group.assignee') }] : []),
    { value: 'label', label: t('views.group.label') },
    ...groupable.map((f) => ({ value: `field:${f.id}` as const, label: f.name })),
  ];
  const columns = [
    ...VIEW_COLUMNS.filter((c) => shared || c !== 'assignees').map((c) => ({
      value: c as string,
      label: t(COLUMN_LABEL[c]),
    })),
    ...fields.map((f) => ({ value: `field:${f.id}`, label: f.name })),
  ];
  const toggleColumn = (c: string) =>
    set({
      columns: draft.columns.includes(c)
        ? draft.columns.filter((x) => x !== c)
        : [...draft.columns, c],
    });

  const name = draft.name.trim();
  const save = () => {
    if (!name) return;
    onSave({ ...draft, name, columns: draft.kind === 'table' ? draft.columns : [] }, scope);
    onClose();
  };

  return (
    <DialogFrame wide onClose={onClose}>
      <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-4">
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
          {view ? t('views.edit') : t('views.new')}
        </Text>
        <Input
          value={draft.name}
          onChangeText={(text) => set({ name: text })}
          maxLength={60}
          placeholder={t('views.namePlaceholder')}
          accessibilityLabel={t('views.name')}
          autoFocus={!view}
        />
        <Group title={t('views.kindTitle')}>
          {VIEW_KINDS.map((k) => (
            <Chip
              key={k}
              role="radio"
              label={t(KIND[k])}
              selected={draft.kind === k}
              onPress={() => changeKind(k)}
            />
          ))}
        </Group>
        {shared && (
          <Group title={t('views.scopeTitle')}>
            <Chip
              role="radio"
              label={t('views.scope.personal')}
              selected={scope === 'personal'}
              onPress={() => setScope('personal')}
            />
            <Chip
              role="radio"
              label={t('views.scope.project')}
              selected={scope === 'project'}
              disabled={!manage}
              onPress={() => setScope('project')}
            />
          </Group>
        )}
        {(draft.kind === 'list' || draft.kind === 'board' || draft.kind === 'table') && (
          <Group title={t('views.groupTitle')}>
            {groups.map((g) => (
              <Chip
                key={g.value}
                role="radio"
                label={g.label}
                selected={draft.group === g.value}
                onPress={() => set({ group: g.value })}
              />
            ))}
          </Group>
        )}
        <Group title={t('views.statusTitle')}>
          {(['all', 'open', 'done'] as const).map((s) => (
            <Chip
              key={s}
              role="radio"
              label={t(`views.status.${s}`)}
              selected={draft.filter.status === s}
              onPress={() => setFilter({ status: s })}
            />
          ))}
        </Group>
        <Group title={t('views.dueTitle')}>
          {(['any', 'overdue', 'week', 'undated'] as const).map((d) => (
            <Chip
              key={d}
              role="radio"
              label={t(`views.due.${d}`)}
              selected={draft.filter.due === d}
              onPress={() => setFilter({ due: d })}
            />
          ))}
        </Group>
        {labels.length > 0 && (
          <Group title={t('views.labelTitle')}>
            <Chip
              role="radio"
              label={t('views.anyLabel')}
              selected={!draft.filter.label}
              onPress={() => setFilter({ label: null })}
            />
            {labels.map((l) => (
              <Chip
                key={l}
                role="radio"
                label={`#${l}`}
                selected={draft.filter.label === l}
                onPress={() => setFilter({ label: l })}
              />
            ))}
          </Group>
        )}
        {shared && (
          <ToggleRow
            title={t('views.mine')}
            value={draft.filter.mine}
            onChange={(mine) => setFilter({ mine })}
          />
        )}
        {draft.kind !== 'gantt' && (
          <Group title={t('views.sortTitle')}>
            {VIEW_SORTS.map((s) => (
              <Chip
                key={s}
                role="radio"
                label={t(SORT[s])}
                selected={draft.sort === s}
                onPress={() => set({ sort: s })}
              />
            ))}
            <Chip
              role="checkbox"
              label={t('views.desc')}
              selected={draft.desc}
              onPress={() => set({ desc: !draft.desc })}
            />
          </Group>
        )}
        {draft.kind === 'table' && (
          <Group title={t('views.columnsTitle')} multi>
            {columns.map((c) => (
              <Chip
                key={c.value}
                role="checkbox"
                label={c.label}
                selected={draft.columns.includes(c.value)}
                onPress={() => toggleColumn(c.value)}
              />
            ))}
          </Group>
        )}
        <View className="flex-row flex-wrap items-center gap-2">
          <Button label={t('common.save')} disabled={!name} onPress={save} />
          <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
          {onDelete && (
            <Button
              variant="ghost"
              className="ml-auto"
              label={t('views.delete')}
              onPress={() => {
                onDelete();
                onClose();
              }}
            />
          )}
        </View>
      </ScrollView>
    </DialogFrame>
  );
}

function Group({
  title,
  multi,
  children,
}: {
  title: string;
  /** Várias marcadas (caixinhas), não uma escolha só */
  multi?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</Text>
      <View
        className="flex-row flex-wrap gap-2"
        accessibilityRole={multi ? undefined : 'radiogroup'}
        aria-label={title}
      >
        {children}
      </View>
    </View>
  );
}
