-- Motor de automações: webhook de saída (ESCOPO_V14 §7.1, AU8, D339).
--
-- O passo `enviar_webhook` é feito pelo executor (Edge Function `automation-run`, com o anti-SSRF de
-- supabase/functions/_shared/webhook-out.ts). Aqui ficam a validação do passo e os segredos:
-- - `automation_secrets`: os segredos de cabeçalho (`{"segredo": "nome"}` no passo) e o de
--   assinatura (`_assinatura`), guardados no Vault. O cliente grava por RPC e só vê os nomes; o
--   valor sai só para o executor (`automation_run_secrets`, chave de serviço). O de assinatura é
--   mostrado uma vez, ao gerar ou trocar.

-- Validação do passo
create or replace function public._automation_check_steps(p_steps jsonb, p_scope text, p_level integer)
returns integer
language plpgsql immutable set search_path = ''
as $$
declare
  v_step jsonb;
  v_type text;
  v_count integer := 0;
  v_catalog jsonb := public.automation_catalog() -> 'passos';
  v_key text;
begin
  if jsonb_typeof(p_steps) <> 'array' then
    perform public._automation_fail('Os passos precisam ser uma lista');
  end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_type := v_step ->> 'tipo';
    if jsonb_typeof(v_step) <> 'object' or v_type is null or not v_catalog ? v_type then
      perform public._automation_fail('Passo desconhecido: ' || coalesce(v_type, '?'));
    end if;
    if not (v_catalog -> v_type -> 'escopos') ? p_scope then
      perform public._automation_fail('O passo ' || v_type || ' não vale para regra de ' || p_scope);
    end if;
    v_count := v_count + 1;
    case v_type
      when 'se' then
        if p_level >= 3 then
          perform public._automation_fail('SE dentro de SE com no máximo 3 níveis');
        end if;
        if not v_step ? 'condicao' then
          perform public._automation_fail('SE precisa de condição');
        end if;
        perform public._automation_check_condition(v_step -> 'condicao', 0);
        v_count := v_count + public._automation_check_steps(coalesce(v_step -> 'entao', '[]'), p_scope, p_level + 1)
                           + public._automation_check_steps(coalesce(v_step -> 'senao', '[]'), p_scope, p_level + 1);
      when 'notificar' then
        if char_length(coalesce(v_step ->> 'titulo', '')) > 80 or char_length(coalesce(v_step ->> 'corpo', '')) > 240 then
          perform public._automation_fail('Aviso: título até 80 e texto até 240 caracteres');
        end if;
        if coalesce(v_step ->> 'canal', 'ambos') not in ('app', 'push', 'ambos') then
          perform public._automation_fail('Canal do aviso: app, push ou ambos');
        end if;
      when 'criar_tarefa' then
        if char_length(btrim(coalesce(v_step ->> 'titulo', ''))) = 0 or char_length(v_step ->> 'titulo') > 500 then
          perform public._automation_fail('Criar tarefa precisa de título (até 500 caracteres)');
        end if;
      when 'atualizar_tarefa' then
        -- V14-5: nada de concluir, reabrir ou apagar
        for v_key in select jsonb_object_keys(v_step) loop
          if v_key not in ('tipo', 'tarefa', 'adicionar_etiquetas', 'remover_etiquetas', 'mover_para', 'vencimento') then
            perform public._automation_fail('Atualizar tarefa não aceita: ' || v_key);
          end if;
        end loop;
      when 'esperar' then
        if coalesce((v_step ->> 'minutos')::numeric, 0) not between 1 and 10080 then
          perform public._automation_fail('Esperar de 1 minuto a 7 dias');
        end if;
      when 'definir_variavel' then
        if coalesce(v_step ->> 'nome', '') !~ '^[a-z_][a-z0-9_]{0,30}$' then
          perform public._automation_fail('Nome de variável: letras minúsculas, números e _');
        end if;
      when 'executar_regra' then
        if coalesce(v_step ->> 'regra', '') !~ '^[0-9a-f-]{36}$' then
          perform public._automation_fail('Executar regra precisa da regra');
        end if;
      when 'enviar_webhook' then
        if coalesce(v_step ->> 'url', '') !~* '^https://' or char_length(v_step ->> 'url') > 2000 then
          perform public._automation_fail('Webhook: só endereços https://');
        end if;
        if upper(coalesce(v_step ->> 'metodo', 'POST')) not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE') then
          perform public._automation_fail('Webhook: método GET, POST, PUT, PATCH ou DELETE');
        end if;
        if v_step ? 'cabecalhos' then
          if jsonb_typeof(v_step -> 'cabecalhos') <> 'object'
             or (select count(*) from jsonb_object_keys(v_step -> 'cabecalhos')) > 20 then
            perform public._automation_fail('Webhook: até 20 cabeçalhos');
          end if;
          for v_key in select jsonb_object_keys(v_step -> 'cabecalhos') loop
            if v_key ~* '^(host|content-length|connection|transfer-encoding|x-questlist-.*)$' or v_key !~ '^[A-Za-z0-9-]{1,64}$' then
              perform public._automation_fail('Webhook: cabeçalho não permitido: ' || v_key);
            end if;
            if not (jsonb_typeof(v_step -> 'cabecalhos' -> v_key) = 'string'
                    or (jsonb_typeof(v_step -> 'cabecalhos' -> v_key) = 'object'
                        and coalesce(v_step -> 'cabecalhos' -> v_key ->> 'segredo', '') ~ '^[a-z][a-z0-9_]{0,30}$')) then
              perform public._automation_fail('Webhook: o cabeçalho é um texto ou um segredo');
            end if;
          end loop;
        end if;
        if v_step ? 'corpo' and jsonb_typeof(v_step -> 'corpo') not in ('object', 'array', 'null') then
          perform public._automation_fail('Webhook: o corpo é um objeto JSON');
        end if;
      when 'alternar_modo_jogo' then
        if coalesce(v_step ->> 'modo', '') not in ('off', 'light', 'full') then
          perform public._automation_fail('Modo de jogo: off, light ou full');
        end if;
      else
        null;
    end case;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Segredos da regra (no Vault)
