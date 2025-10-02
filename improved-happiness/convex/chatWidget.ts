import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Types for the widget API
type AgentResponse = {
  id: Id<"agents">;
  name: string;
  welcomeMessage: string;
  systemPrompt: string;
  temperature: number;
  headerColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  profileImage?: string;
  // Pre-chat configuration (from agents.getPublic)
  collectUserInfo?: boolean;
  formFields?: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    value?: string;
  }>;
};

type SessionResponse = {
  sessionId: Id<"chatSessions">;
  agent: AgentResponse;
};

type ChatResponse = {
  reply: string;
  sessionId: Id<"chatSessions">;
};

// Utility function to handle CORS headers
function corsResponse(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

// Save pre-chat user info to the session metadata
export const saveUserInfo = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse({});
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: Id<'chatSessions'>;
      userInfo?: Record<string, string>;
    };
    const sessionId = body.sessionId;
    const userInfo = body.userInfo;
    if (!sessionId || !userInfo || typeof userInfo !== 'object') {
      return corsResponse({ error: 'sessionId and userInfo are required' }, 400);
    }
    await ctx.runMutation(api.sessions.updateSessionUserInfo, { sessionId, userInfo });
    return corsResponse({ ok: true });
  } catch (error) {
    console.error('[saveUserInfo] error:', error);
    return corsResponse({ error: 'Failed to save user info' }, 500);
  }
});

// Handle CORS preflight requests
const options = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
});

// AI Response Generation (OpenRouter)
type OpenRouterChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    }
  }>;
};
async function generateAIResponse(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature: number;
  model: string;
}): Promise<string> {
  const { messages, temperature, model } = params;
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Safe fallback if no key is configured
    return `AI (stub): ${lastMessage.content}`;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // Optional best practice headers for OpenRouter analytics
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Vaste Chatbot',
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Gracefully handle unauthorized/misconfigured key in production
      if (res.status === 401) {
        console.warn("OpenRouter unauthorized (401). Falling back to stub. Details:", text);
        return `AI (stub): ${lastMessage.content}`;
      }
      throw new Error(`OpenRouter error ${res.status}: ${text}`);
    }

    const data = await res.json() as OpenRouterChatCompletion;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in completion');
    return content;
  } catch (error) {
    console.error('OpenRouter request failed:', error);
    return 'Sorry, I had trouble generating a response.';
  }
}

