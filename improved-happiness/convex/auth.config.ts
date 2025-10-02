import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

/**
 * Convex Authentication Configuration
 * 
 * This file configures the authentication providers for your Convex app.
 * It's used by Convex to authenticate users and validate JWT tokens from Clerk.
 * 
 * Required Environment Variables:
 * - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Your Clerk publishable key (from Clerk dashboard)
 * - CLERK_WEBHOOK_SECRET: Secret for verifying Clerk webhook events
 * 
 * @see https://docs.convex.dev/auth/clerk
 */

// Get Clerk configuration from environment variables
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  console.warn('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Authentication will not work in production.');
}

// Use the exact domain from your Clerk JWT token. Prefer env to avoid hardcoding.
// Example: CLERK_ISSUER_URL=https://direct-thrush-68.clerk.accounts.dev
const clerkDomain = process.env.CLERK_ISSUER_URL || 'https://direct-thrush-68.clerk.accounts.dev';
if (!process.env.CLERK_ISSUER_URL) {
  console.warn('[convex/auth.config] CLERK_ISSUER_URL not set; falling back to hardcoded Clerk domain:', clerkDomain);
}

// JWT configuration
// Must match the audience in your Clerk JWT template
const JWT_AUDIENCE = 'convex';

/**
 * Authentication configuration for Convex
 */
interface AuthConfig {
  providers: Array<{
    domain: string;
    applicationID: string;
  }>;
  clerk: {
    webhookSecret?: string;
    jwksUri: string;
    issuer: string;
    audience: string;
    // JWT verification options
    verifyOptions: {
      algorithms: string[];
      issuer: string;
      audience: string;
      clockTolerance: number; // seconds
    };
    // Map JWT claims to Convex user identity
    user: (token: TokenClaims) => {
      id: string;
      name?: string;
      email?: string;
      picture?: string;
      [key: string]: unknown;
    };
  };
  webhooks: Array<{
    path: string;
    handler: (req: NextRequest) => Promise<Response>;
  }>;
}

type TokenClaims = {
  sub?: string;
  name?: string;
  nickname?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
};

