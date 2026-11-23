# pdf.js 3.11.174 (Apache-2.0)

Cópia de `pdfjs-dist@3.11.174` (`build/pdf.min.js` e `build/pdf.worker.min.js`), com a extensão
`.txt` para o Metro tratar como arquivo (asset) e não como código do app. É o leitor de PDF dentro
do app no celular (ES7/CD44, D329): `src/lib/pdf-reader-html.ts` monta a página que carrega os dois
na WebView. A versão 3 é a última com o build UMD (sem módulo ES), que roda a partir de `file://`.
Atualizar: troque os dois arquivos pelos de outra versão 3.x e confira no Chromium (veja D329).
