import { router } from 'expo-router';

import { getReadFirst } from './prefs';

// Abrir uma tarefa (ES1, ESCOPO_V13 §1, D322): a ficha de leitura (`/ler/<id>`) ou o painel de
// edição (`/task/<id>`). Quem só quer ler (grafo, links, Citado em, Bases, Calendário, busca) chama
// `readTask`; a lista e o quadro chamam `openTask`, que respeita a preferência "ficha em todo lugar".

export function readTask(id: string) {
  router.push({ pathname: '/ler/[id]', params: { id } });
}

/** A tarefa do projeto de estudo na tela de leitura, com anterior e próximo (CD46) */
export function studyTask(id: string) {
  router.push({ pathname: '/estudo/[id]', params: { id } });
}

export function editTask(id: string) {
  router.push({ pathname: '/task/[id]', params: { id } });
}

/** Pastas de projeto de estudo (ES7, D328): lá as tarefas abrem a ficha. Quem preenche é o app */
let studyFolders: ReadonlySet<string> = new Set();
export function setStudyFolders(ids: ReadonlySet<string>) {
  studyFolders = ids;
}
export const isStudyFolder = (folderId: string | null | undefined) =>
  !!folderId && studyFolders.has(folderId);

/**
 * Da lista e do quadro: o painel, ou a ficha se a pessoa pediu ficha em todo lugar; a tarefa de
 * projeto de estudo abre na tela de leitura (`/estudo/<id>`, CD46)
 */
export function openTask(id: string, folderId?: string | null) {
  if (isStudyFolder(folderId)) studyTask(id);
  else if (getReadFirst()) readTask(id);
  else editTask(id);
}