-- ---------------------------------------------------------------------------------------------
create table public.automation_secrets (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  name text not null check (name ~ '^(_assinatura|[a-z][a-z0-9_]{0,30})$'),
  secret_id uuid not null,
  created_at timestamptz not null default now(),
  unique (rule_id, name)
);
alter table public.automation_secrets enable row level security;
revoke all on public.automation_secrets from anon, authenticated;

create function public.automation_secrets_cleanup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return null;
end;
$$;
create trigger automation_secrets_cleanup after delete on public.automation_secrets
  for each row execute function public.automation_secrets_cleanup();

-- Quem mexe nos segredos: a dona da regra pessoal (webhook é só de regra pessoal, D333)
create function public._automation_own_rule(p_rule uuid)
returns public.automation_rules
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rule public.automation_rules;
begin
  select * into v_rule from public.automation_rules where id = p_rule;
  if v_rule.id is null or v_rule.scope <> 'pessoal' or v_rule.owner_id is distinct from auth.uid() then
    raise exception 'Automação não encontrada' using errcode = '42501';
  end if;
  return v_rule;
end;
$$;

create function public._automation_put_secret(p_rule uuid, p_name text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := (select secret_id from public.automation_secrets where rule_id = p_rule and name = p_name);
begin
  if v_id is null then
    v_id := vault.create_secret(p_value, 'automacao-' || p_rule || '-' || p_name, 'Segredo de automação');
    insert into public.automation_secrets (rule_id, name, secret_id) values (p_rule, p_name, v_id);
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

-- Guardar (ou apagar, com valor vazio) um segredo de cabeçalho. Não devolve o valor.
create function public.automation_secret_set(p_rule uuid, p_name text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._automation_own_rule(p_rule);
  if p_name !~ '^[a-z][a-z0-9_]{0,30}$' then
    raise exception 'Nome do segredo: letras minúsculas, números e _' using errcode = '22023';
  end if;
  if coalesce(p_value, '') = '' then
    delete from public.automation_secrets where rule_id = p_rule and name = p_name;
    return;
  end if;
  if char_length(p_value) > 4000 then
    raise exception 'Segredo longo demais' using errcode = '22023';
  end if;
  if (select count(*) from public.automation_secrets where rule_id = p_rule) >= 10
     and not exists (select 1 from public.automation_secrets where rule_id = p_rule and name = p_name) then
    raise exception 'No máximo 10 segredos por automação' using errcode = '22023';
  end if;
  perform public._automation_put_secret(p_rule, p_name, p_value);
end;
$$;

-- Os nomes guardados (sem os valores)
create function public.automation_secret_names(p_rule uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._automation_own_rule(p_rule);
  return array(select name from public.automation_secrets where rule_id = p_rule order by name);
end;
$$;

-- Gera (ou troca) o segredo de assinatura e mostra uma vez
create function public.automation_signing_secret(p_rule uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  perform public._automation_own_rule(p_rule);
  perform public._automation_put_secret(p_rule, '_assinatura', v_secret);
  return v_secret;
end;
$$;

-- Para o executor: os segredos da regra desta execução
create function public.automation_run_secrets(p_run uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.name, d.decrypted_secret), '{}')
  from public.automation_runs x
  join public.automation_secrets s on s.rule_id = x.rule_id
  join vault.decrypted_secrets d on d.id = s.secret_id
  where x.id = p_run;
$$;

revoke execute on function public.automation_secrets_cleanup(), public._automation_own_rule(uuid),
  public._automation_put_secret(uuid, text, text), public.automation_run_secrets(uuid),
  public._automation_check_steps(jsonb, text, integer)
  from public, anon, authenticated;
grant execute on function public.automation_run_secrets(uuid) to service_role;
revoke execute on function public.automation_secret_set(uuid, text, text), public.automation_secret_names(uuid),
  public.automation_signing_secret(uuid) from public, anon;
grant execute on function public.automation_secret_set(uuid, text, text), public.automation_secret_names(uuid),
  public.automation_signing_secret(uuid) to authenticated;
