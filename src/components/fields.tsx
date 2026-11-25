import { Pencil, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { Json } from '@/lib/db';
import { FIELD_KINDS, formatFieldValue, parseFieldInput, type FieldKind } from '@/lib/fields';
import { checkFormula, computeFormula, type FormulaIssue, type FormulaValue } from '@/lib/formula';
import { formatShortDate, type IsoDate } from '@/lib/parser/dates';
import { useFieldMutations, usePageFields, type PageField } from '@/lib/queries/fields';
import { useToday } from '@/lib/queries/profile';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { usePageTasks, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { childrenMap } from '@/lib/task-tree';
import { rollup } from '@/lib/totals';
import { useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Campos personalizados (M5, D142).

const KIND_LABEL = {
  text: 'fields.kindText',
  number: 'fields.kindNumber',
  select: 'fields.kindSelect',
  date: 'fields.kindDate',
  person: 'fields.kindPerson',
  money: 'fields.kindMoney',
  formula: 'fields.kindFormula',
} as const satisfies Record<FieldKind, string>;

/** O erro da fórmula, em texto para quem escreveu */
export function useFormulaIssueText() {
  const { t } = useTranslation();
  return (issue: FormulaIssue) => {
    switch (issue.code) {
      case 'empty':
        return t('fields.formulaEmpty');
      case 'tooLong':
        return t('fields.formulaTooLong');
      case 'unknownFunction':
        return t('fields.formulaFunction', { name: issue.name });
      case 'arity':
        return t('fields.formulaArity', { name: issue.name });
      case 'unknownField':
        return t('fields.formulaField', { name: issue.name });
      case 'cycle':
        return t('fields.formulaCycle', { name: issue.name });
      case 'budget':
        return t('fields.formulaBudget');
      default:
        return t('fields.formulaSyntax');
    }
  };
}

/** Valor calculado → texto: número com até 2 casas, data curta, sim/não. */
export function formulaText(value: FormulaValue, locale: string, yes: string, no: string) {
  if (value === null || value === '') return '';
  if (typeof value === 'number')
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? yes : no;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatShortDate(value as IsoDate);
  return value;
}

/**
 * O valor de qualquer campo numa tarefa, já calculado no caso da fórmula (`value`) e em texto
 * (`text`). Para a linha, o painel e a tabela da visão.
 */
export function useFieldText(pageId: string | undefined, folderId: string | undefined) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const fields = usePageFields(pageId).data ?? [];
  const people = usePeople(folderId);
  const value = (field: PageField, task: Task): unknown => {
    if (field.kind !== 'formula') {
      const custom = task.custom && typeof task.custom === 'object' ? task.custom : {};
      return (custom as Record<string, unknown>)[field.id] ?? null;
    }
    const r = computeFormula(field, task, fields, today);
    return r.ok ? r.value : null;
  };
  const text = (field: PageField, task: Task, v: unknown = value(field, task)): string =>
    field.kind === 'formula'
      ? formulaText(v as FormulaValue, i18n.language, t('fields.yes'), t('fields.no'))
      : formatFieldValue(field.kind, v, i18n.language, people);
  return { fields, people, value, text };
}

/** Total das subtarefas (rollup) num campo de número: null se a tarefa não tem filhas com valor. */
function useRollup(task: Task) {
  const tasks = usePageTasks(task.page_id);
  const kids = childrenMap(tasks.data ?? []);
  const byId = new Map((tasks.data ?? []).map((x) => [x.id, x]));
  return (valueOf: (task: Task) => unknown) =>
    kids.has(task.id)
      ? rollup(task.id, kids, (id) => {
          const child = byId.get(id);
          const v = child ? valueOf(child) : null;
          return typeof v === 'number' && Number.isFinite(v) ? v : null;
        })
      : null;
}

/** Configurar os campos da página (menu da página). */
export function FieldsDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const fields = usePageFields(pageId);
  const m = useFieldMutations(pageId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FieldKind>('text');
  const [options, setOptions] = useState('');
  const [formula, setFormula] = useState('');
  // Mudando a fórmula de um campo que já existe
  const [editing, setEditing] = useState<PageField | null>(null);
  const issueText = useFormulaIssueText();
  const list = fields.data ?? [];
  const onError = (err: Error) => toast({ message: err.message });
  const formulaKind = editing ? true : kind === 'formula';
  const issue = formulaKind
    ? checkFormula(formula, editing ?? { id: '', name: name.trim() }, list)
    : null;

  function add() {
    if (editing) {
      if (issue) return;
      m.update.mutate({ id: editing.id, formula: formula.trim() }, { onError });
      setEditing(null);
      setFormula('');
      return;
    }
    if (!name.trim() || issue) return;
    const opts =
      kind === 'select'
        ? options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];
    m.add.mutate(
      {
        name: name.trim(),
        kind,
        options: opts,
        formula: kind === 'formula' ? formula.trim() : null,
      },
      { onError },
    );
    setName('');
    setOptions('');
    setFormula('');
  }

  return (
    <DialogFrame wide onClose={onClose}>
      <ScrollView contentContainerClassName="gap-4">
        <Text className="text-lg font-semibold text-ink">{t('fields.title')}</Text>
        {list.length === 0 && <Text className="text-sm text-ink-muted">{t('fields.empty')}</Text>}
        {list.map((field) => (
          <View
            key={field.id}
            className="min-h-11 flex-row items-center gap-2 border-b border-line"
          >
            <Text className="flex-1 text-sm text-ink">{field.name}</Text>
            <Text className="flex-shrink font-mono text-xs text-ink-muted" numberOfLines={1}>
              {t(KIND_LABEL[field.kind])}
              {field.options.length ? ` · ${field.options.join(', ')}` : ''}
              {field.kind === 'formula' && field.formula ? ` · ${field.formula}` : ''}
            </Text>
            {field.kind === 'formula' && (
              <IconButton
                icon={Pencil}
                label={t('fields.editFormula', { name: field.name })}
                onPress={() => {
                  setEditing(field);
                  setFormula(field.formula ?? '');
                }}
              />
            )}
            <IconButton
              icon={X}
              label={t('fields.remove', { name: field.name })}
              onPress={() => m.remove.mutate(field.id, { onError })}
            />
          </View>
        ))}
        {(list.length < 10 || editing) && (
          <View className="gap-2">
            {editing ? (
              <Text className="text-sm font-semibold text-ink">
                {t('fields.editFormula', { name: editing.name })}
              </Text>
            ) : (
              <Input
                value={name}
                onChangeText={setName}
                maxLength={40}
                placeholder={t('fields.namePlaceholder')}
                accessibilityLabel={t('fields.name')}
              />
            )}
            <View
              className={editing ? 'hidden' : 'flex-row flex-wrap gap-2'}
              accessibilityRole="radiogroup"
            >
              {FIELD_KINDS.map((k) => (
                <Chip
                  key={k}
                  role="radio"
                  label={t(KIND_LABEL[k])}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>
            {kind === 'select' && (
              <Input
                value={options}
                onChangeText={setOptions}
                placeholder={t('fields.optionsPlaceholder')}
                accessibilityLabel={t('fields.options')}
              />
            )}
            {formulaKind && (
              <View className="gap-1">
                <Input
                  value={formula}
                  onChangeText={setFormula}
                  maxLength={500}
                  multiline
                  className="min-h-12 py-2 font-mono md:text-xs"
                  placeholder="{Valor} * {Quantidade}"
                  accessibilityLabel={t('fields.formula')}
                />
                <Text
                  className={
                    issue && formula.trim() ? 'text-xs text-danger' : 'text-xs text-ink-muted'
                  }
                  accessibilityLiveRegion="polite"
                >
                  {issue && formula.trim() ? issueText(issue) : t('fields.formulaHint')}
                </Text>
              </View>
            )}
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={editing ? t('common.save') : t('fields.add')}
                disabled={(!editing && !name.trim()) || !!issue}
                onPress={add}
                className="self-start"
              />
              {editing && (
                <Button
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => {
                    setEditing(null);
                    setFormula('');
                  }}
                />
              )}
            </View>
          </View>
        )}
        <Button variant="ghost" className="self-end" label={t('common.close')} onPress={onClose} />
      </ScrollView>
    </DialogFrame>
  );
}

/** Pessoas do projeto da página (campos "pessoa"): id → nome (fora de projeto, ninguém). */
export function usePeople(folderId: string | undefined) {
  const tree = useTree();
  const root = rootFolder(tree.data, folderId);
  const members = useMembers(root?.is_shared ? root.id : undefined);
  return new Map((members.data ?? []).map((m) => [m.userId, m.displayName]));
}

/** No painel da tarefa: um campo por linha, salvando ao sair. */
export function TaskFields({ task, disabled }: { task: Task; disabled?: boolean }) {
  const { t } = useTranslation();
  const show = useFieldText(task.page_id, task.folder_id);
  const sum = useRollup(task);
  if (!show.fields.length) return null;
  return (
    <View className="gap-3">
      {show.fields.map((field) => {
        // Total das subtarefas (VS2) nos campos de número
        const numeric =
          field.kind === 'number' || field.kind === 'money' || field.kind === 'formula';
        const total = numeric ? sum((child) => show.value(field, child)) : null;
        const totalText =
          total === null
            ? null
            : t('fields.subtaskTotal', {
                value:
                  field.kind === 'formula'
                    ? show.text(field, task, total)
                    : formatFieldValue(field.kind, total, undefined, show.people),
              });
        return field.kind === 'formula' ? (
          <View key={field.id} className="gap-1">
            <Text className="text-xs text-ink-muted">{field.name}</Text>
            <Text className="font-mono text-sm text-ink" accessibilityLabel={field.name}>
              {show.text(field, task) || '—'}
            </Text>
            {totalText && <Text className="font-mono text-xs text-ink-muted">{totalText}</Text>}
          </View>
        ) : (
          <View key={field.id} className="gap-1">
            <FieldEditor field={field} task={task} people={show.people} disabled={disabled} />
            {totalText && <Text className="font-mono text-xs text-ink-muted">{totalText}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function FieldEditor({
  field,
  task,
  people,
  disabled,
}: {
  field: PageField;
  task: Task;
  people: ReadonlyMap<string, string>;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const update = useUpdateTask();
  const custom = (task.custom && typeof task.custom === 'object' ? task.custom : {}) as Record<
    string,
    Json
  >;
  const current = custom[field.id] ?? null;
  const shown =
    field.kind === 'date' && current
      ? String(current).split('-').reverse().join('/')
      : current == null
        ? ''
        : String(current);
  const [text, setText] = useState(shown);

  const save = (value: Json | null) => {
    const next = { ...custom };
    if (value == null) delete next[field.id];
    else next[field.id] = value;
    update.mutate({ id: task.id, patch: { custom: next as NonNullable<Json> } });
  };

  const options =
    field.kind === 'person' ? [...people.entries()] : field.options.map((o) => [o, o] as const);
  return (
    <View className="gap-1">
      <Text className="text-xs text-ink-muted">{field.name}</Text>
      {field.kind === 'select' || field.kind === 'person' ? (
        <View className="flex-row flex-wrap gap-2">
          {options.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={current === value}
              disabled={disabled}
              onPress={() => save(current === value ? null : value)}
            />
          ))}
        </View>
      ) : (
        <Input
          value={text}
          onChangeText={setText}
          editable={!disabled}
          accessibilityLabel={field.name}
          keyboardType={
            field.kind === 'number' || field.kind === 'money' ? 'decimal-pad' : 'default'
          }
          placeholder={field.kind === 'date' ? '15/10/2026' : undefined}
          onBlur={() => {
            const value = parseFieldInput(field.kind, text);
            if (value === undefined) {
              toast({ message: t('fields.invalid', { name: field.name }) });
              return;
            }
            if (value !== current) save(value);
            if (value != null && field.kind !== 'text')
              setText(
                field.kind === 'date'
                  ? String(value).split('-').reverse().join('/')
                  : String(value),
              );
          }}
        />
      )}
      {(field.kind === 'money' || field.kind === 'number') && current != null && (
        <Text className="font-mono text-xs text-ink-muted">
          {formatFieldValue(field.kind, current, i18n.language)}
        </Text>
      )}
    </View>
  );
}

/** Na linha: até dois valores preenchidos ("Valor R$ 1.200,00 · Fase Obra"). */
export function FieldValues({ task }: { task: Task }) {
  const show = useFieldText(task.page_id, task.folder_id);
  const parts = show.fields
    .map((f) => ({ f, text: show.text(f, task) }))
    .filter((p) => p.text)
    .slice(0, 2)
    .map((p) => `${p.f.name} ${p.text}`);
  if (parts.length === 0) return null;
  return (
    <Text className="font-mono text-xs text-ink-muted" numberOfLines={1}>
      {parts.join(' · ')}
    </Text>
  );
}
