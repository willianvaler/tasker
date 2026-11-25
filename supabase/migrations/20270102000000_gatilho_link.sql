-- Gatilho por link (ESCOPO_V15 §2 CT4, D362).
--
-- Uma automação pessoal com gatilho `manual` pode ganhar um endereço `https://<domínio>/r/<token>`,
-- que vira QR (impresso) ou etiqueta NFC (gravada com qualquer app: o sistema abre o link e o link
-- abre o app). O token (32 bytes aleatórios) é guardado só como hash, aparece uma vez e trocar ou
-- revogar invalida o antigo na hora. Quem abre precisa estar logado como a dona da regra: a execução
-- é a mesma do "Executar agora" (`automation_run_now`). Regra com passo externo (webhook,
-- dispositivo) sempre pede confirmação (V15-19); as outras pedem por padrão e a dona pode tirar.
-- O serve.mjs limita os pedidos por IP às duas RPCs de abrir.

create table public.automation_links (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null unique references public.automation_rules (id) on delete cascade,
  token_hash text not null unique,
  confirm boolean not null default true,
  uses integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.automation_links enable row level security;
create policy "automation_links_select" on public.automation_links for select to authenticated
  using (public.can_see_automation_rule(rule_id));
revoke all on public.automation_links from anon, authenticated;
grant select (id, rule_id, confirm, uses, last_used_at, created_at) on public.automation_links to authenticated;

-- A regra tem algum passo externo do catálogo (em qualquer nível, dentro de "se" e afins)?
create function public._automation_has_external(p_definition jsonb)
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_path_query(coalesce(p_definition -> 'passos', '[]'), 'strict $.**.tipo') as t(v)
    join jsonb_each(public.automation_catalog() -> 'passos') as c(tipo, meta)
      on to_jsonb(c.tipo) = t.v
    where (c.meta ->> 'externo')::boolean is true);
$$;

-- Gera (ou troca) o link da regra e devolve o token uma vez
create function public.automation_link_create(p_rule uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules := public._automation_own_rule(p_rule);
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_rule.trigger_type is distinct from 'manual' then
    raise exception 'Só automação com o gatilho "manual" tem link' using errcode = '22023';
  end if;
  insert into public.automation_links (rule_id, token_hash)
  values (p_rule, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (rule_id) do update
    set token_hash = excluded.token_hash, created_at = now(), last_used_at = null, uses = 0;
  return v_token;
end;
$$;

create function public.automation_link_revoke(p_rule uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_own_rule(p_rule);
  delete from public.automation_links where rule_id = p_rule;
end;
$$;

create function public.automation_link_set_confirm(p_rule uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_own_rule(p_rule);
  update public.automation_links set confirm = p_confirm where rule_id = p_rule;
end;
$$;

-- O link e a regra, se valem para quem pede; nada (null) em qualquer outro caso
create function public._automation_link_find(p_token text)
returns public.automation_links
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_link public.automation_links;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select l.* into v_link
  from public.automation_links l
  join public.automation_rules r on r.id = l.rule_id
  where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and r.scope = 'pessoal' and r.owner_id = auth.uid() and r.trigger_type = 'manual';
  return v_link;
end;
$$;

-- O que a tela do link mostra antes de executar. Token inválido, revogado ou de outra pessoa
-- respondem igual: {"valido": false}
create function public.automation_link_open(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_link public.automation_links := public._automation_link_find(p_token);
  v_rule public.automation_rules;
  v_external boolean;
begin
  if v_link.id is null then
    return jsonb_build_object('valido', false);
  end if;
  select * into v_rule from public.automation_rules where id = v_link.rule_id;
  v_external := public._automation_has_external(v_rule.definition);
  return jsonb_build_object(
    'valido', true,
    'regra', v_rule.id,
    'nome', v_rule.name,
    'ligada', v_rule.enabled,
    'externo', v_external,
    'confirmar', v_external or v_link.confirm);
end;
$$;

-- Executa. Sem `p_confirmado`, só roda a regra que dispensa a confirmação
create function public.automation_link_fire(p_token text, p_confirmado boolean default false)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_link public.automation_links := public._automation_link_find(p_token);
  v_rule public.automation_rules;
  v_id uuid;
begin
  if v_link.id is null then
    raise exception 'Link inválido ou revogado' using errcode = '42501';
  end if;
  select * into v_rule from public.automation_rules where id = v_link.rule_id;
  if (v_link.confirm or public._automation_has_external(v_rule.definition)) and not p_confirmado then
    raise exception 'Esta automação pede confirmação' using errcode = '22023';
  end if;
  v_id := public.automation_run_now(v_rule.id);
  update public.automation_links set uses = uses + 1, last_used_at = now() where id = v_link.id;
  return v_id;
end;
$$;

revoke execute on function public._automation_has_external(jsonb), public._automation_link_find(text)
  from public, anon, authenticated;
revoke execute on function public.automation_link_create(uuid), public.automation_link_revoke(uuid),
  public.automation_link_set_confirm(uuid, boolean), public.automation_link_open(text),
  public.automation_link_fire(text, boolean)
  from public, anon;
grant execute on function public.automation_link_create(uuid), public.automation_link_revoke(uuid),
  public.automation_link_set_confirm(uuid, boolean), public.automation_link_open(text),
  public.automation_link_fire(text, boolean)
  to authenticated;
