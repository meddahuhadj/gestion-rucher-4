-- ─────────────────────────────────────────────────────────────
-- MOUMEN Apiary AI — RLS + triggers
-- À appliquer APRÈS `prisma migrate deploy` (Prisma crée les tables ;
-- ce fichier ajoute ce que Prisma ne gère pas : Row-Level Security et
-- le trigger updated_at pour les écritures SQL directes).
--
--   psql "$DIRECT_URL" -f infra/supabase/migrations/0001_rls_and_triggers.sql
--
-- Modèle : l'API (connexion `postgres`) contourne la RLS et applique
-- elle-même le contrôle de propriété dans la couche service. La RLS est
-- la SECONDE barrière : elle protège tout accès direct via supabase-js
-- avec un JWT `authenticated` (auth.uid() = id de l'utilisateur).
-- ─────────────────────────────────────────────────────────────

-- 1) trigger updated_at ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','apiaries','hives','queens','inspections','treatments','tasks',
    'harvests','expenses','revenues','attachments'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- 2) RLS : tables possédées directement (colonne owner_id) -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'apiaries','hives','queens','inspections','treatments','tasks','harvests',
    'expenses','revenues','attachments','notifications','weather_records',
    'ai_observations','ai_recommendations','conversation_sessions','sync_operations'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists owner_all on public.%I;', t);
    execute format(
      'create policy owner_all on public.%I
         for all
         using (owner_id = auth.uid())
         with check (owner_id = auth.uid());', t);
  end loop;
end $$;

-- 3) RLS : table users (id = auth.uid()) ----------------------------------
alter table public.users enable row level security;
drop policy if exists self_rw on public.users;
create policy self_rw on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

-- 4) RLS : tables filles (propriété via le parent) ----------------------
alter table public.inspection_observations enable row level security;
drop policy if exists via_inspection on public.inspection_observations;
create policy via_inspection on public.inspection_observations
  for all using (
    exists (
      select 1 from public.inspections i
      where i.id = inspection_id and i.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.inspections i
      where i.id = inspection_id and i.owner_id = auth.uid()
    )
  );

alter table public.conversation_messages enable row level security;
drop policy if exists via_session on public.conversation_messages;
create policy via_session on public.conversation_messages
  for all using (
    exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

-- 5) RLS : audit_logs — lecture de ses propres entrées, jamais d'écriture client
alter table public.audit_logs enable row level security;
drop policy if exists own_read on public.audit_logs;
create policy own_read on public.audit_logs
  for select using (actor_id = auth.uid());
-- (les insertions passent par l'API en connexion `postgres`, hors RLS)
