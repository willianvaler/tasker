// OCR da foto da nota pelo Tesseract (D254), dentro da própria Edge Function: a foto não sai do
// servidor. tesseract-wasm roda na mesma thread (a Edge Function não tem worker_threads, que o
// tesseract.js exige). O motor e o modelo (português, tessdata_fast) são baixados uma vez por
// worker, de versões fixas, e reaproveitados nas leituras seguintes.
import { createOCREngine } from 'npm:tesseract-wasm@0.11.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import { decode as decodePng } from 'npm:fast-png@6.2.0';
import decodeWebp, { init as initWebp } from 'npm:@jsquash/webp@1.5.0/decode.js';

const ENGINE_WASM = 'https://cdn.jsdelivr.net/npm/tesseract-wasm@0.11.0/dist/tesseract-core.wasm';
const WEBP_WASM = 'https://cdn.jsdelivr.net/npm/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm';
const MODEL = 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@4.1.0/por.traineddata';

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OCR download ${res.status}: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Uma vez por worker; se falhar, a próxima leitura tenta de novo
let engine: ReturnType<typeof loadEngine> | null = null;
let webpReady: Promise<unknown> | null = null;

async function loadEngine() {
  const [wasmBinary, model] = await Promise.all([download(ENGINE_WASM), download(MODEL)]);
  const ocr = await createOCREngine({ wasmBinary });
  ocr.loadModel(model);
  return ocr;
}

async function decode(bytes: Uint8Array, mime: string): Promise<Pixels> {
  if (mime === 'image/webp') {
    webpReady ??= download(WEBP_WASM).then((wasm) =>
      WebAssembly.compile(wasm).then((module) => initWebp(module)),
    );
    await webpReady.catch((err) => {
      webpReady = null;
      throw err;
    });
    return decodeWebp(bytes.buffer as ArrayBuffer);
  }
  if (mime === 'image/png') {
    const png = decodePng(bytes);
    if (png.depth !== 8) throw new Error(`OCR png de ${png.depth} bits`);
    // Cinza, cinza+alfa, RGB ou RGBA → RGBA
    const n = png.width * png.height;
    const data = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const at = i * png.channels;
      const gray = png.channels < 3;
      data[i * 4] = png.data[at];
      data[i * 4 + 1] = png.data[gray ? at : at + 1];
      data[i * 4 + 2] = png.data[gray ? at : at + 2];
      data[i * 4 + 3] = png.channels % 2 === 0 ? png.data[at + png.channels - 1] : 255;
    }
    return { data, width: png.width, height: png.height };
  }
  const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  return { data: new Uint8ClampedArray(img.data.buffer), width: img.width, height: img.height };
}

/** Texto da foto (base64), linha a linha como o Tesseract leu. */
export async function readText(image: string, mime: string): Promise<string> {
  const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
  const pixels = await decode(bytes, mime);
  engine ??= loadEngine();
  const ocr = await engine.catch((err) => {
    engine = null;
    throw err;
  });
  // Sem await entre carregar a imagem e ler: duas leituras no mesmo worker não se misturam
  ocr.loadImage(pixels);
  return ocr.getText();
}
