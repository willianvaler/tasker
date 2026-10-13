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
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { MenuItem, Popover } from '@/components/ui/popover';
import { Avatar, PersonRow } from '@/components/ui/person';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/providers/toast';
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
        <Checkboxes />
        <Chips />
        <Rules />
        <People />
        <Feedback />
        <Menus />
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

function Checkboxes() {
  const [checked, setChecked] = useState(true);
  return (
    <Section title="Caixa de marcar (carimbo)">
      <View className="flex-row items-center gap-4">
        <Checkbox label="Exemplo" checked={checked} onChange={setChecked} />
        <Checkbox label="Desmarcada" checked={false} onChange={() => {}} />
        <Checkbox label="Desabilitada" checked disabled onChange={() => {}} />
      </View>
    </Section>
  );
}

function Chips() {
  const [selected, setSelected] = useState('semana');
  return (
    <Section title="Chips">
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {['dia', 'semana', 'mês'].map((c) => (
          <Chip
            key={c}
            role="radio"
            label={c}
            selected={selected === c}
            onPress={() => setSelected(c)}
          />
        ))}
        <Chip label="#churrasco" onPress={() => {}} />
        <Chip label="desabilitado" disabled onPress={() => {}} />
      </View>
    </Section>
  );
}

function Rules() {
  return (
    <Section title="Progresso (régua de 2 px)">
      <View className="max-w-md gap-4">
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="font-mono text-xs text-ink-muted">7 de 12 itens</Text>
            <Text className="font-mono text-xs text-ink-muted">58%</Text>
          </View>
          <ProgressBar value={7 / 12} label="Progresso de exemplo" />
        </View>
        <View className="flex-row items-center gap-4 border-y border-line py-2">
          <Text className="font-serif text-base text-ink">Golem da Procrastinação</Text>
          <ProgressBar value={0.29} label="HP do boss" className="flex-1" />
          <Text className="font-mono text-xs text-ink-muted">HP 640/900</Text>
        </View>
      </View>
    </Section>
  );
}

function People() {
  return (
    <Section title="Pessoas">
      <View className="max-w-md">
        <PersonRow
          name="Willian Valer"
          detail="Gerente"
          right={<Text className="font-mono text-xs text-ink-muted">4 tarefas</Text>}
        />
        <PersonRow
          name="Greg"
          detail="Editor"
          right={<Text className="font-mono text-xs text-ink-muted">3 tarefas</Text>}
        />
      </View>
      <View className="flex-row gap-2">
        <Avatar name="Willian Valer" />
        <Avatar name="Greg" />
        <Avatar name="Ana Souza" size={32} />
      </View>
    </Section>
  );
}

function Feedback() {
  const toast = useToast();
  return (
    <Section title="Aviso e estado vazio">
      <View className="flex-row">
        <Button
          variant="ghost"
          label="Mostrar aviso"
          onPress={() =>
            toast({
              message: 'Concluída: Comprar carvão · +10 xp',
              action: { label: 'Desfazer', onPress: () => {} },
            })
          }
        />
      </View>
      <EmptyState
        title="Nada para hoje. Aproveite o café."
        hint="Digite no campo acima para criar uma tarefa."
      />
    </Section>
  );
}

function Menus() {
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Section title="Popover e menu">
      <View ref={anchor} collapsable={false} className="self-start">
        <Button label="Novo" icon={Plus} variant="ghost" onPress={() => setOpen(true)} />
      </View>
      <Popover anchor={anchor} open={open} onClose={close}>
        <MenuItem label="Tarefa" shortcut="T" icon={<Icon icon={Check} />} onPress={close} />
        <MenuItem label="Página" shortcut="P" icon={<Icon icon={Folder} />} onPress={close} />
        <MenuItem label="Projeto" shortcut="J" icon={<Icon icon={Users} />} onPress={close} />
        <MenuItem label="Apagar" danger onPress={close} />
      </Popover>
    </Section>
  );
}
