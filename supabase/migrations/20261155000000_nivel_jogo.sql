-- HB3 (ESCOPO_V8 §2, D195): três níveis de jogo por pessoa. Desligado continua sendo
-- gamification_enabled = false; ligado, game_mode diz se é o Leve (o de sempre) ou o Completo.
-- As regras do servidor são as mesmas nos três; o Completo só muda a apresentação (e, a partir do
-- HB5, liga vida e diárias).
alter table public.profiles
  add column game_mode text not null default 'light'
    constraint profiles_game_mode check (game_mode in ('light', 'full'));

grant update (game_mode) on public.profiles to authenticated;
