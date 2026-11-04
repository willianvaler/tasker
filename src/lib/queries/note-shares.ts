import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';
import { webUrl } from './projects';

// Compartilhar e publicar anotações (OB14, D300). O compartilhamento é só das anotações pessoais e
// só com amigos; lê do banco do aparelho com o sync (funciona sem internet), mas compartilhar,
// tirar, publicar e despublicar são do servidor (RPCs, com internet). A publicação (/p/<token>)
// não entra no sync: é coisa de quem está online.

export type NoteShare = {
  note_id: string;
  /** Quem recebe */
  user_id: string;
  owner_id: string;
  role: 'read' | 'edit';
  /** Nome de quem recebe (para a dona) ou da dona (para quem recebe) */
  name: string;
};

export const noteSharesKey = ['note-shares'] as const;

/** Todos os compartilhamentos que vejo: os das minhas anotações e os que recebi */
export function useNoteShares() {
  return useQuery({
    queryKey: noteSharesKey,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<NoteShare[]> => {
      if (isLocal()) {
        const me = await sessionUserId();
        const rows = await db.getAll<NoteShare>(
          `select s.note_id, s.user_id, s.owner_id, s.role, coalesce(p.display_name, '') as name
           from note_shares s
           left join people p on p.id = case when s.owner_id = ? then s.user_id else s.owner_id end`,
          [me],
        );
        return rows.map((r) => ({ ...r, role: r.role === 'edit' ? 'edit' : 'read' }));
      }
      const [{ data, error }, friends] = await Promise.all([
        supabase.from('note_shares').select('note_id, user_id, owner_id, role'),
        supabase.rpc('my_friends'),
      ]);
      if (error) throw error;
      const { data: auth } = await supabase.auth.getSession();
      const me = auth.session?.user.id;
      const names = new Map(
        ((friends.data ?? []) as { user_id: string; display_name: string }[]).map((f) => [
          f.user_id,
          f.display_name,
        ]),
      );
      return data.map((s) => ({
        ...s,
        role: s.role === 'edit' ? 'edit' : 'read',
        name: names.get(s.owner_id === me ? s.user_id : s.owner_id) ?? '',
      }));
    },
  });
}

export function useNoteShareActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: noteSharesKey });
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const share = useMutation({
    mutationFn: async (input: { noteId: string; userId: string; role: 'read' | 'edit' }) => {
      const { error } = await supabase.rpc('share_note', {
        p_note: input.noteId,
        p_user: input.userId,
        p_role: input.role,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  /** A dona tira alguém, ou quem recebeu sai (userId = a própria pessoa) */
  const unshare = useMutation({
    mutationFn: async (input: { noteId: string; userId: string }) => {
      const { error } = await supabase.rpc('unshare_note', {
        p_note: input.noteId,
        p_user: input.userId,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { share, unshare };
}

export type NotePublication = {
  token: string;
  has_password: boolean;
  include_linked: boolean;
};

const publicationKey = (noteId: string) => ['note-publication', noteId] as const;

/** O endereço público da anotação (só a dona lê) */
export function useNotePublication(noteId: string, enabled = true) {
  return useQuery({
    queryKey: publicationKey(noteId),
    enabled,
    queryFn: async (): Promise<NotePublication | null> => {
      const { data, error } = await supabase
        .from('note_publications')
        .select('token, has_password, include_linked')
        .eq('note_id', noteId)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, has_password: !!data.has_password } : null;
    },
  });
}

export function useNotePublicationActions(noteId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: publicationKey(noteId) });

  /** `password`: undefined mantém, '' tira, o resto troca */
  const publish = useMutation({
    mutationFn: async (input: { includeLinked: boolean; password?: string }) => {
      const { data, error } = await supabase.rpc('publish_note', {
        p_note: noteId,
        p_include_linked: input.includeLinked,
        ...(input.password === undefined ? {} : { p_password: input.password }),
      });
      if (error) throw error;
      return data as string;
    },
    onSettled: refresh,
  });

  const unpublish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('unpublish_note', { p_note: noteId });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { publish, unpublish };
}

export function publishedUrl(token: string) {
  return webUrl(`/p/${token}`);
}

export type PublishedNote =
  | { status: 'missing' | 'password' | 'wrong' | 'locked' }
  | {
      status: 'ok';
      root: string;
      author: string | null;
      note: { id: string; title: string; body: string; updated_at: string };
      notes: { id: string; title: string; body: string }[];
    };

/** A página pública (fora do login): anotação do conjunto, com a senha se houver */
export async function fetchPublishedNote(
  token: string,
  password: string | null,
  noteId: string | null,
): Promise<PublishedNote> {
  const { data, error } = await supabase.rpc('published_note', {
    p_token: token,
    ...(password ? { p_password: password } : {}),
    ...(noteId ? { p_note: noteId } : {}),
  });
  if (error) throw error;
  return data as unknown as PublishedNote;
}
