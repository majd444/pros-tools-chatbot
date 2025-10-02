# Multi-service repo: build and run only the discord-bot on Railway
# Use Node 20 for compatibility
FROM node:20-alpine AS base

# Create app directory
WORKDIR /app

# Copy discord-bot sources only
# (Improves build cache and avoids sending the whole monorepo)
COPY discord-bot/package.json ./discord-bot/package.json
COPY discord-bot/tsconfig.json ./discord-bot/tsconfig.json
COPY discord-bot/src ./discord-bot/src

# Install and build the bot
WORKDIR /app/discord-bot
RUN npm install --no-audit --no-fund && npm run build

ENV NODE_ENV=production
# Default to supervisor (manages multiple agents based on Convex configs)
# Required envs at runtime:
#   - CONVEX_URL
#   - DISCORD_BACKEND_KEY
# Optional:
#   - SUPERVISOR_MODE=prod
#   - SUPERVISOR_POLL_MS
CMD ["node", "dist/supervisor.js"]
