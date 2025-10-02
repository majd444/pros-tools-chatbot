import { mutation } from "./_generated/server"
import { v } from "convex/values"

// This function will be called when a user signs in
export const createOrUpdateUser = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (existingUser) {
      // Update existing user
      return await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        lastLogin: Date.now(),
      })
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        userId: args.userId,
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        createdAt: Date.now(),
        lastLogin: Date.now(),
      })
    }
  },
})
