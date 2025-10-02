# Discord Bot (discord.js v14)

Deployable on Railway.

## Setup

1. Create a Discord Application + Bot in the Developer Portal.
2. Copy the Bot Token and Client ID.
3. Configure environment variables on Railway:
   - `DISCORD_TOKEN`: your bot token
   - `DISCORD_CLIENT_ID`: your application client id
   - `DISCORD_GUILD_ID` (optional during dev): id of a test server for faster command registration
   - `AGENT_ID` (optional): your internal agent id to echo via /agent id
   - `LOG_LEVEL` (optional): info|debug

## Scripts

- `npm run dev`
- `npm run build && npm start`
- `npm run register` — registers slash commands (global or per-guild if `DISCORD_GUILD_ID` is set)

## Invite URL

Use this to invite the bot (replace CLIENT_ID):

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=3072
```

## Notes

- Keep the process always-on. Railway’s starter plan is sufficient for small bots.
- If you see gateway disconnect logs, Railway might be restarting due to crashes or missing token.
- Enable Privileged Intents if you need Message Content or Server Members.
