/// <reference types="nativewind/types" />

// Import de CSS só pelo efeito (src/global.css, processado pelo NativeWind)
declare module '*.css';
// Arquivos do pdf.js levados como asset (assets/pdfjs, D329): o Metro devolve o id do asset
declare module '*.txt' {
  const asset: number;
  export default asset;
}
