"use client"

import React, { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Send, 
  Trash2, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Bot,
  Loader2
} from "lucide-react"

interface TelegramConfigProps {
  agentId: Id<"agents">
}

interface TelegramBotInfo {
  id?: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
}

export default function TelegramConfig({ agentId }: TelegramConfigProps) {
  const { toast } = useToast()
  
  // State
  const [botToken, setBotToken] = useState("")
  const [botUsername, setBotUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    botInfo?: TelegramBotInfo
    error?: string
  } | null>(null)

  // Convex queries and mutations
  const telegramConfig = useQuery(api.telegramConfigs.get, { agentId })
  const saveTelegramConfig = useMutation(api.telegramConfigs.save)
  const removeTelegramConfig = useMutation(api.telegramConfigs.remove)

  // Load existing config
  useEffect(() => {
    if (telegramConfig) {
      setBotToken(telegramConfig.botToken || "")
      setBotUsername(telegramConfig.botUsername || "")
    }
  }, [telegramConfig])

  // Validate bot token with Telegram API
  const validateBotToken = async (rawToken: string) => {
    const token = rawToken.trim()
    if (!token) return

    setIsValidating(true)
    try {
      // Prefer HTTP Actions base (.site) when provided; fallback to Convex client URL
      const httpBase = (process.env.NEXT_PUBLIC_CONVEX_HTTP_URL || process.env.NEXT_PUBLIC_CONVEX_URL || '').replace(/\/$/, '')
      let ok = false
      let botInfo: TelegramBotInfo | undefined = undefined
      let errorMsg: string | undefined
      if (httpBase) {
        const resp = await fetch(`${httpBase}/api/telegram/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        if (resp.ok) {
          const data = await resp.json().catch(() => ({} as { ok?: boolean; botInfo?: TelegramBotInfo; error?: string }))
          ok = !!data?.ok
          botInfo = data?.botInfo
          errorMsg = data?.error
        } else {
          // Fallback to direct Telegram validate if server route not found yet
          const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
          const data = await response.json()
          ok = !!data?.ok
          botInfo = data?.result
          errorMsg = data?.description
        }
      } else {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        const data = await response.json()
        ok = !!data?.ok
        botInfo = data?.result
        errorMsg = data?.description
      }

      if (ok && botInfo) {
        setValidationResult({
          isValid: true,
          botInfo
        })
        if (botInfo?.username) setBotUsername(botInfo.username)
      } else {
        setValidationResult({
          isValid: false,
          error: errorMsg || "Invalid bot token"
        })
      }
    } catch (error) {
      console.error("Token validation error:", error)
      setValidationResult({
        isValid: false,
        error: "Failed to validate bot token"
      })
    } finally {
      setIsValidating(false)
    }
  }

  // Handle token input change
  const handleTokenChange = (value: string) => {
    setBotToken(value)
    setValidationResult(null)
    
    // Auto-validate if token looks complete
    if (value.trim().match(/^\d+:[A-Za-z0-9_-]{30,100}$/)) {
      validateBotToken(value.trim())
    }
  }

  // Save configuration
  const handleSave = async () => {
    if (!botToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter a bot token",
        className: "bg-red-500 text-white"
      })
      return
    }

    // Proceed even if validation hasn't succeeded client-side; we'll rely on server-side webhook set to determine validity

    try {
      setIsLoading(true)
      
      // Save the configuration
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
      await saveTelegramConfig({
        agentId,
        botToken: botToken.trim(),
        botUsername: botUsername.trim() || undefined,
        preferredBaseUrl: baseUrl || undefined,
      })

      // Explicitly call Convex HTTP activate endpoint to force webhook to Convex URL
      try {
        const httpBase = (process.env.NEXT_PUBLIC_CONVEX_HTTP_URL || process.env.NEXT_PUBLIC_CONVEX_URL || '').replace(/\/$/, '')
        if (httpBase) {
          const resp = await fetch(`${httpBase}/api/telegram/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId })
          })
          if (resp.ok) {
            const data = await resp.json()
            toast({
              title: "Activated",
              description: `Webhook set to Convex: ${data.webhookUrl || 'OK'}`,
              className: "bg-green-500 text-white"
            })
          } else {
            const text = await resp.text()
            toast({
              title: "Saved, but activation failed",
              description: text || 'Failed to activate Convex webhook',
              className: "bg-yellow-500 text-white"
            })
          }
        } else {
          toast({
            title: "Saved",
            description: "Set NEXT_PUBLIC_CONVEX_URL to auto-activate Convex webhook.",
            className: "bg-blue-500 text-white"
          })
        }
      } catch (e) {
        console.error('Convex activation error:', e)
        toast({
          title: "Saved, but activation errored",
          description: e instanceof Error ? e.message : 'Unknown error',
          className: "bg-yellow-500 text-white"
        })
      }

    } catch (error) {
      console.error("Error saving Telegram config:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        className: "bg-red-500 text-white"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete configuration
  const handleDeleteConfig = async () => {
    if (!telegramConfig) return

    const confirmed = window.confirm("Are you sure you want to delete this Telegram configuration?")
    if (!confirmed) return

    try {
      setIsLoading(true)

      // Remove webhook from Telegram
      if (telegramConfig.botToken) {
        await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/deleteWebhook`)
      }

      // Remove from database
      await removeTelegramConfig({ agentId })

      setBotToken("")
      setBotUsername("")
      setValidationResult(null)

      toast({
        title: "Success",
        description: "Telegram configuration deleted successfully",
        className: "bg-green-500 text-white"
      })

    } catch (error) {
      console.error("Error deleting Telegram config:", error)
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        className: "bg-red-500 text-white"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          Telegram Bot Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>How to get your bot token:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Message <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">@BotFather</a> on Telegram</li>
                <li>Send <code>/newbot</code> command</li>
                <li>Follow the instructions to create your bot</li>
                <li>Copy the bot token and paste it below</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* Bot Token Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bot Token</label>
          <div className="flex gap-2">
            <Input
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              className="font-mono text-sm"
            />
            {isValidating && <Loader2 className="h-4 w-4 animate-spin mt-3" />}
          </div>
          
          {/* Validation Result */}
          {validationResult && (
            <div className="flex items-center gap-2 text-sm">
              {validationResult.isValid ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">
                    {`Valid bot${validationResult.botInfo?.username ? `: @${validationResult.botInfo.username}` : ''}`}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">{validationResult.error}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bot Username (auto-filled) */}
        {botUsername && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Bot Username</label>
            <Input
              value={`@${botUsername}`}
              readOnly
              className="bg-gray-50"
            />
          </div>
        )}

        {/* Status */}
        {telegramConfig && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={telegramConfig.isActive ? "default" : "secondary"}>
              {telegramConfig.isActive ? "Active" : "Inactive"}
            </Badge>
            {telegramConfig.webhookUrl && (
              <a
                href={telegramConfig.webhookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm flex items-center gap-1"
              >
                Webhook URL <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={isLoading || !botToken.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {telegramConfig ? "Update Configuration" : "Save Configuration"}
          </Button>

          {telegramConfig && (
            <Button
              variant="destructive"
              onClick={handleDeleteConfig}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>

        {/* Test Bot Link */}
        {telegramConfig?.isActive && botUsername && (
          <Alert>
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Your bot is ready! Test it now:</span>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Open Bot
                  </a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
