// Na web o app é uma SPA (web.output = "single"), então o localStorage do navegador sempre existe.
export const authStorage = globalThis.localStorage;
/** Mesmo armazenamento, usado também para o cache offline e preferências de UI. */
export const localStore = globalThis.localStorage;
