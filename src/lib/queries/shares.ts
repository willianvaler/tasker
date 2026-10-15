import { useQuery } from '@tanstack/react-query';

import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId, toPage } from '../sync/local';

// Páginas enviadas (L, D133). Do lado de quem recebe: as páginas ao vivo que chegaram (com o
// envio) e os convites pendentes. A página recebida não está na árvore de pastas do usuário.

export type PageShare = Tables<'page_shares'>;
export type ReceivedPage = Tables<'pages'> & {
  share_id: string;
  owner_id: string;
  owner_name: string | null;
};

export const receivedKey = ['received'] as const;

export function useReceivedPages() {
  return useQuery({
    queryKey: receivedKey,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ReceivedPage[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal()) {
        const rows = await db.getAll<Record<string, unknown>>(
          `select p.*, s.id as share_id, s.owner_id as owner_id, pe.display_name as owner_name
           from page_shares s join pages p on p.id = s.page_id
           left join people pe on pe.id = s.owner_id
           where s.recipient_id = ? and s.status = 'active' and s.mode = 'live'
           order by p.name`,
          [userId],
        );
        return rows.map((row) => {
          const { share_id, owner_id, owner_name, ...page } = row;
          return {
            ...toPage(page),
            share_id: share_id as string,
            owner_id: owner_id as string,
            owner_name: (owner_name as string | null) ?? null,
          };
        });
      }
      const { data, error } = await supabase
        .from('page_shares')
        .select('id, owner_id, page:pages!page_shares_page_id_fkey(*)')
        .eq('recipient_id', userId)
        .eq('status', 'active')
        .eq('mode', 'live');
      if (error) throw error;
      return data
        .filter((s) => s.page)
        .map((s) => ({
          ...(s.page as Tables<'pages'>),
          share_id: s.id,
          owner_id: s.owner_id,
          owner_name: null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** A página (ou a pasta dela) chegou para mim por envio, e não é minha? */
export function useIsReceived(pageOrFolderId: string | null | undefined) {
  const received = useReceivedPages();
  return (
    !!pageOrFolderId &&
    !!received.data?.some((p) => p.id === pageOrFolderId || p.folder_id === pageOrFolderId)
  );
}
