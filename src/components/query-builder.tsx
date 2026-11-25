import { Plus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ActionMenu } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  parseQuery,
  valueFromText,
  type Condition,
  type Field,
  type FieldName,
  type Op,
  type Query,
} from '@/lib/query/parse';
import { langOf, queryToText, valueText } from '@/lib/query/serialize';
import { pageLabel, useTree } from '@/lib/queries/tree';

// Construtor visual da consulta (R2b, D374): origem, lista ou pasta, filtros, situação, ordem,
// limite e "mostrar como" em controles, como as visões de banco do Notion. A frase escrita (a
// linguagem do OB7) aparece embaixo, ao vivo, e é o que se grava: escrever à mão continua valendo.

const TASK_FIELDS: FieldName[] = ['tag', 'due', 'priority', 'title', 'status', 'created', 'updated', 'completed'];
const NOTE_FIELDS: FieldName[] = ['tag', 'title', 'created', 'updated'];
const OPS: Op[] = ['=', '!=', '<', '<=', '>', '>=', 'contains'];

type Row = { field: Field; op: Op; text: string };

const EMPTY: Query = {
  source: 'tasks',
  lists: [],
  folders: [],
  conditions: [],
  done: false,
  sort: null,
  limit: null,
  view: 'list',
};

export function QueryBuilder({
  source,
  onApply,
  onCancel,
}: {
  source: string;
  onApply: (text: string) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const tree = useTree();
  const parsed = parseQuery(source);
  const start = parsed.ok ? parsed.query : EMPTY;
  const [q, setQ] = useState<Query>(start);
  const [rows, setRows] = useState<Row[]>(() =>
    start.conditions.map((c) => ({
      field: c.field,
      op: c.op,
      text: c.value.kind === 'text' ? c.value.value : valueText(c.value, lang),
    })),
  );
  const [limitText, setLimitText] = useState(start.limit ? String(start.limit) : '');
  const [menu, setMenu] = useState<
    | { kind: 'list' }
    | { kind: 'folder' }
    | { kind: 'field'; row: number }
    | { kind: 'op'; row: number }
    | { kind: 'sort' }
    | null
  >(null);

  const fields = q.source === 'tasks' ? TASK_FIELDS : NOTE_FIELDS;
  const fieldLabel = (f: Field) =>
    f.kind === 'prop' ? f.name : t(`queryBuilder.fields.${f.kind}`);
  const opLabel = (op: Op) => (op === 'contains' ? t('queryBuilder.contains') : op);

  // A consulta inteira, com as linhas de filtro lidas como na frase
  const conditions: Condition[] = rows.flatMap((r) => {
    const value = valueFromText(r.field, r.text);
    return value ? [{ field: r.field, op: r.op, value }] : [];
  });
  const limit = /^\d{1,4}$/.test(limitText) && Number(limitText) > 0 ? Number(limitText) : null;
  const full: Query = { ...q, conditions, limit, done: q.source === 'tasks' ? q.done : null };
  const text = queryToText(full, lang);
  const check = parseQuery(text);
  const selective = full.lists.length + full.folders.length + full.conditions.length > 0;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const pages = (tree.data?.pages ?? []).filter((p) => !p.is_habits);
  const folders = (tree.data?.folders ?? []).filter((f) => !f.is_inbox);

  return (
    <View testID="query-builder" className="gap-3 border-b border-line bg-surface px-3 py-3">
      {!parsed.ok && source.trim() !== '' && (
        <Text className="text-xs text-warn">{t('queryBuilder.unparsed')}</Text>
      )}
      <Section label={t('queryBuilder.source')}>
        {(['tasks', 'notes'] as const).map((s) => (
          <Chip
            key={s}
            role="radio"
            label={t(`queryBuilder.${s}`)}
            selected={q.source === s}
            onPress={() => setQ({ ...q, source: s })}
          />
        ))}
      </Section>

      <Section label={t('queryBuilder.where')}>
        {q.lists.map((l) => (
          <Chip
            key={`l:${l}`}
            label={`${t('queryBuilder.list')}: ${l} ×`}
            onPress={() => setQ({ ...q, lists: q.lists.filter((x) => x !== l) })}
          />
        ))}
        {q.folders.map((f) => (
          <Chip
            key={`f:${f}`}
            label={`${t('queryBuilder.folder')}: ${f} ×`}
            onPress={() => setQ({ ...q, folders: q.folders.filter((x) => x !== f) })}
          />
        ))}
        {q.source === 'tasks' && (
          <Button variant="ghost" icon={Plus} label={t('queryBuilder.list')} onPress={() => setMenu({ kind: 'list' })} />
        )}
        <Button variant="ghost" icon={Plus} label={t('queryBuilder.folder')} onPress={() => setMenu({ kind: 'folder' })} />
      </Section>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase text-ink-muted">{t('queryBuilder.filters')}</Text>
        {rows.map((r, i) => (
          <View key={i} className="flex-row flex-wrap items-center gap-2">
            <Button variant="ghost" label={fieldLabel(r.field)} onPress={() => setMenu({ kind: 'field', row: i })} />
            <Button variant="ghost" label={opLabel(r.op)} onPress={() => setMenu({ kind: 'op', row: i })} />
            <Input
              className="min-w-32 flex-1"
              accessibilityLabel={t('queryBuilder.value', { field: fieldLabel(r.field) })}
              value={r.text}
              placeholder={t(`queryBuilder.placeholders.${r.field.kind === 'prop' ? 'title' : r.field.kind}`)}
              onChangeText={(text) => setRow(i, { text })}
            />
            <IconButton
              icon={X}
              label={t('queryBuilder.removeFilter')}
              onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            />
          </View>
        ))}
        <Button
          variant="ghost"
          className="self-start"
          icon={Plus}
          label={t('queryBuilder.addFilter')}
          onPress={() => setRows((rs) => [...rs, { field: { kind: 'tag' }, op: '=', text: '' }])}
        />
      </View>

      {q.source === 'tasks' && (
        <Section label={t('queryBuilder.status')}>
          {([null, false, true] as const).map((d) => (
            <Chip
              key={String(d)}
              role="radio"
              label={t(d === null ? 'queryBuilder.done.null' : d ? 'queryBuilder.done.true' : 'queryBuilder.done.false')}
              selected={q.done === d}
              onPress={() => setQ({ ...q, done: d })}
            />
          ))}
        </Section>
      )}

      <Section label={t('queryBuilder.sort')}>
        <Button
          variant="ghost"
          label={q.sort ? fieldLabel(q.sort.field) : t('queryBuilder.noSort')}
          onPress={() => setMenu({ kind: 'sort' })}
        />
        {q.sort && (
          <Chip
            label={q.sort.desc ? t('queryBuilder.desc') : t('queryBuilder.asc')}
            onPress={() => q.sort && setQ({ ...q, sort: { ...q.sort, desc: !q.sort.desc } })}
          />
        )}
      </Section>

      <Section label={t('queryBuilder.show')}>
        {(['list', 'table', 'count'] as const).map((v) => (
          <Chip
            key={v}
            role="radio"
            label={t(`queryBuilder.views.${v}`)}
            selected={q.view === v}
            onPress={() => setQ({ ...q, view: v })}
          />
        ))}
        <Input
          className="w-24"
          accessibilityLabel={t('queryBuilder.limit')}
          placeholder={t('queryBuilder.limit')}
          keyboardType="number-pad"
          value={limitText}
          onChangeText={setLimitText}
        />
      </Section>

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase text-ink-muted">{t('queryBuilder.text')}</Text>
        <Text selectable testID="query-builder-text" className="font-mono text-xs text-ink">
          {text}
        </Text>
        {!selective && <Text className="text-xs text-warn">{t('query.notSelective')}</Text>}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
        <Button label={t('queryBuilder.apply')} disabled={!check.ok} onPress={() => onApply(text)} />
      </View>

      {menu?.kind === 'list' && (
        <ActionMenu
          title={t('queryBuilder.list')}
          onClose={() => setMenu(null)}
          actions={pages.map((p) => ({
            label: pageLabel(p),
            onPress: () => setQ({ ...q, lists: [...new Set([...q.lists, p.name])] }),
          }))}
        />
      )}
      {menu?.kind === 'folder' && (
        <ActionMenu
          title={t('queryBuilder.folder')}
          onClose={() => setMenu(null)}
          actions={folders.map((f) => ({
            label: f.name,
            onPress: () => setQ({ ...q, folders: [...new Set([...q.folders, f.name])] }),
          }))}
        />
      )}
      {menu?.kind === 'field' && (
        <ActionMenu
          title={t('queryBuilder.field')}
          onClose={() => setMenu(null)}
          actions={fields.map((f) => ({
            label: t(`queryBuilder.fields.${f}`),
            onPress: () => setRow(menu.row, { field: { kind: f } }),
          }))}
        />
      )}
      {menu?.kind === 'op' && (
        <ActionMenu
          title={t('queryBuilder.operator')}
          onClose={() => setMenu(null)}
          actions={OPS.map((op) => ({ label: opLabel(op), onPress: () => setRow(menu.row, { op }) }))}
        />
      )}
      {menu?.kind === 'sort' && (
        <ActionMenu
          title={t('queryBuilder.sort')}
          onClose={() => setMenu(null)}
          actions={[
            { label: t('queryBuilder.noSort'), onPress: () => setQ({ ...q, sort: null }) },
            ...fields.map((f) => ({
              label: t(`queryBuilder.fields.${f}`),
              onPress: () => setQ({ ...q, sort: { field: { kind: f }, desc: q.sort?.desc ?? false } }),
            })),
          ]}
        />
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold uppercase text-ink-muted">{label}</Text>
      <View className="flex-row flex-wrap items-center gap-2">{children}</View>
    </View>
  );
}

