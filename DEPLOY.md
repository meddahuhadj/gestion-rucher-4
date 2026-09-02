# Déploiement — MOUMEN Apiary AI

Architecture **tout-en-un sur Render** (offres gratuites), décrite par
`render.yaml` à la racine. Un seul `Apply` crée les 3 ressources :

| Brique | Ressource Render | Ce qui tourne |
| --- | --- | --- |
| Base de données | `gestion-rucher-db` (PostgreSQL free) | Postgres 1 Go — ⚠️ expire ~90 j |
| API (`apps/api`) | `gestion-rucher-api` (web service free) | Fastify + Prisma |
| Frontend PWA (`apps/web`) | `gestion-rucher-web` (static site, gratuit illimité) | statique + Service Worker |

Le front appelle `/api/v1/*` **en same-origin** ; `render.yaml` réécrit `/api/*`
vers le service API (`routes` → `rewrite`). Aucun CORS à gérer côté navigateur,
et le Service Worker (cache offline) continue de fonctionner.

**Auth** : pas de Supabase Auth pour l'instant. Le front affiche un bouton
« connexion dev » (`VITE_ALLOW_DEV_LOGIN=true`) qui envoie l'en-tête
`X-Debug-User` ; l'API l'accepte car `ALLOW_DEBUG_AUTH=true`. Déploiement privé
uniquement — voir §5 pour rebrancher Supabase Auth plus tard.

---

## 0. Pré-requis (une seule fois)

```bash
# à la racine du repo
git add -A && git commit -m "chore: setup déploiement Render"
git push                       # le repo doit être sur GitHub (privé OK)
```

Compte : [render.com](https://render.com). Clé Google AI Studio pour Gemini.

---

## 1. Déploiement (Blueprint)

1. Dashboard Render → **New + → Blueprint** → sélectionner le repo → **Apply**.
2. Render crée `gestion-rucher-db`, `gestion-rucher-api`, `gestion-rucher-web`
   dans la région `frankfurt`.
3. Renseigner la **seule** variable secrète (`sync: false`), onglet
   **Environment** du service `gestion-rucher-api` :

   | Variable | Valeur |
   | --- | --- |
   | `GEMINI_API_KEY` | clé Google AI Studio |

   Tout le reste (`DATABASE_URL`, `DIRECT_URL`, `ALLOW_DEBUG_AUTH`,
   `CORS_ORIGINS`, modèles Gemini…) est déjà câblé dans `render.yaml`.
4. Au premier boot, l'API exécute `prisma db push` (startCommand) → le schéma
   est synchronisé sur la base automatiquement, aucune action manuelle.

### ⚠️ Si un nom est déjà pris

Render ajoute alors un suffixe aléatoire (`gestion-rucher-api-x7k2`). Les URLs
en dur ne correspondent plus. À corriger dans `render.yaml` puis recommit :

- `routes[0].destination` du static site → `https://<vraie-URL-API>/api/*`
- `CORS_ORIGINS` de l'API → `https://<vraie-URL-web>`

(Render n'accepte pas l'interpolation de variables dans les Blueprints, d'où les
URLs en dur.)

---

## 2. Vérification

1. Ouvrir `https://gestion-rucher-web.onrender.com`.
2. Page de connexion → bouton **« connexion dev »**.
3. 1er appel API ≈ 50 s (cold start du service free, voir §4), puis normal.
4. `GET https://gestion-rucher-api.onrender.com/health` → `200`.

---

## 3. Vérification PWA

- Site → DevTools → **Application → Manifest** : icônes 192/512 + maskable, pas
  d'erreur.
- **Application → Service Workers** : `sw.js` *activated*.
- Lighthouse → catégorie *PWA* : installable, hors-ligne OK.
- Mobile : « Ajouter à l'écran d'accueil » (Android/Chrome, iOS/Safari).
- Icônes régénérables : `pnpm --filter @moumen/web gen:icons`.
- Mise à jour : SW en mode `prompt` → à chaque déploiement, « Nouvelle version
  disponible. Recharger ? » (géré dans `main.tsx`).

---

## 4. Notes offre gratuite Render

- **API** : s'endort après 15 min d'inactivité → 1re requête ≈ 50 s (cold
  start). Le chat/vocal MOUMEN est lent au réveil. Un cron externe (ex.
  cron-job.org qui ping `/health` toutes les 10 min) garde le service chaud.
- 750 h/mois, **une seule instance** → OK (les *pending actions* IA sont en
  mémoire, cohérent avec une instance unique).
- **PostgreSQL free : expire ~90 jours** et se supprime. Pour un usage durable :
  passer la base en plan payant, ou exporter/réimporter (`pg_dump`) avant
  l'échéance, ou revenir sur Supabase (§5).
- **Static site** : gratuit, illimité, pas de cold start.
- Le port de l'API est imposé par `$PORT` (déjà géré dans `server.ts`).

---

## 5. Plus tard : rebrancher Supabase (Auth + base durable)

1. **Base** : dans `render.yaml`, remplacer les deux `fromDatabase` par
   `sync: false` et coller les connection strings Supabase
   (`DATABASE_URL` = pooler `:6543/postgres?pgbouncer=true`,
   `DIRECT_URL` = direct `:5432/postgres`). Supprimer le bloc `databases:`.
2. **Auth API** : passer `ALLOW_DEBUG_AUTH` à `false`, ajouter
   `SUPABASE_SERVICE_ROLE_KEY` (`sync: false`). `SUPABASE_URL` et
   `SUPABASE_JWT_JWKS_URL` sont déjà présents.
3. **Auth front** : dans `apps/web/.env.production`, passer
   `VITE_ALLOW_DEV_LOGIN` à `false` et définir `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` (Render → static site → Environment).
4. **Policies** : rejouer dans le SQL Editor Supabase
   `infra/supabase/migrations/0001_rls_and_triggers.sql` puis
   `0002_task_completed_by.sql`.
5. **Supabase Auth → URL Configuration** : ajouter
   `https://gestion-rucher-web.onrender.com` en *Site URL* et *Redirect URLs*
   (`/**`).

---

## 6. Après chaque `git push`

- **Render** redéploie l'API **et** le front automatiquement (`autoDeploy: true`).
- **Schéma DB** : `prisma db push` tourne au boot de l'API à chaque déploiement
  (idempotent). Un changement de `apps/api/prisma/schema.prisma` est donc
  appliqué automatiquement — attention aux modifs destructrices.