// Create a new widget session
export const createWidgetSession = httpAction(async (ctx, req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse({});
  }

  try {
    const body = await req.json();
    let rawAgentId = body?.agentId as string | undefined;
    // Basic Convex Id format check: 32 lowercase alphanumerics
    const isValidConvexId = (s: string) => /^[a-z0-9]{32}$/.test(s);

    if (!rawAgentId || typeof rawAgentId !== 'string') {
      return corsResponse({ error: 'agentId is required' }, 400);
    }

    // If client accidentally sends a JSON-stringified string (wrapped in quotes), strip them
    if (rawAgentId.startsWith('"') && rawAgentId.endsWith('"')) {
      rawAgentId = rawAgentId.slice(1, -1);
    }

    if (!isValidConvexId(rawAgentId)) {
      return corsResponse({ error: 'Invalid agentId format' }, 400);
    }

    const agentId = rawAgentId as unknown as Id<"agents">;
    
    // Fetch agent details from the database (public)
    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    
    if (!agent) {
      return corsResponse({ error: 'Agent not found' }, 404);
    }

    // Create a new session
    const sessionId = await ctx.runMutation(api.sessions.createSession, {
      agentId,
      userId: 'widget-user', // Can be a guest ID for anonymous users
      metadata: {
        userAgent: req.headers.get('user-agent') || 'unknown',
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    // Prepare the response with agent theming and public pre-chat config
    const response: SessionResponse = {
      sessionId,
      agent: {
        id: agent._id,
        name: agent.name,
        welcomeMessage: agent.welcomeMessage,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        headerColor: agent.headerColor,
        accentColor: agent.accentColor,
        backgroundColor: agent.backgroundColor,
        profileImage: agent.profileImage,
        collectUserInfo: Boolean((agent as unknown as AgentResponse).collectUserInfo),
        formFields: Array.isArray((agent as unknown as AgentResponse).formFields)
          ? ((agent as unknown as AgentResponse).formFields as NonNullable<AgentResponse['formFields']>).map((f) => ({
              id: String(f.id),
              type: String(f.type || 'text'),
              label: String(f.label || ''),
              required: Boolean(f.required),
              value: typeof f.value === 'string' ? f.value : undefined,
            }))
          : undefined,
      },
    };

    return corsResponse(response);
  } catch (error) {
    console.error('Error creating widget session:', error);
    return corsResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Handle widget chat messages
export const widgetChat = httpAction(async (ctx, req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse({});
  }

  try {
    const body = await req.json();
    const src = req.headers.get('x-source') || 'unknown';
    const origin = req.headers.get('origin') || 'unknown';
    console.log(`[widgetChat] source=${src} origin=${origin}`);
    const { sessionId, agentId, message, history = [], user, userFields } = body as {
      sessionId: Id<'chatSessions'>;
      agentId: Id<'agents'>;
      message: string;
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      user?: Partial<{ name: string; email: string; phone: string; custom: string }>;
      userFields?: Record<string, string>;
    };

    if (!sessionId || !agentId || !message) {
      return corsResponse({ error: 'sessionId, agentId, and message are required' }, 400);
    }

    // Verify the session exists and belongs to this agent
    const session = await ctx.runQuery(api.sessions.getSession, { id: sessionId });
    if (!session) {
      return corsResponse({ error: 'Session not found' }, 404);
    }

    if (session.agentId !== agentId) {
      return corsResponse({ error: 'Session does not belong to this agent' }, 403);
    }

    // If user info was provided, persist it to session metadata before saving the message
    try {
      const merged: Record<string, string> = {};
      if (user && typeof user === 'object') {
        Object.entries(user).forEach(([k, v]) => {
          if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
        });
      }
      if (userFields && typeof userFields === 'object') {
        Object.entries(userFields).forEach(([k, v]) => {
          if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
        });
      }
      if (Object.keys(merged).length > 0) {
        await ctx.runMutation(api.sessions.updateSessionUserInfo, { sessionId, userInfo: merged });
      }
    } catch (e) {
      console.warn('[widgetChat] Failed to save user info on chat:', e);
    }

    // Get the agent (public)
    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) {
      return corsResponse({ error: 'Agent not found' }, 404);
    }

    // Fetch agent knowledge base entries (public)
    const knowledge = await ctx.runQuery(api.fineTuning.getPublicAgentKnowledge, {
      agentId: agentId as unknown as string,
      limit: 20,
    });
    const knowledgeText = (knowledge || [])
      .map((k: { input: unknown; output: unknown }) => {
        const input = typeof k.input === 'string' ? k.input : '';
        const output = typeof k.output === 'string' ? k.output : '';
        return `- ${input}: ${output}`;
      })
      .join('\n');
    const knowledgeSection = knowledgeText
      ? `\n\nKnowledge Base (most recent first):\n${knowledgeText}`
      : '';

    // Add the user message to the database
    await ctx.runMutation(api.sessions.createMessage, {
      sessionId,
      role: 'user',
      content: message,
      metadata: { source: src }
    });

    // Prepare messages for AI
    const messages = [
      { role: 'system' as const, content: `${agent.systemPrompt}${knowledgeSection}` },
      ...history,
      { role: 'user' as const, content: message }
    ];

    // Generate AI response
    const aiResponse = await generateAIResponse({
      messages,
      temperature: agent.temperature || 0.7,
      model: 'openai/gpt-4o-mini',
    });

    // Save assistant's response
    await ctx.runMutation(api.sessions.createMessage, {
      sessionId,
      role: 'assistant',
      content: aiResponse,
      metadata: { source: src }
    });

    // Update session last active
    await ctx.runMutation(api.sessions.updateSessionLastActive, { id: sessionId });

    // Return the response
    const response: ChatResponse = {
      reply: aiResponse,
      sessionId,
    };

    return corsResponse(response);
  } catch (error) {
    console.error('Error processing chat message:', error);
    return corsResponse({ 
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Build HTTP router
const http = httpRouter();
const health = httpAction(async () => corsResponse({ status: "ok" }));

http.route({ path: "/api/chat/widget/session", method: "POST", handler: createWidgetSession });
http.route({ path: "/api/chat/widget/session", method: "OPTIONS", handler: options });
http.route({ path: "/chat/widget/session", method: "POST", handler: createWidgetSession });
http.route({ path: "/chat/widget/session", method: "OPTIONS", handler: options });

http.route({ path: "/api/chat/widget/chat", method: "POST", handler: widgetChat });
http.route({ path: "/api/chat/widget/chat", method: "OPTIONS", handler: options });
http.route({ path: "/chat/widget/chat", method: "POST", handler: widgetChat });
http.route({ path: "/chat/widget/chat", method: "OPTIONS", handler: options });

// User info routes
http.route({ path: "/api/chat/widget/user", method: "POST", handler: saveUserInfo });
http.route({ path: "/api/chat/widget/user", method: "OPTIONS", handler: options });
http.route({ path: "/chat/widget/user", method: "POST", handler: saveUserInfo });
http.route({ path: "/chat/widget/user", method: "OPTIONS", handler: options });

// Telegram webhook handler in Convex to avoid platform auth issues
type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; is_bot: boolean; first_name: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; is_bot: boolean; first_name: string; username?: string };
    message?: { message_id: number; chat: { id: number; type: string } };
    data?: string;
  };
};

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('Telegram sendMessage failed:', err);
  }
}

const telegramWebhook = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse({});
  }

  try {
    const url = new URL(req.url);
    const agentIdStr = url.searchParams.get('agentId');
    if (!agentIdStr) {
      return corsResponse({ error: 'Missing agentId' }, 400);
    }
    const agentId = agentIdStr as unknown as Id<"agents">;

    const config = await ctx.runQuery(api.telegramConfigs.getByAgentId, { agentId: agentIdStr });
    if (!config?.botToken) {
      return corsResponse({ error: 'Telegram config not found' }, 404);
    }

    const update = (await req.json()) as TelegramUpdate;
    console.log('[telegramWebhook] update:', JSON.stringify(update));

    // Ensure a session for this Telegram user
    const userId = update.message?.from?.id
      ? `telegram_${update.message.from.id}`
      : update.callback_query?.from?.id
        ? `telegram_${update.callback_query.from.id}`
        : 'telegram_unknown';

    let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, {
      agentId,
      userId,
    });
    if (!session) {
      const newId = await ctx.runMutation(api.sessions.createSession, {
        agentId,
        userId,
        metadata: { platform: 'telegram' },
      });
      session = await ctx.runQuery(api.sessions.getSession, { id: newId });
    }

    // Get agent public config
    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) {
      return corsResponse({ error: 'Agent not found' }, 404);
    }

    // Handle text messages
    if (update.message?.text && !update.message.from.is_bot) {
      const text = update.message.text;
      const chatId = update.message.chat.id;

      await ctx.runMutation(api.sessions.createMessage, {
        sessionId: session!._id as Id<'chatSessions'>,
        role: 'user',
        content: text,
        metadata: { source: 'telegram' },
      });

      // Build history (last 20)
      const history = await ctx.runQuery(api.sessions.getSessionMessages, {
        sessionId: session!._id as Id<'chatSessions'>,
      });
      const mapped = history.map(m => ({ role: m.role as 'user'|'assistant'|'system', content: m.content }));

      const knowledge = await ctx.runQuery(api.fineTuning.getPublicAgentKnowledge, {
        agentId: agent._id as unknown as string,
        limit: 20,
      });
      const knowledgeText = (knowledge || []).map((k: { input: unknown; output: unknown }) => {
        const input = typeof k.input === 'string' ? k.input : '';
        const output = typeof k.output === 'string' ? k.output : '';
        return `- ${input}: ${output}`;
      }).join('\n');
      const knowledgeSection = knowledgeText ? `\n\nKnowledge Base (most recent first):\n${knowledgeText}` : '';

      const messages = [
        { role: 'system' as const, content: `${agent.systemPrompt}${knowledgeSection}` },
        ...mapped,
        { role: 'user' as const, content: text },
      ];

      const ai = await generateAIResponse({
        messages,
        temperature: agent.temperature || 0.7,
        model: 'openai/gpt-4o-mini',
      });

      await ctx.runMutation(api.sessions.createMessage, {
        sessionId: session!._id as Id<'chatSessions'>,
        role: 'assistant',
        content: ai,
        metadata: { source: 'telegram' },
      });
      await sendTelegramMessage(config.botToken, chatId, ai);
      return corsResponse({ ok: true });
    }

    // Handle callback queries
    if (update.callback_query?.data && update.callback_query.message?.chat.id) {
      const data = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;

      const ai = await generateAIResponse({
        messages: [
          { role: 'system' as const, content: agent.systemPrompt },
          { role: 'user' as const, content: data },
        ],
        temperature: agent.temperature || 0.7,
        model: 'openai/gpt-4o-mini',
      });
      await sendTelegramMessage(config.botToken, chatId, ai);
      return corsResponse({ ok: true });
    }

    return corsResponse({ ok: true });
  } catch (err) {
    console.error('[telegramWebhook] error:', err);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

http.route({ path: "/api/telegram/webhook", method: "POST", handler: telegramWebhook });
http.route({ path: "/api/telegram/webhook", method: "OPTIONS", handler: options });
http.route({ path: "/telegram/webhook", method: "POST", handler: telegramWebhook });
http.route({ path: "/telegram/webhook", method: "OPTIONS", handler: options });

// Meta (Facebook Messenger / WhatsApp) webhook
type MetaWebhookBody = {
  object?: string;
  entry?: unknown[];
};

type MessengerMessaging = {
  sender?: { id?: string };
  message?: { text?: string };
};
type MessengerEntry = {
  messaging?: MessengerMessaging[];
};

type WhatsAppMessage = {
  from?: string;
  text?: { body?: string };
};
type WhatsAppChange = {
  value?: { messages?: WhatsAppMessage[]; metadata?: { phone_number_id?: string } };
};
type WhatsAppEntry = {
  changes?: WhatsAppChange[];
};

function isMessengerEntry(e: unknown): e is MessengerEntry {
  return !!(e as { messaging?: unknown })?.messaging;
}
function isWhatsAppEntry(e: unknown): e is WhatsAppEntry {
  return !!(e as { changes?: unknown })?.changes;
}

async function sendMessengerMessage(accessToken: string, recipientId: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(accessToken)}` ,{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[sendMessengerMessage] Failed:', t);
  }
}

async function sendWhatsAppMessage(accessToken: string, phoneNumberId: string, to: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[sendWhatsAppMessage] Failed:', t);
  }
}

const metaWebhook = httpAction(async (ctx, req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    const url = new URL(req.url);
    const agentIdStr = url.searchParams.get('agentId');
    if (!agentIdStr) return corsResponse({ error: 'Missing agentId' }, 400);
    const agentId = agentIdStr as unknown as Id<'agents'>;

    // GET: webhook verification
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const cfg = await ctx.runQuery(api.metaConfigs.getByAgentId, { agentId: agentIdStr });
      if (!cfg) return new Response('Not found', { status: 404 });

      if (mode === 'subscribe' && token && token === cfg.verifyToken && challenge) {
        return new Response(challenge, { status: 200, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        }});
      }
      return new Response('Forbidden', { status: 403, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }});
    }

    // POST: message events
    const body = (await req.json().catch(() => ({}))) as MetaWebhookBody;
    if (!body || !Array.isArray(body.entry)) {
      return corsResponse({ ok: true });
    }

    const cfg = await ctx.runQuery(api.metaConfigs.getByAgentId, { agentId: agentIdStr });
    if (!cfg?.accessToken) return corsResponse({ error: 'Meta config not found' }, 404);

    // Ensure a chat session for this sender
    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) return corsResponse({ error: 'Agent not found' }, 404);

    for (const entry of body.entry) {
      // Messenger payload shape: entry[].messaging[]
      if (isMessengerEntry(entry) && entry.messaging && Array.isArray(entry.messaging)) {
        for (const m of entry.messaging) {
          const senderId = m?.sender?.id as string | undefined;
          const text = m?.message?.text as string | undefined;
          if (!senderId || !text) continue;

          const userId = `messenger_${senderId}`;
          let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, { agentId, userId });
          if (!session) {
            const newId = await ctx.runMutation(api.sessions.createSession, { agentId, userId, metadata: { platform: 'messenger' } });
            session = await ctx.runQuery(api.sessions.getSession, { id: newId });
          }

          await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'user', content: text, metadata: { source: 'messenger' } });

          const knowledge = await ctx.runQuery(api.fineTuning.getPublicAgentKnowledge, { agentId: agent._id as unknown as string, limit: 20 });
          const knowledgeText = (knowledge || []).map((k: { input: unknown; output: unknown }) => {
            const input = typeof k.input === 'string' ? k.input : '';
            const output = typeof k.output === 'string' ? k.output : '';
            return `- ${input}: ${output}`;
          }).join('\n');
          const knowledgeSection = knowledgeText ? `\n\nKnowledge Base (most recent first):\n${knowledgeText}` : '';

          const messages = [
            { role: 'system' as const, content: `${agent.systemPrompt}${knowledgeSection}` },
            { role: 'user' as const, content: text },
          ];
          const ai = await generateAIResponse({ messages, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

          await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'assistant', content: ai, metadata: { source: 'messenger' } });
          await sendMessengerMessage(cfg.accessToken, senderId, ai);
        }
      }

      // WhatsApp payload shape (Cloud API): entry[].changes[].value.messages[]
      if (isWhatsAppEntry(entry) && entry.changes && Array.isArray(entry.changes)) {
        for (const ch of entry.changes) {
          const value = ch?.value;
          const messages = value?.messages;
          const phoneNumberId = cfg.whatsappPhoneNumberId || value?.metadata?.phone_number_id;
          if (!messages || !Array.isArray(messages)) continue;
          for (const wm of messages) {
            const from = wm?.from as string | undefined; // user phone in international format
            const text = wm?.text?.body as string | undefined;
            if (!from || !text) continue;

            const userId = `whatsapp_${from}`;
            let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, { agentId, userId });
            if (!session) {
              const newId = await ctx.runMutation(api.sessions.createSession, { agentId, userId, metadata: { platform: 'whatsapp' } });
              session = await ctx.runQuery(api.sessions.getSession, { id: newId });
            }

            await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'user', content: text, metadata: { source: 'whatsapp' } });

            const knowledge = await ctx.runQuery(api.fineTuning.getPublicAgentKnowledge, { agentId: agent._id as unknown as string, limit: 20 });
            const knowledgeText = (knowledge || []).map((k: { input: unknown; output: unknown }) => {
              const input = typeof k.input === 'string' ? k.input : '';
              const output = typeof k.output === 'string' ? k.output : '';
              return `- ${input}: ${output}`;
            }).join('\n');
            const knowledgeSection = knowledgeText ? `\n\nKnowledge Base (most recent first):\n${knowledgeText}` : '';

            const msgs = [
              { role: 'system' as const, content: `${agent.systemPrompt}${knowledgeSection}` },
              { role: 'user' as const, content: text },
            ];
            const ai = await generateAIResponse({ messages: msgs, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

            await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'assistant', content: ai, metadata: { source: 'whatsapp' } });
            if (phoneNumberId) {
              await sendWhatsAppMessage(cfg.accessToken, phoneNumberId, from, ai);
            } else {
              console.error('[metaWebhook] Missing phoneNumberId for WhatsApp reply');
            }
          }
        }
      }
    }

    return corsResponse({ ok: true });
  } catch (e) {
    console.error('[metaWebhook] error:', e);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

http.route({ path: "/api/meta/webhook", method: "GET", handler: metaWebhook });
http.route({ path: "/api/meta/webhook", method: "POST", handler: metaWebhook });
http.route({ path: "/api/meta/webhook", method: "OPTIONS", handler: options });

// Activate Telegram webhook to Convex HTTP Actions base
const activateTelegramWebhook = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  try {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const body = method === 'POST' ? await req.json().catch(() => ({})) : {};
    const agentIdStr = (url.searchParams.get('agentId') || (body?.agentId as string) || '').trim();
    if (!agentIdStr) return corsResponse({ error: 'Missing agentId' }, 400);

    const config = await ctx.runQuery(api.telegramConfigs.getByAgentId, { agentId: agentIdStr });
    if (!config?.botToken) return corsResponse({ error: 'Telegram config not found' }, 404);

    // Build webhook using Convex HTTP Actions origin
    const origin = `${url.protocol}//${url.host}`.replace(/\/$/, '');
    const webhookUrl = `${origin}/api/telegram/webhook?agentId=${agentIdStr}`;

    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    });
    const data: { ok?: boolean; description?: string } = await res.json().catch(() => ({} as { ok?: boolean; description?: string }));
    if (!res.ok || data?.ok !== true) {
      // Surface a clearer error for invalid tokens from Telegram
      const desc = (data?.description || '').toLowerCase();
      if (res.status === 401 || desc.includes('unauthorized')) {
        console.error('[activateTelegramWebhook] Unauthorized: invalid Telegram bot token');
        return corsResponse({
          error: 'Unauthorized',
          message: 'Telegram rejected the request: your bot token appears to be invalid. Please regenerate the token with @BotFather (/token) and update it in the Telegram settings for this agent.',
          details: data,
        }, 401);
      }
      console.error('[activateTelegramWebhook] setWebhook failed:', data);
      return corsResponse({ error: 'Failed to set webhook', details: data }, 500);
    }

    // Persist
    // Use a mutation designed to update webhook; fallback patch via mutation if exists
    await ctx.runMutation(api.telegramConfigs.updateWebhook, {
      agentId: agentIdStr as unknown as Id<'agents'>,
      webhookUrl,
      isActive: true,
    });

    return corsResponse({ ok: true, webhookUrl });
  } catch (e) {
    console.error('[activateTelegramWebhook] error:', e);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

http.route({ path: "/api/telegram/activate", method: "POST", handler: activateTelegramWebhook });
http.route({ path: "/api/telegram/activate", method: "OPTIONS", handler: options });

http.route({ path: "/api/health", method: "GET", handler: health });
http.route({ path: "/api/health", method: "OPTIONS", handler: options });
http.route({ path: "/health", method: "GET", handler: health });
http.route({ path: "/health", method: "OPTIONS", handler: options });

export default http;
