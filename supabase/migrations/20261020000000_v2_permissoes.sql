-- V2 §4.3 e V3 §8: permissões como dados. Um cargo é um conjunto de permissões atômicas; os papéis
-- de hoje (folder_role: owner, editor, viewer) são presets com o mesmo nome. O catálogo abaixo é o
-- espelho de src/lib/permissions.ts (o teste do app compara). As policies passam a usar
-- has_permission() quando os cargos novos chegarem (Fase E); por enquanto ele convive com
-- is_folder_member().

create function public.permission_presets()
returns jsonb
language sql immutable
as $fn$
  select $json${
  "presets": {
    "owner": ["project.view", "project.delete", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth"],
    "manager": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "member.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "automation.manage", "item.check", "item.log", "page.share", "page.view_progress", "timer.use", "settings.max_depth"],
    "editor": ["project.view", "comment.create", "task.create", "task.complete", "task.edit", "task.delete", "task.assign", "page.manage", "task.start", "task.force_unblock", "dependency.manage", "workflow.view_audit", "item.check", "item.log", "page.share", "page.view_progress", "timer.use"],
    "contributor": ["project.view", "comment.create", "task.create", "task.complete:own", "task.start:own", "task.delete:own", "item.check:own", "item.log:own", "timer.use:own"],
    "viewer": ["project.view", "comment.create"],
    "executor": ["project.view", "comment.create", "item.check", "item.log", "timer.use"]
  },
  "own": {"task.complete": "assigned", "task.start": "assigned", "item.check": "assigned", "item.log": "assigned", "timer.use": "assigned", "task.delete": "created"}
}$json$::jsonb;
$fn$;

-- O preset tem a permissão? As ":own" valem só sobre o que é seu (atribuída a si ou criada por si).
create function public.preset_can(
  p_preset text,
  p_permission text,
  p_is_assignee boolean default false,
  p_is_creator boolean default false
)
returns boolean
language sql immutable set search_path = ''
as $$
  with c as (select public.permission_presets() as cfg)
  select coalesce(
    (c.cfg -> 'presets' -> p_preset) ? p_permission
    or (
      (c.cfg -> 'presets' -> p_preset) ? (p_permission || ':own')
      and case c.cfg -> 'own' ->> p_permission
            when 'assigned' then p_is_assignee
            when 'created' then p_is_creator
            else false
          end
    ),
    false)
  from c;
$$;

-- A função única de permissão no servidor: o usuário logado pode fazer isso nesta pasta/projeto?
create function public.has_permission(
  p_folder_id uuid,
  p_permission text,
  p_is_assignee boolean default false,
  p_is_creator boolean default false
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select public.preset_can(m.role::text, p_permission, p_is_assignee, p_is_creator)
    from public.folder_members m
    where m.folder_id = public.folder_root(p_folder_id)
      and m.user_id = auth.uid()
  ), false);
$$;

grant execute on function public.permission_presets() to authenticated;
grant execute on function public.preset_can(text, text, boolean, boolean) to authenticated;
grant execute on function public.has_permission(uuid, text, boolean, boolean) to authenticated;
