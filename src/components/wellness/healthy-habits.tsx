import { Check, Plus, Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HubRow, HubSection } from '@/components/hub';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { HEALTHY_HABITS, habitTitleKey } from '@/lib/healthy-habits';
import { useToday } from '@/lib/queries/profile';
import { useCreateTasks, useHabits } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/**
 * Vida saudável (BE3, ESCOPO_V10 §5, D275): hábitos prontos de água, sono, movimento, comida e
 * descanso, que entram na tela Hábitos com um toque (contador onde faz sentido: 8 copos de água),
 * e o atalho para Peso e medidas. O que já está nos hábitos (mesmo nome) aparece como adicionado.
 */
export function HealthyHabitsSection() {
  const { t } = useTranslation();
  const tree = useTree();
  const today = useToday();
  const habits = useHabits(today);
  const create = useCreateTasks();
  const toast = useToast();
  const pageId = tree.data?.habits?.id;
  const writable = useCanWrite(tree.data?.habits?.folder_id, { offline: true });
  const have = new Set((habits.data ?? []).map((h) => habitTitleKey(h.title)));

  function add(key: string, kind: 'check' | 'counter', target?: number) {
    if (!pageId) return;
    const title = t(`healthy.items.${key}` as 'healthy.items.water');
    create
      .mutateAsync({
        pageId,
        items: [
          {
            id: uuidv7(),
            title,
            meta: null,
            repeatPlan: null,
            priority: 0,
            dueDate: null,
            labels: [],
            mentions: [],
            prereqs: [],
            recurrence: null,
            habitKind: kind,
            habitTarget: kind === 'counter' ? (target ?? 1) : null,
          },
        ],
      })
      .then(
        () => toast({ message: t('healthy.added', { title }) }),
        (err: Error) => toast({ message: t('healthy.error', { message: err.message }) }),
      );
  }

  return (
    <View className="gap-3">
      <SectionLabel title={t('healthy.title')} />
      <Text className="text-sm text-ink-muted">{t('healthy.intro')}</Text>
      <View>
        {HEALTHY_HABITS.map((h) => {
          const title = t(`healthy.items.${h.key}` as 'healthy.items.water');
          const added = have.has(habitTitleKey(title));
          return (
            <View
              key={h.key}
              className="min-h-11 flex-row items-center gap-3 border-b border-line py-1"
            >
              <Text className="w-6 text-center text-base">{h.icon}</Text>
              <View className="flex-1">
                <Text className="text-sm text-ink">{title}</Text>
                <Text className="text-xs text-ink-muted">
                  {h.kind === 'counter'
                    ? t('healthy.perDay', { count: h.target })
                    : t('healthy.daily')}
                </Text>
              </View>
              {added ? (
                <Button
                  variant="ghost"
                  icon={Check}
                  label={t('healthy.done')}
                  disabled
                  accessibilityLabel={t('healthy.doneLabel', { title })}
                  onPress={() => undefined}
                />
              ) : (
                <Button
                  variant="ghost"
                  icon={Plus}
                  label={t('healthy.add')}
                  accessibilityLabel={t('healthy.addLabel', { title })}
                  disabled={!pageId || !writable}
                  onPress={() => add(h.key, h.kind, h.target)}
                />
              )}
            </View>
          );
        })}
      </View>
      <HubSection>
        <HubRow
          icon={Scale}
          label={t('body.title')}
          hint={t('workoutHub.bodyHint')}
          href="/corpo"
        />
      </HubSection>
    </View>
  );
}
