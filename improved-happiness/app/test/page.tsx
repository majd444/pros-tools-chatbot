'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/nextjs';

export default function TestPage() {
  const authStatus = useQuery(api.test.getAuthStatus);
  const { isSignedIn, userId } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
        
        <div className="space-y-4">
          <div className="p-4 border rounded">
            <h2 className="font-semibold mb-2">Clerk Auth Status</h2>
            <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify({
                isSignedIn,
                userId,
              }, null, 2)}
            </pre>
          </div>

          <div className="p-4 border rounded">
            <h2 className="font-semibold mb-2">Convex Auth Status</h2>
            {authStatus ? (
              <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(authStatus, null, 2)}
              </pre>
            ) : (
              <p>Loading Convex auth status...</p>
            )}
          </div>

          <div className="p-4 border rounded">
            <h2 className="font-semibold mb-2">Environment Variables</h2>
            <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify({
                NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ? 'Set' : 'Not Set',
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set' : 'Not Set',
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
