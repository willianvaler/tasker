import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { qrMatrix, qrPath } from '@/lib/qr';
import { QR_COLORS } from '@/lib/tokens';

// QR do link de automação (CT4, D362). Preto no branco mesmo no modo escuro: a câmera do celular
// lê mal o código invertido, por isso as cores são fixas (QR_COLORS, em lib/tokens).
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const { d, units } = useMemo(() => {
    const m = qrMatrix(value);
    return { d: qrPath(m, 2), units: m.length + 4 };
  }, [value]);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Rect width={units} height={units} fill={QR_COLORS.light} />
      <Path d={d} fill={QR_COLORS.dark} />
    </Svg>
  );
}
