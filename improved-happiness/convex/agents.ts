import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"

// Define types for form fields
interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  value?: string;
}

// Validation function for form fields
function validateFormFields(fields: FormField[]) {
  if (!Array.isArray(fields)) {
    throw new Error("Form fields must be an array")
  }

  for (const field of fields) {
    if (!field.id || typeof field.id !== 'string') {
      throw new Error("Each form field must have a valid ID")
    }
    if (!field.type || typeof field.type !== 'string') {
      throw new Error(`Field ${field.id} is missing a valid type`)
    }
    if (!field.label || typeof field.label !== 'string') {
      throw new Error(`Field ${field.id} is missing a valid label`)
    }
    if (typeof field.required !== 'boolean') {
      throw new Error(`Field ${field.id} must specify if it's required`)
    }
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }
    
    const userId = identity.subject;
    
    return await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }
    
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      return null;
    }
    
    // Only return the agent if the current user is the owner
    if (agent.userId !== identity.subject) {
      throw new ConvexError("Not authorized to access this agent");
    }
    
    return agent;
  },
});

export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.string(),
    welcomeMessage: v.string(),
    systemPrompt: v.string(),
    temperature: v.number(),
    headerColor: v.string(),
    accentColor: v.string(),
    backgroundColor: v.string(),
    profileImage: v.optional(v.union(v.string(), v.null())),
    collectUserInfo: v.boolean(),
    formFields: v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      required: v.boolean(),
      value: v.optional(v.string())
    })),
  },
  handler: async (ctx, args) => {
    try {
      console.log('Starting update mutation with args:', JSON.stringify(args, null, 2));
      
      // Validate authentication
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Not authenticated");
      }

      // Get the existing agent with error handling
      let agent;
      try {
        agent = await ctx.db.get(args.id);
      } catch (dbError) {
        console.error('Database error when getting agent:', dbError);
        throw new ConvexError("Failed to retrieve agent data");
      }
      
      if (!agent) {
        throw new ConvexError("Agent not found");
      }

      // Verify ownership
      if (agent.userId !== identity.subject) {
        console.warn(`User ${identity.subject} attempted to update agent ${args.id} owned by ${agent.userId}`);
        throw new ConvexError("Not authorized to update this agent");
      }

      // Validate form fields
      if (!Array.isArray(args.formFields)) {
        throw new ConvexError("Form fields must be an array");
      }

      // Prepare the update data with validation
      const updateData = {
        name: args.name?.trim() || 'Untitled Agent',
        welcomeMessage: args.welcomeMessage?.trim() || "",
        systemPrompt: args.systemPrompt?.trim() || "You are a helpful AI assistant.",
        temperature: typeof args.temperature === 'number' ? 
          Math.min(Math.max(args.temperature, 0), 1) : 0.7,
        headerColor: /^#[0-9A-F]{6}$/i.test(args.headerColor) ? args.headerColor : "#3B82F6",
        accentColor: /^#[0-9A-F]{6}$/i.test(args.accentColor) ? args.accentColor : "#00D4FF",
        backgroundColor: /^#[0-9A-F]{6}$/i.test(args.backgroundColor) ? args.backgroundColor : "#FFFFFF",
        // Persist profile image if provided; otherwise keep existing
        profileImage: (args.profileImage !== undefined) ? (args.profileImage || undefined) : agent.profileImage,
        collectUserInfo: Boolean(args.collectUserInfo),
        formFields: args.formFields.map((field, index) => ({
          id: field.id || `field-${index}-${Date.now()}`,
          type: ['text', 'email', 'number', 'tel', 'url'].includes(field.type) ? field.type : 'text',
          label: field.label?.trim() || `Field ${index + 1}`,
          required: Boolean(field.required),
          value: field.value?.trim() || ""
        })),
        updatedAt: Date.now(),
      };
      
      console.log('Attempting to update agent with validated data:', JSON.stringify(updateData, null, 2));

      // Attempt to update the agent
      try {
        await ctx.db.patch(args.id, updateData);
        const updatedAgent = await ctx.db.get(args.id);
        
        if (!updatedAgent) {
          throw new Error('Failed to retrieve updated agent');
        }
        
        console.log('Agent updated successfully:', updatedAgent);
        return updatedAgent;
        
      } catch (dbError) {
        console.error('Database update error:', dbError);
        throw new ConvexError("Failed to update agent in database");
      }
      
    } catch (error) {
      console.error('Error in update mutation:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw with more context if it's not already a ConvexError
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    welcomeMessage: v.string(),
    systemPrompt: v.string(),
    temperature: v.number(),
    headerColor: v.string(),
    accentColor: v.string(),
    backgroundColor: v.string(),
    profileImage: v.optional(v.union(v.string(), v.null())),
    collectUserInfo: v.boolean(),
    formFields: v.array(v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      required: v.boolean(),
      value: v.optional(v.string())
    })),
  },
  handler: async (ctx, args) => {
    console.log("[createAgent] Starting agent creation...")
    
    // Authentication check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      console.error("[createAgent] Unauthorized: No identity found")
      throw new ConvexError("Not authenticated. Please log in to create an agent.")
    }

    const userId = identity.subject
    console.log(`[createAgent] Creating agent for user: ${userId}`)

    // Input validation
    if (!args.name?.trim()) {
      const errorMsg = "Agent name is required"
      console.error(`[createAgent] Validation error: ${errorMsg}`)
      throw new ConvexError(errorMsg)
    }

    try {
      // Validate form fields if collectUserInfo is true
      if (args.collectUserInfo && args.formFields?.length > 0) {
        console.log("[createAgent] Validating form fields...")
        validateFormFields(args.formFields)
      }

      const now = Date.now()
      // Create agent data with proper types
      const agentData = {
        userId,
        name: args.name.trim(),
        welcomeMessage: args.welcomeMessage || `👋 Hi there! I'm ${args.name}. How can I help you today?`,
        systemPrompt: args.systemPrompt || "You are a helpful AI assistant.",
        temperature: Math.min(Math.max(args.temperature, 0), 1), // Ensure between 0 and 1
        headerColor: args.headerColor || "#3B82F6",
        accentColor: args.accentColor || "#00D4FF",
        backgroundColor: args.backgroundColor || "#FFFFFF",
        // Use undefined instead of null to match the expected type
        profileImage: args.profileImage || undefined,
        collectUserInfo: Boolean(args.collectUserInfo),
        formFields: args.formFields || [],
        createdAt: now,
        updatedAt: now,
      }

      console.log("[createAgent] Creating agent with data:", JSON.stringify(agentData, null, 2))
      
      const agentId = await ctx.db.insert("agents", agentData)
      
      console.log(`[createAgent] Successfully created agent with ID: ${agentId}`)
      return agentId
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      console.error(`[createAgent] Error creating agent: ${errorMessage}`, error)
      
      // Re-throw with user-friendly message
      throw new ConvexError(`Failed to create agent: ${errorMessage}`)
    }
  },
})

export const remove = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }

    // Ownership check
    if (agent.userId !== identity.subject) {
      throw new ConvexError("Not authorized to delete this agent");
    }

    await ctx.db.delete(args.id);
    return { success: true } as const;
  }
});

// Public agent fetch for chat widget (no auth required). Returns only safe fields.
export const getPublic = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return null;
    // Expose only the fields needed by the widget
    return {
      _id: agent._id,
      name: agent.name || "",
      welcomeMessage: agent.welcomeMessage || "",
      systemPrompt: agent.systemPrompt || "You are a helpful AI assistant.",
      temperature: typeof agent.temperature === "number" ? agent.temperature : 0.7,
      headerColor: agent.headerColor,
      accentColor: agent.accentColor,
      backgroundColor: agent.backgroundColor,
      profileImage: agent.profileImage,
      collectUserInfo: Boolean(agent.collectUserInfo),
      formFields: Array.isArray(agent.formFields)
        ? agent.formFields.map((f: any) => ({
            id: String(f.id),
            type: String(f.type || 'text'),
            label: String(f.label || ''),
            required: Boolean(f.required),
            value: typeof f.value === 'string' ? f.value : ''
          }))
        : [],
    };
  }
});
