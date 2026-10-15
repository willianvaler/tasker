import { X } from 'lucide-react-native';
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
import { useFieldMutations, usePageFields, type PageField } from '@/lib/queries/fields';
import { rootFolder, useMembers } from '@/lib/queries/projects';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
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
} as const satisfies Record<FieldKind, string>;

/** Configurar os campos da página (menu da página). */
export function FieldsDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const fields = usePageFields(pageId);
  const m = useFieldMutations(pageId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FieldKind>('text');
  const [options, setOptions] = useState('');
  const list = fields.data ?? [];
  const onError = (err: Error) => toast({ message: err.message });

  function add() {
    if (!name.trim()) return;
    const opts =
      kind === 'select'
        ? options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];
    m.add.mutate({ name: name.trim(), kind, options: opts }, { onError });
    setName('');
    setOptions('');
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
            <Text className="font-mono text-xs text-ink-muted">
              {t(KIND_LABEL[field.kind])}
              {field.options.length ? ` · ${field.options.join(', ')}` : ''}
            </Text>
            <IconButton
              icon={X}
              label={t('fields.remove', { name: field.name })}
              onPress={() => m.remove.mutate(field.id, { onError })}
            />
          </View>
        ))}
        {list.length < 10 && (
          <View className="gap-2">
            <Input
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder={t('fields.namePlaceholder')}
              accessibilityLabel={t('fields.name')}
            />
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
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
            <Button
              label={t('fields.add')}
              disabled={!name.trim()}
              onPress={add}
              className="self-start"
            />
          </View>
        )}
        <Button variant="ghost" className="self-end" label={t('common.close')} onPress={onClose} />
      </ScrollView>
    </DialogFrame>
  );
}

/** Pessoas do projeto da página (campos "pessoa"). */
function usePeople(folderId: string) {
  const tree = useTree();
  const root = rootFolder(tree.data, folderId);
  const members = useMembers(root?.is_shared ? root.id : undefined);
  return new Map((members.data ?? []).map((m) => [m.userId, m.displayName]));
}

/** No painel da tarefa: um campo por linha, salvando ao sair. */
export function TaskFields({ task, disabled }: { task: Task; disabled?: boolean }) {
  const fields = usePageFields(task.page_id);
  const people = usePeople(task.folder_id);
  if (!fields.data?.length) return null;
  return (
    <View className="gap-3">
      {fields.data.map((field) => (
        <FieldEditor key={field.id} field={field} task={task} people={people} disabled={disabled} />
      ))}
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
  const { i18n } = useTranslation();
  const fields = usePageFields(task.page_id);
  const people = usePeople(task.folder_id);
  const custom = (task.custom && typeof task.custom === 'object' ? task.custom : {}) as Record<
    string,
    unknown
  >;
  const parts = (fields.data ?? [])
    .map((f) => ({ f, text: formatFieldValue(f.kind, custom[f.id], i18n.language, people) }))
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
