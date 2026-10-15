import { createContext, useContext, type ReactNode } from 'react';

import { canApprove } from '@/lib/approval';
import { actorCan, can } from '@/lib/permissions';
import { assigneesOf, useAssignees, useFolderActor } from '@/lib/queries/projects';
import { useIsOnline } from './online';

const FolderScope = createContext<string | undefined>(undefined);
// Tela inteira só de leitura mesmo com cargo que escreve (tarefa de outra pessoa para o Colaborador)
const ReadOnlyScope = createContext(false);

/** Pasta da tela (página, detalhes da tarefa): os campos de dentro herdam a permissão dela. */
export function WriteScope({
  folderId,
  readOnly = false,
  children,
}: {
  folderId?: string;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <FolderScope.Provider value={folderId}>
      <ReadOnlyScope.Provider value={readOnly}>{children}</ReadOnlyScope.Provider>
    </FolderScope.Provider>
  );
}

/**
 * Pode escrever? Precisa de cargo que crie tarefas no projeto (leitor só vê e comenta) e de conexão, a não ser que a ação vá para a fila offline (`offline: true`). Sem pasta
 * conhecida, vale só a conexão (o servidor confere de novo).
 */
export function useCanWrite(folderId?: string | null, options?: { offline?: boolean }) {
  const scoped = useContext(FolderScope);
  const readOnly = useContext(ReadOnlyScope);
  const online = useIsOnline();
  const actor = useFolderActor(folderId ?? scoped);
  // Criar, marcar e reordenar tarefas entram na fila offline; o resto precisa de conexão
  if (readOnly) return false;
  if (!online && !options?.offline) return false;
  if (!(folderId ?? scoped)) return true;
  // Colaborador passa (cria e marca o que é dele); o que ele não pode, o servidor recusa
  return actor === undefined ? true : actorCan(actor, 'task.create');
}

/**
 * O que posso fazer nesta tarefa, espelho do guarda do servidor (zz_tasks_permission): concluir
 * pede task.complete (o Colaborador, só nas atribuídas a ele); editar, task.edit, ou ter criado a
 * tarefa, ou poder concluí-la; apagar, task.delete (o Colaborador, só o que criou). Sem conexão
 * (fora a fila offline), nada.
 */
export function useTaskCan(task: {
  id: string;
  folder_id: string;
  created_by: string | null;
  approver_id?: string | null;
  approver_role?: string | null;
}) {
  const writable = useCanWrite(task.folder_id, { offline: true });
  const actor = useFolderActor(task.folder_id);
  const assignees = useAssignees();
  // Página recebida (Executor): marca e registra, não muda a estrutura (D133). Também offline
  if (actor?.preset === 'executor')
    return { complete: can(actor, 'item.check'), edit: false, delete: false };
  if (!writable) return { complete: false, edit: false, delete: false };
  // Ainda carregando: deixa, e o servidor confere
  if (!actor) return { complete: true, edit: true, delete: true };
  const resource = {
    createdBy: task.created_by,
    assigneeIds: assigneesOf(assignees.data, task.id).flatMap((a) =>
      a.user_id ? [a.user_id] : [],
    ),
  };
  // Aprovação (M7): só quem aprova conclui (o servidor confere)
  const complete =
    can(actor, 'task.complete', resource) &&
    canApprove(
      { approver_id: task.approver_id ?? null, approver_role: task.approver_role ?? null },
      actor.userId,
      actor.preset,
    );
  const edit =
    can(actor, 'task.edit', resource) ||
    complete ||
    (!!actor.userId && task.created_by === actor.userId && can(actor, 'task.create'));
  return { complete, edit, delete: can(actor, 'task.delete', resource) };
}
