import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get Meta configuration for an agent (authenticated owner)
export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== identity.subject) return null;

    const config = await ctx.db
      .query("metaConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    return config;
  },
});

// Save or update Meta configuration
export const save = mutation({
  args: {
    agentId: v.id("agents"),
    platform: v.union(v.literal("messenger"), v.literal("whatsapp")),
    verifyToken: v.string(),
    accessToken: v.string(),
    pageId: v.optional(v.string()),
    whatsappPhoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("metaConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        platform: args.platform,
        verifyToken: args.verifyToken,
        accessToken: args.accessToken,
        pageId: args.pageId,
        whatsappPhoneNumberId: args.whatsappPhoneNumberId,
        updatedAt: now,
      });
      return existing._id as Id<"metaConfigs">;
    }

    const id = await ctx.db.insert("metaConfigs", {
      agentId: args.agentId,
      platform: args.platform,
      verifyToken: args.verifyToken,
      accessToken: args.accessToken,
      pageId: args.pageId,
      whatsappPhoneNumberId: args.whatsappPhoneNumberId,
      webhookUrl: undefined,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Update webhook URL and activation
export const updateWebhook = mutation({
  args: {
    agentId: v.id("agents"),
    webhookUrl: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied");
    }

    const config = await ctx.db
      .query("metaConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!config) throw new Error("Meta configuration not found");

    await ctx.db.patch(config._id, {
      webhookUrl: args.webhookUrl,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    return config._id;
  },
});

// Delete Meta configuration
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== identity.subject) {
      throw new Error("Agent not found or access denied");
    }

    const config = await ctx.db
      .query("metaConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    if (config) await ctx.db.delete(config._id);
    return true;
  },
});

// Internal: get config by agent id (no auth; for webhook)
export const getByAgentId = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("metaConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId as Id<"agents">))
      .first();
    return config;
  },
});
