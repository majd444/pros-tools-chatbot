import { query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Test query to verify authentication status
 * Returns the current user's identity if authenticated
 */
export const getAuthStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      console.log('No identity found - user is not authenticated');
      return { isAuthenticated: false };
    }

    console.log('User authenticated with identity:', {
      subject: identity.subject,
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });

    return {
      isAuthenticated: true,
      identity: {
        subject: identity.subject,
        name: identity.name,
        email: identity.email,
        tokenIdentifier: identity.tokenIdentifier,
      },
    };
  },
});

/**
 * Public test query that doesn't require authentication
 * Used to verify basic Convex connectivity
 */
export const ping = query({
  args: {},
  handler: async () => {
    console.log('Ping received at:', new Date().toISOString());
    return { 
      status: 'pong',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  },
});
