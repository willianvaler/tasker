-- OB5 (ESCOPO_V11 §4, D290): modelos de anotação. Um modelo é uma anotação marcada (`is_template`),
-- que some das listas e serve de ponto de partida ("Nova anotação a partir de modelo" e o modelo da
-- nota do dia, escolhido em ui_prefs.notes.dailyTemplate). As variáveis ({{data}}, {{hora}},
-- {{titulo}}) são trocadas pelo app ao criar (lib/note-templates.ts). A nota do dia é uma anotação
-- comum, sem pasta, com o título AAAA-MM-DD: nada muda no banco para ela.
alter table public.notes add column is_template boolean not null default false;
create index notes_templates on public.notes (user_id) where is_template;
grant insert (is_template), update (is_template) on public.notes to authenticated;
