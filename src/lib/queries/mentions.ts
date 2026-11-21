import { nameKey, resolveMention, toAssignees, type MentionResolution } from '../members';
import { useMilestones } from './milestones';
import { isProjectPage, memberNames, rootFolder, useMembers } from './projects';
import { useTree } from './tree';

/**
 * @nome da página: só em página de projeto. Resolve contra os membros do projeto;
 * quem não é membro vira responsável pendente.
 */
export function useMentions(pageId: string | undefined) {
  const tree = useTree();
  const enabled = isProjectPage(tree.data, pageId);
  const page = tree.data?.pages.find((p) => p.id === pageId);
  const root = rootFolder(tree.data, page?.folder_id);
  const members = useMembers(enabled ? root?.id : undefined);
  const names = memberNames(members.data);
  // Marcos do projeto (GP3): "~v1.0" na escrita rápida
  const milestones = useMilestones(enabled ? root?.id : undefined);

  return {
    enabled,
    /** Membros do projeto, para o autocomplete */
    members: names,
    resolve: (mentions: string[]): MentionResolution[] =>
      enabled ? mentions.map((m) => resolveMention(m, names)) : [],
    toAssignees,
    /** Há marcos no projeto: a escrita rápida entende "~marco" */
    milestones: (milestones.data?.length ?? 0) > 0,
    /** Id do marco pelo nome (sem acento, espaço nem pontuação); ambíguo ou desconhecido: null */
    milestoneId: (name: string | undefined) => {
      if (!name) return null;
      const found = (milestones.data ?? []).filter((m) => nameKey(m.name) === nameKey(name));
      return found.length === 1 ? found[0].id : null;
    },
  };
}
