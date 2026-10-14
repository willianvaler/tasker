import { router, usePathname } from 'expo-router';

import { selection } from '@/lib/selection';
import { useShortcut } from '@/lib/use-shortcut';

/**
 * Atalhos da lista na tela em foco (V2 §8, §9): J/K e setas andam pela lista; F2 edita o título da tarefa selecionada, ou o
 * nome da página/pasta aberta quando nada está selecionado; Shift+F2 ou Enter abre os detalhes;
 * Esc tira a seleção. Montado uma vez, no layout logado.
 */
export function ListKeys() {
  const pathname = usePathname();

  useShortcut('list.next', () => selection.move(1));
  useShortcut('list.prev', () => selection.move(-1));

  useShortcut('item.rename', () => {
    const task = selection.selectedTask();
    if (task) return selection.edit(task.id);
    const match = /^\/(page|folder)\/([^/]+)/.exec(pathname);
    if (!match) return false;
    selection.rename({ kind: match[1] as 'page' | 'folder', id: match[2] });
  });

  useShortcut('item.open', () => {
    const task = selection.selectedTask();
    if (!task) return false;
    router.push({ pathname: '/task/[id]', params: { id: task.id } });
  });

  useShortcut('list.deselect', () => {
    if (!selection.get().selectedId) return false;
    selection.select(null);
  });

  return null;
}
