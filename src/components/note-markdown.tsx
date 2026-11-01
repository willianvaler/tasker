import { useMemo, type ReactNode } from 'react';
import { View, type TextStyle } from 'react-native';
import { Renderer, useMarkdown } from 'react-native-marked';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { FONT_FAMILY } from '@/lib/fonts';
import { withTaskBoxes } from '@/lib/markdown-edit';
import { useColors } from '@/lib/tokens';
import { parseLinkHref, wikiToMarkdown, type LinkHref, type ResolveLink } from '@/lib/wikilinks';

const HEADING = 'note-heading-';

/**
 * Os links [[...]] (OB1) abrem por dentro do app: o endereço `questlist-link:` não vai para o
 * navegador. O link para o que ainda não existe fica apagado; o sem acesso, sem toque. Os títulos
 * levam um testID com a ordem, para a anotação rolar até a âncora.
 */
class NoteRenderer extends Renderer {
  constructor(
    private readonly onLink: ((href: LinkHref) => void) | undefined,
    private readonly muted: string,
  ) {
    super();
  }

  link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string) {
    const target = parseLinkHref(href);
    if (!target) return super.link(children, href, styles, title);
    const faded = target.kind === 'new' || target.kind === 'none';
    return (
      <Text
        key={this.getKey()}
        accessibilityRole={target.kind === 'none' ? undefined : 'link'}
        onPress={target.kind === 'none' ? undefined : () => this.onLink?.(target)}
        style={[
          styles,
          faded && { color: this.muted, textDecorationStyle: 'dashed' },
          target.kind === 'none' && { fontStyle: 'italic', textDecorationLine: 'none' },
        ]}
      >
        {children}
      </Text>
    );
  }

  heading(text: string | ReactNode[], styles?: TextStyle) {
    return (
      <View key={this.getKey()} testID={`${HEADING}${this.getKey()}`}>
        {super.heading(text, styles)}
      </View>
    );
  }
}

/**
 * Anotação formatada (D187): Markdown com as cores e as fontes do app. Com `resolve`, os [[...]]
 * viram links com o título de agora; `onHeadingLayout` dá a posição de cada título (na ordem).
 */
export function NoteMarkdown({
  value,
  onLink,
  resolve,
  onHeadingLayout,
}: {
  value: string;
  onLink?: (href: LinkHref) => void;
  resolve?: ResolveLink;
  onHeadingLayout?: (index: number, y: number) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const text = { color: colors.ink, fontFamily: FONT_FAMILY.sans, fontSize: 16, lineHeight: 24 };
  const heading = { color: colors.ink, fontFamily: FONT_FAMILY.serif, marginTop: 8 };
  const source = withTaskBoxes(
    resolve ? wikiToMarkdown(value, resolve, t('wikilinks.noAccess')) : value,
  );
  const muted = colors['ink-muted'];
  const renderer = useMemo(() => new NoteRenderer(onLink, muted), [onLink, muted]);
  const elements = useMarkdown(source, {
    colorScheme,
    renderer,
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
  let headingRank = 0;
  return (
    <View className="gap-1">
      {elements.map((element, i) => {
        const id = (element as { props?: { testID?: string } } | null)?.props?.testID;
        // A ordem entre os títulos (a contagem do renderizador não recomeça se ele reler o texto)
        const index = id?.startsWith(HEADING) ? headingRank++ : -1;
        return (
          <View
            key={i}
            onLayout={
              index >= 0 && onHeadingLayout
                ? (e) => onHeadingLayout(index, e.nativeEvent.layout.y)
                : undefined
            }
          >
            {element}
          </View>
        );
      })}
    </View>
  );
}
