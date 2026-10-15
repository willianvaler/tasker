/**
 * Tela de toque? No app, sempre. Abrir uma tela não deve focar campo sozinho no toque: o teclado
 * sobe e cobre metade da tela sem a pessoa pedir (U3, D154).
 */
export const isTouchScreen = () => true;
