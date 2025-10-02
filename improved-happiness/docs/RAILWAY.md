# Deploying the Discord Bot to Railway

This repo contains a Next.js app (deploy it to Netlify) and a Discord bot in `discord-bot/` (deploy it to Railway).

The Railway service should only build and run the `discord-bot/` subproject. Do NOT build the Next.js app on Railway.

## Option A: Nixpacks (recommended)

Configure your Railway service as follows:

- Root Directory: `probable-broccoli/discord-bot`
- Build Command (npm):
  ```bash
  npm ci && npm run build
  ```
  Or with pnpm:
  ```bash
  corepack enable && pnpm install --frozen-lockfile=false && pnpm build
  ```
- Start Command:
  ```bash
  node dist/supervisor.js
  ```

### Required environment variables
Set these on the Railway service (Service → Variables):

- `CONVEX_URL` – e.g. `https://YOUR-DEPLOYMENT.convex.cloud` (no trailing slash)
- `DISCORD_BACKEND_KEY` – secure key used by the bot to fetch configs/tokens from Convex
- `SUPERVISOR_MODE` – set to `prod`
- `SUPERVISOR_POLL_MS` – optional, e.g. `30000`

The supervisor exposes a healthcheck HTTP server on `PORT` (provided by Railway). It responds with JSON like:
```json
{ "ok": true, "processes": ["<agentId>", "..."] }
```

## Option B: Dockerfile

A `Dockerfile` is provided at `probable-broccoli/Dockerfile` that builds and runs only the `discord-bot/`:

- Uses Node 20 (Alpine)
- Installs dependencies and runs `npm run build` inside `discord-bot/`
- Starts the supervisor with `node dist/supervisor.js`

When using Docker on Railway, you usually do not set a Start Command (the Dockerfile `CMD` handles it). Keep the same environment variables as above.

## Frontend flow (for a smooth plug-and-play UX)

- The Next.js frontend provides a secure form to input `agentId`, `clientId` and `bot token`.
- The form POSTs to a server-only API route which calls a Convex mutation to save the Discord config (store token securely, set `isActive=true`).
- The Railway supervisor periodically calls Convex to list active configs and spawns a bot per active agent.

## Convex endpoints expected by the bot

Ensure these Convex functions exist and are protected with `DISCORD_BACKEND_KEY`:

- `discord:listActiveConfigs` – used by `src/supervisor.ts` to know which bots to run
- `discord:getBotConfig` – used by `src/index.ts` to resolve the bot token by `agentId`

## Local development

```bash
cd probable-broccoli/discord-bot
npm install
# or: corepack enable && pnpm install

# Dev mode (auto-reload)
CONVEX_URL=... DISCORD_BACKEND_KEY=... SUPERVISOR_MODE=dev npm run supervisor:dev

# Single bot (without supervisor)
AGENT_ID=... DISCORD_CLIENT_ID=... DISCORD_TOKEN=... npm run dev

# Register slash commands (once)
DISCORD_TOKEN=... DISCORD_CLIENT_ID=... npm run register
```

## Troubleshooting

- If Railway builds the Next.js app instead of the bot, ensure Root Directory is set to `probable-broccoli/discord-bot`.
- Verify env vars are set on the Railway service, not the project.
- Check logs for messages like `Starting Discord supervisor` and `Spawned Discord bot process`.
- If using Docker, ensure Railway is building the repo root containing the `Dockerfile`.
