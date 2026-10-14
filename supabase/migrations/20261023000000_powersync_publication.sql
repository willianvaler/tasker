-- Tabelas que o PowerSync replica para o SQLite do aparelho (D75). Tabela nova sincronizável
-- entra aqui e no powersync/sync-config.yaml.
create publication powersync for table
  public.folders,
  public.folder_members,
  public.pages,
  public.tasks;
