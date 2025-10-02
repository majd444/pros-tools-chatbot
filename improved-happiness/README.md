This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# bug-free-fishstick

## Discord Bot Supervisor (Railway / VPS)

This repo includes a multi-tenant Discord bot supervisor that brings bots online automatically for every agent that saves a Discord Client ID + Bot Token in the app (Plugins → Discord).

### How it works

- Frontend component `components/DiscordConfig.tsx` saves credentials to Convex with `api.discord.saveBotConfig`.
- The supervisor `discord-bot/src/supervisor.ts` polls `discord:listActiveConfigs` and spawns one bot process per agent. Each bot fetches its token from Convex and logs in.
- After saving, the UI auto-opens the official Discord Invite URL for the user to approve (required by Discord).

### Run locally

```
cd discord-bot
cp .env.example .env # or create .env with the vars below
npm install
npm run supervisor:dev
```

Required env vars in `discord-bot/.env`:

- `CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud`
- `DISCORD_BACKEND_KEY=YOUR_SECURE_KEY` (must match Convex Production)
- `LOG_LEVEL=info` (or `debug`)
- `SUPERVISOR_POLL_MS=10000` (optional; faster pickup)

### Deploy on Railway (24/7)

Set these in the Railway Service settings:

- Root Directory: `probable-broccoli/discord-bot`
- Node: `>=18`
- Build Command (pick one):
  - Recommended: `npm install --omit=dev && npm run build`
  - Strict: `npm ci && npm run build` (requires in-sync lockfile)
- Start Command: `npm run supervisor:start`

Environment Variables:

- `CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud`
- `DISCORD_BACKEND_KEY=YOUR_SECURE_KEY`
- `LOG_LEVEL=info`
- `SUPERVISOR_POLL_MS=10000` (optional)

### Discord requirements per bot

- Invite the bot after saving (we auto-open the Invite URL).
- Enable "Message Content Intent" in the Discord Developer Portal → Bot → Privileged Gateway Intents.

