"use client"

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProvider } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
const hasClerkEnv = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Extend Clerk's AuthObject type
declare module '@clerk/nextjs' {
  interface AuthObject {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  }
}

// Create the Convex client with proper error handling
function createConvexClient() {
  // Always return a client instance, but don't initialize WebSocket during SSR
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error('Missing NEXT_PUBLIC_CONVEX_URL environment variable');
    return null;
  }
  
  try {
    if (typeof window !== 'undefined') {
      console.log('Initializing Convex client with URL:', convexUrl);
    }
    
    const options: {
      unsavedChangesWarning: boolean;
      verbose: boolean;
      webSocketConstructor?: typeof WebSocket;
    } = {
      unsavedChangesWarning: typeof window !== 'undefined',
      verbose: process.env.NODE_ENV === 'development',
    };
    
    // Only add webSocketConstructor if window is defined
    if (typeof window !== 'undefined') {
      options.webSocketConstructor = WebSocket;
    }
    
    return new ConvexReactClient(convexUrl, options);
  } catch (error) {
    console.error('Failed to initialize Convex client:', error);
    return null;
  }
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  
  // Initialize the Convex client with useMemo to prevent recreation
  const convexClient = useMemo(() => {
    const client = createConvexClient();
    if (!client) return null;
    return client;
  }, []);

  // One-time diagnostic: print Clerk JWT iss/aud to verify it matches Convex auth config
  // This helps resolve "No auth provider found" issues by confirming issuer/audience.
  const { getToken } = useAuth();
  useEffect(() => {
    let ran = false;
    if (typeof window === 'undefined') return;
    if (ran) return;
    ran = true;
    (async () => {
      try {
        const jwt = await getToken?.({ template: 'convex' });
        if (!jwt) {
          console.warn('🪪 [Clerk JWT] No token returned for template "convex"');
          return;
        }
        const payloadPart = jwt.split('.')[1];
        const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized));
        console.log('🪪 [Clerk JWT] iss:', decoded.iss, 'aud:', decoded.aud);
      } catch (e) {
        console.error('🪪 [Clerk JWT] Failed to get/parse token:', e);
      }
    })();
  }, [getToken]);

  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // Test the connection when the client is ready
  useEffect(() => {
    if (!convexClient) return;

    const testConnection = async () => {
      try {
        console.log('🔍 [Convex] Testing connection...');
        const testResult = await convexClient.query(api.testQueries.getAuthStatus);
        console.log('🔍 [Convex] Auth test result:', testResult);
        setAuthStatus(testResult.isAuthenticated ? 'authenticated' : 'unauthenticated');
      } catch (error) {
        console.error('❌ [Convex] Connection test failed:', error);
        setAuthStatus('unauthenticated');
      }
    };

    testConnection();
    
    // Test connection every 5 minutes
    const interval = setInterval(testConnection, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [convexClient]);
  
  // Show error if client initialization fails
  if (!convexClient) {
    // Use a client-side only component to show the error
    const ErrorDisplay = () => {
      const [mounted, setMounted] = useState(false);
      
      useEffect(() => {
        setMounted(true);
      }, []);
      
      if (!mounted) {
        return <div className="min-h-screen bg-background" />; // Empty div during SSR
      }
      
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <div className="text-center space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-destructive">
                Convex Initialization Error
              </h2>
              <p className="text-sm text-destructive/90 mt-2">
                Failed to initialize the Convex client. Please check the following:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-left">
                <li>Verify NEXT_PUBLIC_CONVEX_URL is set in your .env.local file</li>
                <li>Ensure the Convex deployment is running</li>
                <li>Check your network connection</li>
                <li>Verify Clerk authentication is properly configured</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    };
    
    return <ErrorDisplay />;
  }
  
  // Show loading state while checking auth
  const LoadingSpinner = () => {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
      setMounted(true);
    }, []);
    
    if (!mounted || authStatus !== 'loading') {
      return null;
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  };
  
  if (authStatus === 'loading') {
    return <LoadingSpinner />;
  }

  // When Clerk is not configured, fallback to plain ConvexProvider
  if (!hasClerkEnv) {
    return (
      <ConvexProvider client={convexClient}>
        {children}
      </ConvexProvider>
    );
  }

  return (
    <ConvexProviderWithClerk 
      client={convexClient}
      useAuth={useAuth}
    >
      {children}
    </ConvexProviderWithClerk>
  );
}

export default ConvexClientProvider;
