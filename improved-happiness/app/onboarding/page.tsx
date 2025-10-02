"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function OnboardingPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in')
    }
  }, [isLoaded, userId, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">Welcome to Your App</h1>
        <p className="text-center text-gray-600">
          Thank you for signing up! Let&apos;s get you started with your new account.
        </p>
        <div className="mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
