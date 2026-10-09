import { createContext, useContext, type ReactNode } from 'react';

import { canEdit, useFolderRole } from '@/lib/queries/projects';
import { useIsOnline } from './online';

const FolderScope = createContext<string | undefined>(undefined);

/** Pasta da tela (página, detalhes da tarefa): os campos de dentro herdam a permissão dela. */
export function WriteScope({ folderId, children }: { folderId?: string; children: ReactNode }) {
  return <FolderScope.Provider value={folderId}>{children}</FolderScope.Provider>;
}

/**
 * Pode escrever? Precisa de papel de dono ou editor no projeto (leitor só vê e comenta, ESCOPO
 * 4.5) e de conexão, a não ser que a ação vá para a fila offline (`offline: true`). Sem pasta
 * conhecida, vale só a conexão (o servidor confere de novo).
 */
export function useCanWrite(folderId?: string | null, options?: { offline?: boolean }) {
  const scoped = useContext(FolderScope);
  const online = useIsOnline();
  const role = useFolderRole(folderId ?? scoped);
  // Criar, marcar e reordenar tarefas entram na fila offline (D52); o resto precisa de conexão
  if (!online && !options?.offline) return false;
  if (!(folderId ?? scoped)) return true;
  return role === undefined ? true : canEdit(role);
}
