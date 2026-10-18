-- V4 §3 (Q1, D181): itens com a mesma escala de raridade das conquistas (comum, incomum, rara,
-- épica, lendária). Os raros mais baratos da loja (120 de ouro) passam a incomuns; o sorteio do boss
-- dá ao incomum o mesmo peso que o raro tinha, para a chance de cada item não mudar.

alter table public.items drop constraint items_rarity_check;
alter table public.items add constraint items_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

update public.items set rarity = 'uncommon' where rarity = 'rare' and price = 120;

create or replace function public._roll_drop(p_user uuid, p_level integer)
returns text
language sql volatile security definer set search_path = ''
as $$
  select i.key from public.items i
  where i.drop and not exists (select 1 from public.user_items u where u.user_id = p_user and u.item_key = i.key)
  -- Amostragem ponderada: menor -ln(random) / peso
  order by -ln(1 - random()) / case i.rarity
    when 'uncommon' then 60
    when 'rare' then 60
    when 'epic' then 25 + 5 * p_level
    when 'legendary' then 5 + 3 * p_level
    else 10 end
  limit 1;
$$;
revoke execute on function public._roll_drop(uuid, integer) from public, anon, authenticated;
