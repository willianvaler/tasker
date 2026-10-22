import { useIsFocused, useRootNavigationState } from 'expo-router';

import { tabUnderOverlay, type NavState } from '@/lib/tab-slots';

/**
 * Se a aba deve desenhar o conteúdo: quando está em foco ou quando só um painel transparente está
 * por cima dela. As abas ficam montadas atrás da ativa, e as de lista não desenham fora de foco
 * (repetiriam as tarefas na árvore de acessibilidade da página aberta por cima); mas atrás do painel
 * da tarefa a tela continua à vista, e sumir com ela deixava o fundo vazio.
 */
export function useShownTab(tab: string): boolean {
  const focused = useIsFocused();
  const root = useRootNavigationState() as unknown as NavState | undefined;
  return focused || tabUnderOverlay(root) === tab;
}
