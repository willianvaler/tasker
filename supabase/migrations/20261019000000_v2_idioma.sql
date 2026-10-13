-- V2 §11: idioma salvo no perfil e sincronizado entre aparelhos. Nulo = idioma do aparelho.

alter table public.profiles
  add column locale text check (locale in ('pt-BR', 'en', 'es'));

grant update (locale) on public.profiles to authenticated;
