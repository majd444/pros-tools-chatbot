import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/create-agent',
  '/agent(.*)',
]);

// Define public routes that don't require authentication
const isPublicRoute = (pathname: string) => {
  return [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    // Telegram webhook must be public (Telegram cannot provide your app session)
    '/api/telegram(.*)',
    '/api/webhooks(.*)',
    '/api/trpc(.*)',
    '/_next(.*)',
    '/favicon.ico',
    '/(assets|images|fonts|icons)(.*)',
  ].some(route => 
    pathname === route || 
    (route.endsWith('(.*)') && new RegExp(`^${route.replace('(.*)', '.*')}$`).test(pathname))
  );
};

const hasClerkEnv =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// If Clerk is not configured, bypass middleware to prevent 500s in production
export default (!hasClerkEnv
  ? (async (_req: Request) => {
      return NextResponse.next();
    })
  : clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  
  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Get the current session
  const session = await auth();
  
  // Handle protected routes
  if (isProtectedRoute(req)) {
    // Check if user is signed in
    const isSignedIn = session && 
                      'userId' in session && 
                      typeof session.userId === 'string' && 
                      session.userId.length > 0;
    
    // If user is not signed in, redirect to sign-in
    if (!isSignedIn) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Add Convex auth headers to the request
  const requestHeaders = new Headers(req.headers);
  
  // Type guard to check if session has getToken method
  type SessionWithToken = {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  };
  
  const hasGetToken = (s: unknown): s is SessionWithToken => {
    return !!s && typeof s === 'object' && 'getToken' in s && typeof (s as { getToken: unknown }).getToken === 'function';
  };

  if (hasGetToken(session)) {
    try {
      const token = await session.getToken({ template: 'convex' });
      if (token) {
        requestHeaders.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}));

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - files with extensions (e.g., .jpg, .css, .js)
    '/((?!_next/static|_next/image|favicon.ico|.*[.].*).*)',
  ],
};
