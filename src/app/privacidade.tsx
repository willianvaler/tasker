import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

// Política de privacidade (ESCOPO 9). Pública (fora do login): as lojas pedem um endereço para ela.
export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="w-full max-w-2xl self-center gap-4 px-6 py-8">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          Política de privacidade
        </Text>
        <Text className="text-sm text-ink-muted">Questlist · atualizada em outubro de 2026</Text>

        <Section title="O que guardamos">
          Seu nome, e-mail e fuso horário; as pastas, páginas, tarefas e comentários que você cria;
          o histórico de conclusões e de XP; o seu personagem (classe, atributos, ouro e itens); e,
          se você ligar os avisos no celular, um identificador do aparelho para mandar as
          notificações.
        </Section>
        <Section title="Para que usamos">
          Só para o app funcionar: mostrar suas tarefas, sincronizar entre aparelhos, mostrar aos
          membros de um projeto ou clã o que é compartilhado com eles e calcular XP, dano, ouro,
          sequência e bosses. Não vendemos nem compartilhamos seus dados, não mostramos anúncios e
          não rastreamos você em outros apps ou sites.
        </Section>
        <Section title="Quem vê o quê">
          Suas pastas pessoais são só suas. Em um projeto compartilhado, os membros veem as tarefas,
          comentários e a atividade daquele projeto. Num clã, os membros veem seu nome, nível,
          classe, o visual do personagem, conquistas e o dano no boss, nunca as suas tarefas.
        </Section>
        <Section title="Onde fica">
          Os dados ficam num banco de dados Supabase, com acesso restrito por regras de segurança
          por usuário. No aparelho fica só uma cópia para abrir rápido e sem internet.
        </Section>
        <Section title="Seus direitos">
          No Perfil você pode baixar todos os seus dados (JSON ou planilha) e excluir a conta a
          qualquer momento. Ao excluir, suas pastas e seu histórico são apagados; projetos com
          outras pessoas continuam com elas.
        </Section>
        <Section title="Contato">
          Dúvidas sobre privacidade: abra uma issue em github.com/willianvaler/tasker.
        </Section>

        <View className="pt-4">
          <Button
            variant="ghost"
            className="self-start"
            label="Ir para o Questlist"
            onPress={() => router.replace('/')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      <Text className="text-base  text-ink">{children}</Text>
    </View>
  );
}
