import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Diagrama } from '@/components/processo/diagram';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { openTask } from '@/lib/open-task';
import { useInstance, useProcessMutations } from '@/lib/queries/processos';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

// Uma instância (§9): o diagrama com o passo atual, a linha do tempo, as variáveis e cancelar,
// suspender, retomar e repetir o passo com falha (só a dona da definição).

export default function InstanciaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useSession();
  const q = useInstance(id);
  const m = useProcessMutations();
  const onError = (e: Error) => toast({ message: e.message });
  const inst = q.data?.instancia;
  const grafo = q.data?.grafo;
  const dona = inst?.owner_id === session?.user.id;
  const ativos = new Set(
    (q.data?.tokens ?? [])
      .filter((x) => ['pronto', 'rodando', 'esperando', 'falhou'].includes(x.status))
      .map((x) => x.node_id),
  );
  const nomes = new Map(
    (grafo?.nos ?? []).map((n) => [
      n.id,
      n.nome || t(`processos.no.${n.tipo}` as 'processos.badge'),
    ]),
  );
  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          help="processos"
          title={(inst?.process_definitions as { name?: string } | null)?.name ?? '…'}
          eyebrow={inst ? t(`processos.status.${inst.status}` as 'processos.badge') : undefined}
          back
        />
        {inst?.error && <Text className="text-sm text-danger">{inst.error}</Text>}
        {grafo && <Diagrama grafo={grafo} ativos={ativos} altura={360} />}
        {dona && inst && (
          <View className="flex-row flex-wrap gap-2">
            {inst.status === 'em_andamento' && (
              <Button
                variant="ghost"
                label={t('processos.suspend')}
                onPress={() => m.suspend.mutate(inst.id, { onError })}
              />
            )}
            {inst.status === 'suspensa' && (
              <Button
                variant="ghost"
                label={t('processos.resume')}
                onPress={() => m.resume.mutate(inst.id, { onError })}
              />
            )}
            {inst.status === 'falhou' && (
              <Button
                label={t('processos.retryStep')}
                onPress={() => m.resume.mutate(inst.id, { onError })}
              />
            )}
            {['em_andamento', 'suspensa'].includes(inst.status) && (
              <Button
                variant="ghost"
                destructive
                label={t('processos.cancel')}
                onPress={() => m.cancel.mutate(inst.id, { onError })}
              />
            )}
          </View>
        )}
        <View className="gap-1">
          <SectionLabel title={t('processos.timeline')} />
          {(q.data?.passos ?? []).map((p) => {
            const tarefa = (p.result as { tarefa?: string } | null)?.tarefa;
            return (
              <View key={p.id} className="gap-1 border-b border-line py-1">
                <Text
                  className={p.status === 'falhou' ? 'text-sm text-danger' : 'text-sm text-ink'}
                >
                  {new Date(p.started_at).toLocaleString()} · {nomes.get(p.node_id) ?? p.node_id} ·{' '}
                  {t(`processos.stepStatus.${p.status}` as 'processos.badge')}
                </Text>
                {p.error && <Text className="text-xs text-danger">{p.error}</Text>}
                {tarefa && (
                  <Button
                    variant="ghost"
                    className="self-start"
                    label={t('processos.openTask')}
                    onPress={() => openTask(tarefa)}
                  />
                )}
              </View>
            );
          })}
        </View>
        {dona && inst && (
          <View className="gap-1">
            <SectionLabel title={t('processos.variables')} />
            <Text selectable className="font-mono text-xs text-ink-muted">
              {JSON.stringify(inst.vars, null, 2)}
            </Text>
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}
