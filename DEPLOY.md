# Déploiement — MOUMEN Apiary AI

Architecture cible (offres **gratuites**) :

| Brique | Hébergeur | Ce qui tourne |
| --- | --- | --- |
| Frontend PWA (`apps/web`) | **Vercel** (Hobby) | statique + Service Worker, proxy `/api/*` |
| API (`apps/api`) | **Render** (Free web service) | Fastify + Prisma |
| Base de données | **Supabase** (Free) | Postgres + Auth + Storage |
| IA | Google Gemini | clé API existante |

Le frontend appelle `/api/v1/*` **en same-origin** ; `apps/web/vercel.json` réécrit
ces requêtes vers le service Render. Aucun CORS à gérer côté navigateur, et le
Service Worker (cache offline) continue de fonctionner.

---

## 0. Pré-requis (une seule fois)

```bash
# à la racine du repo
git add -A && git commit -m "chore: setup PWA + déploiement"
gh repo create moumen-apiary-ai --private --source=. --push   # ou pousser à la main
```

Comptes : [vercel.com](https://vercel.com), [render.com](https://render.com),
projet Supabase déjà créé.

---

## 1. Base de données Supabase

1. Supabase → **Project Settings → Database → Connection string** :
   - **Connection pooling** (mode *Transaction*, port `6543`) → ce sera `DATABASE_URL`
     (ajouter `?pgbouncer=true` à la fin).
   - **Direct connection** (port `5432`) → ce sera `DIRECT_URL`.
2. Pousser le schéma une première fois (depuis la machine de dev, `DIRECT_URL` en `.env`) :

   ```bash
   cd apps/api
   npx pnpm@9.15.0 exec prisma db push
   ```

3. Appliquer les policies RLS / triggers (SQL Editor Supabase) :
   - `infra/supabase/migrations/0001_rls_and_triggers.sql`
   - `infra/supabase/migrations/0002_task_completed_by.sql`
4. **Storage** : créer un bucket privé `attachments`.
5. **Auth → URL Configuration** : ajouter le futur domaine Vercel
   (`https://moumen-apiary.vercel.app`) en *Site URL* **et** dans *Redirect URLs*
   (`https://moumen-apiary.vercel.app/**`). Nécessaire pour l'OAuth Google et les
   magic links.

---

## 2. API sur Render

### Option A — Blueprint (recommandé)

`render.yaml` est à la racine. Dashboard Render → **New + → Blueprint** →
sélectionner le repo → *Apply*. Renseigner ensuite les variables marquées
`sync: false` (onglet **Environment** du service `moumen-api`) :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | Supabase pooler (`...:6543/postgres?pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct (`...:5432/postgres`) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` |
| `SUPABASE_JWT_JWKS_URL` | `https://xxxx.supabase.co/auth/v1/.well-known/jwks.json` (projets récents) |
| `SUPABASE_JWT_SECRET` | *ou bien* le secret HS256 (projets legacy) — **un seul des deux** |
| `GEMINI_API_KEY` | clé Google AI |
| `CORS_ORIGINS` | `https://moumen-apiary.vercel.app` (utile en secours si on désactive le proxy) |
| `TEAM_MEMBER_IDS` | *(optionnel)* IDs Supabase de Moumen,Hdj séparés par une virgule |

### Option B — service manuel

New + → **Web Service** → repo → Root Directory `.` :
- Build : `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @moumen/api exec prisma generate && pnpm --filter @moumen/api build`
- Start : `pnpm --filter @moumen/api start`
- Health check path : `/health`

### Notes offre gratuite Render
- Le service **s'endort après 15 min** d'inactivité → 1re requête ≈ 50 s
  (cold start). Le chat/vocal MOUMEN sera lent au réveil. Un cron externe
  (ex. cron-job.org qui ping `/health` toutes les 10 min) garde le service chaud.
- 750 h/mois, **une seule instance** → OK (les *pending actions* IA sont en
  mémoire, cohérent avec une instance unique).
- **Ne pas** utiliser le Postgres gratuit de Render (expire à 90 jours) : on
  reste sur Supabase.
- Le port est imposé par `$PORT` (déjà géré dans `server.ts`).

Une fois déployé, noter l'URL : `https://moumen-api.onrender.com`.

---

## 3. Frontend sur Vercel

1. Dashboard Vercel → **Add New → Project** → importer le repo.
2. **Root Directory** : `apps/web` (Vercel détecte `pnpm-workspace.yaml` à la
   racine et installe tout le monorepo ; laisser *Include files outside root* activé).
3. Framework : **Vite** (auto). Build/Output : gérés par `apps/web/vercel.json`.
4. **Environment Variables** :

   | Variable | Valeur |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → API → `anon` (clé publique) |

   `VITE_API_BASE_URL` est déjà fixé à `/api/v1` par `apps/web/.env.production` —
   ne pas le surcharger sauf si tu désactives le proxy (voir §5).
5. Si l'URL Render diffère de `moumen-api.onrender.com`, éditer la ligne
   `destination` dans **`apps/web/vercel.json`** puis recommit.
6. Deploy. Récupérer le domaine (`https://moumen-apiary.vercel.app`) et le
   reporter dans `CORS_ORIGINS` (Render) + Supabase Auth URLs (§1.5).

---

## 4. Vérification PWA

- Ouvrir le site → DevTools → **Application → Manifest** : icônes 192/512 +
  maskable présentes, pas d'erreur.
- **Application → Service Workers** : `sw.js` *activated*.
- Lighthouse → catégorie *PWA* : installable, hors-ligne OK.
- Mobile : « Ajouter à l'écran d'accueil » (Android/Chrome, iOS/Safari).
- Icônes régénérables : `pnpm --filter @moumen/web gen:icons`.
- Mise à jour : le SW est en mode `prompt` → à chaque déploiement, l'utilisateur
  voit « Nouvelle version disponible. Recharger ? » (géré dans `main.tsx`).

---

## 5. Secours : appels API directs (sans proxy)

Si le streaming SSE (chat/vocal MOUMEN) passe mal à travers le rewrite Vercel :

1. Vercel → env var `VITE_API_BASE_URL = https://moumen-api.onrender.com/api/v1`
   (surcharge `.env.production`), redéployer.
2. Vérifier que `CORS_ORIGINS` (Render) contient bien le domaine Vercel.
3. Le Service Worker continue de cacher `/api/v1/*` par *pathname* même en
   cross-origin (réponses opaques non cachées — dégradation acceptable).

---

## 6. Après chaque `git push`

- **Vercel** : redéploie le frontend automatiquement.
- **Render** : redéploie l'API automatiquement (`autoDeploy: true`).
- **Migrations DB** : non automatiques. En cas de changement de
  `apps/api/prisma/schema.prisma`, relancer `prisma db push` (ou générer une
  vraie migration) manuellement — cf. §1.2.
