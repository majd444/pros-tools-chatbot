import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Users table
  users: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    lastLogin: v.optional(v.number()),
    lastSignIn: v.optional(v.number())
  })
  .index("by_userId", ["userId"])
  .index("by_email", ["email"]),
  
  // Chat sessions
  chatSessions: defineTable({
    agentId: v.id('agents'),
    userId: v.string(), // Can be a guest ID for anonymous users
    metadata: v.optional(v.any()),
    lastActive: v.number(),
    createdAt: v.number(),
  })
  .index('by_agent', ['agentId'])
  .index('by_user', ['userId'])
  .index('by_last_active', ['lastActive']),

  // Chat messages
  chatMessages: defineTable({
    sessionId: v.id('chatSessions'),
    content: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
  .index('by_session', ['sessionId'])
  .index('by_created', ['createdAt']),
  
  // User settings
  userSettings: defineTable({
    userId: v.string(),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    language: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Agents table
  agents: defineTable({
    userId: v.string(),
    name: v.string(),
    welcomeMessage: v.string(),
    systemPrompt: v.string(),
    temperature: v.number(),
    headerColor: v.string(),
    accentColor: v.string(),
    backgroundColor: v.string(),
    profileImage: v.optional(v.string()),
    collectUserInfo: v.boolean(),
    formFields: v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      required: v.boolean(),
      value: v.optional(v.string())
    })),
    createdAt: v.number(),
    updatedAt: v.number()
  })
  .index("by_user", ["userId"])
  .index("by_created", ["createdAt"]),
  
  // Fine-tuning data storage
  fineTuningOutputs: defineTable({
    userId: v.string(),
    agentId: v.string(),
    input: v.string(),
    output: v.string(),
    metadata: v.any(),
    createdAt: v.number()
  })
  .index("by_agent", ["agentId", "userId"])
  .index("by_created", ["createdAt"]),

  // Discord bot configuration per agent (sensitive)
  // Note: token is stored here; ensure access is restricted in queries.
  discordConfigs: defineTable({
    agentId: v.id('agents'),
    clientId: v.string(),
    token: v.optional(v.string()),
    botToken: v.optional(v.string()),
    botStatus: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    lastSeen: v.optional(v.number()),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index('by_agent', ['agentId']),

  // Telegram bot configuration per agent (sensitive)
  // Note: token is stored here; ensure access is restricted in queries.
  telegramConfigs: defineTable({
    agentId: v.id('agents'),
    botToken: v.string(),
    botUsername: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index('by_agent', ['agentId'])
  ,

  // Meta (Facebook Messenger / WhatsApp) configuration per agent
  // Stores verification token and access credentials
  metaConfigs: defineTable({
    agentId: v.id('agents'),
    // Platform can be 'messenger' or 'whatsapp'
    platform: v.union(v.literal('messenger'), v.literal('whatsapp')),
    // Verification token used for GET webhook verification
    verifyToken: v.string(),
    // App/page tokens
    accessToken: v.string(),
    // Optional: pageId for Messenger
    pageId: v.optional(v.string()),
    // Optional: phone number id for WhatsApp Cloud API
    whatsappPhoneNumberId: v.optional(v.string()),
    // Webhook URL we applied (optional)
    webhookUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index('by_agent', ['agentId'])
})
