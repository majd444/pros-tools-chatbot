"use client"

import { useState } from "react"
import { useSignIn, useSignUp, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import { MessageSquare, Mail, Lock, User, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

type OAuthProvider = 'google' | 'github' | 'facebook' | 'apple' // Add more providers as needed

export interface AuthModalProps {
  type: "login" | "signup" | null
  onClose: () => void
  onSwitchType: (type: "login" | "signup") => void
}

const AuthModal = ({ type, onClose, onSwitchType }: AuthModalProps) => {
  const { isLoaded: isUserLoaded } = useUser()
  const router = useRouter()
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn()
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    
    if (!email || !password || (type === "signup" && !name)) {
      setAuthError("Please fill in all fields")
      return
    }
    
    if (!signIn || !signUp || !setActive) {
      setAuthError("Authentication service is not available. Please try again later.")
      return
    }
    
    setIsLoading(true)
    
    try {
      if (type === "login") {
        // Sign in flow
        const result = await signIn.create({
          identifier: email,
          password,
        })
        
        if (result.status === 'complete') {
          if (setActive) {
            await setActive({ session: result.createdSessionId })
          }
          router.push("/dashboard")
          onClose()
        } else {
          console.error('Sign in failed:', result)
          setAuthError("Failed to sign in. Please check your credentials.")
        }
      } else {
        // Sign up flow
        const result = await signUp.create({
          emailAddress: email,
          password,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ') || ' ',
        })
        
        if (result.status === 'complete') {
          if (setActive) {
            await setActive({ session: result.createdSessionId })
          }
          router.push("/onboarding")
          onClose()
        } else {
          console.error('Sign up failed:', result)
          setAuthError("Failed to create account. Please try again.")
        }
      }
    } catch (err: unknown) {
      console.error('Error during authentication:', err)
      const error = err as { errors?: Array<{ message: string }> }
      setAuthError(error?.errors?.[0]?.message || "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: string) => {
    setAuthError("")
    
    try {
      const oauthProvider = provider.toLowerCase() as OAuthProvider
      
      if (type === 'login') {
        if (!signIn) {
          setAuthError("Sign in service is not available. Please try again later.")
          return
        }
        
        await signIn.authenticateWithRedirect({
          strategy: `oauth_${oauthProvider}` as const,
          redirectUrl: '/dashboard',
          redirectUrlComplete: '/dashboard',
        })
      } else {
        if (!signUp) {
          setAuthError("Sign up service is not available. Please try again later.")
          return
        }
        
        await signUp.authenticateWithRedirect({
          strategy: `oauth_${oauthProvider}` as const,
          redirectUrl: '/onboarding',
          redirectUrlComplete: '/onboarding',
        })
      }
    } catch (err) {
      console.error(`Error with ${provider} sign in:`, err)
      setAuthError(`Failed to sign in with ${provider}. Please try again.`)
    }
  }

  if (!type || !isUserLoaded || !isSignInLoaded || !isSignUpLoaded) return null

  return (
    <Dialog open={!!type} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold">
            {type === "login" ? "Welcome Back" : "Create Account"}
          </DialogTitle>
        </DialogHeader>
        
        {/* Social Login Buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full flex items-center gap-3 p-3"
            onClick={() => handleSocialLogin("google")}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        </div>

        {authError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={isLoading}
          >
            {isLoading ? "Please wait..." : (type === "login" ? "Log In" : "Create Account")}
          </Button>
        </form>
        
        <div className="text-center">
          <span className="text-gray-600">
            {type === "login" ? "Don't have an account?" : "Already have an account?"}
          </span>
          <Button
            variant="link"
            onClick={() => onSwitchType(type === "login" ? "signup" : "login")}
            className="p-0 ml-2 text-blue-600 hover:text-blue-700"
          >
            {type === "login" ? "Sign up" : "Log in"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthModal
