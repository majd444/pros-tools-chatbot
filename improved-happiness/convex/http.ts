import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import nacl from "tweetnacl";
import { createWidgetSession, widgetChat, saveUserInfo } from "./chatWidget";

function corsResponse(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    },
  });

}


// --- Discord Interactions (HTTPS) ---
// Verify incoming requests from Discord and respond to slash commands via HTTPS only.
// Requires Convex env var: DISCORD_PUBLIC_KEY
function hexToUint8Array(hex: string): Uint8Array {
  if (!hex || typeof hex !== 'string') return new Uint8Array();
  const clean = hex.toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

const discordInteractions = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();
  if (!publicKey) {
    return new Response(JSON.stringify({ error: 'Server not configured: DISCORD_PUBLIC_KEY missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Discord sends signature headers; we must verify over timestamp + raw body
  const signature = req.headers.get('x-signature-ed25519') || req.headers.get('X-Signature-Ed25519') || '';
  const timestamp = req.headers.get('x-signature-timestamp') || req.headers.get('X-Signature-Timestamp') || '';
  const bodyText = await req.text();

  try {
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + bodyText),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey)
    );
    if (!isValid) {
      return new Response('Bad request signature', { status: 401 });
    }
  } catch {
    return new Response('Bad request signature', { status: 401 });
  }

  // Body is now trusted; handle interaction
  type Interaction = { type?: number; data?: { name?: string; options?: unknown[] }; member?: { user?: { id?: string } } };
  let json: Interaction = {};
  try {
    json = JSON.parse(bodyText) as Interaction;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // PING
  if (json?.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // APPLICATION_COMMAND (type 2): route into sessions + AI using DB config.
  if (json?.type === 2) {
    try {
      type DiscordInteraction = {
        application_id?: string;
        data?: { name?: string; options?: Array<{ name?: string; value?: unknown }> };
        member?: { user?: { id?: string } };
        user?: { id?: string };
      };
      const di = json as DiscordInteraction;
      const appId = (di.application_id || '').trim();
      const command = di?.data?.name || 'ask';
      // Prefer slash option named 'q' or 'message', else fallback to command name
      const opts = Array.isArray(di?.data?.options) ? di!.data!.options! : [];
      const arg = (opts.find(o => (o?.name || '').toLowerCase() === 'q')?.value 
                || opts.find(o => (o?.name || '').toLowerCase() === 'message')?.value 
                || '').toString();
      const text = (arg || '').toString().trim() || `Hello from /${command}`;

      // Map application_id (clientId) -> agent via DB
      let agentIdStr = '';
      if (appId) {
        const cfg = await ctx.runQuery(api.discord.getByClientId, { clientId: appId });
        if (cfg && cfg.agentId) agentIdStr = cfg.agentId;
      }
      if (!agentIdStr) {
        const content = 'No Discord configuration found for this application. Please save Client ID and Token for an agent.';
        return new Response(
          JSON.stringify({ type: 4, data: { content } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Resolve user id (Discord snowflake)
      const discordUserId = (di?.member?.user?.id || di?.user?.id || '').toString();
      const userId = discordUserId ? `discord_${discordUserId}` : 'discord_unknown';
      const agentId = agentIdStr as unknown as Id<'agents'>;

      let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, { agentId, userId });
      if (!session) {
        const newId = await ctx.runMutation(api.sessions.createSession, { agentId, userId, metadata: { platform: 'discord' } });
        session = await ctx.runQuery(api.sessions.getSession, { id: newId });
      }

      await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'user', content: text, metadata: { source: 'discord' } });

      const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
      if (!agent) {
        const content = 'Agent not found.';
        return new Response(
          JSON.stringify({ type: 4, data: { content } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

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
      const ai = await generateAIResponseLocal({ messages, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

      await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'assistant', content: ai, metadata: { source: 'discord' } });

      return new Response(
        JSON.stringify({ type: 4, data: { content: ai } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('[discordInteractions] error:', e);
      return new Response(JSON.stringify({ type: 4, data: { content: 'Internal error' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Fallback ack
  return new Response(JSON.stringify({ type: 4, data: { content: 'OK' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});


const options = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    },
  });
});

const health = httpAction(async () => corsResponse({ status: 'ok' }));

// Simple OpenRouter-based generator with graceful fallback if no key configured
type ORChoiceMessage = { content?: string };
type ORResponse = { choices?: Array<{ message?: ORChoiceMessage }> };
async function generateAIResponseLocal(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature: number;
  model: string;
}): Promise<string> {
  const { messages, temperature, model } = params;
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return '...';
  const apiKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !openaiKey) return `You said: ${last.content}`;
  try {
    if (apiKey) {
      const orModel = process.env.OPENROUTER_MODEL || model || 'openrouter/auto';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Vaste Chatbot',
        },
        body: JSON.stringify({ model: orModel, temperature, messages }),
      });
      if (!res.ok) {
        const status = res.status;
        const t = await res.text().catch(() => '');
        console.error('[OpenRouter] non-OK', status, t?.slice(0, 200));
        // Attempt OpenAI fallback if available
        if (openaiKey) {
          try {
            const oa = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                temperature,
                messages,
              }),
            });
            if (oa.ok) {
              const data = await oa.json().catch(() => ({} as { choices?: Array<{ message?: ORChoiceMessage }> }));
              const content = data?.choices?.[0]?.message?.content;
              return content || 'Sorry, I had trouble generating a response.';
            }
          } catch {}
        }
        // Otherwise fallback to echo
        return `You said: ${last.content}`;
      }
      const data = (await res.json()) as ORResponse;
      const content = data?.choices?.[0]?.message?.content;
      return content || 'Sorry, I had trouble generating a response.';
    }

    // Fallback to OpenAI if OpenRouter is not configured
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          temperature,
          messages,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) return `You said: ${last.content}`;
        const t = await res.text().catch(() => '');
        throw new Error(`OpenAI error ${res.status}: ${t}`);
      }
      const data = await res.json().catch(() => ({} as { choices?: Array<{ message?: ORChoiceMessage }> }));
      const content = data?.choices?.[0]?.message?.content;
      return content || 'Sorry, I had trouble generating a response.';
    }
    // Safety net; TypeScript may not narrow above control flow across try-blocks
    return `You said: ${last.content}`;
  } catch (e) {
    console.error('[generateAIResponseLocal] error:', e);
    return 'Sorry, I had trouble generating a response.';
  }
}

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; is_bot: boolean; first_name: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; is_bot: boolean; first_name: string };
    message?: { message_id: number; chat: { id: number; type: string } };
    data?: string;
  };
};

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const telegramWebhook = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});

  try {
    const url = new URL(req.url);
    const agentIdStr = url.searchParams.get('agentId');
    if (!agentIdStr) return corsResponse({ error: 'Missing agentId' }, 400);

    const config = await ctx.runQuery(api.telegramConfigs.getByAgentId, { agentId: agentIdStr });
    if (!config?.botToken) return corsResponse({ error: 'Telegram config not found' }, 404);

    const update = (await req.json()) as TelegramUpdate;
    const userId = update.message?.from?.id
      ? `telegram_${update.message.from.id}`
      : update.callback_query?.from?.id
        ? `telegram_${update.callback_query.from.id}`
        : 'telegram_unknown';

    const agentId = agentIdStr as unknown as Id<'agents'>;
    let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, { agentId, userId });
    if (!session) {
      const newId = await ctx.runMutation(api.sessions.createSession, {
        agentId,
        userId,
        metadata: { platform: 'telegram' },
      });
      session = await ctx.runQuery(api.sessions.getSession, { id: newId });
    }

    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) return corsResponse({ error: 'Agent not found' }, 404);

    if (update.message?.text && !update.message.from.is_bot) {
      const text = update.message.text;
      const chatId = update.message.chat.id;

      await ctx.runMutation(api.sessions.createMessage, {
        sessionId: session!._id as Id<'chatSessions'>,
        role: 'user',
        content: text,
        metadata: { source: 'telegram' },
      });
      // Fetch recent history for context
      const history = await ctx.runQuery(api.sessions.getSessionMessages, { sessionId: session!._id as Id<'chatSessions'> });
      const mapped = history.map(m => ({ role: m.role as 'user'|'assistant'|'system', content: m.content }));

      // Build a knowledge section similar to other channels
      const knowledge = await ctx.runQuery(api.fineTuning.getPublicAgentKnowledge, { agentId: agent._id as unknown as string, limit: 20 });
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

      let ai = await generateAIResponseLocal({ messages, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });
      // If fallback echo is returned, provide a more helpful default reply
      if (/^You said:\s*/i.test(ai)) {
        ai = 'Thanks for your message! How can I help you today?';
      }

      await ctx.runMutation(api.sessions.createMessage, {
        sessionId: session!._id as Id<'chatSessions'>,
        role: 'assistant',
        content: ai,
        metadata: { source: 'telegram' },
      });

      await sendTelegramMessage(config.botToken, chatId, ai);
      return corsResponse({ ok: true });
    }

    return corsResponse({ ok: true });
  } catch {
    return corsResponse({ error: 'Internal error' }, 500);
  }
});

