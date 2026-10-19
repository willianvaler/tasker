import { useColorScheme } from 'nativewind';
import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Mask, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { BRAND } from '@/lib/tokens';

// Mesma geometria de assets/brand/gerar.py (fonte dos ícones e das peças das lojas).
const TAIL = 'rotate(-43.5 789 761)';

/** Símbolo do Questlist: verde no tema claro, creme no escuro; bandeira e cauda laranja. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const { colorScheme } = useColorScheme();
  const color = colorScheme === 'dark' ? BRAND.cream : BRAND.green;
  // ids únicos: o símbolo aparece mais de uma vez na mesma página da web
  const id = useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="88 60 874 874" aria-hidden>
      <Defs>
        <ClipPath id={`d${id}`}>
          <Circle cx={520} cy={480} r={410} />
        </ClipPath>
        <Mask id={`m${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1024} height={1024}>
          <Rect width={1024} height={1024} fill="white" />
          <Polyline
            points="232,858 468,612 526,668 640,552 760,676"
            fill="none"
            stroke="black"
            strokeWidth={44}
            strokeLinejoin="miter"
          />
          <Rect transform={TAIL} x={723.5} y={600.5} width={131} height={321} rx={22} fill="black" />
        </Mask>
      </Defs>
      <G mask={`url(#m${id})`}>
        <Circle cx={520} cy={480} r={344} fill="none" stroke={color} strokeWidth={132} />
        <Polygon
          clipPath={`url(#d${id})`}
          points="485,398 612,530 660,486 960,800 960,960 80,960 80,840"
          fill={color}
        />
      </G>
      <Rect transform={TAIL} x={736.5} y={613.5} width={105} height={295} rx={12} fill={BRAND.orange} />
      <Rect x={519} y={250} width={16} height={200} rx={4} fill={BRAND.orange} />
      <Path
        d="M527 250 L676 312 Q690 318 676 325 L527 392 Z"
        fill={BRAND.orange}
        stroke={BRAND.orange}
        strokeWidth={10}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
