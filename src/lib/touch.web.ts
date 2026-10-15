/** Na web, toque é o ponteiro "grosso" (celular e tablet); com mouse, o foco automático ajuda. */
export const isTouchScreen = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
