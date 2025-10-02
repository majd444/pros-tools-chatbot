"use client";

import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

export default function TestAuthPage() {
  const { isLoaded, userId, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
    [key: string]: unknown;
  }
  const [tokenInfo, setTokenInfo] = useState<TokenPayload | null>(null);
  
  // Test Convex query using the existing getAuthStatus
  const authStatus = useQuery(api.test.getAuthStatus);
  
  // Get environment variables for debugging
  const envVars = {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 
      ? `${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 10)}...` 
      : 'Not set',
  };
  
  useEffect(() => {
    async function loadToken() {
      if (isLoaded && userId) {
        try {
          console.log('Fetching JWT token with template: convex');
          const clerkToken = await getToken({ template: 'convex' });
          console.log('Received token:', clerkToken ? 'Token received' : 'No token');
          setToken(clerkToken);
          
          if (clerkToken) {
            try {
              // Safely decode the JWT token
              const payload = JSON.parse(atob(clerkToken.split('.')[1]));
              console.log('Decoded token payload:', payload);
              setTokenInfo({
                ...payload,
                exp: new Date(payload.exp * 1000).toISOString(),
                iat: new Date(payload.iat * 1000).toISOString(),
              });
            } catch (e) {
              console.error('Error decoding token:', e);
            }
          }
        } catch (error) {
          console.error('Error in loadToken:', error);
        }
      }
    }
    
    loadToken();
  }, [isLoaded, userId, getToken]);

  if (!isLoaded) {
    return <div className="p-8">Loading Clerk...</div>;
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(envVars, null, 2)}
        </pre>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Clerk Auth Status</h2>
        <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
          {JSON.stringify({
            isLoaded,
            isSignedIn: !!userId,
            userId,
          }, null, 2)}
        </pre>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">JWT Token</h2>
        <div className="mb-4">
          <div className="font-medium mb-2">Token (first 30 chars):</div>
          <div className="bg-gray-50 p-3 rounded break-all text-sm font-mono">
            {token ? `${token.substring(0, 30)}...` : 'No token available'}
          </div>
        </div>
        
        {tokenInfo ? (
          <div>
            <div className="font-medium mb-2">Token Payload:</div>
            <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(tokenInfo, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="text-gray-500 italic">No token information available</div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Convex Auth Status</h2>
        {authStatus ? (
          <div className={`p-4 rounded border ${authStatus.isAuthenticated ? 'bg-green-50' : 'bg-yellow-50'}`}>
            {authStatus.isAuthenticated ? (
              <>
                <p className="text-green-700 font-medium">✅ Successfully authenticated with Convex</p>
                <pre className="mt-2 bg-white p-3 rounded text-sm overflow-auto">
                  {JSON.stringify(authStatus.identity, null, 2)}
                </pre>
              </>
            ) : (
              <div className="text-yellow-700">
                <p className="font-medium">⚠️ Not authenticated with Convex</p>
                {authStatus.identity === null && (
                  <p className="mt-2 text-sm">The identity object is null. This usually means the JWT token wasn&apos;t properly set or validated.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-blue-50 text-blue-700 p-4 rounded border">
            {authStatus === undefined ? (
              <p>Loading Convex auth status...</p>
            ) : (
              <p>❌ Failed to connect to Convex. Check the browser console for errors.</p>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Troubleshooting Tips:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          <li>Check the browser console for any error messages</li>
          <li>Verify your Clerk JWT template is named &apos;convex&apos; and has the correct audience</li>
          <li>Ensure your environment variables are correctly set in your deployment</li>
          <li>Make sure your Convex deployment is running and accessible</li>
        </ul>
      </div>
    </div>
  );
}
