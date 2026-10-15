-- K2: salvar a configuração do pomodoro é um upsert com a hora da mudança; a coluna faltava na
-- permissão de insert (a primeira gravação era recusada).
grant insert (updated_at) on public.pomodoro_settings to authenticated;
