import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Id } from "./_generated/dataModel"

// Get Telegram configuration for an agent
export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    // Verify the user owns this agent
    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.userId !== identity.subject) {
      return null
    }

    const config = await ctx.db
      .query("telegramConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first()

    return config
  },
})

// Save or update Telegram configuration
export const save = mutation({
  args: {
    agentId: v.id("agents"),
    botToken: v.string(),
    botUsername: v.optional(v.string()),
    // Optional: when Convex doesn't know its public URL, allow the client
    // to provide a base URL (e.g., NEXT_PUBLIC_APP_URL or window.location.origin)
    preferredBaseUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the user owns this agent
    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied")
    }

    // Validate bot token format (allow variable lengths)
    if (!args.botToken.match(/^\d+:[A-Za-z0-9_-]{30,100}$/)) {
      throw new Error("Invalid bot token format")
    }

    const now = Date.now()

    // Check if config already exists
    const existingConfig = await ctx.db
      .query("telegramConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first()

    let configId: Id<"telegramConfigs">;
    if (existingConfig) {
      // Update existing config
      await ctx.db.patch(existingConfig._id, {
        botToken: args.botToken,
        botUsername: args.botUsername,
        updatedAt: now,
      })
      configId = existingConfig._id
    } else {
      // Create new config
      configId = await ctx.db.insert("telegramConfigs", {
        agentId: args.agentId,
        botToken: args.botToken,
        botUsername: args.botUsername,
        webhookUrl: undefined,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Attempt to automatically apply webhook to a public URL
    try {
      // Prefer Convex site URL when available (Convex HTTP Action endpoint)
      const convexSite = (process.env.CONVEX_SITE_URL || "").replace(/\/$/, "")
      // Otherwise, if the client provided a base URL (the Next.js site), use the Next API route style
      const preferredBase = (args.preferredBaseUrl || "").replace(/\/$/, "")

      const webhookUrl = convexSite
        ? `${convexSite}/api/telegram/webhook?agentId=${args.agentId}`
        : preferredBase
          ? `${preferredBase}/api/telegram/webhook/${args.agentId}`
          : ""

      if (!webhookUrl) {
        console.warn("[telegramConfigs.save] No public base URL available; skipping webhook setup")
        return configId
      }
      const res = await fetch(`https://api.telegram.org/bot${args.botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] })
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        console.error("[telegramConfigs.save] setWebhook failed:", text)
        return configId
      }
      await ctx.db.patch(configId, {
        webhookUrl,
        isActive: true,
        updatedAt: Date.now(),
      })
    } catch (e) {
      console.error("[telegramConfigs.save] Error applying webhook:", e)
    }

    return configId
  },
})

// Update webhook URL and activation status
export const updateWebhook = mutation({
  args: {
    agentId: v.id("agents"),
    webhookUrl: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the user owns this agent
    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied")
    }

    const config = await ctx.db
      .query("telegramConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first()

    if (!config) {
      throw new Error("Telegram configuration not found")
    }

    await ctx.db.patch(config._id, {
      webhookUrl: args.webhookUrl,
      isActive: args.isActive,
      updatedAt: Date.now(),
    })

    return config._id
  },
})

// Delete Telegram configuration
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Not authenticated")
    }

    // Verify the user owns this agent
    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied")
    }

    const config = await ctx.db
      .query("telegramConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first()

    if (config) {
      await ctx.db.delete(config._id)
    }

    return true
  },
})

// Get configuration by agent ID for webhook processing (internal use)
export const getByAgentId = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("telegramConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId as Id<"agents">))
      .first()

    return config
  },
})
