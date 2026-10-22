import { useQueryClient } from '@tanstack/react-query';
import { uuidv7 } from '@/lib/uuid';
import { router } from 'expo-router';
import {
  Check,
  Folder,
  SlidersHorizontal,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameLevelSettings } from '@/components/game-profile';
import { ItemIcon } from '@/components/item-icon';
import { LanguageChooser, ThemeChooser } from '@/components/preference-choosers';
import { TimerAlertSetting } from '@/components/timer-alert-setting';
import { QuickAdd } from '@/components/tasks/quick-add';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { keys } from '@/lib/queries/keys';
import {
  useProfile,
  useSetGymMode,
  useToday,
  useUpdateProfile,
  type Profile,
} from '@/lib/queries/profile';
import { useTemplateMutations } from '@/lib/queries/projects';
import { useCreateTasks, type Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { parseQuickInput } from '@/lib/parser/quick';
import { STARTER_TEMPLATES, templateData } from '@/lib/templates';
import { useToast } from '@/providers/toast';

const STEPS = 4;

/**
 * Assistente de primeiro uso em 4 passos (U4, D160): deixar do seu jeito (idioma, tema e avisos),
 * capturar rápido, organizar em pastas e "Para que você vai usar?" (treino e jogo, D266). Aparece uma vez por
 * conta; dá para pular a qualquer momento e refazer pela Ajuda.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const profile = useProfile().data;
  const setGymMode = useSetGymMode();
  // Treino (UX12): a resposta vai ao começar; quem pula não responde (a Hoje pergunta depois)
  const [gym, setGym] = useState(profile?.gym_enabled === true);
  const [answered, setAnswered] = useState(false);

  function finish() {
    if (answered && (profile?.gym_enabled == null || gym !== profile.gym_enabled))
      setGymMode.mutate(gym);
    const now = new Date().toISOString();
    // Já marca no cache: senão o layout manda de volta para cá enquanto o servidor responde
    queryClient.setQueryData<Profile>(keys.profile, (p) => (p ? { ...p, onboarded_at: now } : p));
    update.mutate({ onboarded_at: now });
    router.replace('/');
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="w-full max-w-lg flex-1 self-center px-6">
        <View className="flex-row items-center py-3">
          <View
            className="flex-1 flex-row items-center gap-3"
            accessibilityLabel={t('onboarding.step', { n: step + 1 })}
          >
            <Text className="font-mono text-xs text-ink-muted">
              {step + 1}/{STEPS}
            </Text>
            <ProgressBar className="flex-1" value={(step + 1) / STEPS} label="" />
          </View>
          <Button variant="ghost" className="ml-3" label={t('onboarding.skip')} onPress={finish} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-8 pt-4">
          {step === 0 && <SetupStep />}
          {step === 1 && <CaptureStep />}
          {step === 2 && <OrganizeStep />}
          {step === 3 && (
            <UsesStep
              gym={gym}
              onGym={(value) => {
                setGym(value);
                setAnswered(true);
              }}
            />
          )}
        </ScrollView>

        <View className="flex-row justify-between py-4">
          {step > 0 ? (
            <Button variant="ghost" label={t('common.back')} onPress={() => setStep(step - 1)} />
          ) : (
            <View />
          )}
          {step < STEPS - 1 ? (
            <Button
              label={t('onboarding.next')}
              onPress={() => {
                // Chegar ao último passo já é responder (mesmo deixando o treino desligado)
                if (step + 1 === STEPS - 1) setAnswered(true);
                setStep(step + 1);
              }}
            />
          ) : (
            <Button label={t('onboarding.start')} onPress={finish} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Title({ icon, title, children }: { icon: LucideIcon; title: string; children: string }) {
  return (
    <View className="gap-3">
      <Icon icon={icon} size={24} tone="accent" />
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {title}
      </Text>
      <Text className="text-base text-ink-muted">{children}</Text>
    </View>
  );
}

/** Lista curta de exemplos em mono, sem caixa. */
function Hints({ lines }: { lines: string[] }) {
  return (
    <View className="gap-1 border-l-2 border-line pl-3">
      {lines.map((line) => (
        <Text key={line} className="font-mono text-xs text-ink-muted">
          {line}
        </Text>
      ))}
    </View>
  );
}

/** Opção de começar com algo pronto: linha com ícone e o "feito" no acento. */
function StarterRow({
  label,
  title,
  text,
  icon,
  created,
  disabled,
  onPress,
}: {
  label: string;
  title: string;
  text: string;
  icon: ReactNode;
  created: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={created}
      disabled={disabled}
      className="flex-row items-start gap-3 border-b border-line px-2 py-3 hover:bg-wash active:bg-wash"
      onPress={onPress}
    >
      <View className="pt-1">{icon}</View>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        <Text className="text-sm text-ink-muted">{text}</Text>
      </View>
      {created && <Icon icon={Check} tone="accent" />}
    </Pressable>
  );
}

function CaptureStep() {
  const { t } = useTranslation();
  const tree = useTree();
  const today = useToday();
  const [created, setCreated] = useState(0);
  return (
    <>
      <Title icon={Zap} title={t('onboarding.captureTitle')}>
        {t('onboarding.captureText')}
      </Title>
      <QuickAdd
        pageId={tree.data?.inbox?.id}
        defaultDueDate={today}
        placeholder={t('onboarding.capturePlaceholder')}
        onCreated={() => setCreated((n) => n + 1)}
      />
      {created > 0 && (
        <Text className="text-sm text-accent" accessibilityLiveRegion="polite">
          {t('onboarding.created', { count: created })}
        </Text>
      )}
      <Hints
        lines={[
          t('onboarding.syntaxDate'),
          t('onboarding.syntaxPriority'),
          t('onboarding.syntaxLabel'),
          t('onboarding.syntaxRepeat'),
        ]}
      />
    </>
  );
}

/** Hábitos sugeridos: vão para a página de Hábitos, não viram pasta. */
// A repetição vai na sintaxe que o parser entende (português, por enquanto: F3 traduz o parser)
const STARTER_HABITS = [
  { title: 'onboarding.habitWater', kind: 'counter', target: 8 },
  { title: 'onboarding.habitMeditate', kind: 'check' },
  { title: 'onboarding.habitRead', kind: 'check', repeat: '/seg,qua,sex' },
  { title: 'onboarding.habitEat', kind: 'plusminus' },
] as const satisfies readonly {
  title: string;
  kind: Task['habit_kind'];
  target?: number;
  repeat?: string;
}[];

function OrganizeStep() {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const m = useTemplateMutations();
  const createTasks = useCreateTasks();
  const toast = useToast();
  const [done, setDone] = useState<string[]>([]);

  function createHabits() {
    const pageId = tree.data?.habits?.id;
    if (!pageId) return;
    createTasks.mutate(
      {
        pageId,
        items: STARTER_HABITS.map((h) => ({
          ...parseQuickInput(`${t(h.title)}${'repeat' in h ? ` ${h.repeat}` : ''}`, { today }),
          habitKind: h.kind,
          habitTarget: 'target' in h ? h.target : null,
          id: uuidv7(),
        })),
      },
      {
        onSuccess: () => setDone((d) => [...d, 'habitos']),
        onError: (err) => toast({ message: t('onboarding.error', { message: err.message }) }),
      },
    );
  }
  return (
    <>
      <Title icon={Folder} title={t('onboarding.organizeTitle')}>
        {t('onboarding.organizeText')}
      </Title>
      <View className="border-t border-line">
        {STARTER_TEMPLATES.map((tpl) => {
          const created = done.includes(tpl.key);
          if (tpl.key === 'habitos')
            return (
              <StarterRow
                key={tpl.key}
                label={t('onboarding.habitsLabel')}
                title={t('onboarding.habitsTitle')}
                text={t('onboarding.habitsText')}
                icon={<ItemIcon kind="habits" size={20} />}
                created={created}
                disabled={created || createTasks.isPending || !tree.data?.habits}
                onPress={createHabits}
              />
            );
          return (
            <StarterRow
              key={tpl.key}
              label={t('onboarding.createFolder', { name: tpl.name })}
              title={tpl.name}
              text={tpl.description}
              icon={<ItemIcon icon={tpl.icon} kind="folder" size={20} />}
              created={created}
              disabled={created || m.createFrom.isPending}
              onPress={() =>
                m.createFrom.mutate(
                  { name: tpl.name, icon: tpl.icon, data: templateData(tpl, today), shared: false },
                  {
                    onSuccess: () => setDone((d) => [...d, tpl.key]),
                    onError: (err) =>
                      toast({ message: t('onboarding.error', { message: err.message }) }),
                  },
                )
              }
            />
          );
        })}
      </View>
    </>
  );
}

/** Do seu jeito: o que muda a cara do app, antes de usar (U4) */
function SetupStep() {
  const { t } = useTranslation();
  return (
    <>
      <Title icon={SlidersHorizontal} title={t('onboarding.setupTitle')}>
        {t('onboarding.setupText')}
      </Title>
      <LanguageChooser />
      <ThemeChooser />
      <TimerAlertSetting />
    </>
  );
}

/**
 * "Para que você vai usar?" (UX12, D266): treino e jogo, que mudam o que aparece (a Academia, o
 * Treino, o Jogo e as posições da barra de baixo). A resposta do treino vale ao começar (o "Vai
 * usar para treinar?" da Hoje não aparece mais para quem passou por aqui).
 */
function UsesStep({ gym, onGym }: { gym: boolean; onGym: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Title icon={Sparkles} title={t('onboarding.usesTitle')}>
        {t('onboarding.usesText')}
      </Title>
      <ToggleRow title={t('gym.toggle')} hint={t('gym.toggleHint')} value={gym} onChange={onGym} />
      <View className="gap-2 pt-2">
        <Text className="font-serif text-lg text-ink">{t('onboarding.gameTitle')}</Text>
        <Text className="text-sm text-ink-muted">{t('onboarding.gameText')}</Text>
        <Hints lines={[t('onboarding.noPunish'), t('onboarding.shared')]} />
        <GameLevelSettings />
      </View>
      <Text className="text-sm text-ink-muted">{t('onboarding.barHint')}</Text>
    </>
  );
}
