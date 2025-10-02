'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'
import ConvexClientProvider from '@/components/providers/convex-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const hasClerkEnv = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  
  if (!hasClerkEnv) {
    return (
      <ConvexClientProvider>
        {children}
      </ConvexClientProvider>
    )
  }

  return (
    <ClerkProvider 
      appearance={{
        baseTheme: theme === 'dark' ? dark : undefined,
        elements: {
          formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
          footerActionLink: 'text-blue-600 hover:text-blue-700',
        },
      }}
    >
      <ConvexClientProvider>
        {children}
      </ConvexClientProvider>
    </ClerkProvider>
  )
}
