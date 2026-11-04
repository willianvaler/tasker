// A extensão do navegador só existe na web (OB15, D305); no celular, nada a guardar.
export function stashClipFromUrl() {}
export const hasStashedClip = () => false;
export const takeStashedClip = (): string | null => null;
