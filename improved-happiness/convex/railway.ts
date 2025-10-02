import { action } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { api } from "./_generated/api"

// Provisions a new Railway service for a given agent's Discord bot.
// This action expects the following environment variables to be set on Convex:
// - RAILWAY_API_TOKEN: Personal access token for Railway API
// - RAILWAY_PROJECT_ID: The Railway project ID where services should be created
// - RAILWAY_TEMPLATE_SERVICE_ID (optional): A template service to clone from (discord-bot)
// If TEMPLATE_SERVICE_ID is not provided, we will attempt to create a blank service and set variables only.
// Note: This is a best-effort starter. Railway's API is GraphQL and subject to change.
// You may need to adjust the GraphQL mutations to match your account/project.

export const provisionDiscordBot = action({
  args: {
    agentId: v.id("agents"),
    clientId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { agentId, clientId, token }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError("Not authenticated")

    // Ensure the caller owns the agent using a server-side query
    const agent = await ctx.runQuery(api.agents.get, { id: agentId }).catch((e) => {
      // agents.get throws ConvexError on not authorized; map to a clean error
      throw new ConvexError(e instanceof Error ? e.message : "Failed to verify agent ownership")
    })
    if (!agent) throw new ConvexError("Agent not found")
    if (agent.userId !== identity.subject) throw new ConvexError("Not authorized")

    const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN
    const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID
    const RAILWAY_TEMPLATE_SERVICE_ID = process.env.RAILWAY_TEMPLATE_SERVICE_ID

    if (!RAILWAY_API_TOKEN || !RAILWAY_PROJECT_ID) {
      throw new ConvexError("Server missing Railway credentials. Please set RAILWAY_API_TOKEN and RAILWAY_PROJECT_ID in Convex environment.")
    }

    const endpoint = "https://backboard.railway.app/graphql"

    async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
        },
        body: JSON.stringify({ query, variables }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new ConvexError(`Railway API HTTP ${res.status}: ${text}`)
      }
      const json = await res.json()
      if (json.errors?.length) {
        throw new ConvexError(`Railway API error: ${JSON.stringify(json.errors)}`)
      }
      return json.data as T
    }

    // 1) Create a new service (optionally by forking from template)
    const serviceName = `discord-bot-${String(agentId).slice(0, 6)}`

    let newServiceId: string | null = null

    if (RAILWAY_TEMPLATE_SERVICE_ID) {
      // Attempt to fork from a template service in the same project
      const forkMutation = `
        mutation ServiceFork($projectId: String!, $serviceId: String!, $name: String!) {
          serviceFork(projectId: $projectId, serviceId: $serviceId, name: $name) { id }
        }
      `
      try {
        const fork = await gql<{ serviceFork: { id: string } }>(forkMutation, {
          projectId: RAILWAY_PROJECT_ID,
          serviceId: RAILWAY_TEMPLATE_SERVICE_ID,
          name: serviceName,
        })
        newServiceId = fork.serviceFork.id
      } catch (e) {
        // Fall back to creating a blank service if fork fails
        console.log("[railway] fork failed, falling back to serviceCreate", e)
      }
    }

    if (!newServiceId) {
      const createMutation = `
        mutation ServiceCreate($projectId: String!, $name: String!) {
          serviceCreate(projectId: $projectId, name: $name) { id }
        }
      `
      const created = await gql<{ serviceCreate: { id: string } }>(createMutation, {
        projectId: RAILWAY_PROJECT_ID,
        name: serviceName,
      })
      newServiceId = created.serviceCreate.id
    }

    // 2) Set service variables (per-agent)
    const vars = [
      { name: "AGENT_ID", value: String(agentId) },
      { name: "DISCORD_CLIENT_ID", value: clientId },
      { name: "DISCORD_TOKEN", value: token },
      // Shared variables available at project or service level; we set them explicitly to be safe
      { name: "CONVEX_URL", value: process.env.CONVEX_URL || "" },
      { name: "DISCORD_BACKEND_KEY", value: process.env.DISCORD_BACKEND_KEY || "" },
      { name: "NODE_ENV", value: process.env.NODE_ENV || "production" },
    ]

    const setVarMutation = `
      mutation VariablesSet($serviceId: String!, $variables: [VariableInput!]!) {
        variablesSet(serviceId: $serviceId, variables: $variables) { id }
      }
    `

    await gql<{ variablesSet: { id: string } }>(setVarMutation, {
      serviceId: newServiceId,
      variables: vars.map(v => ({ key: v.name, value: v.value })),
    })

    // 3) Trigger a deployment (assumes the template has source configured)
    const deployMutation = `
      mutation DeploymentTrigger($serviceId: String!) {
        deploymentTrigger(serviceId: $serviceId) { id }
      }
    `
    try {
      await gql<{ deploymentTrigger: { id: string } }>(deployMutation, { serviceId: newServiceId })
    } catch (e) {
      // Not all accounts/projects allow triggering this way; the service may auto-deploy on variable changes if template is configured.
      console.log("[railway] deploymentTrigger failed or unavailable", e)
    }

    return { success: true as const, serviceId: newServiceId, name: serviceName }
  },
})
