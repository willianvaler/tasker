import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { cachedSvg, texToSvg, type MathSvg } from '@/lib/mathjax';
import { useColors } from '@/lib/tokens';

/** Quantos pixels tem 1 ex do MathJax no texto de 16 px da anotação */
const EX = 8;

/**
 * Uma fórmula LaTeX desenhada (ES2, D323): em bloco (centrada, rola de lado se não couber) ou na
 * linha do texto. Enquanto o MathJax carrega, e se o LaTeX tiver erro, aparece o próprio LaTeX.
 */
export function MathView({ tex, display }: { tex: string; display: boolean }) {
  const colors = useColors();
  const [svg, setSvg] = useState<MathSvg | null | undefined>(() => cachedSvg(tex, display));
  useEffect(() => {
    let alive = true;
    if (svg === undefined)
      texToSvg(tex, display).then((result) => {
        if (alive) setSvg(result);
      });
    return () => {
      alive = false;
    };
  }, [tex, display, svg]);

  if (!svg) {
    const source = display ? `$$${tex}$$` : `$${tex}$`;
    return display ? (
      <Text
        selectable
        className="my-2 font-mono text-sm text-ink-muted"
        accessibilityLabel={tex}
        testID={svg === null ? 'math-error' : 'math-loading'}
      >
        {source}
      </Text>
    ) : (
      <Text className="font-mono text-sm text-ink-muted">{source}</Text>
    );
  }

  const xml = svg.svg.replace(/currentColor/g, colors.ink);
  const width = svg.widthEx * EX;
  const height = svg.heightEx * EX;
  if (display)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 8 }}
      >
        <View accessibilityRole="image" accessibilityLabel={tex} testID="math-block">
          <SvgXml xml={xml} width={width} height={height} />
        </View>
      </ScrollView>
    );
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={tex}
      testID="math-inline"
      // A linha da fórmula desce abaixo da linha do texto o quanto o MathJax manda
      style={{ width, height, transform: [{ translateY: -svg.valignEx * EX }] }}
    >
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}
