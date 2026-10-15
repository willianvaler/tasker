import { Fragment } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

// Markdown dos artigos da Ajuda (F1, D145): só o que eles usam — "## título", parágrafos,
// listas com "- ", **negrito** e `código`. Sem HTML, sem link, sem imagem.

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <Text key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </Text>
        ) : part.startsWith('`') ? (
          <Text key={i} className="rounded bg-wash font-mono text-sm text-ink">
            {part.slice(1, -1)}
          </Text>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n\s*\n/);
  return (
    <View className="gap-3">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (block.startsWith('## '))
          return (
            <Text
              key={i}
              accessibilityRole="header"
              className="pt-2 text-lg font-semibold text-ink"
            >
              {block.slice(3)}
            </Text>
          );
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <View key={i} className="gap-1" accessibilityRole="list">
              {lines.map((line, j) => (
                <View key={j} className="flex-row gap-2">
                  <Text className="text-base text-ink-muted">•</Text>
                  <Text className="flex-1 text-base text-ink">
                    <Inline text={line.slice(2)} />
                  </Text>
                </View>
              ))}
            </View>
          );
        return (
          <Text key={i} className="text-base text-ink">
            <Inline text={lines.join(' ')} />
          </Text>
        );
      })}
    </View>
  );
}
