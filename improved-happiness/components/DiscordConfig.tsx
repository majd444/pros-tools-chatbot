"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bot, CheckCircle, ExternalLink, Loader2, Shield, XCircle } from "lucide-react"

interface DiscordConfigProps {
  agentId: Id<"agents">
}

export default function DiscordConfig({ agentId }: DiscordConfigProps) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState("")
  const [token, setToken] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validation, setValidation] = useState<{ ok: boolean; reason?: string } | null>(null)

  // Load existing config for this user/agent
  const myCfg = useQuery(api.discord.getMyBotConfig, { agentId })
  const save = useMutation(api.discord.saveBotConfig)

  useEffect(() => {
    if (myCfg) {
      setClientId(myCfg.clientId || "")
      // We never fetch the token value for security; just reflect hasToken status
    }
  }, [myCfg])

  // Validate Discord token shape very loosely (can't fully validate without hitting Discord API)
  const quickValidateToken = (val: string) => {
    // Discord bot tokens are opaque; basic length check to avoid obvious mistakes
    return val.trim().length > 20
  }

  const onTokenChange = (v: string) => {
    setToken(v)
    setValidation(null)
    if (v.trim().length > 0) {
      setIsValidating(true)
      // Lightweight async validator
      setTimeout(() => {
        const ok = quickValidateToken(v)
        setValidation({ ok, reason: ok ? undefined : "Token looks too short" })
        setIsValidating(false)
      }, 300)
    }
  }

  const inviteUrl = useMemo(() => {
    const id = clientId || "CLIENT_ID"
    return `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot%20applications.commands&permissions=3072`
  }, [clientId])

  const handleSave = async () => {
    if (!clientId.trim() || !token.trim()) {
      toast({ title: "Error", description: "Please enter both Client ID and Bot Token.", className: "bg-red-500 text-white" })
      return
    }
    if (validation && !validation.ok) {
      toast({ title: "Invalid token", description: validation.reason || "Please check your bot token.", className: "bg-red-500 text-white" })
      return
    }

    try {
      setIsSaving(true)
      await save({ agentId, clientId: clientId.trim(), token: token.trim() })
      setToken("")
      toast({ title: "Saved", description: "Discord credentials saved. Invite the bot to your server next.", className: "bg-green-500 text-white" })
      // Auto-open invite URL to streamline onboarding
      const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId.trim())}&scope=bot%20applications.commands&permissions=3072`
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Unknown error", className: "bg-red-500 text-white" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-500" />
          Discord Bot Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <div className="space-y-2 text-sm">
              <p><strong>Steps:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a Discord Application and a Bot in the Developer Portal.</li>
                <li>Copy the <strong>Client ID</strong> and <strong>Bot Token</strong>.</li>
                <li>Paste them below and click <strong>Save</strong>.</li>
                <li>Invite the bot to your server using the invite link.</li>
              </ol>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Your token is stored securely in Convex, and never exposed back to the browser.
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Discord Client ID</label>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234567890123456789" className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Bot Token</label>
            <div className="flex gap-2 items-center">
              <Input value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder="Paste your bot token" className="font-mono text-sm" />
              {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {validation && (
              <div className="flex items-center gap-2 text-sm">
                {validation.ok ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Looks valid</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">{validation.reason}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={myCfg?.hasToken ? "default" : "secondary"}>
            {myCfg?.hasToken ? "Token saved" : "No token"}
          </Badge>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={isSaving || !clientId.trim() || !token.trim()} className="flex items-center gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <Button variant="outline" asChild>
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Invite Bot
            </a>
          </Button>
        </div>

        {myCfg?.hasToken && (
          <Alert>
            <AlertDescription>
              <div className="text-sm">
                Credentials saved. If your bot process is deployed (e.g., Railway) and configured to read from Convex, it will come online automatically after you invite it to your server.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
