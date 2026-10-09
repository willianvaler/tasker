import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuickAdd } from '@/components/tasks/quick-add';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useGameState, useSetGamification } from '@/lib/queries/game';
import { keys } from '@/lib/queries/keys';
import { useToday, useUpdateProfile, type Profile } from '@/lib/queries/profile';
import { useTemplateMutations } from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { STARTER_TEMPLATES, templateData } from '@/lib/templates';
import { useToast } from '@/providers/toast';

const STEPS = ['Capturar', 'Organizar', 'Jogar'] as const;

/**
 * Onboarding guiado em 3 passos (ESCOPO 12, Fase 6): capturar rápido, organizar em pastas,
 * entender a gamificação. Aparece uma vez por conta; dá para pular a qualquer momento.
 */
export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const update = useUpdateProfile();
  const queryClient = useQueryClient();

  function finish() {
    const now = new Date().toISOString();
    // Já marca no cache: senão o layout manda de volta para cá enquanto o servidor responde
    queryClient.setQueryData<Profile>(keys.profile, (p) => (p ? { ...p, onboarded_at: now } : p));
    update.mutate({ onboarded_at: now });
    router.replace('/');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-lg flex-1 self-center px-5">
        <View className="flex-row items-center py-3">
          <View className="flex-1 flex-row gap-2" accessibilityLabel={`Passo ${step + 1} de 3`}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            className="ml-3 min-h-11 justify-center px-2"
            onPress={finish}
          >
            <Text className="text-sm text-muted-foreground">Pular introdução</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-8 pt-4">
          {step === 0 && <CaptureStep />}
          {step === 1 && <OrganizeStep />}
          {step === 2 && <GameStep />}
        </ScrollView>

        <View className="flex-row justify-between py-4">
          {step > 0 ? (
            <Button variant="ghost" label="Voltar" onPress={() => setStep(step - 1)} />
          ) : (
            <View />
          )}
          {step < STEPS.length - 1 ? (
            <Button label="Próximo" onPress={() => setStep(step + 1)} />
          ) : (
            <Button label="Começar" onPress={finish} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Title({ emoji, title, children }: { emoji: string; title: string; children: string }) {
  return (
    <View className="gap-2">
      <Text style={{ fontSize: 40, lineHeight: 48 }}>{emoji}</Text>
      <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
        {title}
      </Text>
      <Text className="text-base text-muted-foreground">{children}</Text>
    </View>
  );
}

function CaptureStep() {
  const tree = useTree();
  const today = useToday();
  const [created, setCreated] = useState(0);
  return (
    <>
      <Title emoji="⚡" title="Anote em 2 segundos">
        Digite e aperte Enter. Data, prioridade e etiqueta saem do próprio texto. Colar uma lista
        cria várias de uma vez.
      </Title>
      <QuickAdd
        pageId={tree.data?.inbox?.id}
        defaultDueDate={today}
        placeholder="Experimente: Comprar pão amanhã !! #casa"
        onCreated={() => setCreated((n) => n + 1)}
      />
      {created > 0 && (
        <Text className="text-sm text-primary" accessibilityLiveRegion="polite">
          ✓ {created === 1 ? 'Tarefa criada' : `${created} tarefas criadas`} na Caixa de entrada.
        </Text>
      )}
      <View className="gap-1 rounded-xl bg-muted p-3">
        <Text className="text-sm text-foreground">amanhã, sexta, 15/10 → vencimento</Text>
        <Text className="text-sm text-foreground">! !! !!! → prioridade</Text>
        <Text className="text-sm text-foreground">#mercado → etiqueta</Text>
        <Text className="text-sm text-foreground">/diaria, /seg,qua,sex → repete</Text>
      </View>
    </>
  );
}

function OrganizeStep() {
  const today = useToday();
  const m = useTemplateMutations();
  const toast = useToast();
  const [done, setDone] = useState<string[]>([]);
  return (
    <>
      <Title emoji="📁" title="Organize em pastas">
        Pastas guardam páginas: uma lista, um treino em cards, seus hábitos. Quer começar com
        alguma? Dá para mudar tudo depois.
      </Title>
      {STARTER_TEMPLATES.map((t) => {
        const created = done.includes(t.key);
        return (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={`Criar pasta ${t.name}`}
            aria-disabled={created}
            disabled={created || m.createFrom.isPending}
            className={cn(
              'gap-1 rounded-xl border p-4 active:opacity-70',
              created ? 'border-primary bg-card' : 'border-border',
            )}
            onPress={() =>
              m.createFrom.mutate(
                { name: t.name, icon: t.icon, data: templateData(t, today), shared: false },
                {
                  onSuccess: () => setDone((d) => [...d, t.key]),
                  onError: (err) => toast({ message: `Não deu certo: ${err.message}` }),
                },
              )
            }
          >
            <Text className="text-lg font-semibold text-foreground">
              {t.icon} {t.name} {created ? '✓' : ''}
            </Text>
            <Text className="text-sm text-muted-foreground">{t.description}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

function GameStep() {
  const game = useGameState();
  const setEnabled = useSetGamification();
  const enabled = game.data?.enabled ?? true;
  return (
    <>
      <Title emoji="⚔️" title="Ganhe XP fazendo">
        Cada tarefa concluída vale XP e sobe seu nível. Dias seguidos viram sequência (um dia de
        folga por semana não quebra). Toda semana aparece um boss: seu XP é o dano nele.
      </Title>
      <View className="gap-1 rounded-xl bg-muted p-3">
        <Text className="text-sm text-foreground">
          Nada de punição: tarefa esquecida não tira XP.
        </Text>
        <Text className="text-sm text-foreground">
          Em projetos e clãs, o boss é de todo mundo, e quem ajudou ganha a recompensa.
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-base text-foreground">
          {enabled ? 'Gamificação ligada' : 'Gamificação desligada (dá para ligar no Perfil)'}
        </Text>
        <Switch
          accessibilityLabel="Gamificação"
          aria-checked={enabled}
          value={enabled}
          onValueChange={(value) => setEnabled.mutate(value)}
        />
      </View>
    </>
  );
}
