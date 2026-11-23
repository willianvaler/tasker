// Leitor de PDF dentro do app no celular (ES7/CD44, D329): a página que a WebView abre a partir de
// `file://`, com o pdf.js 3 (assets/pdfjs) ao lado. Desenha as páginas conforme aparecem, abre na
// página guardada e avisa o app em que página a pessoa está (onde parei, sem anotar à mão). O PDF
// é só desenhado (sem eval, sem scripts do documento). Puro: o teste confere no Chromium.

export type PdfReaderOptions = {
  /** Endereço do PDF (file://) */
  pdf: string;
  /** Página onde abrir (1 = começo) */
  page: number;
  /** Cores do tema (lib/tokens) */
  background: string;
  ink: string;
};

const quote = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');

export function pdfReaderHtml({ pdf, page, background, ink }: PdfReaderOptions): string {
  const bg = background.replace(/[^#\w(),. %]/g, '');
  const fg = ink.replace(/[^#\w(),. %]/g, '');
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<style>
  html, body { margin: 0; background: ${bg}; color: ${fg}; font-family: sans-serif; }
  #pages { padding: 8px 0 48px; }
  .page { margin: 0 auto 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); position: relative; }
  .page canvas { width: 100%; height: 100%; display: block; }
  #status { padding: 24px; text-align: center; }
</style>
<script src="pdf.worker.min.js"></script>
<script src="pdf.min.js"></script>
</head><body>
<div id="status">…</div>
<div id="pages"></div>
<script>
(function () {
  var send = function (msg) {
    var text = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.__messages = (window.__messages || []).concat([msg]);
  };
  var lib = window.pdfjsLib;
  if (!lib) { send({ type: 'error', message: 'pdf.js' }); return; }
  var start = ${Math.max(1, Math.floor(page))};
  var holder = document.getElementById('pages');
  var status = document.getElementById('status');
  lib.getDocument({ url: ${quote(pdf)}, isEvalSupported: false, disableFontFace: false }).promise.then(function (doc) {
    return doc.getPage(1).then(function (first) {
      var base = first.getViewport({ scale: 1 });
      var width = Math.min(window.innerWidth - 16, 1000);
      var ratio = base.height / base.width;
      var boxes = [];
      for (var i = 1; i <= doc.numPages; i++) {
        var box = document.createElement('div');
        box.className = 'page';
        box.dataset.page = String(i);
        box.style.width = width + 'px';
        box.style.height = Math.round(width * ratio) + 'px';
        holder.appendChild(box);
        boxes.push(box);
      }
      status.remove();
      send({ type: 'ready', pages: doc.numPages });
      var drawn = {};
      var draw = function (box) {
        var n = Number(box.dataset.page);
        if (drawn[n]) return;
        drawn[n] = true;
        doc.getPage(n).then(function (p) {
          var view = p.getViewport({ scale: 1 });
          var scale = (width / view.width) * (window.devicePixelRatio || 1);
          var vp = p.getViewport({ scale: scale });
          var canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          box.style.height = Math.round(width * (view.height / view.width)) + 'px';
          box.appendChild(canvas);
          return p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        }).then(function () {
          send({ type: 'drawn', page: n });
          // As alturas mudam ao desenhar: volta para a página guardada até a pessoa rolar
          if (!moved && start > 1 && target) window.scrollTo(0, target.offsetTop - 8);
        })
          .catch(function (e) { send({ type: 'error', message: String(e && e.message || e) }); });
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) draw(e.target); });
      }, { rootMargin: '800px 0px' });
      boxes.forEach(function (b) { io.observe(b); });
      var target = boxes[Math.min(start, boxes.length) - 1];
      var moved = false;
      window.addEventListener('touchstart', function () { moved = true; }, { passive: true });
      window.addEventListener('wheel', function () { moved = true; }, { passive: true });
      if (target && start > 1) window.scrollTo(0, target.offsetTop - 8);
      var current = start;
      var timer;
      window.addEventListener('scroll', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var mid = window.scrollY + window.innerHeight / 3;
          var n = 1;
          for (var i = 0; i < boxes.length; i++) { if (boxes[i].offsetTop <= mid) n = i + 1; else break; }
          if (n !== current) { current = n; send({ type: 'page', page: n }); }
        }, 400);
      }, { passive: true });
    });
  }).catch(function (e) {
    status.textContent = '⚠';
    send({ type: 'error', message: String(e && e.message || e) });
  });
})();
</script>
</body></html>`;
}

export type PdfReaderMessage =
  | { type: 'ready'; pages: number }
  | { type: 'page'; page: number }
  | { type: 'drawn'; page: number }
  | { type: 'error'; message: string };

export function parseReaderMessage(data: string): PdfReaderMessage | null {
  try {
    const msg = JSON.parse(data) as PdfReaderMessage;
    return msg && typeof msg === 'object' && 'type' in msg ? msg : null;
  } catch {
    return null;
  }
}
