"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Loader2, Bot, ExternalLink, Save, Trash2, Info, Copy, Rocket, FlaskConical, Send, KeyRound } from "lucide-react"

interface MetaConfigProps {
  agentId: Id<"agents">
}

type Platform = "messenger" | "whatsapp"

export default function MetaConfig({ agentId }: MetaConfigProps) {
  const { toast } = useToast()

  // Access generated Convex functions with a shim so the app compiles before running convex codegen
  const metaApi = (api as any).metaConfigs || {}
  const metaGet = metaApi.get as any | undefined
  const metaSave = metaApi.save as any | undefined
  const metaRemove = metaApi.remove as any | undefined

  // Fallback function refs to keep hook order stable
  const fallbackGet = (api as any).agents?.get
  const fallbackSave = (api as any).telegramConfigs?.save
  const fallbackRemove = (api as any).telegramConfigs?.remove

  // Avoid calling server until the Convex environment is confirmed updated
  const metaConfig = useQuery((metaGet || fallbackGet) as any, "skip")
  const saveMetaConfig = useMutation((metaSave || fallbackSave) as any)
  const removeMetaConfig = useMutation((metaRemove || fallbackRemove) as any)

  const [platform, setPlatform] = useState<Platform>("messenger")
  const [verifyToken, setVerifyToken] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [pageId, setPageId] = useState("")
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testText, setTestText] = useState("Hello from your WhatsApp bot 👋")

  useEffect(() => {
    if (metaConfig) {
      setPlatform(metaConfig.platform as Platform)
      setVerifyToken(metaConfig.verifyToken || "")
      setAccessToken(metaConfig.accessToken || "")
      setPageId(metaConfig.pageId || "")
      setWhatsappPhoneNumberId(metaConfig.whatsappPhoneNumberId || "")
    }
  }, [metaConfig])

  const convexUrl = (process.env.NEXT_PUBLIC_CONVEX_URL || "").replace(/\/$/, "")
  const webhookUrl = useMemo(() => {
    if (!convexUrl) return ""
    return `${convexUrl}/api/meta/webhook?agentId=${agentId}`
  }, [agentId, convexUrl])

  const handleCopyWebhook = async () => {
    try {
      if (!webhookUrl) return
      await navigator.clipboard.writeText(webhookUrl)
      toast({ title: "Copied", description: "Webhook URL copied to clipboard", className: "bg-green-500 text-white" })
    } catch (e) {
      toast({ title: "Copy failed", description: "Could not copy to clipboard", className: "bg-red-500 text-white" })
    }
  }

  const handleGenerateVerifyToken = () => {
    const rand = Math.random().toString(36).slice(2, 10)
    const token = `verify_${rand}`
    setVerifyToken(token)
    toast({ title: "Verify Token generated", description: token, className: "bg-blue-600 text-white" })
  }

  const handleQuickConnectWhatsApp = () => {
    setPlatform("whatsapp")
    toast({ title: "WhatsApp selected", description: "Fill Access Token and Phone Number ID, then Save.", className: "bg-slate-800 text-white" })
  }

  const handleTestSend = async () => {
    if (!testTo.trim()) {
      toast({ title: "Missing recipient", description: "Enter the WhatsApp number in international format.", className: "bg-red-500 text-white" })
      return
    }
    if (!convexUrl) {
      toast({ title: "Missing Convex URL", description: "Set NEXT_PUBLIC_CONVEX_URL in .env.local", className: "bg-red-500 text-white" })
      return
    }
    try {
      setIsSending(true)
      const res = await fetch(`${convexUrl}/api/meta/whatsapp/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, to: testTo.trim(), text: testText.trim() })
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || `HTTP ${res.status}`)
      }
      toast({ title: "Sent", description: "Test message sent via WhatsApp Cloud API", className: "bg-green-500 text-white" })
    } catch (e) {
      console.error(e)
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Unknown error", className: "bg-red-500 text-white" })
    } finally {
      setIsSending(false)
    }
  }

  const handleSave = async () => {
    if (!verifyToken.trim() || !accessToken.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide both Verify Token and Access Token",
        className: "bg-red-500 text-white",
      })
      return
    }
    if (platform === "messenger" && !pageId.trim()) {
      toast({ title: "Missing Page ID", description: "Enter your Facebook Page ID", className: "bg-red-500 text-white" })
      return
    }
    if (platform === "whatsapp" && !whatsappPhoneNumberId.trim()) {
      toast({ title: "Missing Phone Number ID", description: "Enter your WhatsApp Phone Number ID", className: "bg-red-500 text-white" })
      return
    }

    try {
      setIsLoading(true)
      if (!metaSave) throw new Error("Convex API not ready in this environment. Deploy Convex with metaConfigs.")
      await saveMetaConfig({
        agentId,
        platform,
        verifyToken: verifyToken.trim(),
        accessToken: accessToken.trim(),
        pageId: platform === "messenger" ? pageId.trim() : undefined,
        whatsappPhoneNumberId: platform === "whatsapp" ? whatsappPhoneNumberId.trim() : undefined,
      })
      toast({ title: "Saved", description: "Meta configuration updated.", className: "bg-green-500 text-white" })
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save", className: "bg-red-500 text-white" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!metaConfig) return
    const ok = window.confirm("Delete Meta configuration?")
    if (!ok) return
    try {
      setIsLoading(true)
      if (!metaRemove) throw new Error("Convex API not ready in this environment. Deploy Convex with metaConfigs.")
      await removeMetaConfig({ agentId })
      toast({ title: "Deleted", description: "Meta configuration removed.", className: "bg-green-500 text-white" })
      setVerifyToken("")
      setAccessToken("")
      setPageId("")
      setWhatsappPhoneNumberId("")
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to delete", className: "bg-red-500 text-white" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-500" />
          Meta (Messenger / WhatsApp) Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert>
          <AlertDescription className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Webhook URL</p>
                <p className="font-mono break-all">{webhookUrl || "Set NEXT_PUBLIC_CONVEX_URL to see webhook URL"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCopyWebhook} disabled={!webhookUrl} className="gap-1">
                    <Copy className="h-3 w-3" /> Copy URL
                  </Button>
                  <Badge>Customizable</Badge>
                </div>
                <p className="mt-2">Use this URL when configuring the webhook in the Meta Developer Console.</p>
                <p className="text-xs text-gray-600">Note: The config will load once your Convex deployment is updated with the new schema and functions.</p>
                {!metaGet && (
                  <p className="text-red-600">Convex API not generated for metaConfigs in this environment. Deploy Convex or run codegen.</p>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FlaskConical className="h-4 w-4" /> Quick Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleQuickConnectWhatsApp} className="gap-1">
                <Rocket className="h-3 w-3" /> Connect WhatsApp (Test)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleGenerateVerifyToken} className="gap-1">
                <KeyRound className="h-3 w-3" /> Generate Verify Token
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Send Test To (WhatsApp number)</Label>
                <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="15551234567" />
              </div>
              <div className="space-y-2">
                <Label>Test Message</Label>
                <Input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Hello from your bot" />
              </div>
            </div>
            <div>
              <Button type="button" onClick={handleTestSend} disabled={isSending} className="gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test Message
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="messenger">Messenger (Pages)</option>
              <option value="whatsapp">WhatsApp Cloud API</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Verify Token</Label>
            <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="your-verify-token" />
          </div>

          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAB..." />
          </div>

          {platform === "messenger" && (
            <div className="space-y-2">
              <Label>Page ID</Label>
              <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" />
            </div>
          )}

          {platform === "whatsapp" && (
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input value={whatsappPhoneNumberId} onChange={(e) => setWhatsappPhoneNumberId(e.target.value)} placeholder="123456789012345" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={metaConfig?.isActive ? "default" : "secondary"}>
            {metaConfig?.isActive ? "Active" : "Inactive"}
          </Badge>
          {metaConfig?.webhookUrl && (
            <a href={metaConfig.webhookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
              Webhook URL <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={isLoading || !metaSave} className="flex items-center gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {metaConfig ? "Update Configuration" : "Save Configuration"}
          </Button>

          {metaConfig && (
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading || !metaRemove} className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>

        <Alert>
          <AlertDescription className="space-y-2 text-sm">
            <p className="font-medium">Setup steps</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter your platform, Verify Token, and Access Token (and Page ID or Phone Number ID).</li>
              <li>Click Save to store credentials.</li>
              <li>In Meta Developer Console, configure the webhook callback to the URL above and use the same Verify Token.</li>
              <li>Subscribe to messaging events. Send a test message to verify.</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
