/** Junta classes do Tailwind ignorando valores vazios. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
