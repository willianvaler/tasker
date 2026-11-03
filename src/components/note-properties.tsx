import { router } from 'expo-router';
import {
  Calendar,
  CheckSquare,
  Hash,
  Link2,
  List,
  Plus,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text, textClass } from '@/components/ui/text';
import {
  ALIASES_PROP,
  cleanPropName,
  convertProp,
  PROP_TYPES,
  propEntries,
  propType,
  TAGS_PROP,
  type NoteProps,
  type PropType,
  type PropValue,
} from '@/lib/note-props';
import { useColors } from '@/lib/tokens';
import { parseLinks, type LinkHref, type ResolveLink } from '@/lib/wikilinks';

const TYPE_ICON: Record<PropType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  list: List,
  link: Link2,
};

/**
 * Propriedades da anotação (OB4, D289), como o frontmatter do Obsidian: nome e valor com tipo
 * (texto, número, data, caixinha, lista, link). `tags` e `aliases` são listas com sentido próprio:
 * etiquetas e outros nomes. Lendo, mostra os valores; escrevendo, cada um tem o seu campo.
 */
export function NoteProperties({
  props,
  onChange,
  editable,
  resolve,
  onLink,
}: {
  props: NoteProps;
  onChange: (next: NoteProps) => void;
  editable: boolean;
  resolve?: ResolveLink;
  onLink?: (href: LinkHref) => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding, closeAdding] = useDialog<true>();
  const [menu, setMenu, closeMenu] = useDialog<string>();
  // O tipo vem do valor; vazio (data ou número recém-criados), vale o que a pessoa escolheu
  const [chosen, setChosen] = useState<Record<string, PropType>>({});
  const typeOf = (key: string) => {
    const value = props[key] ?? null;
    return (value === '' || value === null) && chosen[key] ? chosen[key] : propType(value);
  };
  const entries = propEntries(props);
  if (!editable && entries.length === 0) return null;

  const set = (key: string, value: PropValue) => onChange({ ...props, [key]: value });
  const remove = (key: string) => {
    const next = { ...props };
    delete next[key];
    onChange(next);
  };

  return (
    <View
      accessibilityRole="list"
      aria-label={t('noteProps.title')}
      className="gap-1 border-b border-line py-2"
    >
      {entries.map(([key, value]) => (
        <View key={key} className="min-h-9 flex-row items-start gap-2">
          <Pressable
            disabled={!editable}
            accessibilityRole={editable ? 'button' : undefined}
            accessibilityLabel={editable ? t('noteProps.edit', { name: key }) : key}
            onPress={() => setMenu(key)}
            className="w-32 flex-row items-center gap-1 rounded py-2 hover:bg-wash"
          >
            <Icon icon={TYPE_ICON[typeOf(key)]} size={16} tone="ink-muted" />
            <Text className="flex-1 text-sm text-ink-muted" numberOfLines={1}>
              {key === TAGS_PROP
                ? t('noteProps.tags')
                : key === ALIASES_PROP
                  ? t('noteProps.aliases')
                  : key}
            </Text>
          </Pressable>
          <View className="flex-1 justify-center py-1">
            <PropField
              name={key}
              value={value}
              type={typeOf(key)}
              editable={editable}
              onChange={(v) => set(key, v)}
              resolve={resolve}
              onLink={onLink}
            />
          </View>
        </View>
      ))}
      {editable && (
        <Button
          variant="ghost"
          icon={Plus}
          label={t('noteProps.add')}
          className="self-start"
          onPress={() => setAdding(true)}
        />
      )}
      {adding && (
        <PromptDialog
          title={t('noteProps.add')}
          message={t('noteProps.addHint')}
          fields={[{ key: 'name', placeholder: t('noteProps.namePlaceholder'), maxLength: 40 }]}
          validate={(v) => {
            const name = cleanPropName(v.name);
            return !!name && !(name in props);
          }}
          onClose={closeAdding}
          onConfirm={(v) => {
            closeAdding();
            const name = cleanPropName(v.name);
            if (!name) return;
            const lower = name.toLowerCase();
            const special = lower === TAGS_PROP || lower === ALIASES_PROP;
            set(special ? lower : name, special ? [] : '');
          }}
        />
      )}
      {menu && (
        <ActionMenu
          title={menu}
          onClose={closeMenu}
          actions={[
            ...(menu === TAGS_PROP || menu === ALIASES_PROP
              ? []
              : PROP_TYPES.filter((type) => type !== typeOf(menu)).map((type) => ({
                  label: t('noteProps.changeTo', { type: t(`noteProps.type.${type}`) }),
                  group: t('noteProps.typeGroup'),
                  onPress: () => {
                    closeMenu();
                    setChosen({ ...chosen, [menu]: type });
                    set(menu, convertProp(props[menu] ?? null, type));
                  },
                }))),
            {
              label: t('noteProps.remove'),
              destructive: true,
              onPress: () => {
                closeMenu();
                remove(menu);
              },
            },
          ]}
        />
      )}
    </View>
  );
}

