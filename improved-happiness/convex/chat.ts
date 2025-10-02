import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// Add a new message to a chat session
export const sendMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      content: args.content,
      role: args.role,
      createdAt: Date.now(),
    })
    return messageId
  },
})

// Get all messages for a session
export const getMessages = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect()
    
    return messages
  },
})
