# infra/supabase

Base de données, RLS et policies pour MOUMEN Apiary AI.

## Ordre de mise en place

1. **Créer le projet Supabase**, récupérer `DATABASE_URL` (pooler, port 6543) et
   `DIRECT_URL` (port 5432), les mettre dans `apps/api/.env`.

2. **Créer les tables** avec Prisma (source de vérité du schéma) :

   ```bash
   pnpm --filter @moumen/api db:migrate      # dev : crée + applique la migration
   # ou en CI/prod :
   pnpm --filter @moumen/api db:deploy
   ```

3. **Appliquer RLS + triggers** (ce que Prisma ne gère pas) :

   ```bash
   psql "$DIRECT_URL" -f infra/supabase/migrations/0001_rls_and_triggers.sql
   ```

## Modèle de sécurité

- L'**API** se connecte en rôle `postgres` : elle **contourne la RLS** et applique
  elle-même le contrôle de propriété (`owner_id === user.id`) dans chaque *service*.
- La **RLS** est la **seconde barrière** : elle protège tout accès direct fait
  depuis le navigateur via `supabase-js` avec un JWT `authenticated`
  (`auth.uid()` = identifiant utilisateur).
- Le **Storage** (photos, audio, justificatifs) est privé ; l'accès se fait par
  URL signée courte émise par l'API.

## Storage

Bucket privé `apiary-media`. Policies : lecture/écriture réservées au propriétaire
via chemin `"{owner_id}/..."`. Créé manuellement dans le dashboard Supabase ou via
`supabase` CLI (à ajouter en `0002_storage.sql`).
