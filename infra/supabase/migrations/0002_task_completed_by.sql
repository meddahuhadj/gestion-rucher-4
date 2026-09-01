-- 0002 — Attribution en équipe co-propriétaire : qui a marqué une tâche « faite ».
-- Compagnon de la modif Prisma (Task.completedBy). À appliquer avant le déploiement
-- de l'API 22e/23e "continu".

alter table public.tasks
  add column if not exists completed_by uuid;

comment on column public.tasks.completed_by is
  'auth.users.id de la personne ayant complété la tâche (équipe co-propriétaire)';
