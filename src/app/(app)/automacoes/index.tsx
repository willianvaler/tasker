import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { MODELOS, resumoGatilho, type Definicao } from '@/lib/automation/editor';
import { useRuleMutations, useRules, useUsage } from '@/lib/queries/automation-rules';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Configurações → Automações (V14 §9, AU7): as regras pessoais, o uso da hora, Pausar todas e os
// modelos. O editor é a tela /automacao/<id>.

export default function AutomationsHome() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const rules = useRules();
  const usage = useUsage();
  const m = useRuleMutations();
  const onError = (err: Error) => toast({ message: err.message });
  const paused = usage.data?.pausado ?? false;

  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader help="automacoes" title={t('auto.ed.title')} back />
        <Text className="text-sm text-ink-muted">{t('auto.ed.intro')}</Text>
        {!online && <Text className="text-sm text-warn">{t('auto.ed.offline')}</Text>}

        {usage.data && (
          <View className="gap-2">
            {/* O uso só aparece perto do limite (avaliação de UX, M11) */}
            {usage.data.hora >= usage.data.limite_hora * 0.8 && (
              <Text className="font-mono text-xs text-warn">
                {t('auto.ed.usage', { n: usage.data.hora, max: usage.data.limite_hora })}
              </Text>
            )}
            <ToggleRow
              title={t('auto.ed.pauseAll')}
              hint={t('auto.ed.pauseAllHint')}
              value={paused}
              disabled={!online}
              onChange={(v) => m.pause.mutate(v, { onError })}
            />
          </View>
        )}

        <View className="gap-2">
          <SectionLabel title={t('auto.ed.mine')} />
          {(rules.data ?? []).length === 0 && !rules.isLoading && (
            <Text className="text-sm text-ink-muted">{t('auto.ed.empty')}</Text>
          )}
          {(rules.data ?? []).map((r) => {
            const def = r.definition as unknown as Definicao;
            const falhas = r.disabled_reason === 'falhas';
            return (
              <View key={r.id} className="gap-1 border-b border-line pb-2">
                <ToggleRow
                  title={r.name}
                  hint={[
                    resumoGatilho(def.gatilho),
                    r.last_run_at
                      ? t('auto.ed.lastRun', { at: new Date(r.last_run_at).toLocaleString() })
                      : null,
                    falhas
                      ? t('auto.ed.disabledFailures')
                      : r.consecutive_failures > 0
                        ? t('auto.ed.failing', { n: r.consecutive_failures })
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={r.enabled}
                  disabled={!online}
                  onChange={(enabled) => m.toggle.mutate({ id: r.id, enabled }, { onError })}
                />
                <Button
                  variant="ghost"
                  className="self-start"
                  label={t('auto.ed.edit', { name: r.name })}
                  onPress={() => router.push({ pathname: '/automacao/[id]', params: { id: r.id } })}
                />
              </View>
            );
          })}
          <Button
            icon={Plus}
            className="self-start"
            label={t('auto.new')}
            disabled={!online}
            onPress={() => router.push({ pathname: '/automacao/[id]', params: { id: 'nova' } })}
          />
        </View>

        <View className="gap-3">
          <SectionLabel title={t('auto.ed.models')} />
          {MODELOS.map((modelo) => (
            <View key={modelo.id} className="gap-1">
              <Text className="text-sm font-semibold text-ink">{modelo.titulo()}</Text>
              <Text className="text-sm text-ink-muted">{modelo.descricao()}</Text>
              {modelo.precisa === 'dispositivos' ? (
                <Text className="text-xs text-ink-muted">{t('auto.ed.needsDevices')}</Text>
              ) : (
                <Button
                  variant="ghost"
                  className="self-start"
                  label={t('auto.ed.useModel', { name: modelo.titulo() })}
                  disabled={!online}
                  onPress={() =>
                    router.push({
                      pathname: '/automacao/[id]',
                      params: { id: 'nova', modelo: modelo.id },
                    })
                  }
                />
              )}
            </View>
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