const authConfig: AuthConfig = {
  providers: [
    {
      domain: clerkDomain,
      applicationID: JWT_AUDIENCE,
    },
  ],
  // Configure Clerk as the authentication provider
  clerk: {
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
    // Use the JWKS URI from your Clerk dashboard
    jwksUri: `${clerkDomain}/.well-known/jwks.json`,
    // Make sure the issuer matches exactly what's in your JWT token
    // For Clerk, it's typically the domain with a trailing slash
    issuer: `${clerkDomain}/`,
    audience: JWT_AUDIENCE,
    verifyOptions: {
      algorithms: ['RS256'],
      issuer: `${clerkDomain}/`, // Include trailing slash to match JWT token
      audience: JWT_AUDIENCE,
      clockTolerance: 10, // 10 seconds leeway for clock skew
    },
    // Map JWT claims to Convex user identity
    user: (token: TokenClaims) => ({
      id: token.sub ?? '',
      name: (token.name as string | undefined) ?? (token.nickname as string | undefined) ?? '',
      email: (token.email as string | undefined) ?? '',
      picture: (token.picture as string | undefined) ?? '',
      // Include any additional claims you need
      ...token,
    })
  },
  // Webhook handlers
  webhooks: [
    {
      path: '/api/webhooks/clerk',
      async handler(req: NextRequest) {
        try {
          const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
          if (!WEBHOOK_SECRET) {
            console.error('CLERK_WEBHOOK_SECRET is not set');
            return new Response('Webhook secret not configured', { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Get the headers
          const headerPayload = await headers();
          const svix_id = headerPayload.get("svix-id");
          const svix_timestamp = headerPayload.get("svix-timestamp");
          const svix_signature = headerPayload.get("svix-signature");

          // If there are no headers, error out
          if (!svix_id || !svix_timestamp || !svix_signature) {
            console.error('Missing required Svix headers');
            return new Response(
              JSON.stringify({ error: 'Missing required headers' }), 
              { status: 400, headers: { 'Content-Type': 'application/json' }}
            );
          }

          // Get the raw body as text
          const payload = await req.text();
          if (!payload) {
            console.error('Empty payload received');
            return new Response(
              JSON.stringify({ error: 'Empty payload' }),
              { status: 400, headers: { 'Content-Type': 'application/json' }}
            );
          }

          // Verify the webhook signature
          const wh = new Webhook(WEBHOOK_SECRET);
          let evt: WebhookEvent;
          
          try {
            evt = wh.verify(payload, {
              "svix-id": svix_id,
              "svix-timestamp": svix_timestamp,
              "svix-signature": svix_signature,
            }) as unknown as WebhookEvent;
          } catch (err) {
            console.error('Error verifying webhook signature:', err);
            return new Response(
              JSON.stringify({ error: 'Invalid signature' }),
              { status: 400, headers: { 'Content-Type': 'application/json' }}
            );
          }

          // Handle different webhook event types
          const eventType = evt.type;
          console.log(`Processing Clerk webhook event: ${eventType}`);

          try {
            switch (eventType) {
              case 'user.created':
                await handleUserCreated(evt.data);
                break;
                
              case 'user.updated':
                await handleUserUpdated(evt.data);
                break;
                
              case 'user.deleted':
                await handleUserDeleted(evt.data);
                break;
                
              case 'session.created':
              case 'session.ended':
              case 'session.removed':
              case 'session.revoked':
                await handleSessionEvent(eventType, evt.data);
                break;
                
              default:
                console.log(`Unhandled event type: ${eventType}`);
            }

            return new Response(
              JSON.stringify({ received: true }), 
              { status: 200, headers: { 'Content-Type': 'application/json' }}
            );
            
          } catch (error) {
            console.error(`Error handling ${eventType} event:`, error);
            return new Response(
              JSON.stringify({ error: 'Error processing webhook' }),
              { status: 500, headers: { 'Content-Type': 'application/json' }}
            );
          }
          
        } catch (error) {
          console.error('Unexpected error in webhook handler:', error);
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' }}
          );
        }
      },
    },
  ]
};

async function handleUserCreated(userData: unknown) {
  const u = userData as { id?: string; email_addresses?: Array<{ email_address?: string }>; first_name?: string | null; last_name?: string | null };
  const { id, email_addresses, first_name, last_name } = u;
  const email = email_addresses?.[0]?.email_address;
  
  console.log('New user created:', { 
    userId: id, 
    email,
    name: `${first_name || ''} ${last_name || ''}`.trim()
  });
  
  // TODO: Add your user creation logic here
  // Example: Create user in your database
  // await db.insert(users).values({
  //   id,
  //   email,
  //   name: `${first_name || ''} ${last_name || ''}`.trim(),
  //   createdAt: new Date(),
  //   updatedAt: new Date()
  // });
}

async function handleUserUpdated(userData: unknown) {
  const u = userData as { id?: string; email_addresses?: Array<{ email_address?: string }>; first_name?: string | null; last_name?: string | null };
  const { id, email_addresses, first_name, last_name } = u;
  const email = email_addresses?.[0]?.email_address;
  
  console.log('User updated:', { 
    userId: id, 
    email,
    name: `${first_name || ''} ${last_name || ''}`.trim()
  });
  
  // TODO: Add your user update logic here
  // Example: Update user in your database
  // await db.update(users)
  //   .set({
  //     email,
  //     name: `${first_name || ''} ${last_name || ''}`.trim(),
  //     updatedAt: new Date()
  //   })
  //   .where(eq(users.id, id));
}

async function handleUserDeleted(userData: unknown) {
  const u = userData as { id?: string };
  const { id } = u;
  
  console.log('User deleted:', { userId: id });
  
  // TODO: Add your user deletion logic here
  // Example: Soft delete user in your database
  // await db.update(users)
  //   .set({ 
  //     deletedAt: new Date(),
  //     email: `deleted-${id}@deleted.user`
  //   })
  //   .where(eq(users.id, id));
}

async function handleSessionEvent(eventType: string, sessionData: unknown) {
  const s = sessionData as { id?: string; user_id?: string; status?: string };
  const { id, user_id: userId, status } = s;
  
  console.log(`Session ${eventType}:`, { 
    sessionId: id, 
    userId,
    status
  });
  
  // TODO: Add your session handling logic here
  // Example: Track user sessions in your database
  // if (eventType === 'session.created') {
  //   await db.insert(sessions).values({
  //     id,
  //     userId,
  //     status,
  //     lastActiveAt: new Date()
  //   });
  // } else {
  //   await db.update(sessions)
  //     .set({ status, endedAt: new Date() })
  //     .where(eq(sessions.id, id));
  // }
}

export default authConfig;
