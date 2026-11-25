import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { Grafo } from '@/lib/processo';

// Diagrama no celular (PR5, V16-12): só leitura, como lista de passos e ligações, com o passo atual
// em destaque. A edição é só na web (`diagram.web.tsx`).

export type DiagramaProps = {
  grafo: Grafo;
  editavel?: boolean;
  ativos?: Set<string>;
  comErro?: Set<string>;
  selecionado?: { tipo: 'no' | 'aresta'; id: string } | null;
  onSelecionar?: (s: { tipo: 'no' | 'aresta'; id: string } | null) => void;
  onMudar?: (g: Grafo) => void;
  altura?: number;
};

export function Diagrama({ grafo, ativos, comErro, onSelecionar }: DiagramaProps) {
  const { t } = useTranslation();
  const nome = (id: string) => {
    const n = grafo.nos.find((x) => x.id === id);
    return n?.nome || (n ? t(`processos.no.${n.tipo}` as 'processos.badge') : id);
  };
  return (
    <View className="gap-1" accessibilityLabel={t('processos.diagram')}>
      {grafo.nos.map((n) => {
        const saem = grafo.arestas.filter((a) => a.de === n.id);
        return (
          <Pressable
            key={n.id}
            onPress={() => onSelecionar?.({ tipo: 'no', id: n.id })}
            className={cn(
              'gap-1 rounded border border-line px-3 py-2',
              ativos?.has(n.id) && 'border-accent bg-accent-soft',
              comErro?.has(n.id) && 'border-danger',
            )}
          >
            <Text className="text-xs text-ink-muted">
              {t(`processos.no.${n.tipo}` as 'processos.badge')}
            </Text>
            <Text className="text-sm text-ink">{nome(n.id)}</Text>
            {saem.map((a) => (
              <Text key={a.id} className="text-xs text-ink-muted">
                → {nome(a.para)}
                {a.condicao
                  ? ` (${a.condicao})`
                  : a.padrao
                    ? ` (${t('processos.aresta.padrao')})`
                    : a.escolha
                      ? ` (${a.escolha})`
                      : ''}
              </Text>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}