function PropField({
  name,
  value,
  type,
  editable,
  onChange,
  resolve,
  onLink,
}: {
  name: string;
  value: PropValue;
  type: PropType;
  editable: boolean;
  onChange: (value: PropValue) => void;
  resolve?: ResolveLink;
  onLink?: (href: LinkHref) => void;
}) {
  const { t, i18n } = useTranslation();

  if (type === 'checkbox')
    return (
      <Checkbox
        checked={value === true}
        disabled={!editable}
        label={name}
        onChange={(checked) => onChange(checked)}
      />
    );

  if (type === 'list')
    return (
      <ListField
        name={name}
        items={Array.isArray(value) ? value : []}
        editable={editable}
        tags={name === TAGS_PROP}
        onChange={onChange}
      />
    );

  if (!editable) {
    if (type === 'link') {
      const link = parseLinks(String(value))[0];
      if (link) {
        const title = link.kind && link.id ? resolve?.(link.kind, link.id) : undefined;
        const shown =
          title === null ? t('wikilinks.noAccess') : (title ?? link.alias ?? link.title);
        return (
          <Text
            accessibilityRole="link"
            className="text-sm text-accent underline"
            onPress={() =>
              onLink?.(
                link.kind && link.id
                  ? { kind: link.kind, id: link.id, anchor: null }
                  : { kind: 'new', title: link.title, anchor: null },
              )
            }
          >
            {shown}
          </Text>
        );
      }
    }
    if (type === 'date' && typeof value === 'string') {
      const [y, m, d] = value.split('-').map(Number);
      return (
        <Text className="text-sm text-ink">
          {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
            new Date(Date.UTC(y, m - 1, d)),
          )}
        </Text>
      );
    }
    return <Text className="text-sm text-ink">{value == null ? '—' : String(value)}</Text>;
  }

  return (
    <DraftInput
      key={`${name}:${type}`}
      name={name}
      initial={value == null ? '' : String(value)}
      placeholder={t(`noteProps.placeholder.${type as 'text' | 'number' | 'date' | 'link'}`)}
      numeric={type === 'number'}
      commit={(text) => {
        if (type === 'number') {
          const n = Number(text.replace(',', '.'));
          onChange(text.trim() && Number.isFinite(n) ? n : null);
        } else if (type === 'date') {
          // Data inválida volta a ser texto (o tipo é dado pelo valor)
          onChange(text.trim());
        } else if (type === 'link') {
          onChange(convertProp(text, 'link'));
        } else onChange(text);
      }}
      live={type === 'text'}
    />
  );
}

/** Campo que grava ao sair (número, data, link) ou a cada letra (texto) */
function DraftInput({
  name,
  initial,
  placeholder,
  numeric,
  commit,
  live,
}: {
  name: string;
  initial: string;
  placeholder: string;
  numeric?: boolean;
  commit: (text: string) => void;
  live?: boolean;
}) {
  const colors = useColors();
  const [text, setText] = useState(initial);
  return (
    <TextInput
      value={text}
      onChangeText={(v) => {
        setText(v);
        if (live) commit(v);
      }}
      onBlur={() => !live && commit(text)}
      onSubmitEditing={() => !live && commit(text)}
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      placeholderTextColor={colors['ink-muted']}
      accessibilityLabel={name}
      maxLength={500}
      className={textClass('rounded px-1 py-1 text-sm text-ink hover:bg-wash')}
    />
  );
}

function ListField({
  name,
  items,
  editable,
  tags,
  onChange,
}: {
  name: string;
  items: string[];
  editable: boolean;
  tags: boolean;
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [draft, setDraft] = useState('');
  const add = () => {
    const more = draft
      .split(',')
      .map((s) => (tags ? s.trim().replace(/^#+/, '') : s.trim()))
      .filter((s) => s && !items.includes(s));
    if (more.length) onChange([...items, ...more]);
    setDraft('');
  };
  return (
    <View className="flex-row flex-wrap items-center gap-1">
      {items.map((item) => (
        <View
          key={item}
          className="flex-row items-center gap-1 rounded-full border border-line px-2 py-1"
        >
          {tags && !editable ? (
            <Text
              accessibilityRole="link"
              className="text-sm text-accent"
              onPress={() =>
                router.push({ pathname: '/etiquetas', params: { tag: item.toLowerCase() } })
              }
            >
              #{item}
            </Text>
          ) : (
            <Text className="text-sm text-ink">{tags ? `#${item}` : item}</Text>
          )}
          {editable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('noteProps.removeItem', { item })}
              onPress={() => onChange(items.filter((x) => x !== item))}
              hitSlop={8}
            >
              <Icon icon={X} size={16} tone="ink-muted" />
            </Pressable>
          )}
        </View>
      ))}
      {editable && (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          onBlur={add}
          submitBehavior="submit"
          placeholder={t('noteProps.addItem')}
          placeholderTextColor={colors['ink-muted']}
          accessibilityLabel={t('noteProps.addItemTo', { name })}
          maxLength={60}
          className={textClass('min-w-24 flex-1 px-1 py-1 text-sm text-ink')}
        />
      )}
    </View>
  );
}
