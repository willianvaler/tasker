import { View } from 'react-native';
import { useMarkdown } from 'react-native-marked';
import { useColorScheme } from 'nativewind';

import { FONT_FAMILY } from '@/lib/fonts';
import { withTaskBoxes } from '@/lib/markdown-edit';
import { useColors } from '@/lib/tokens';

/** Anotação formatada (D187): Markdown com as cores e as fontes do app. */
export function NoteMarkdown({ value }: { value: string }) {
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const text = { color: colors.ink, fontFamily: FONT_FAMILY.sans, fontSize: 16, lineHeight: 24 };
  const heading = { color: colors.ink, fontFamily: FONT_FAMILY.serif, marginTop: 8 };
  const elements = useMarkdown(withTaskBoxes(value), {
    colorScheme,
    theme: {
      colors: { text: colors.ink, link: colors.accent, code: colors.wash, border: colors.line },
    },
    styles: {
      text,
      paragraph: { paddingVertical: 4 },
      li: text,
      strong: { fontFamily: FONT_FAMILY.sansSemibold, fontWeight: 'normal' },
      em: { fontStyle: 'italic' },
      h1: { ...heading, fontSize: 24, lineHeight: 32 },
      h2: { ...heading, fontSize: 20, lineHeight: 28 },
      h3: { ...heading, fontSize: 18, lineHeight: 26 },
      codespan: { fontFamily: FONT_FAMILY.mono, backgroundColor: colors.wash },
      link: { color: colors.accent, textDecorationLine: 'underline' },
    },
  });
  return (
    <View className="gap-1">
      {elements.map((element, i) => (
        <View key={i}>{element}</View>
      ))}
    </View>
  );
}
