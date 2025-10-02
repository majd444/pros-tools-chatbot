import { query } from './_generated/server';

export const getAuthStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      isAuthenticated: !!identity,
      identity: identity ? {
        subject: identity.subject,
        name: identity.name,
        email: identity.email,
        token: identity.tokenIdentifier,
      } : null,
    };
  },
});
