import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uuidv7 } from '@/lib/uuid';
import type { NoteProps } from '../note-props';
import { supabase } from '../supabase';
import { commandResult } from '../sync/connector';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';

// Histórico de versões da anotação (OB11, D296). As versões nascem no servidor (uma por sessão de
// edição) e não vão para o aparelho: ver e restaurar precisam de internet. Restaurar, com o sync,
// vai pela fila de comandos, na ordem do que já foi digitado (senão uma gravação antiga que ainda
// não subiu passaria por cima da restauração).

export type NoteVersion = {
  id: string;
  title: string;
  body: string;
  props: NoteProps;
  size: number;
  created_at: string;
};
export type RestoredNote = { title: string; body: string; props: NoteProps };

const key = (noteId: string) => ['note-versions', noteId] as const;
/** As mais novas primeiro; um ano de versões de uma anotação cabe com folga */
const LIMIT = 300;

export function useNoteVersions(noteId: string) {
  return useQuery({
    queryKey: key(noteId),
    // Sempre do servidor: o histórico que outro aparelho gerou também conta
    staleTime: 0,
    queryFn: async (): Promise<NoteVersion[]> => {
      const { data, error } = await supabase
        .from('note_versions')
        .select('id, title, body, props, size, created_at')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return data.map((v) => ({ ...v, props: (v.props ?? {}) as NoteProps }));
    },
  });
}

export function useNoteVersionMutations(noteId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: key(noteId) });
    void queryClient.invalidateQueries({ queryKey: ['attachment-usage'] });
    void queryClient.invalidateQueries({ queryKey: ['note-versions-usage'] });
  };

  const restore = useMutation({
    mutationFn: async (version: NoteVersion): Promise<RestoredNote> => {
      const restored = { title: version.title, body: version.body, props: version.props ?? {} };
      if (isLocal()) {
        const id = uuidv7();
        // O comando primeiro, depois a linha do aparelho já com o texto restaurado: no servidor a
        // RPC guarda a versão de agora e restaura; a linha chega igual e não vira outra versão
        await db.writeTransaction(async (tx) => {
          await tx.execute('insert into commands (id, name, args) values (?, ?, ?)', [
            id,
            'restore_note_version',
            JSON.stringify({ p_version: version.id }),
          ]);
          await tx.execute(
            'update notes set title = ?, body = ?, props = ?, updated_at = ? where id = ?',
            [
              restored.title,
              restored.body,
              JSON.stringify(restored.props),
              new Date().toISOString(),
              noteId,
            ],
          );
        });
        if (db.currentStatus.connected && onlineManager.isOnline()) await commandResult(id, 4000);
        return restored;
      }
      const { error } = await supabase.rpc('restore_note_version', { p_version: version.id });
      if (error) throw error;
      return restored;
    },
    onSettled: () => {
      settle();
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.from('note_versions').delete().eq('id', versionId);
      if (error) throw error;
    },
    onMutate: (versionId) => {
      queryClient.setQueryData<NoteVersion[]>(key(noteId), (list) =>
        list?.filter((v) => v.id !== versionId),
      );
    },
    onSettled: settle,
  });

  return { restore, remove };
}

/** Quanto as versões ocupam do espaço de anexos (V11-5) */
export function useNoteVersionsUsage() {
  return useQuery({
    queryKey: ['note-versions-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('note_versions_usage');
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

/** Apaga todas as versões de todas as anotações (libera o espaço) */
export function useDeleteAllNoteVersions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const me = await sessionUserId();
      const { error } = await supabase
        .from('note_versions')
        .delete()
        .eq('user_id', me ?? '');
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['note-versions'] });
      void queryClient.invalidateQueries({ queryKey: ['attachment-usage'] });
      void queryClient.invalidateQueries({ queryKey: ['note-versions-usage'] });
    },
  });
}
