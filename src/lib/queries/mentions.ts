import { resolveMention, toAssignees, type MentionResolution } from '../members';
import { isProjectPage, memberNames, rootFolder, useMembers } from './projects';
import { useTree } from './tree';

/**
 * @nome da página: só em página de projeto (ESCOPO 4.1). Resolve contra os membros do projeto;
 * quem não é membro vira responsável pendente.
 */
export function useMentions(pageId: string | undefined) {
  const tree = useTree();
  const enabled = isProjectPage(tree.data, pageId);
  const page = tree.data?.pages.find((p) => p.id === pageId);
  const root = rootFolder(tree.data, page?.folder_id);
  const members = useMembers(enabled ? root?.id : undefined);
  const names = memberNames(members.data);

  return {
    enabled,
    resolve: (mentions: string[]): MentionResolution[] =>
      enabled ? mentions.map((m) => resolveMention(m, names)) : [],
    toAssignees,
  };
}
