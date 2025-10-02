import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new chat session
export const createSession = mutation({
  args: {
    agentId: v.id("agents"),
    userId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("chatSessions", {
      agentId: args.agentId,
      userId: args.userId,
      metadata: args.metadata || {},
      lastActive: Date.now(),
      createdAt: Date.now(),
    });
    return sessionId;
  },
});

// Update session user info (merge into metadata.user)
export const updateSessionUserInfo = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    userInfo: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    const prevMeta = (session.metadata || {}) as Record<string, unknown>;
    const userPrev = (prevMeta as { user?: Record<string, string> }).user || {};
    const nextMeta = {
      ...prevMeta,
      user: {
        ...userPrev,
        ...args.userInfo,
      },
    };
    await ctx.db.patch(args.sessionId, { metadata: nextMeta });
    return { ok: true as const };
  },
});

// Get a session by ID
export const getSession = query({
  args: { id: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Update session last active timestamp
export const updateSessionLastActive = mutation({
  args: { id: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastActive: Date.now() });
  },
});

// Create a new message
export const createMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      metadata: args.metadata || {},
      createdAt: Date.now(),
    });
    return messageId;
  },
});

// Get messages for a session
export const getSessionMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// Get the most recent session for a given agent and user
export const getLatestByAgentAndUser = query({
  args: {
    agentId: v.id("agents"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Query by userId (indexed), then filter by agentId
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return sessions.find((s) => s.agentId === args.agentId) || null;
  },
});
