import { NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

// Lazily create Convex client at runtime to avoid build-time failures when env vars aren't present in CI
function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set. Please add it to your environment (e.g., https://YOUR-DEPLOYMENT.convex.cloud).')
  }
  return new ConvexHttpClient(convexUrl)
}

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      type: string
    }
    date: number
    text?: string
  }
  callback_query?: {
    id: string
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    message?: {
      message_id: number
      chat: {
        id: number
        type: string
      }
    }
    data?: string
  }
}

// Send message to Telegram user
async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Failed to send Telegram message:', error)
    throw new Error('Failed to send message')
  }

  return response.json()
}

// Generate AI response using the agent
async function generateResponse(agentId: string, userMessage: string, userId: string, origin: string) {
  try {
    const convex = getConvexClient()
    // Get agent details
    const agent = await convex.query(api.agents.getPublic, { id: agentId as Id<"agents"> })
    if (!agent) {
      return "Sorry, I couldn't find the agent configuration."
    }

    // Create or get chat session
    let sessionId: string
    try {
      const existing = await convex.query(api.sessions.getLatestByAgentAndUser, {
        agentId: agentId as Id<"agents">,
        userId,
      })

      if (existing?._id) {
        sessionId = existing._id as unknown as string
      } else {
        sessionId = await convex.mutation(api.sessions.createSession, {
          agentId: agentId as Id<"agents">,
          userId,
          metadata: { platform: 'telegram' },
        })
      }
    } catch (error) {
      console.error('Error managing chat session:', error)
      return "Sorry, I'm having trouble starting our conversation."
    }

    // Save user message
    await convex.mutation(api.chat.sendMessage, {
      sessionId: sessionId as Id<"chatSessions">,
      content: userMessage,
      role: "user" as const,
    })

    // Generate AI response via Convex HTTP widget endpoint (handles persistence & response)
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      console.error('Missing NEXT_PUBLIC_CONVEX_URL env; cannot generate AI response')
      return 'Sorry, my server is missing configuration.'
    }
    const response = await fetch(`${convexUrl}/api/chat/widget/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Source': 'telegram' },
      body: JSON.stringify({
        message: userMessage,
        agentId: agentId,
        sessionId: sessionId,
        history: []
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate AI response')
    }

    const aiResponse = await response.json()
    const reply = aiResponse.reply || aiResponse.message || ""
    return reply

  } catch (error) {
    console.error('Error generating response:', error)
    return "Sorry, I'm having trouble processing your message right now. Please try again later."
  }
}

export async function POST(request: Request) {
  try {
    const convex = getConvexClient()
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.host}`
    // Derive agentId from the URL path: /api/telegram/webhook/[agentId]
    const parts = url.pathname.split("/")
    const agentIdFromPath = parts[parts.length - 1]
    if (!agentIdFromPath) {
      return NextResponse.json({ error: "Missing agentId in path" }, { status: 400 })
    }
    const agentId: string = agentIdFromPath
    
    // Get Telegram configuration for this agent
    const telegramConfig = await convex.query(api.telegramConfigs.getByAgentId, {
      agentId
    })

    if (!telegramConfig) {
      return NextResponse.json({ error: "Telegram bot not configured" }, { status: 404 })
    }
    if (!telegramConfig.botToken) {
      console.error('Telegram config missing botToken for agent', agentId)
      return NextResponse.json({ error: "Bot token missing" }, { status: 500 })
    }

    // Parse the webhook update
    const update: TelegramUpdate = await request.json()
    console.log('Telegram webhook received:', JSON.stringify(update))
    
    // Handle text messages
    if (update.message?.text && !update.message.from.is_bot) {
      const message = update.message
      const userMessage = message.text!
      const chatId = message.chat.id
      const userId = `telegram_${message.from.id}`

      console.log(`Received message from ${message.from.first_name}: ${userMessage}`)

      // Generate AI response
      const aiResponse = await generateResponse(agentId, userMessage, userId, origin)

      // Send response back to Telegram
      await sendTelegramMessage(telegramConfig.botToken as string, chatId, aiResponse)

      return NextResponse.json({ ok: true })
    }

    // Handle callback queries (inline keyboard buttons)
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const userId = `telegram_${callbackQuery.from.id}`

      if (chatId && callbackQuery.data) {
        // Generate response based on callback data
        const aiResponse = await generateResponse(agentId, callbackQuery.data!, userId, origin)
        
        // Send response
        await sendTelegramMessage(telegramConfig.botToken as string, chatId, aiResponse)

        // Answer the callback query to remove loading state
        await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "Processing..."
          })
        })
      }

      return NextResponse.json({ ok: true })
    }

    // Ignore other types of updates
    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    )
  }
}
