// Amigos (D230): o que a pessoa digitou no "adicionar" vira nick ou e-mail. Função pura.

/** Nick, e-mail ou nada: o que a pessoa digitou no "adicionar". */
export function friendQuery(text: string): { username: string } | { email: string } | null {
  const value = text.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { email: value };
  const nick = value.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_.]{3,20}$/.test(nick) ? { username: nick } : null;
}
