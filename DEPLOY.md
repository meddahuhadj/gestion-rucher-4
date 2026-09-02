# Déploiement — MOUMEN Apiary AI

Architecture **Render (front + API) + Supabase (base)**, offres gratuites,
décrite par `render.yaml` à la racine. Un `Apply` crée les 2 ressources Render :

| Brique | Hébergeur | Ce qui tourne |
| --- | --- | --- |
| Base de données | **Supabase** (free) | Postgres — pas d'expiration |
| API (`apps/api`) | Render — `gestion-rucher-api` (web service free) | Fastify + Prisma |
| Frontend PWA (`apps/web`) | Render — `gestion-rucher-web` (static site, gratuit illimité) | statique + Service Worker |

> Pourquoi pas la base Postgres de Render : la limite « 1 seule base free par
> compte » est déjà atteinte, et le free Render expire à 90 jours.

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

## 1. Base Supabase — récupérer les connection strings

Supabase → **Project Settings → Database → Connection string** :

| Variable | Source | Forme |
| --- | --- | --- |
| `DATABASE_URL` | *Connection pooling*, mode **Transaction**, port `6543` | `postgresql://…@…pooler…:6543/postgres?pgbouncer=true` (ajouter `?pgbouncer=true`) |
| `DIRECT_URL` | *Direct connection*, port `5432` | `postgresql://…@…:5432/postgres` |

(`DIRECT_URL` sert au `prisma db push` lancé au démarrage de l'API.)

---

## 2. Déploiement Render (Blueprint)

1. Dashboard Render → **New + → Blueprint** → repo `gestion-rucher-4` →
   branche `main` → **Apply**.
2. Render crée `gestion-rucher-api` (région `frankfurt`) et `gestion-rucher-web`
   (static, CDN global).
3. Renseigner les 3 variables `sync: false`, onglet **Environment** du service
   `gestion-rucher-api` :

   | Variable | Valeur |
   | --- | --- |
   | `DATABASE_URL` | Supabase pooler (§1) |
   | `DIRECT_URL` | Supabase direct (§1) |
   | `GEMINI_API_KEY` | clé Google AI Studio |

   Le reste (`ALLOW_DEBUG_AUTH`, `CORS_ORIGINS`, `SUPABASE_URL`, modèles
   Gemini…) est déjà câblé dans `render.yaml`.
4. Au premier boot, l'API exécute `prisma db push` (startCommand) → le schéma
   Prisma est synchronisé sur la base Supabase automatiquement.

### ⚠️ Si un nom est déjà pris

Render ajoute alors un suffixe aléatoire (`gestion-rucher-api-x7k2`). Les URLs
en dur ne correspondent plus. À corriger dans `render.yaml` puis recommit :

- `routes[0].destination` du static site → `https://<vraie-URL-API>/api/*`
- `CORS_ORIGINS` de l'API → `https://<vraie-URL-web>`

(Render n'accepte pas l'interpolation de variables dans les Blueprints, d'où les
URLs en dur.)

---

## 3. Vérification

1. Ouvrir `https://gestion-rucher-web.onrender.com`.
2. Page de connexion → bouton **« connexion dev »**.
3. 1er appel API ≈ 50 s (cold start du service free, voir §5), puis normal.
4. `GET https://gestion-rucher-api.onrender.com/health` → `200`.

---

## 4. Vérification PWA

- Site → DevTools → **Application → Manifest** : icônes 192/512 + maskable, pas
  d'erreur.
- **Application → Service Workers** : `sw.js` *activated*.
- Lighthouse → catégorie *PWA* : installable, hors-ligne OK.
- Mobile : « Ajouter à l'écran d'accueil » (Android/Chrome, iOS/Safari).
- Icônes régénérables : `pnpm --filter @moumen/web gen:icons`.
- Mise à jour : SW en mode `prompt` → à chaque déploiement, « Nouvelle version
  disponible. Recharger ? » (géré dans `main.tsx`).

---

## 5. Notes offre gratuite

- **API Render** : s'endort après 15 min d'inactivité → 1re requête ≈ 50 s (cold
  start). Le chat/vocal MOUMEN est lent au réveil. Un cron externe (ex.
  cron-job.org qui ping `/health` toutes les 10 min) garde le service chaud.
- 750 h/mois, **une seule instance** → OK (les *pending actions* IA sont en
  mémoire, cohérent avec une instance unique).
- **Static site Render** : gratuit, illimité, pas de cold start.
- **Supabase free** : projet mis en pause après 1 semaine sans requête → le cron
  `/health` ci-dessus fait aussi tourner la base (l'API l'interroge au boot).
- Le port de l'API est imposé par `$PORT` (déjà géré dans `server.ts`).

---

## 6. Plus tard : rebrancher Supabase Auth

La base Supabase est déjà utilisée (§1). Il reste à activer l'authentification :

1. **Auth API** : passer `ALLOW_DEBUG_AUTH` à `false`, ajouter
   `SUPABASE_SERVICE_ROLE_KEY` (`sync: false`). `SUPABASE_URL` et
   `SUPABASE_JWT_JWKS_URL` sont déjà présents.
2. **Auth front** : dans `apps/web/.env.production`, passer
   `VITE_ALLOW_DEV_LOGIN` à `false` et définir `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` (Render → static site → Environment).
3. **Policies** : rejouer dans le SQL Editor Supabase
   `infra/supabase/migrations/0001_rls_and_triggers.sql` puis
   `0002_task_completed_by.sql`.
4. **Supabase Auth → URL Configuration** : ajouter
   `https://gestion-rucher-web.onrender.com` en *Site URL* et *Redirect URLs*
   (`/**`).

---

## 7. Après chaque `git push`

- **Render** redéploie l'API **et** le front automatiquement (`autoDeploy: true`).
- **Schéma DB** : `prisma db push` tourne au boot de l'API à chaque déploiement
  (idempotent). Un changement de `apps/api/prisma/schema.prisma` est donc
  appliqué automatiquement — attention aux modifs destructrices.
