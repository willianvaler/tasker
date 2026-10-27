-- AC13.2 (V6 §11): o treinador define, para cada aluno de uma página enviada ao vivo, a regra de
-- progressão e a carga inicial de cada exercício; o aluno vê "definido pelo treinador". Fica no
-- próprio envio (`page_shares.coach_plan`, que já vai para o aparelho do aluno pelo sync):
-- { "<tarefa>": { "progression": "linear" | ... | null, "weight": "40kg" | null } }.
-- Só muda pela RPC `set_student_plan` (quem gerencia o envio, `can_share_page`).

alter table public.page_shares add column coach_plan jsonb not null default '{}'::jsonb;

create function public.set_student_plan(
  p_share_id uuid, p_task_id uuid, p_progression text, p_weight text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_share public.page_shares;
  v_weight text := nullif(regexp_replace(coalesce(p_weight, ''), '\s', '', 'g'), '');
  v_entry jsonb;
  v_plan jsonb;
begin
  select * into v_share from public.page_shares where id = p_share_id;
  if v_share.id is null or v_share.mode <> 'live' or v_share.status <> 'active'
     or not public.can_share_page(v_share.page_id) then
    raise exception 'Aluno não encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.tasks where id = p_task_id and page_id = v_share.page_id) then
    raise exception 'Exercício não encontrado' using errcode = 'P0002';
  end if;
  if p_progression is not null
     and p_progression not in ('off', 'linear', 'double', 'greyskull', 'time') then
    raise exception 'Regra de progressão inválida' using errcode = '22023';
  end if;
  -- A carga no formato do plano ("40kg", "42,5 kg", "100lb")
  if v_weight is not null and v_weight !~* '^[0-9]+([.,][0-9]+)?(kg|lbs?)$' then
    raise exception 'Carga inválida' using errcode = '22023';
  end if;
  v_entry := jsonb_strip_nulls(jsonb_build_object('progression', p_progression, 'weight', v_weight));
  v_plan := case when v_entry = '{}'::jsonb then v_share.coach_plan - p_task_id::text
                 else jsonb_set(v_share.coach_plan, array[p_task_id::text], v_entry) end;
  update public.page_shares set coach_plan = v_plan where id = p_share_id;
  return v_plan;
end;
$$;

revoke execute on function public.set_student_plan(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_student_plan(uuid, uuid, text, text) to authenticated;
