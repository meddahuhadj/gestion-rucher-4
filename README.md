# 🐝 MOUMEN Apiary AI

Copilote numérique intelligent pour apiculteur — voix, vision, texte et données
réelles du rucher autour de l'assistant **MOUMEN**.

> **Architecture complète** : [`docs/ARCHITECTURE.html`](docs/ARCHITECTURE.html)
> (ouvrir dans un navigateur) — 23 volets + roadmap V1 → V4.

## Stack

| Couche    | Techno |
|-----------|--------|
| Frontend  | React + TypeScript + Vite + Tailwind + React Router (PWA) |
| Backend   | Node.js + TypeScript + Fastify + Prisma |
| Données   | Supabase — PostgreSQL + Auth (JWT/OAuth) + Storage + Realtime |
| IA        | Gemini 2.5 par défaut, derrière une interface `AIProvider` remplaçable |

## Structure

```
apps/
  web/     application React (PWA)
  api/     API Fastify + Prisma + orchestrateur IA
packages/
  shared/  enums, schémas Zod, types — contrat unique client/serveur
infra/
  supabase/  migrations SQL (RLS, triggers), notes de déploiement
docs/
  ARCHITECTURE.html   le blueprint
MOUMEN-ASSISTANT.html  prototype voix/vision d'origine (référence module Voice)
```

## Démarrage (développement)

```bash
# 1. dépendances
pnpm install

# 2. configuration
cp apps/api/.env.example apps/api/.env      # renseigner DATABASE_URL, SUPABASE_*
cp apps/web/.env.example apps/web/.env

# 3. base de données (nécessite un projet Supabase)
pnpm --filter @moumen/api db:migrate
psql "$DIRECT_URL" -f infra/supabase/migrations/0001_rls_and_triggers.sql

# 4. lancer API + Web
pnpm dev
#   API → http://localhost:4000   (GET /health)
#   Web → http://localhost:5173
```

### Connexion

- **Avec Supabase** : renseigner `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  (web) et `SUPABASE_JWT_JWKS_URL` (api). L'écran `/login` propose e-mail +
  mot de passe, lien magique et Google.
- **Sans Supabase (dev)** : mettre `ALLOW_DEBUG_AUTH=true` dans `apps/api/.env` ;
  l'écran `/login` affiche alors un bouton **« Connexion développeur »** qui
  injecte un utilisateur fictif (en-tête `X-Debug-User`).

## État d'avancement (V1 — MVP)

| Fait | Module |
|------|--------|
| ✅ | Monorepo, contrat partagé (`packages/shared`), schéma Prisma complet (§11) — les 3 paquets *typecheck* proprement |
| ✅ | API : config, auth JWT Supabase + RBAC, error handler, audit, RLS SQL |
| ✅ | Modules `apiaries`, `hives`, `inspections`, `tasks`, `queens` (+ « reines anciennes », liaison ruche), `treatments`, `harvests` (+ stats §17), `finance` (dépenses/revenus + synthèse §18), `attachments` (URL signées Supabase Storage) |
| ✅ | Couche `AIProvider` + `GeminiProvider` (chat streaming multi-tours, vision) |
| ✅ | **Orchestrateur IA (§8)** : Context Engine, registre de **25 outils** (lecture / réversible / sensible), boucle plan→tools→validation, confirmation niveau 2/3 (`POST /ai/chat` SSE, `POST /ai/actions/confirm`) |
| ✅ | **MOUMEN Vision (§7)** : `POST /ai/vision/analyze` → structure prudente (observation/confiance/à vérifier), stockée dans `ai_observations` |
| ✅ | Web : shell responsive, **i18n AR / FR / EN complet (170 clés) + RTL** (police IBM Plex Sans Arabic, `dir` avant premier rendu, dates/nombres localisés `ar-DZ`, propriétés logiques CSS), PWA, Dashboard, Ruches + fiche ruche, Reines, Traitements, Finance, Récoltes, **chat MOUMEN branché** (streaming + confirmations), **Vision** (caméra + upload) |
| ✅ | **Offline-first (§15–16)** : `POST /sync/batch` (idempotent par `clientUuid`, conflits par `baseVersion`) + `GET /sync/changes`. Client : Dexie (`outbox`), moteur de synchro (flush à la reconnexion + toutes les 30 s), bandeau d'état, SW enregistré. Inspection rapide sur la fiche ruche = enregistrée hors-ligne, jamais perdue. |
| ✅ | **Alertes intelligentes (§13)** : moteur `POST /notifications/scan` (inspection en retard, ruche faible, reine absente/ancienne, tâche urgente) + `GET /notifications` + marquage lu. **Analytics (§19)** : `GET /analytics/overview`. Tableau de bord (§40) branché sur données réelles : alertes, compteurs, production, bénéfice. |
| ✅ | **Authentification** : écran `/login` (e-mail+mot de passe, lien magique, Google OAuth via `@supabase/supabase-js`), `AuthProvider` synchronise le token rafraîchi, garde de route dans `AppShell`, déconnexion. Repli « connexion développeur » si Supabase absent. |
| ✅ | **Smart Inspection (§7)** : parcours guidé `/hives/:id/inspect` en 5 étapes (entrée → cadre → couvain → reine → réserves), photo + analyse Vision par étape, champs contextuels, récapitulatif, enregistrement **offline-first** avec observations IA rattachées. |
| ✅ | **Planificateur (§14/§57)** : `POST /planner/generate` agrège tâches en retard, inspections dues, ruches faibles, suivis de traitement → **planning proposé** (jamais créé automatiquement), réparti sur la semaine. Pages **Travaux** (filtres portée + ajout + complétion) et **Calendrier** (agenda semaine + « Organiser ma semaine » → création tâche par item). Outil IA `generatePlan`. |
| ✅ | **MOUMEN Voice (§6)** — conversation vocale bidirectionnelle en langage naturel (Gemini Live). API : `POST /ai/voice/token` émet un **jeton éphémère** (clé privée jamais exposée), `POST /ai/tools/run` (outils lecture pendant l'échange), `POST /ai/voice/session` (transcript persisté). Web : `services/voice/` (capture micro 16 kHz, lecture 24 kHz, barge-in, transcription entrée/sortie) + `VoicePanel` dans l'écran MOUMEN (orbe d'état, transcript live, cartes de confirmation pour les actions). |
| ⏳ | Module reports · cron des jobs · météo (§31) |

Suite : voir la roadmap dans `docs/ARCHITECTURE.html` §23.
