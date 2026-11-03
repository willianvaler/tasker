-- OB8 e OB10 (ESCOPO_V11 §5 e §6, D293 e D295): dois tipos novos de lista que não guardam tarefas.
--
-- `base`: a visão de banco de dados (tabela ou cartões) de tarefas ou anotações filtradas. O filtro
-- é a linguagem de consulta do OB7 (lib/query/, rodada no aparelho), e as colunas, a visão, o
-- agrupamento e a ordem ficam em `config`:
--   {"query": "tarefas onde etiqueta = casa", "view": "table" | "cards", "columns": ["due", ...],
--    "group": "status" | null}
--
-- `canvas`: o quadro branco infinito, guardado no formato aberto JSON Canvas (jsoncanvas.org, MIT):
--   {"nodes": [{"id", "type": "text" | "file" | "link" | "group", "x", "y", "width", "height",
--               "color"?, "text"?, "file"?, "url"?, "label"?}],
--    "edges": [{"id", "fromNode", "toNode", "fromSide"?, "toSide"?, "label"?, "color"?}]}
-- Os cartões de verdade (anotação, tarefa, lista, pasta) são nós "file" com `file` = "<prefixo>:<id>"
-- (os prefixos do [[link]], OB1: n, t, p, f): a tarefa no canvas é a mesma tarefa, não uma cópia.
--
-- Quem mexe na `config` é quem pode configurar a lista (o guarda zz_pages_permission, page.manage).
alter type public.page_view_type add value if not exists 'base';
alter type public.page_view_type add value if not exists 'canvas';

alter table public.pages add column config jsonb
  check (config is null or (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 1000000));
grant insert (config), update (config) on public.pages to authenticated;
