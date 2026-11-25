-- Motor de automações: webhook de entrada (ESCOPO_V14 §7.2, AU9, D340).
--
-- `https://<domínio>/hooks/<token>` chega ao scripts/serve.mjs (limite por token e por IP, corpo até
-- 16 KB), que chama `automation_hook_fire` direto no Supabase local; de fora, essa RPC é fechada pelo
-- portão (scripts/supabase-gate.mjs). O token (32 bytes aleatórios) é guardado só como hash, aparece
-- uma vez e trocar invalida o antigo na hora. A resposta é sempre a mesma (o serve.mjs responde 202),
-- com token válido ou não: nada a sondar. Opcional: exigir a assinatura HMAC no corpo, com o mesmo
-- segredo de assinatura do webhook de saída (`_assinatura`, D339).

-- Profundidade de um JSON (o corpo pode ter no máximo 4 níveis)
create function public._jsonb_depth(p jsonb)
returns integer
language sql immutable set search_path = ''
as $$
  select case jsonb_typeof(p)
    when 'object' then 1 + coalesce((select max(public._jsonb_depth(value)) from jsonb_each(p)), 0)
    when 'array' then 1 + coalesce((select max(public._jsonb_depth(value)) from jsonb_array_elements(p)), 0)
    else 0 end;
$$;

-- Gera (ou troca) o endereço da regra e devolve o token uma vez
create function public.automation_hook_create(p_rule uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules := public._automation_own_rule(p_rule);
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_rule.trigger_type is distinct from 'webhook' then
    raise exception 'O gatilho desta automação não é a chamada de fora' using errcode = '22023';
  end if;
  insert into public.automation_hooks (rule_id, token_hash)
  values (p_rule, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (rule_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return v_token;
end;
$$;

create function public.automation_hook_require_signature(p_rule uuid, p_require boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_own_rule(p_rule);
  update public.automation_hooks set require_signature = p_require where rule_id = p_rule;
end;
$$;

-- A chamada (só o serve.mjs chama). Não devolve nada que diga se o token valeu.
create function public.automation_hook_fire(p_token text, p_body jsonb, p_raw text default null, p_signature text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_hook public.automation_hooks;
  v_rule public.automation_rules;
  v_secret text;
  v_t text;
  v_v1 text;
begin
  if p_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  select h.* into v_hook from public.automation_hooks h
  where h.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if v_hook.id is null then
    return;
  end if;
  select * into v_rule from public.automation_rules where id = v_hook.rule_id;
  if not v_rule.enabled or v_rule.trigger_type is distinct from 'webhook' then
    return;
  end if;
  if octet_length(coalesce(p_raw, p_body::text)) > 16384 or public._jsonb_depth(coalesce(p_body, '{}')) > 4 then
    return;
  end if;
  if v_hook.require_signature then
    v_t := substring(coalesce(p_signature, '') from 't=(\d+)');
    v_v1 := substring(coalesce(p_signature, '') from 'v1=([0-9a-f]{64})');
    select d.decrypted_secret into v_secret from public.automation_secrets s
    join vault.decrypted_secrets d on d.id = s.secret_id
    where s.rule_id = v_rule.id and s.name = '_assinatura';
    if v_secret is null or v_t is null or v_v1 is null or p_raw is null
       or abs(extract(epoch from now()) - v_t::bigint) > 300
       or encode(extensions.hmac(v_t || '.' || p_raw, v_secret, 'sha256'), 'hex') <> v_v1 then
      return;
    end if;
  end if;
  update public.automation_hooks set last_used_at = now() where id = v_hook.id;
  insert into public.automation_events (owner_id, kind, payload)
  values (v_rule.owner_id, 'webhook',
          jsonb_build_object('regra', v_rule.id, 'hook', coalesce(p_body, '{}'), 'recebido_em', now()));
end;
$$;

revoke execute on function public._jsonb_depth(jsonb) from public, anon, authenticated;
revoke execute on function public.automation_hook_create(uuid), public.automation_hook_require_signature(uuid, boolean)
  from public, anon;
grant execute on function public.automation_hook_create(uuid), public.automation_hook_require_signature(uuid, boolean)
  to authenticated;
-- O serve.mjs chama com a chave publicável (anon); de fora, o portão recusa esta rota
revoke execute on function public.automation_hook_fire(text, jsonb, text, text) from public, authenticated;
grant execute on function public.automation_hook_fire(text, jsonb, text, text) to anon;