// Server-side validation of Telegram bot token to avoid client networking issues
// Body: { token: string }
const telegramValidate = httpAction(async (_ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await req.json().catch(() => ({} as { token?: string }));
    const token = (body.token || '').toString().trim();
    if (!token) return corsResponse({ ok: false, error: 'Missing token' }, 400);
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      // Pass through Telegram's error description if any
      let description = '';
      try {
        const j = JSON.parse(text) as { description?: string };
        description = j?.description || '';
      } catch {}
      return corsResponse({ ok: false, error: description || `Telegram getMe failed (${res.status})` }, 200);
    }
    let data: unknown = {};
    try { data = JSON.parse(text); } catch {}
    // Standardize payload
    return corsResponse({ ok: true, botInfo: (data as { result?: unknown })?.result || null });
  } catch (e) {
    console.error('[telegramValidate] error:', e);
    return corsResponse({ ok: false, error: 'Internal server error' }, 500);
  }
});


// Meta (Messenger / WhatsApp) webhook support
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

    // GET: webhook verification using stored verifyToken
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

    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) return corsResponse({ error: 'Agent not found' }, 404);

    for (const entry of body.entry) {
      // Messenger: entry[].messaging[]
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
          const ai = await generateAIResponseLocal({ messages, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

          await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'assistant', content: ai, metadata: { source: 'messenger' } });
          await sendMessengerMessage(cfg.accessToken, senderId, ai);
        }
      }

      // WhatsApp: entry[].changes[].value.messages[]
      if (isWhatsAppEntry(entry) && entry.changes && Array.isArray(entry.changes)) {
        for (const ch of entry.changes) {
          const value = ch?.value;
          const messages = value?.messages;
          const phoneNumberId = cfg.whatsappPhoneNumberId || value?.metadata?.phone_number_id;
          if (!messages || !Array.isArray(messages)) continue;
          for (const wm of messages) {
            const from = wm?.from as string | undefined; // user phone
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
            const ai = await generateAIResponseLocal({ messages: msgs, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

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

// Discord HTTPS relay: simple endpoint your bot runner can call
// Body: { agentId: string, userId: string, text: string }
const discordRelay = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await req.json().catch(() => ({} as { agentId?: string; userId?: string; text?: string }));
    const agentIdStr = (body.agentId || '').trim();
    const userId = (body.userId || '').trim();
    const text = (body.text || '').trim();
    if (!agentIdStr || !userId || !text) return corsResponse({ error: 'agentId, userId, text are required' }, 400);

    // Optional: ensure Discord config exists (authenticate the request implicitly)
    const backendKey = process.env.DISCORD_BACKEND_KEY || '';
    try {
      await ctx.runQuery(api.discord.getBotConfig, { agentId: agentIdStr as unknown as Id<'agents'>, key: backendKey });
    } catch {
      // If backend key missing or unauthorized, we still can proceed but it's recommended to set DISCORD_BACKEND_KEY
    }

    const agentId = agentIdStr as unknown as Id<'agents'>;
    let session = await ctx.runQuery(api.sessions.getLatestByAgentAndUser, { agentId, userId });
    if (!session) {
      const newId = await ctx.runMutation(api.sessions.createSession, { agentId, userId, metadata: { platform: 'discord' } });
      session = await ctx.runQuery(api.sessions.getSession, { id: newId });
    }

    await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'user', content: text, metadata: { source: 'discord' } });

    const agent = await ctx.runQuery(api.agents.getPublic, { id: agentId });
    if (!agent) return corsResponse({ error: 'Agent not found' }, 404);

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
    const ai = await generateAIResponseLocal({ messages, temperature: agent.temperature || 0.7, model: 'openai/gpt-4o-mini' });

    await ctx.runMutation(api.sessions.createMessage, { sessionId: session!._id as Id<'chatSessions'>, role: 'assistant', content: ai, metadata: { source: 'discord' } });
    return corsResponse({ ok: true, reply: ai });
  } catch (e) {
    console.error('[discordRelay] error:', e);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

const http = httpRouter();
http.route({ path: '/api/health', method: 'GET', handler: health });
http.route({ path: '/api/health', method: 'OPTIONS', handler: options });
http.route({ path: '/health', method: 'GET', handler: health });
http.route({ path: '/health', method: 'OPTIONS', handler: options });
// LLM/config health (booleans only; never return secrets)
const llmHealth = httpAction(async () => {
  const hasOpenRouter = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.length > 0;
  const hasOpenAI = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
  const hasDiscordBackendKey = typeof process.env.DISCORD_BACKEND_KEY === 'string' && process.env.DISCORD_BACKEND_KEY.length > 0;
  const hasDiscordPublicKey = typeof process.env.DISCORD_PUBLIC_KEY === 'string' && process.env.DISCORD_PUBLIC_KEY.length > 0;
  return corsResponse({ ok: true, hasOpenRouter, hasOpenAI, hasDiscordBackendKey, hasDiscordPublicKey });
});
http.route({ path: '/api/llm/health', method: 'GET', handler: llmHealth });
http.route({ path: '/api/llm/health', method: 'OPTIONS', handler: options });

// Widget chat endpoints (proxy-free access on convex.site)
http.route({ path: '/api/chat/widget/session', method: 'POST', handler: createWidgetSession });
http.route({ path: '/api/chat/widget/session', method: 'OPTIONS', handler: options });
http.route({ path: '/chat/widget/session', method: 'POST', handler: createWidgetSession });
http.route({ path: '/chat/widget/session', method: 'OPTIONS', handler: options });

http.route({ path: '/api/chat/widget/chat', method: 'POST', handler: widgetChat });
http.route({ path: '/api/chat/widget/chat', method: 'OPTIONS', handler: options });
http.route({ path: '/chat/widget/chat', method: 'POST', handler: widgetChat });
http.route({ path: '/chat/widget/chat', method: 'OPTIONS', handler: options });

// Persist pre-chat user info
http.route({ path: '/api/chat/widget/user', method: 'POST', handler: saveUserInfo });
http.route({ path: '/api/chat/widget/user', method: 'OPTIONS', handler: options });
http.route({ path: '/chat/widget/user', method: 'POST', handler: saveUserInfo });
http.route({ path: '/chat/widget/user', method: 'OPTIONS', handler: options });
http.route({ path: '/api/telegram/webhook', method: 'POST', handler: telegramWebhook });
http.route({ path: '/api/telegram/webhook', method: 'OPTIONS', handler: options });
http.route({ path: '/telegram/webhook', method: 'POST', handler: telegramWebhook });
http.route({ path: '/telegram/webhook', method: 'OPTIONS', handler: options });

// Telegram validation endpoint
http.route({ path: '/api/telegram/validate', method: 'POST', handler: telegramValidate });
http.route({ path: '/api/telegram/validate', method: 'OPTIONS', handler: options });

// Meta webhook routes (both /api and non-/api for convenience)
http.route({ path: '/api/meta/webhook', method: 'GET', handler: metaWebhook });
http.route({ path: '/api/meta/webhook', method: 'POST', handler: metaWebhook });
http.route({ path: '/api/meta/webhook', method: 'OPTIONS', handler: options });
http.route({ path: '/meta/webhook', method: 'GET', handler: metaWebhook });
http.route({ path: '/meta/webhook', method: 'POST', handler: metaWebhook });
http.route({ path: '/meta/webhook', method: 'OPTIONS', handler: options });

// Meta OAuth callback: exchanges code for access_token, then redirects back with token
const metaOauthCallback = httpAction(async (_ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const origin = `${url.protocol}//${url.host}`.replace(/\/$/, '');
    const redirectUri = `${origin}/api/meta/oauth/callback`;

    // Extract optional agentId and return URL from state (format: agent=<id>|return=<url>)
    let agentIdFromState = '';
    let returnUrl = process.env.NEXT_PUBLIC_SITE_URL || `${origin}`;
    if (state) {
      const parts = state.split('|');
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'agent') agentIdFromState = v || '';
        if (k === 'return') returnUrl = decodeURIComponent(v || returnUrl);
      }
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      return new Response('Server not configured for Meta OAuth', { status: 500 });
    }
    if (!code) {
      const to = new URL(returnUrl);
      to.searchParams.set('meta_error', 'missing_code');
      return Response.redirect(to.toString(), 302);
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`);
    const tokenBody = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenRes.ok || !tokenBody.access_token) {
      const to = new URL(returnUrl);
      to.searchParams.set('meta_error', 'exchange_failed');
      return Response.redirect(to.toString(), 302);
    }
    const accessToken = tokenBody.access_token as string;

    // Redirect back with token and agentId so the frontend can save it via authenticated mutation
    const to = new URL(returnUrl);
    to.searchParams.set('meta_access_token', accessToken);
    if (agentIdFromState) to.searchParams.set('agentId', agentIdFromState);
    return Response.redirect(to.toString(), 302);
  } catch (e) {
    console.error('[metaOauthCallback] error:', e);
    return new Response('Internal error', { status: 500 });
  }
});

http.route({ path: '/api/meta/oauth/callback', method: 'GET', handler: metaOauthCallback });
http.route({ path: '/api/meta/oauth/callback', method: 'OPTIONS', handler: options });
http.route({ path: '/meta/oauth/callback', method: 'GET', handler: metaOauthCallback });
http.route({ path: '/meta/oauth/callback', method: 'OPTIONS', handler: options });

// Simple WhatsApp test-send endpoint to verify config and send a message
const testWhatsAppSend = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await req.json().catch(() => ({} as { agentId?: string; to?: string; text?: string }));
    const agentId = (body.agentId || '').trim();
    const to = (body.to || '').trim();
    const text = (body.text || '').trim();
    if (!agentId || !to || !text) return corsResponse({ error: 'agentId, to, text are required' }, 400);

    const cfg = await ctx.runQuery(api.metaConfigs.getByAgentId, { agentId });
    if (!cfg?.accessToken) return corsResponse({ error: 'Meta config not found' }, 404);
    const phoneNumberId = cfg.whatsappPhoneNumberId;
    if (!phoneNumberId) return corsResponse({ error: 'Missing whatsappPhoneNumberId' }, 400);

    await sendWhatsAppMessage(cfg.accessToken, phoneNumberId, to, text);
    return corsResponse({ ok: true });
  } catch (e) {
    console.error('[testWhatsAppSend] error:', e);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

http.route({ path: '/api/meta/whatsapp/test-send', method: 'POST', handler: testWhatsAppSend });
http.route({ path: '/api/meta/whatsapp/test-send', method: 'OPTIONS', handler: options });

// Discord supervisor compatibility endpoint to list active configs via HTTP GET.
// Accepts backend key from query (?key=) or header 'X-Discord-Backend-Key'.
const discordActiveConfigs = httpAction(async (_ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  try {
    const url = new URL(req.url);
    const key = (url.searchParams.get('key')
      || req.headers.get('x-discord-backend-key')
      || req.headers.get('X-Discord-Backend-Key')
      || '').toString();
    if (!key) return corsResponse({ error: 'Missing key' }, 400);
    const list = await _ctx.runQuery(api.discord.listActiveConfigs, { key });
    return corsResponse(list);
  } catch (e) {
    console.error('[discordActiveConfigs] error:', e);
    return corsResponse({ error: 'Internal server error' }, 500);
  }
});

// Activate Telegram webhook pointing to Convex HTTP Actions origin
const activateTelegramWebhook = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return corsResponse({});
  try {
    const url = new URL(req.url);
    const body = req.method.toUpperCase() === 'POST' ? await req.json().catch(() => ({})) : {};
    const agentIdStr = (url.searchParams.get('agentId') || (body?.agentId as string) || '').trim();
    if (!agentIdStr) return corsResponse({ error: 'Missing agentId' }, 400);

    const config = await ctx.runQuery(api.telegramConfigs.getByAgentId, { agentId: agentIdStr });
    if (!config?.botToken) return corsResponse({ error: 'Telegram config not found' }, 404);

    const origin = `${url.protocol}//${url.host}`.replace(/\/$/, '');
    const webhookUrl = `${origin}/api/telegram/webhook?agentId=${agentIdStr}`;

    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    });
    const data: { ok?: boolean; description?: string } = await res.json().catch(() => ({} as { ok?: boolean; description?: string }));
    if (!res.ok || data?.ok !== true) {
      console.error('[http.activateTelegramWebhook] setWebhook failed:', data);
      return corsResponse({ error: 'Failed to set webhook', details: data }, 500);
    }

    await ctx.runMutation(api.telegramConfigs.updateWebhook, {
      agentId: agentIdStr as unknown as Id<'agents'>,
      webhookUrl,
      isActive: true,
    });

    return corsResponse({ ok: true, webhookUrl });
  } catch (e) {
    console.error('[http.activateTelegramWebhook] error:', e);
    return corsResponse({ error: 'Internal error' }, 500);
  }
});

http.route({ path: '/api/telegram/activate', method: 'POST', handler: activateTelegramWebhook });
http.route({ path: '/api/telegram/activate', method: 'OPTIONS', handler: options });

// Discord routes
http.route({ path: '/api/discord/respond', method: 'POST', handler: discordRelay });
http.route({ path: '/api/discord/respond', method: 'OPTIONS', handler: options });

// Discord Interactions endpoint
http.route({ path: '/api/discord/interactions', method: 'POST', handler: discordInteractions });
http.route({ path: '/api/discord/interactions', method: 'OPTIONS', handler: options });


// Discord supervisor compatibility routes (both with and without /api prefix)
http.route({ path: '/discord/bot/activeConfigs', method: 'GET', handler: discordActiveConfigs });
http.route({ path: '/discord/bot/activeConfigs', method: 'OPTIONS', handler: options });
http.route({ path: '/api/discord/bot/activeConfigs', method: 'GET', handler: discordActiveConfigs });
http.route({ path: '/api/discord/bot/activeConfigs', method: 'OPTIONS', handler: options });

export default http;
