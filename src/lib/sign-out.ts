import { clearPrefs } from '@/lib/prefs';
import { disablePush } from '@/lib/push';
import { signOut as endSession } from '@/lib/session';
import { clearQueryCache } from '@/providers/query';

/** Sair da conta (Configurações e Mais): avisos, sessão, cache e preferências deste aparelho. */
export async function signOutHere() {
  // O próximo a usar este aparelho não recebe os avisos de quem saiu
  await disablePush().catch(() => {});
  await endSession();
  // O próximo usuário deste aparelho não pode ver o cache do anterior
  clearQueryCache();
  clearPrefs();
}
