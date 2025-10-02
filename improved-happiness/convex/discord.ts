import { mutation, query } from "./_generated/server"
import { v, ConvexError } from "convex/values"

// Stores Discord bot credentials per agent.
// Mutations are authenticated and enforce agent ownership.
// Query can be secured with a backend key so your bot (running outside) can fetch config.

export const saveBotConfig = mutation({
  args: {
    agentId: v.id("agents"),
    clientId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { agentId, clientId, token }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError("Not authenticated")

    // Verify agent ownership
    const agent = await ctx.db.get(agentId)
    if (!agent) throw new ConvexError("Agent not found")
    if (agent.userId !== identity.subject) throw new ConvexError("Not authorized")

    // Upsert by agentId
    const existing = await ctx.db
      .query("discordConfigs")
      .withIndex("by_agent", q => q.eq("agentId", agentId))
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        clientId,
        token,
        botToken: token, // keep botToken in sync for UIs expecting this field
        updatedAt: now,
      })
      return { _id: existing._id, updated: true } as const
    } else {
      const _id = await ctx.db.insert("discordConfigs", {
        agentId,
        clientId,
        token,
        botToken: token, // store under both names for compatibility
        createdAt: now,
        updatedAt: now,
      })
      return { _id, created: true } as const
    }
  },
})

// Secured maintenance: backfill botToken from token for existing rows.
export const backfillDiscordBotTokens = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const backendKey = process.env.DISCORD_BACKEND_KEY
    if (!backendKey) throw new ConvexError("Server missing DISCORD_BACKEND_KEY")
    if (key !== backendKey) throw new ConvexError("Unauthorized")

    const all = await ctx.db.query("discordConfigs").collect()
    let updated = 0
    for (const row of all) {
      const hasToken = typeof (row as any).token === 'string' && (row as any).token.length > 0
      const hasBotToken = typeof (row as any).botToken === 'string' && (row as any).botToken.length > 0
      if (hasToken && !hasBotToken) {
        await ctx.db.patch(row._id, { botToken: (row as any).token, updatedAt: Date.now() })
        updated++
      }
    }
    return { ok: true as const, updated }
  },
})

// Resolve a Discord config by its application clientId (public) to discover the agentId.
export const getByClientId = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    // No auth: this is used by server-side HTTP interactions to map app -> agent
    const all = await ctx.db.query("discordConfigs").collect();
    const row = all.find(c => c.clientId === clientId);
    if (!row) return null;
    return {
      agentId: String(row.agentId),
      clientId: row.clientId,
      hasToken: typeof row.token === 'string' && row.token.length > 0,
    };
  },
})

// Authenticated query: fetch current user's Discord config for UI
export const getMyBotConfig = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new ConvexError("Agent not found");
    if (agent.userId !== identity.subject) throw new ConvexError("Not authorized");

    const cfg = await ctx.db
      .query("discordConfigs")
      .withIndex("by_agent", q => q.eq("agentId", agentId))
      .first();
    if (!cfg) return null;
    const tok = (typeof cfg.token === 'string' && cfg.token.length > 0) ? cfg.token : (cfg.botToken || '');
    return { clientId: cfg.clientId, hasToken: typeof tok === 'string' && tok.length > 0 };
  },
})

// For your bot process on Railway to fetch credentials securely.
// Provide the agentId and a backend key that you set as environment in Convex and Railway.
export const getBotConfig = query({
  args: {
    agentId: v.id("agents"),
    key: v.string(),
  },
  handler: async (ctx, { agentId, key }) => {
    const backendKey = process.env.DISCORD_BACKEND_KEY
    if (!backendKey) throw new ConvexError("Server missing DISCORD_BACKEND_KEY")
    if (key !== backendKey) throw new ConvexError("Unauthorized")

    const cfg = await ctx.db
      .query("discordConfigs")
      .withIndex("by_agent", q => q.eq("agentId", agentId))
      .first()
    if (!cfg) return null

    // Return only what's needed by the bot
    return {
      clientId: cfg.clientId,
      token: (cfg.token && cfg.token.length > 0) ? cfg.token : (cfg.botToken || ''),
    }
  },
})

// Lists active Discord bot configurations for the external runner, secured by DISCORD_BACKEND_KEY.
export const listActiveConfigs = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const backendKey = process.env.DISCORD_BACKEND_KEY
    if (!backendKey) throw new ConvexError("Server missing DISCORD_BACKEND_KEY")
    if (key !== backendKey) throw new ConvexError("Unauthorized")

    const all = await ctx.db.query("discordConfigs").collect()
    const filtered = all.filter(c => {
      const hasTok = (typeof c.token === 'string' && c.token.length > 0) || (typeof c.botToken === 'string' && c.botToken.length > 0)
      return c.isActive === true || hasTok
    })
    return filtered.map(c => ({
      agentId: String(c.agentId),
      clientId: c.clientId,
      token: (c.token && c.token.length > 0) ? c.token : (c.botToken || ''),
      updatedAt: c.updatedAt,
    }))
  },
})
