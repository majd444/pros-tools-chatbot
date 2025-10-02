import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Save fine-tuning output
export const saveFineTuningOutput = mutation({
  args: {
    agentId: v.string(),
    input: v.string(),
    output: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const now = Date.now();

    await ctx.db.insert("fineTuningOutputs", {
      userId,
      agentId: args.agentId,
      input: args.input,
      output: args.output,
      metadata: args.metadata || {},
      createdAt: now,
    });
  },
});

// Get fine-tuning outputs for a specific agent
export const getAgentFineTuningOutputs = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    
    return await ctx.db
      .query("fineTuningOutputs")
      .withIndex("by_agent", (q) => 
        q.eq("agentId", args.agentId)
         .eq("userId", userId)
      )
      .order("desc")
      .collect();
  },
});

// Delete a fine-tuning output
export const deleteFineTuningOutput = mutation({
  args: {
    id: v.id("fineTuningOutputs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const output = await ctx.db.get(args.id);
    if (!output) {
      throw new Error("Fine-tuning output not found");
    }

    if (output.userId !== identity.subject) {
      throw new Error("Not authorized to delete this output");
    }

    await ctx.db.delete(args.id);
  },
});

// Public: Get recent knowledge entries for an agent (no auth)
export const getPublicAgentKnowledge = query({
  args: {
    agentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.max(1, Math.min(100, args.limit ?? 20));
    return await ctx.db
      .query("fineTuningOutputs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(lim);
  },
});
