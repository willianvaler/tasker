import { Redirect } from 'expo-router';
import {
  Calendar,
  Check,
  Folder,
  Inbox,
  Plus,
  Repeat,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  User,
  Users,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/theme-toggle';
import { COLORS, MARKER_COLORS, useColors, type ColorToken } from '@/lib/tokens';

// Referência visual dos tokens e componentes (V3 §0.1). Só em desenvolvimento: em produção a
// rota volta para o início. Cada componente novo ganha uma seção aqui antes de ir para as telas.

export default function DesignScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-6 md:p-12">
      <View className="w-full max-w-4xl gap-12 self-center">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="font-mono text-xs text-ink-muted">DOCS/DESIGN.MD</Text>
            <Text className="font-serif text-xl text-ink">Caderno de bolso</Text>
          </View>
          <ThemeToggle />
        </View>
        <Palette />
        <Typography />
        <Spacing />
        <Icons />
        <Buttons />
        <Inputs />
      </View>
    </ScrollView>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-4">
      <Text className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Palette() {
  const colors = useColors();
  const tokens = Object.keys(COLORS.light) as ColorToken[];
  return (
    <Section title="Cores">
      <View className="flex-row flex-wrap gap-4">
        {tokens.map((token) => (
          <View key={token} className="w-32 gap-1">
            <View
              className="h-12 rounded border border-line"
              style={{ backgroundColor: colors[token] }}
            />
            <Text className="text-sm text-ink">{token}</Text>
            <Text className="font-mono text-xs text-ink-muted">
              {COLORS.light[token]} · {COLORS.dark[token]}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-2">
        {MARKER_COLORS.map((c) => (
          <View key={c} className="h-6 w-1 rounded" style={{ backgroundColor: c }} />
        ))}
        <Text className="text-xs text-ink-muted">marcadores de pasta/projeto</Text>
      </View>
    </Section>
  );
}

function Typography() {
  return (
    <Section title="Tipografia">
      <Text className="font-serif text-xl text-ink">Título de página 28 · Fraunces 500</Text>
      <Text className="text-lg font-semibold text-ink">
        Título de seção 20 · Instrument Sans 600
      </Text>
      <Text className="text-base text-ink">
        Texto de leitura 16 · notas e ajuda, com frases curtas.
      </Text>
      <Text className="text-sm text-ink">
        Texto da interface 14 · o padrão de botões, linhas e campos.
      </Text>
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Rótulo de seção 12
      </Text>
      <Text className="font-mono text-xs text-ink-muted">
        nv 7 · 340/500 xp · HP 640/900 · Ctrl K
      </Text>
    </Section>
  );
}

function Spacing() {
  return (
    <Section title="Espaço (4 · 8 · 12 · 16 · 24 · 32 · 48)">
      <View className="flex-row items-end gap-4">
        {[1, 2, 3, 4, 6, 8, 12].map((n) => (
          <View key={n} className="items-center gap-1">
            <View className="bg-accent" style={{ width: n * 4, height: n * 4 }} />
            <Text className="font-mono text-xs text-ink-muted">{n * 4}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function Icons() {
  const icons = [
    Sun,
    Inbox,
    User,
    Users,
    Folder,
    Repeat,
    Plus,
    Search,
    Calendar,
    Check,
    SlidersHorizontal,
    Settings,
  ];
  return (
    <Section title="Ícones (Lucide, traço 1,5)">
      <View className="flex-row flex-wrap items-center gap-4">
        {icons.map((glyph, i) => (
          <Icon key={i} icon={glyph} size={20} />
        ))}
        {icons.slice(0, 6).map((glyph, i) => (
          <Icon key={`s${i}`} icon={glyph} size={16} tone="ink-muted" />
        ))}
        <Icon icon={Check} size={20} tone="accent" />
      </View>
    </Section>
  );
}

function Buttons() {
  return (
    <Section title="Botões (só primário e fantasma)">
      <View className="flex-row flex-wrap items-center gap-2">
        <Button label="Salvar" onPress={() => {}} />
        <Button label="Nova tarefa" icon={Plus} onPress={() => {}} />
        <Button label="Cancelar" variant="ghost" onPress={() => {}} />
        <Button label="Configurar" variant="ghost" icon={SlidersHorizontal} onPress={() => {}} />
        <Button label="Salvando" loading onPress={() => {}} />
        <Button label="Desabilitado" disabled onPress={() => {}} />
        <IconButton icon={Search} label="Buscar" />
        <IconButton icon={Settings} label="Configurações" />
      </View>
    </Section>
  );
}

function Inputs() {
  return (
    <Section title="Campos">
      <View className="max-w-sm gap-2">
        <Input placeholder="Nome (ex.: Academia)" />
        <Input value="Treino A" onChangeText={() => {}} />
        <Input placeholder="Desabilitado" editable={false} className="opacity-40" />
      </View>
    </Section>
  );
}
