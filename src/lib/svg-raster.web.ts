// SVG → PNG no navegador (D324, revisto no CD44): a anotação guarda a imagem desenhada, nunca o SVG
// (que, aberto direto pelo endereço do Storage, rodaria script na origem do app).

const MAX_SIDE = 2048;
/** SVG sem tamanho próprio (só viewBox): desenha com este lado maior */
const DEFAULT_SIDE = 1200;

function viewBoxSize(svg: string) {
  const m = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

export async function rasterizeSvg(body: ArrayBuffer | Blob | Uint8Array): Promise<Blob> {
  const blob =
    body instanceof Blob ? body : new Blob([body as BlobPart], { type: 'image/svg+xml' });
  const text = await blob.text();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const box = viewBoxSize(text);
    let width = img.naturalWidth || box?.width || DEFAULT_SIDE;
    let height = img.naturalHeight || box?.height || DEFAULT_SIDE * 0.75;
    // Vetor: amplia o pequeno e reduz o enorme, até o lado maior caber em 2048
    const scale =
      Math.min(MAX_SIDE, Math.max(DEFAULT_SIDE, Math.max(width, height))) / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('svg'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
