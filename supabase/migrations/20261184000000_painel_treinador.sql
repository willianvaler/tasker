-- AC13 (V6 §11, D278): painel do treinador. Quem acompanha uma página enviada ao vivo
-- (`page.view_progress`) lê o diário do aluno **naquela página** (as séries que ele fez nos
-- exercícios dela, com os recordes), para o painel Alunos mostrar 1RM, volume, recordes,
-- estagnação e aderência ao plano. O resto do diário do aluno continua só dele.

create function public.student_workout_sets(p_page_id uuid, p_user uuid)
returns table (
  task_id uuid, exercise_id text, exercise_name text, set_index integer, weight_kg numeric,
  reps integer, duration_seconds integer, distance_m numeric, warmup boolean,
  performed_at timestamptz, records text[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_page public.pages;
begin
  select * into v_page from public.pages where id = p_page_id;
  if v_page.id is null or not public.has_permission(v_page.folder_id, 'page.view_progress') then
    raise exception 'Página não encontrada' using errcode = 'P0002';
  end if;
  -- Só de quem recebeu esta página ao vivo (o histórico fica depois de arquivar)
  if not exists (select 1 from public.page_shares
                 where page_id = p_page_id and recipient_id = p_user and mode = 'live'
                   and status in ('active', 'archived')) then
    raise exception 'Aluno não encontrado' using errcode = 'P0002';
  end if;
  return query
  select w.task_id, w.exercise_id, w.exercise_name, w.set_index, w.weight_kg, w.reps,
         w.duration_seconds, w.distance_m, w.warmup, w.performed_at, w.records
  from public.workout_sets w
  where w.page_id = p_page_id and w.user_id = p_user and w.performed_at > now() - interval '400 days'
  order by w.performed_at desc
  limit 3000;
end;
$$;

revoke execute on function public.student_workout_sets(uuid, uuid) from public, anon;
grant execute on function public.student_workout_sets(uuid, uuid) to authenticated;

-- A política de privacidade diz que quem enviou a página vê o que o aluno faz nela (D213)
create or replace function public.legal_version()
returns text
language sql immutable set search_path = ''
as $$ select '2026-10-26' $$;
