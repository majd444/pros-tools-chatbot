"use client"

import { useState } from "react"
import Head from "next/head"
import { SignedIn, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import Header from "@/components/Header"
import Hero from "@/components/Hero"
import Features from "@/components/Features"
import Footer from "@/components/Footer"
import AuthModal from "@/components/AuthModal"

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState<"login" | "signup" | null>(null)

  const handleOpenAuth = (type: "login" | "signup") => {
    setAuthModalOpen(type)
  }

  const handleCloseAuth = () => {
    setAuthModalOpen(null)
  }

  const handleSwitchAuth = (type: "login" | "signup") => {
    setAuthModalOpen(type)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Head>
        <title>proaichats - AI Agents for Your Business</title>
        <meta name="description" content="Build, customize, and deploy AI agents for your business needs without writing a single line of code." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header onOpenAuth={handleOpenAuth} />
      
      <main className="flex-grow">
        <div className="flex justify-end p-4">
          <SignedIn>
            <div className="flex items-center gap-4">
              <UserButton afterSignOutUrl="/" />
              <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
          </SignedIn>
        </div>
        <Hero onOpenAuth={handleOpenAuth} />
        <Features />
      </main>
      
      <Footer />
      
      <AuthModal 
        type={authModalOpen} 
        onClose={handleCloseAuth} 
        onSwitchType={handleSwitchAuth} 
      />
    </div>
  )
}
