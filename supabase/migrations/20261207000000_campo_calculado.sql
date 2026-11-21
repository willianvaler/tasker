-- VS2 (ESCOPO_V12 §8, D318): campo calculado. O tipo novo `formula` guarda só o texto da fórmula
-- (`{Valor} * {Quantidade}`); o valor é calculado no app (lib/formula/) e nunca é guardado na
-- tarefa. A RLS e os privilégios seguem os do campo (D142): escrever pede `page.manage`.

alter table public.page_fields drop constraint page_fields_kind_check;
alter table public.page_fields add constraint page_fields_kind_check
  check (kind in ('text', 'number', 'select', 'date', 'person', 'money', 'formula'));

alter table public.page_fields add column formula text
  check (formula is null or char_length(formula) <= 500);
-- Fórmula só no campo calculado, e o calculado sempre com fórmula
alter table public.page_fields add constraint page_fields_formula_kind
  check ((kind = 'formula') = (formula is not null and char_length(trim(formula)) > 0));

grant insert (formula), update (formula) on public.page_fields to authenticated;
