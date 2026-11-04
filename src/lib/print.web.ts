// Imprimir e salvar em PDF (PB9, D304) na web: a página da lista vai para um quadro escondido e o
// navegador abre a impressão dele (que tem "Salvar como PDF" no destino). Nada sai do aparelho.

export const canPrint = () => typeof window !== 'undefined' && typeof window.print === 'function';

export function printHtml(html: string) {
  return new Promise<void>((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.srcdoc = html;
    frame.onload = () => {
      const win = frame.contentWindow;
      // Sai quando a impressão fecha (ou depois de um tempo, se o navegador não avisar)
      const done = () => {
        frame.remove();
        resolve();
      };
      win?.addEventListener('afterprint', done, { once: true });
      setTimeout(done, 60_000);
      win?.focus();
      win?.print();
    };
    document.body.appendChild(frame);
  });
}

/** Na web, o PDF sai pela mesma impressão do navegador */
export const saveHtmlAsPdf = (html: string) => printHtml(html);
