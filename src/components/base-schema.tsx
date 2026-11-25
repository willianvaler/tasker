import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { readBaseConfig } from '@/lib/base-config';
import { cleanPropName } from '@/lib/note-props';
import { pageLabel, useTree, useTreeMutations } from '@/lib/queries/tree';
import {
  MAX_PROPS,
  PROP_KINDS,
  ROLLUP_FNS,
  withInverse,
  type PropDef,
  type PropKind,
  type Schema,
} from '@/lib/relations';
import { useToast } from '@/providers/toast';

/**
 * As propriedades tipadas da base (ED3, D359): tipo, opções, relação para outra base (com a
 * inversa, se pedida) e rollup. O rollup é calculado na tela e não vale em automação (D318).
 */
export function BaseSchemaEditor({
  schema,
  pageId,
  onChange,
}: {
  schema: Schema;
  pageId: string;
  onChange: (schema: Schema) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const tree = useTree();
  const m = useTreeMutations();
  const [nome, setNome] = useState('');
  const bases = (tree.data?.pages ?? []).filter((p) => p.view_type === 'base' && p.id !== pageId);
  const nomes = Object.keys(schema);
  const relacoes = nomes.filter((n) => schema[n].tipo === 'relacao');
  const set = (n: string, def: PropDef) => onChange({ ...schema, [n]: def });

  const criar = () => {
    const limpo = cleanPropName(nome);
    if (!limpo || nomes.some((n) => n.toLowerCase() === limpo.toLowerCase())) return;
    if (nomes.length >= MAX_PROPS) {
      toast({ message: t('base.schema.limit', { n: MAX_PROPS }) });
      return;
    }
    set(limpo, { tipo: 'texto' });
    setNome('');
  };

  // Bidirecional: a inversa entra no esquema da outra base também
  const ligarInversa = (n: string, def: PropDef) => {
    const alvo = bases.find((b) => b.id === def.base);
    if (!alvo || !def.inversa) return;
    const config = readBaseConfig(alvo.config);
    const novo = withInverse(config.schema, def.inversa, pageId, n);
    if (!novo) return;
    m.updatePage.mutate(
      { id: alvo.id, name: alvo.name, config: { ...config, schema: novo } },
      { onError: (err) => toast({ message: err.message }) },
    );
  };

  return (
    <View
      className="gap-3 rounded-lg border border-line p-3"
      accessibilityLabel={t('base.schema.open')}
    >
      <Text className="text-sm text-ink-muted">{t('base.schema.hint')}</Text>
      {nomes.map((n) => {
        const def = schema[n];
        return (
          <View key={n} className="gap-2 border-b border-line pb-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{n}</Text>
              <Button
                variant="ghost"
                label={t('base.schema.remove')}
                onPress={() => {
                  const { [n]: _fora, ...resto } = schema;
                  onChange(resto);
                }}
              />
            </View>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              aria-label={t('base.schema.type', { name: n })}
            >
              {PROP_KINDS.map((k: PropKind) => (
                <Chip
                  key={k}
                  role="radio"
                  label={t(`base.schema.kind_${k}` as 'base.schema.kind_texto')}
                  selected={def.tipo === k}
                  onPress={() => set(n, { tipo: k })}
                />
              ))}
            </View>
            {(def.tipo === 'selecao' || def.tipo === 'multi') && (
              <Input
                accessibilityLabel={t('base.schema.options')}
                placeholder={t('base.schema.options')}
                value={(def.opcoes ?? []).join(', ')}
                onChangeText={(v) =>
                  set(n, {
                    ...def,
                    opcoes: v
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
            {def.tipo === 'relacao' && (
              <>
                <View
                  className="flex-row flex-wrap gap-2"
                  accessibilityRole="radiogroup"
                  aria-label={t('base.schema.target')}
                >
                  {bases.map((b) => (
                    <Chip
                      key={b.id}
                      role="radio"
                      label={pageLabel(b)}
                      selected={def.base === b.id}
                      onPress={() => set(n, { ...def, base: b.id })}
                    />
                  ))}
                  {!bases.length && (
                    <Text className="text-sm text-ink-muted">{t('base.schema.noBases')}</Text>
                  )}
                </View>
                <Input
                  accessibilityLabel={t('base.schema.inverse')}
                  placeholder={t('base.schema.inverse')}
                  value={def.inversa ?? ''}
                  onChangeText={(v) => set(n, { ...def, inversa: v.trim() || undefined })}
                  onBlur={() => ligarInversa(n, def)}
                />
              </>
            )}
            {def.tipo === 'rollup' && (
              <>
                <View
                  className="flex-row flex-wrap gap-2"
                  accessibilityRole="radiogroup"
                  aria-label={t('base.schema.relation')}
                >
                  {relacoes.map((r) => (
                    <Chip
                      key={r}
                      role="radio"
                      label={r}
                      selected={def.relacao === r}
                      onPress={() => set(n, { ...def, relacao: r })}
                    />
                  ))}
                  {!relacoes.length && (
                    <Text className="text-sm text-ink-muted">{t('base.schema.noRelations')}</Text>
                  )}
                </View>
                <Input
                  accessibilityLabel={t('base.schema.property')}
                  placeholder={t('base.schema.property')}
                  value={def.propriedade ?? ''}
                  onChangeText={(v) => set(n, { ...def, propriedade: v.trim() || undefined })}
                />
                <View
                  className="flex-row flex-wrap gap-2"
                  accessibilityRole="radiogroup"
                  aria-label={t('base.schema.function')}
                >
                  {ROLLUP_FNS.map((f) => (
                    <Chip
                      key={f}
                      role="radio"
                      label={t(`base.schema.fn_${f}` as 'base.schema.fn_sum')}
                      selected={(def.funcao ?? 'count') === f}
                      onPress={() => set(n, { ...def, funcao: f })}
                    />
                  ))}
                </View>
                <Text className="text-xs text-ink-muted">{t('base.schema.notInAutomations')}</Text>
              </>
            )}
          </View>
        );
      })}
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            accessibilityLabel={t('base.schema.newName')}
            placeholder={t('base.schema.newName')}
            value={nome}
            onChangeText={setNome}
            onSubmitEditing={criar}
          />
        </View>
        <Button label={t('base.schema.add')} onPress={criar} disabled={!cleanPropName(nome)} />
      </View>
    </View>
  );
}
