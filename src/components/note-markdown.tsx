import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Flame,
  Info,
  Lightbulb,
  Pencil,
  Quote,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type TextStyle } from 'react-native';
import { Renderer, useMarkdown } from 'react-native-marked';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FONT_FAMILY } from '@/lib/fonts';
import { withTaskBoxes } from '@/lib/markdown-edit';
import {
  FOOTNOTE_SCHEME,
  MARK_SCHEME,
  noteOutline,
  prepareMarkdown,
  splitCallouts,
  type CalloutType,
} from '@/lib/note-blocks';
import { useColors, type ColorToken, type Palette } from '@/lib/tokens';
import { parseLinkHref, wikiToMarkdown, type LinkHref, type ResolveLink } from '@/lib/wikilinks';

const HEADING = 'note-heading-';

/**
 * Os links [[...]] (OB1) abrem por dentro do app: o endereço `questlist-link:` não vai para o
 * navegador. O link para o que ainda não existe fica apagado; o sem acesso, sem toque. O destaque
 * (`==texto==`) e a chamada de nota de rodapé chegam como links com endereço próprio (OB3). Os
 * títulos levam um testID, para a anotação saber onde cada um ficou.
 */
class NoteRenderer extends Renderer {
  constructor(
    private readonly onLink: ((href: LinkHref) => void) | undefined,
    private readonly colors: Palette,
  ) {
    super();
  }

  link(children: string | ReactNode[], href: string, styles?: TextStyle, title?: string) {
    if (href === MARK_SCHEME)
      return (
        <Text
          key={this.getKey()}
          testID="note-highlight"
          style={[
            styles,
            {
              color: this.colors.ink,
              backgroundColor: this.colors['accent-soft'],
              textDecorationLine: 'none',
              fontStyle: 'normal',
            },
          ]}
        >
          {children}
        </Text>
      );
    if (href.startsWith(FOOTNOTE_SCHEME))
      return (
        <Text
          key={this.getKey()}
          style={[styles, { textDecorationLine: 'none', fontSize: 13, lineHeight: 16 }]}
        >
          {children}
        </Text>
      );
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
          faded && { color: this.colors['ink-muted'], textDecorationStyle: 'dashed' },
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

const CALLOUT: Record<CalloutType, { icon: LucideIcon; tone: ColorToken }> = {
  note: { icon: Pencil, tone: 'accent' },
  info: { icon: Info, tone: 'accent' },
  tip: { icon: Lightbulb, tone: 'ok' },
  success: { icon: CircleCheck, tone: 'ok' },
  question: { icon: CircleHelp, tone: 'warn' },
  warning: { icon: CircleAlert, tone: 'warn' },
  danger: { icon: Flame, tone: 'danger' },
  quote: { icon: Quote, tone: 'ink-muted' },
};

type ChunkProps = {
  source: string;
  renderer: NoteRenderer;
  small?: boolean;
  /** Posição de cada título deste trecho (na ordem dele) */
  onHeadingLayout?: (index: number, y: number) => void;
};

/** Um trecho de Markdown com as cores e as fontes do app */
function Chunk({ source, renderer, small, onHeadingLayout }: ChunkProps) {
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const size = small ? { fontSize: 14, lineHeight: 20 } : { fontSize: 16, lineHeight: 24 };
  const text = { color: colors.ink, fontFamily: FONT_FAMILY.sans, ...size };
  const heading = { color: colors.ink, fontFamily: FONT_FAMILY.serif, marginTop: 8 };
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
      table: { borderColor: colors.line, marginVertical: 4 },
      tableRow: { borderColor: colors.line },
      tableCell: { borderColor: colors.line, padding: 6 },
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

/** Callout (`> [!dica] Título`, OB3): faixa com a cor do tipo; com `+`/`-`, recolhe ao tocar */
function Callout({
  type,
  title,
  fold,
  body,
  renderer,
}: {
  type: CalloutType;
  title: string;
  fold: 'open' | 'closed' | null;
  body: string;
  renderer: NoteRenderer;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(fold !== 'closed');
  const { icon, tone } = CALLOUT[type];
  const label = title || t(`callouts.${type}`);
  const head = (
    <View className="flex-row items-center gap-2">
      <Icon icon={icon} size={16} tone={tone} />
      <Text className="flex-1 font-semibold text-ink">{label}</Text>
      {fold && <Icon icon={open ? ChevronDown : ChevronRight} size={16} tone="ink-muted" />}
    </View>
  );
  return (
    <View
      testID={`callout-${type}`}
      className="my-1 gap-1 rounded-lg bg-wash px-3 py-2"
      style={{ borderLeftWidth: 4, borderLeftColor: colors[tone] }}
    >
      {fold ? (
        <Pressable
          accessibilityRole="button"
          aria-expanded={open}
          accessibilityLabel={label}
          onPress={() => setOpen(!open)}
        >
          {head}
        </Pressable>
      ) : (
        head
      )}
      {open && body.trim() !== '' && <Chunk source={body} renderer={renderer} />}
    </View>
  );
}

/**
 * Anotação formatada (D187): Markdown com as cores e as fontes do app, mais callouts, destaque,
 * notas de rodapé e tabelas (OB3). Com `resolve`, os [[...]] viram links com o título de agora;
 * `onHeadingLayout` dá a posição de cada título (na ordem do `noteOutline`, fora dos callouts).
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
  const prepared = prepareMarkdown(
    resolve ? wikiToMarkdown(value, resolve, t('wikilinks.noAccess')) : value,
  );
  const segments = splitCallouts(withTaskBoxes(prepared.text));
  const renderer = useMemo(() => new NoteRenderer(onLink, colors), [onLink, colors]);

  // A posição de um título é a do trecho dentro da anotação mais a dele dentro do trecho
  const segmentY = useRef<Record<number, number>>({});
  const headingY = useRef<Record<number, { segment: number; y: number }>>({});
  function report(index: number) {
    const h = headingY.current[index];
    const top = h ? segmentY.current[h.segment] : undefined;
    if (h && top !== undefined) onHeadingLayout?.(index, top + h.y);
  }
  // Onde começa a contagem de títulos de cada trecho
  const counts = segments.map((s) => (s.kind === 'markdown' ? noteOutline(s.text).length : 0));
  const firsts = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <View className="gap-1">
      {segments.map((segment, i) => {
        if (segment.kind === 'callout')
          return (
            <Callout
              key={i}
              type={segment.type}
              title={segment.title}
              fold={segment.fold}
              body={segment.body}
              renderer={renderer}
            />
          );
        const first = firsts[i];
        const count = counts[i];
        return (
          <View
            key={i}
            onLayout={
              onHeadingLayout && count
                ? (e) => {
                    segmentY.current[i] = e.nativeEvent.layout.y;
                    for (let k = first; k < first + count; k++) report(k);
                  }
                : undefined
            }
          >
            <Chunk
              source={segment.text}
              renderer={renderer}
              onHeadingLayout={
                onHeadingLayout
                  ? (index, y) => {
                      headingY.current[first + index] = { segment: i, y };
                      report(first + index);
                    }
                  : undefined
              }
            />
          </View>
        );
      })}
      {prepared.footnotes.length > 0 && (
        <View
          testID="note-footnotes"
          accessibilityLabel={t('notes.footnotes')}
          className="mt-3 border-t border-line pt-2"
        >
          <Chunk
            small
            renderer={renderer}
            source={prepared.footnotes.map((f) => `${f.number}. ${f.text || ' '}`).join('\n')}
          />
        </View>
      )}
    </View>
  );
}
