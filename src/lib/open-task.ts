import { router } from 'expo-router';

import { getReadFirst } from './prefs';

// Abrir uma tarefa (ES1, ESCOPO_V13 §1, D322): a ficha de leitura (`/ler/<id>`) ou o painel de
// edição (`/task/<id>`). Quem só quer ler (grafo, links, Citado em, Bases, Calendário, busca) chama
// `readTask`; a lista e o quadro chamam `openTask`, que respeita a preferência "ficha em todo lugar".

export function readTask(id: string) {
  router.push({ pathname: '/ler/[id]', params: { id } });
}

export function editTask(id: string) {
  router.push({ pathname: '/task/[id]', params: { id } });
}

/** Da lista e do quadro: o painel, ou a ficha se a pessoa pediu ficha em todo lugar */
export function openTask(id: string) {
  if (getReadFirst()) readTask(id);
  else editTask(id);
}
