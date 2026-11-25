import makeQr from 'qrcode-generator';

// QR do link de automação (CT4, D362): o código é gerado no aparelho pelo qrcode-generator (MIT,
// NOTICE.md), sem ida a serviço de fora. Função pura: o caminho SVG serve à tela (react-native-svg)
// e à impressão (HTML).

/** Os módulos do código (true = escuro), com correção de erro M. */
export function qrMatrix(text: string): boolean[][] {
  const qr = makeQr(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Um único caminho SVG (em unidades de módulo, com `margin` módulos de borda). */
export function qrPath(matrix: boolean[][], margin = 2): string {
  const parts: string[] = [];
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      parts.push(`M${start + margin} ${r + margin}h${c - start}v1h${start - c}z`);
    }
  });
  return parts.join('');
}

/** O SVG inteiro (para imprimir); as cores vêm de QR_COLORS, em lib/tokens. */
export function qrSvg(
  text: string,
  colors: { light: string; dark: string },
  size = 256,
  margin = 2,
): string {
  const m = qrMatrix(text);
  const units = m.length + margin * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${units} ${units}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="${units}" height="${units}" fill="${colors.light}"/><path d="${qrPath(m, margin)}" fill="${colors.dark}"/></svg>`
  );
}
