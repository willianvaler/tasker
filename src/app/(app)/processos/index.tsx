import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { MODELOS_PROCESSO } from '@/lib/processo/modelos';
import { useDefinitions, useInstances, useProcessMutations } from '@/lib/queries/processos';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Processos (ESCOPO_V16 §9, PR5): definições, instâncias, funções e modelos. Separado do Fluxo
// (o grafo das dependências), V16-1.

export default function ProcessosHome() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const defs = useDefinitions();
  const inst = useInstances();
  const m = useProcessMutations();
  const onError = (e: Error) => toast({ message: e.message });
  const criar = (
    name: string,
    draft: Parameters<typeof m.create.mutate>[0]['draft'],
    is_function = false,
  ) =>
    m.create.mutate(
      { name, draft, is_function },
      { onError, onSuccess: (id) => router.push({ pathname: '/processos/[id]', params: { id } }) },
    );
  const lista = defs.data ?? [];
  const [advanced, setAdvanced] = useState(false);
  const Linha = ({ d }: { d: (typeof lista)[number] }) => (
    <Button
      variant="ghost"
      className="self-start"
      label={`${d.name}${d.active ? '' : ` · ${t('processos.off')}`}`}
      onPress={() => router.push({ pathname: '/processos/[id]', params: { id: d.id } })}
    />
  );
  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader help="processos" title={t('processos.title')} back />
        <Text className="text-sm text-ink-muted">{t('processos.intro')}</Text>
        {!online && <Text className="text-sm text-warn">{t('auto.ed.offline')}</Text>}

        <View className="gap-2">
          <SectionLabel title={t('processos.definitions')} />
          {lista
            .filter((d) => !d.is_function)
            .map((d) => (
              <Linha key={d.id} d={d} />
            ))}
          {lista.filter((d) => !d.is_function).length === 0 && (
            <Text className="text-sm text-ink-muted">{t('processos.empty')}</Text>
          )}
          <Button
            icon={Plus}
            className="self-start"
            label={t('processos.new')}
            disabled={!online}
            onPress={() =>
              criar(t('processos.newName'), {
                v: 1,
                nos: [
                  { id: 'inicio', tipo: 'inicio', x: 40, y: 40 },
                  { id: 'fim', tipo: 'fim', x: 320, y: 40 },
                ],
                arestas: [{ id: 'a1', de: 'inicio', para: 'fim' }],
              })
            }
          />
        </View>

        {/* Funções são para quem já monta processos: ficam atrás de "Avançado" (M11), salvo se já houver */}
        {!advanced && !lista.some((d) => d.is_function) ? (
          <Button
            variant="ghost"
            className="self-start"
            label={t('base.advanced')}
            aria-expanded={false}
            onPress={() => setAdvanced(true)}
          />
        ) : (
          <View className="gap-2">
            <SectionLabel title={t('processos.functions')} />
            <Text className="text-xs text-ink-muted">{t('processos.functionsHint')}</Text>
            {lista
              .filter((d) => d.is_function)
              .map((d) => (
                <Linha key={d.id} d={d} />
              ))}
            <Button
              variant="ghost"
              className="self-start"
              label={t('processos.newFunction')}
              disabled={!online}
              onPress={() =>
                criar(
                  t('processos.newFunctionName'),
                  {
                    v: 1,
                    assinatura: { entradas: [], saidas: [] },
                    nos: [
                      { id: 'inicio', tipo: 'inicio', x: 40, y: 40 },
                      { id: 'fim', tipo: 'fim', x: 320, y: 40 },
                    ],
                    arestas: [{ id: 'a1', de: 'inicio', para: 'fim' }],
                  },
                  true,
                )
              }
            />
          </View>
        )}

        <View className="gap-2">
          <SectionLabel title={t('processos.templates')} />
          {MODELOS_PROCESSO.map((md) => (
            <View key={md.id} className="gap-1">
              <Text className="text-sm font-semibold text-ink">{md.titulo()}</Text>
              <Text className="text-sm text-ink-muted">{md.descricao()}</Text>
              <Button
                variant="ghost"
                className="self-start"
                label={t('auto.ed.useModel', { name: md.titulo() })}
                disabled={!online}
                onPress={() => criar(md.titulo(), md.grafo())}
              />
            </View>
          ))}
        </View>

        <View className="gap-2">
          <SectionLabel title={t('processos.instances')} />
          {(inst.data ?? []).length === 0 && (
            <Text className="text-sm text-ink-muted">{t('processos.noInstances')}</Text>
          )}
          {(inst.data ?? []).map((i) => (
            <Button
              key={i.id}
              variant="ghost"
              className="self-start"
              label={`${(i.process_definitions as { name?: string } | null)?.name ?? ''} · ${t(`processos.status.${i.status}` as 'processos.badge')} · ${new Date(i.started_at).toLocaleString()}`}
              onPress={() =>
                router.push({ pathname: '/processos/instancia/[id]', params: { id: i.id } })
              }
            />
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
