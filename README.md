# Upload-Post (clone auto-hébergé)

## Lancer le site chez toi (3 commandes)

Il faut Node.js 24 (https://nodejs.org, version « Current »). Ensuite, dans un terminal :

```bash
git clone https://github.com/benjaminarmand77/upload-post.git
cd upload-post && npm install
npm run dev
```

Puis ouvre http://127.0.0.1:4321 dans ton navigateur. Pas de connexion ni de quota : le site est en « mode ouvert » par défaut, tu arrives directement connecté sur le tableau de bord (http://127.0.0.1:4321/app/) avec toutes les fonctionnalités débloquées. (Pour retrouver le comportement du vrai SaaS, login par e-mail et plans payants, mets `OPEN_MODE=0` dans un fichier `.env`.)

Tout fonctionne en mode « sandbox » (publication simulée sur les 22 plateformes). Pour publier pour de vrai sur une plateforme, copie `.env.example` en `.env` et renseigne les clés de cette plateforme (voir « Sandbox vs live » plus bas). `ffmpeg` installé sur la machine active l'éditeur vidéo.

Tu peux aussi demander à Claude Code d'ouvrir ce dossier : le README et `/docs` décrivent toute l'API et le serveur MCP (`POST /mcp`).

---

A full recreation of [upload-post.com](https://www.upload-post.com/fr/): marketing site (FR default + EN, 14-language routing), 22 platform pages, pricing, 11 free tools, guides, comparisons, legal pages, a dashboard app and a REST API compatible with the original `api.upload-post.com` paths and parameters, plus a remote MCP server.

## Run

```bash
npm install
cp .env.example .env        # optional: SMTP, Google sign-in, platform OAuth apps, Anthropic key
npm run dev                 # http://127.0.0.1:4321
```

Production:

```bash
npm run build
SITE_URL=https://your-domain.com APP_SECRET=change-me node ./dist/server/entry.mjs
```

Requirements: Node.js 24 (uses the built-in `node:sqlite`). `ffmpeg` on the PATH enables the FFmpeg editor.

## What is inside

| Area | Where |
| --- | --- |
| Marketing site (all sections of the original home) | `src/pages/[lang]/index.astro`, `src/components/home/*` |
| Platform, MCP, skill, agent, guide, tool, legal, comparison pages | `src/pages/[lang]/**`, content in `src/lib/content/*` |
| Dashboard (`/app`) — magic-link login, profiles & connections, upload, calendar, history, analytics, inbox, FFmpeg, AI Shorts, webhooks, team, billing, settings, whitelabel | `src/pages/app/*`, `src/layouts/AppLayout.astro` |
| Client connect page (whitelabel) | `src/pages/connect.astro` |
| REST API (same paths as the original) | `src/pages/api/**`, engine in `src/server/*` |
| Publishing providers (sandbox + real OAuth/credentials for 22 platforms) | `src/server/providers/*` |
| Remote MCP server | `src/pages/mcp.ts` |
| Docs, `openapi.json`, `llm.txt`, sitemap | `src/pages/docs/*`, `src/pages/openapi.json.ts`, `src/pages/llm.txt.ts` |

## Sandbox vs live

Without platform keys in `.env`, every platform runs in **sandbox mode**: connections open a simulated consent screen, publications return realistic post ids/URLs, analytics are synthesized. Add the keys listed in `.env.example` and the platform switches to its real API (see `/docs/guides/self-hosting`).

Credential platforms (Discord, Telegram, Slack, Mastodon, Bluesky, WordPress, Dev.to, Hashnode, Lemmy, Whop, Listmonk, Nostr) publish for real as soon as you paste valid credentials (you can also tick "sandbox" when connecting).

## Sign-in without SMTP

When `SMTP_HOST` is empty, the magic link is displayed on the login page after you submit your email (development mode). Configure SMTP for real emails.

## Data

SQLite database and uploaded media live in `./data` (override with `DATA_DIR`).

## Deploy on Render

The repo ships a `Dockerfile` (Node 24 + ffmpeg) and a `render.yaml` blueprint (web service + 5 GB persistent disk mounted on `/data`).

1. Push this folder to a GitHub repository.
2. On https://dashboard.render.com → **New → Blueprint**, pick the repository: Render reads `render.yaml` and creates the service and the disk.
3. In the service **Environment** tab set `SITE_URL` to the public URL (`https://<service>.onrender.com` or your own domain). `APP_SECRET` is generated automatically.
4. Optional: `SMTP_*` for real sign-in emails (otherwise the magic link is shown on the login page), `ANTHROPIC_API_KEY`, platform OAuth keys (see `.env.example`).

Health check: `GET /health`. Data (SQLite + uploads) lives on the disk, so it survives deploys.
