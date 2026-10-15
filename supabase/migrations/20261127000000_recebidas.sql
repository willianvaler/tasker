-- V3 §3.2 (L4): convites pendentes de página enviada. Antes de aceitar, quem recebe ainda não lê a
-- página nem o perfil de quem enviou: esta função devolve só o que o convite precisa mostrar.
create function public.my_pending_shares()
returns table (id uuid, mode text, page_name text, page_icon text, view_type text, owner_name text,
               created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.mode, p.name, p.icon, p.view_type::text, o.display_name, s.created_at
  from public.page_shares s
  join public.pages p on p.id = s.page_id
  left join public.profiles o on o.id = s.owner_id
  where s.status = 'pending'
    and (s.recipient_id = auth.uid() or (s.recipient_id is null and s.recipient_email = public.my_email()))
  order by s.created_at;
$$;
revoke execute on function public.my_pending_shares() from public, anon;
grant execute on function public.my_pending_shares() to authenticated;
