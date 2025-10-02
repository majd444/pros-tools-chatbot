"use client"

import React, { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { X, RefreshCw, Upload, FileText, Globe, Trash2, Copy, Plus, Edit2, ChevronDown, Phone, User, Mail, Puzzle } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import SimpleChatForm from "@/components/simple-chat-form"
import ChatInterface from "@/components/chat-interface"
import TelegramConfig from "@/components/TelegramConfig"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Interfaces
interface CreateAgentModalProps {
  onClose: () => void
}

interface ExtractedContent {
  url: string;
  text: string;
  structured?: {
    tabs: Array<{ id: string; label: string }>;
    inputs: Array<{ id: string; type: string; label: string; required: boolean }>;
    buttons: Array<{ id: string; type: string; label: string; action: string }>;
    links: Array<{ text: string; href?: string }>;
  }
}

// Constants
const pluginLogos = [
  { id: "wordpress", name: "WordPress", logoUrl: "https://s.w.org/style/images/about/WordPress-logotype-wmark.png" },
  { id: "shopify", name: "Shopify", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg" },
  { id: "whatsapp", name: "WhatsApp", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" },
  { id: "html-css", name: "HTML", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg" },
  { id: "instagram", name: "Instagram", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" },
  { id: "messenger", name: "Meta", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" },
  { id: "telegram", name: "Telegram", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" },
  { id: "discord", name: "Discord", logoUrl: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" },
]

const colorPalette = [
  '#6B7280', '#EF4444', '#EC4899', '#8B5CF6', '#7C3AED', '#4F46E5', '#3B82F6',
  '#06B6D4', '#14B8A6', '#10B981', '#84CC16', '#F59E0B', '#F97316', '#FFFFFF'
]

// Main Component
function CreateAgentModal({ onClose }: CreateAgentModalProps) {
  const router = useRouter()
  const createAgent = useMutation(api.agents.create)
  const updateAgent = useMutation(api.agents.update)
  const saveFineTuning = useMutation(api.fineTuning.saveFineTuningOutput)
  const { user } = useUser()
  const { toast } = useToast()

  // State Management
  const [assistantName, setAssistantName] = useState('AI Assistant')
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [collectUserInfo, setCollectUserInfo] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant.")
  const [headerColor, setHeaderColor] = useState("#3B82F6")
  const [accentColor, setAccentColor] = useState("#00D4FF")
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF")
  const [temperature, setTemperature] = useState(0.7)
  const [activeTab, setActiveTab] = useState("configuration")
  const [isTopColorPopoverOpen, setIsTopColorPopoverOpen] = useState(false)
  const [isAccentColorPopoverOpen, setIsAccentColorPopoverOpen] = useState(false)
  const [isBackgroundColorPopoverOpen, setIsBackgroundColorPopoverOpen] = useState(false)
  const [selectedContentIndex, setSelectedContentIndex] = useState<number | null>(null)
  const [extractedContents, setExtractedContents] = useState<ExtractedContent[]>([])
  const [extractedLinks, setExtractedLinks] = useState<Array<{url: string, text: string}>>([])
  const [extractionUrl, setExtractionUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [initials, setInitials] = useState('AA')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null!)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [agentIdState, setAgentIdState] = useState<string | null>(null)
  const [formFields, setFormFields] = useState<Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    value?: string;
    isEditing?: boolean;
    isEditingAnswer?: boolean;
  }>>([])

  // Event Handlers
  const handleExtract = async () => {
    if (!extractionUrl) {
      setError('Please enter a URL to extract content from')
      return
    }

    try {
      new URL(extractionUrl)
    } catch {
      setError('Please enter a valid URL (include http:// or https://)')
      return
    }

    setIsExtracting(true)
    setError(null)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extractionUrl }),
      })
      const responseData = await response.json()

      if (!response.ok || responseData?.success === false) {
        const msg = responseData?.error || `${response.status} ${response.statusText}`
        throw new Error(msg || 'Failed to extract content from URL')
      }
      if (!responseData.text && (!responseData.structured || responseData.structured.links.length === 0)) {
        throw new Error('No extractable content found on the page')
      }

      // Prepare preview and capped content for saving
      const MAX_SAVE_CHARS = 200_000
      const textToSave = (responseData.text || '').slice(0, MAX_SAVE_CHARS)

      const newContent: ExtractedContent = {
        url: extractionUrl,
        text: textToSave,
        structured: responseData.structured || { tabs: [], inputs: [], buttons: [], links: [] },
      }

      // Save to knowledge base only if authenticated; ensure agent exists
      if (user) {
        try {
          const agentId = await ensureAgentSaved()
          const insertedId = await saveFineTuning({
            agentId: String(agentId),
            input: `url:${extractionUrl}`,
            output: textToSave,
            metadata: {
              structured: responseData.structured,
              source: 'edge-extract',
              lengthOriginal: (responseData.text || '').length,
            },
          })
          console.log('[create-agent] Saved fine-tuning entry:', String(insertedId))
          toast({
            className: 'bg-green-500 text-white',
            title: 'Saved to Knowledge Base',
            description: `Saved ${textToSave.length} chars from ${extractionUrl}`,
          })
        } catch (e) {
          console.error('[create-agent] Save to knowledge base failed:', e)
          toast({
            className: 'bg-yellow-500 text-white',
            title: 'Preview only',
            description: 'Could not save to Knowledge Base. Content still available below.',
          })
        }
      } else {
        toast({
          className: 'bg-blue-500 text-white',
          title: 'Preview Ready',
          description: 'Sign in to save extracted content to your Knowledge Base.',
        })
      }

      setExtractedContents(prev => [...prev, newContent])
      setExtractedLinks(responseData.structured?.links || [])
      setExtractionUrl('')
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error: /, '') : 'An unknown error occurred')
      setExtractionUrl('')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      setError('No files selected')
      return
    }

    setIsExtracting(true)
    setError(null)
    const processedFiles: string[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      try {
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
          errors.push(`Skipping ${file.name}: File exceeds 10MB size limit`)
          continue
        }

        const allowedTypes = [
          'text/plain',
          'text/markdown',
          'application/json',
          'application/pdf',
        ]
        const allowedExtensions = ['.txt', '.md', '.json', '.pdf']
        const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
        
        if (!allowedTypes.some(t => file.type.includes(t.replace('*', ''))) && 
            !allowedExtensions.includes(`.${fileExt}`)) {
          errors.push(`Skipping ${file.name}: Unsupported file type`)
          continue
        }

        const isPdf = file.type === 'application/pdf' || fileExt === 'pdf'

        if (isPdf) {
          const formData = new FormData()
          formData.append('file', file)
          const response = await fetch('/api/extract-file', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30000)
          })
          const responseData = await response.json()

          if (!response.ok) throw new Error(responseData.error || `Failed to extract content from ${file.name}`)
          
          const extractedText = (responseData.text || '').trim()
          if (!extractedText) throw new Error(`No readable content found in ${file.name}`)

          if (!responseData || typeof responseData !== 'object') {
            throw new Error(`Invalid response format from server for ${file.name}`)
          }

          setExtractedContents(prev => [...prev, {
            url: file.name,
            text: extractedText,
            structured: {
              tabs: responseData.structured?.tabs || [],
              inputs: responseData.structured?.inputs || [],
              buttons: responseData.structured?.buttons || [],
              links: responseData.structured?.links || []
            }
          }])
          processedFiles.push(file.name)
        } else if (file.type.startsWith('text/') || ['.txt', '.md', '.json'].includes(`.${fileExt}`)) {
          const text = await file.text()
          if (!text.trim()) throw new Error(`File ${file.name} is empty`)

          setExtractedContents(prev => [...prev, {
            url: file.name,
            text,
            structured: { tabs: [], inputs: [], buttons: [], links: [] },
          }])
          processedFiles.push(file.name)
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message.replace(/^Error: /, '') : `Failed to process ${file.name}`)
      }
    }

    if (errors.length > 0) {
      setError(processedFiles.length > 0 
        ? `Processed ${processedFiles.length} file(s), but encountered ${errors.length} error(s). ${errors.join(' ')}`
        : `Failed to process files: ${errors.join(' ')}`)
      setTimeout(() => setError(null), 5000)
    } else if (processedFiles.length > 0) {
      setError(`Successfully processed ${processedFiles.length} file(s).`)
      setTimeout(() => setError(null), 3000)
    }
    setIsExtracting(false)
    if (e.target) e.target.value = ''
  }

  const removeLink = (index: number) => {
    setExtractedLinks(prev => prev.filter((_, i) => i !== index))
  }

  // Render Functions
  const renderHeader = () => (
    <div className="border-b border-gray-200 p-4 flex items-center justify-between">
      <h2 className="text-xl font-bold text-black">Create New Agent</h2>
      <button onClick={onClose} className="text-black hover:text-gray-700">
        <X className="h-5 w-5" />
      </button>
    </div>
  )

  const handleSave = async () => {
    console.log("[handleSave] Starting agent save process...")
    
    try {
      // Check authentication
      if (!user) {
        console.error("[handleSave] User not authenticated")
        toast({
          className: "bg-destructive text-destructive-foreground",
          title: "Authentication Error",
          description: "You must be logged in to save an agent",
        })
        return
      }

      // Basic validation
      if (!assistantName?.trim()) {
        console.error("[handleSave] Validation failed: Missing agent name")
        toast({
          className: "bg-destructive text-destructive-foreground",
          title: "Validation Error",
          description: "Please provide a name for your agent",
        })
        return
      }

      // Prepare form fields data
      const formFieldsData = formFields.map(field => ({
        id: field.id,
        type: field.type,
        label: field.label,
        required: field.required,
        value: field.value || ''
      }));

      console.log("[handleSave] Preparing agent payload:", {
        name: assistantName,
        welcomeMessage: welcomeMessage || `👋 Hi there! I'm ${assistantName}. How can I help you today?`,
        systemPrompt: systemPrompt || "You are a helpful AI assistant.",
        temperature,
        headerColor,
        accentColor,
        backgroundColor,
        collectUserInfo,
        formFields: formFieldsData
      });

      // If we already created an agent (e.g., during extraction), update it; otherwise create
      let finalAgentId: string;
      if (agentIdState) {
        await updateAgent({
          id: agentIdState as Id<"agents">,
          name: assistantName,
          welcomeMessage: welcomeMessage || `👋 Hi there! I'm ${assistantName}. How can I help you today?`,
          systemPrompt: systemPrompt || "You are a helpful AI assistant.",
          temperature,
          headerColor,
          accentColor,
          backgroundColor,
          profileImage: profileImage || undefined,
          collectUserInfo,
          formFields: formFieldsData
        } as any);
        finalAgentId = agentIdState;
        console.log("[handleSave] Agent updated successfully:", finalAgentId);
      } else {
        const createdId = await createAgent({
          name: assistantName,
          welcomeMessage: welcomeMessage || `👋 Hi there! I'm ${assistantName}. How can I help you today?`,
          systemPrompt: systemPrompt || "You are a helpful AI assistant.",
          temperature,
          headerColor,
          accentColor,
          backgroundColor,
          profileImage: profileImage || undefined,
          collectUserInfo,
          formFields: formFieldsData
        } as any);
        finalAgentId = String(createdId);
        setAgentIdState(finalAgentId);
        console.log("[handleSave] Agent created successfully with ID:", finalAgentId);
      }
      
      // Show success message
      toast({
        className: "bg-green-500 text-white",
        title: "Success",
        description: "Agent created successfully",
      });

      // Redirect to the agent's page (updated or created)
      router.push(`/agent/${finalAgentId}`);
      
    } catch (error) {
      console.error("[handleSave] Error creating agent:", error);
      
      // Extract error message
      let errorMessage = "There was an error saving your agent. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
        console.error("[handleSave] Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }

      // Show error message to user
      toast({
        className: "bg-destructive text-destructive-foreground",
        title: "Error creating agent",
        description: errorMessage,
      });
    }
  }

  const renderFooter = () => {

    return (
      <div className="border-t border-gray-200 p-4 flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save Agent</Button>
      </div>
    );
  };

  // Ensure an agent exists and return its ID (no redirect). Used by Plugins tab when clicking HTML & CSS card.
  const ensureAgentSaved = async (): Promise<string> => {
    if (agentIdState) return agentIdState;

    if (!user) {
      toast({
        className: "bg-destructive text-destructive-foreground",
        title: "Authentication Error",
        description: "You must be logged in to save an agent",
      });
      throw new Error("Not authenticated");
    }
    if (!assistantName?.trim()) {
      toast({
        className: "bg-destructive text-destructive-foreground",
        title: "Validation Error",
        description: "Please provide a name for your agent",
      });
      throw new Error("Missing agent name");
    }

    const formFieldsData = formFields.map(field => ({
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required,
      value: field.value || ''
    }));

    const newId = await createAgent({
      name: assistantName,
      welcomeMessage: welcomeMessage || `👋 Hi there! I'm ${assistantName}. How can I help you today?`,
      systemPrompt: systemPrompt || "You are a helpful AI assistant.",
      temperature,
      headerColor,
      accentColor,
      backgroundColor,
      profileImage: profileImage || undefined,
      collectUserInfo,
      formFields: formFieldsData
    });
    setAgentIdState(String(newId));
    toast({ className: "bg-green-500 text-white", title: "Saved", description: "Agent saved for embedding." });
    return String(newId);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col h-screen w-screen">
      {renderHeader()}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/3 overflow-y-auto p-6 border-r border-gray-200">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-6 h-12 gap-4">
  <TabsTrigger value="configuration" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-20">
    Configuration
  </TabsTrigger>
  <TabsTrigger value="fine-tuning" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">
    Fine-tuning
  </TabsTrigger>
  <TabsTrigger value="style" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">
    Style
  </TabsTrigger>
  <TabsTrigger value="plugins" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">
    Plugins
  </TabsTrigger>
</TabsList>

            <ConfigurationTab
              assistantName={assistantName}
              setAssistantName={setAssistantName}
              welcomeMessage={welcomeMessage}
              setWelcomeMessage={setWelcomeMessage}
              collectUserInfo={collectUserInfo}
              setCollectUserInfo={setCollectUserInfo}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              temperature={temperature}
              setTemperature={setTemperature}
              formFields={formFields}
              setFormFields={setFormFields}
            />
            <FineTuningTab
              extractionUrl={extractionUrl}
              setExtractionUrl={setExtractionUrl}
              isExtracting={isExtracting}
              extractedContents={extractedContents}
              setExtractedContents={setExtractedContents}
              extractedLinks={extractedLinks}
              selectedContentIndex={selectedContentIndex}
              setSelectedContentIndex={setSelectedContentIndex}
              error={error}
              handleExtract={handleExtract}
              handleFileUpload={handleFileUpload}
              removeLink={removeLink}
            />
            <StyleTab
              profileImage={profileImage}
              setProfileImage={setProfileImage}
              initials={initials}
              setInitials={setInitials}
              
              headerColor={headerColor}
              setHeaderColor={setHeaderColor}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              backgroundColor={backgroundColor}
              setBackgroundColor={setBackgroundColor}
              isTopColorPopoverOpen={isTopColorPopoverOpen}
              setIsTopColorPopoverOpen={setIsTopColorPopoverOpen}
              isAccentColorPopoverOpen={isAccentColorPopoverOpen}
              setIsAccentColorPopoverOpen={setIsAccentColorPopoverOpen}
              isBackgroundColorPopoverOpen={isBackgroundColorPopoverOpen}
              setIsBackgroundColorPopoverOpen={setIsBackgroundColorPopoverOpen}
              fileInputRef={fileInputRef}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              position={position}
              setPosition={setPosition}
              startPos={startPos}
              setStartPos={setStartPos}
              scale={scale}
              setScale={setScale}
              colorPalette={colorPalette}
            />
            <PluginsTab plugins={pluginLogos} getAgentId={ensureAgentSaved} />
          </Tabs>
          {showError && (
            <Alert variant="destructive" className="mt-6 bg-amber-50 border-amber-200 text-amber-800">
              <AlertDescription className="flex items-center">
                <span className="mr-2">⚠️</span>
                <div>
                  <p className="font-medium">Extraction Service Unavailable</p>
                  <p>The document extraction service is not running.</p>
                </div>
              </AlertDescription>
              <Button
                variant="outline"
                className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center"
                onClick={() => setShowError(false)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
            </Alert>
          )}
        </div>
        <div className="w-1/3 p-4 bg-gray-50 flex flex-col">
          <div className="flex-1 min-h-0">
            <div className="h-full border rounded-lg overflow-hidden">
              <div className="h-full w-full flex items-center justify-center p-4">
                {!showChat ? (
                  <SimpleChatForm
                    formFields={formFields.map(field => ({
                      id: field.id,
                      label: field.label,
                      type: field.type,
                      required: field.required,
                      value: field.value || ''
                    }))}
                    onFormSubmitAction={async (formData: Record<string, string>) => {
                      console.log('Form submitted with data:', formData);
                      setShowChat(true);
                      return; // Explicitly return void
                    }}
                    _assistantName={assistantName}
                    _welcomeMessage={welcomeMessage || `👋 Thanks for your information! How can I help you today?`}
                    _headerColor={headerColor}
                    _accentColor={accentColor}
                    _backgroundColor={backgroundColor}
                    _profileImage={profileImage || ''}
                    className="w-full h-full"
                  />
                ) : (
                  <ChatInterface
                    assistantName={assistantName}
                    profileImage={profileImage || undefined}
                    welcomeMessage={welcomeMessage || `👋 Hi there! I&apos;m ${assistantName}. How can I help you today?`}
                    headerColor={headerColor}
                    accentColor={accentColor}
                    onSendMessage={async (message: string) => {
                      // In a real app, you would send this to your API
                      console.log('Message sent:', message);
                      // Simulate a response
                      setTimeout(() => {
                        setShowChat(prev => !prev); // Toggle chat to force re-render with new messages
                      }, 1000);
                      return; // Explicitly return void
                    }}
                    onClose={onClose}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {renderFooter()}
    </div>
  )
}

// Sub-Components
interface ConfigurationTabProps {
  assistantName: string
  setAssistantName: (value: string) => void
  welcomeMessage: string
  setWelcomeMessage: (value: string) => void
  collectUserInfo: boolean
  setCollectUserInfo: (value: boolean) => void
  systemPrompt: string
  setSystemPrompt: (value: string) => void
  temperature: number
  setTemperature: (value: number) => void
  formFields: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    value?: string;
    isEditing?: boolean;
    isEditingAnswer?: boolean;
  }>
  setFormFields: (fields: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    value?: string;
    isEditing?: boolean;
    isEditingAnswer?: boolean;
  }>) => void;
}

const ConfigurationTab: React.FC<ConfigurationTabProps> = ({
  assistantName, setAssistantName, welcomeMessage, setWelcomeMessage,
  collectUserInfo, setCollectUserInfo, systemPrompt, setSystemPrompt,
  temperature, setTemperature, formFields, setFormFields
}) => {
  const toggleCollectUserInfo = () => {
    setCollectUserInfo(!collectUserInfo)
    if (collectUserInfo) setFormFields([])
  }

  const addField = (type: string) => {
    const newField = {
      id: `field-${Date.now()}`,
      type,
      label: type === 'name' ? 'Name' : type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'Field',
      required: true
    }
    setFormFields([...formFields, newField])
  }

  const toggleRequired = (id: string) => {
    setFormFields(formFields.map(field => 
      field.id === id ? {...field, required: !field.required} : field
    ))
  }

  const toggleEditLabel = (id: string, isAnswer = false) => {
    setFormFields(formFields.map(field => ({
      ...field,
      isEditing: field.id === id ? !field.isEditing : false,
      isEditingAnswer: field.id === id && isAnswer ? !field.isEditingAnswer : false
    })))
  }

  const updateFieldLabel = (id: string, newLabel: string) => {
    if (newLabel.trim() === '') return
    setFormFields(formFields.map(field => 
      field.id === id 
        ? { ...field, label: newLabel.trim(), isEditing: false, isEditingAnswer: false }
        : field
    ))
  }

  const removeField = (id: string) => {
    setFormFields(formFields.filter(field => field.id !== id))
  }

  const clearAllFields = () => {
    setFormFields([])
  }

  return (
    <TabsContent value="configuration" className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2 text-black">Name</label>
        <Input placeholder="AI Assistant" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-black">Select Language Model</label>
        <div className="relative">
          <select className="w-full p-2 border border-gray-300 rounded-md appearance-none pr-10 text-black">
            <option>Llama 3.1 Nemetron Nano 8B (Free)</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <label className="block text-sm font-medium text-black">Temperature: {temperature}</label>
          <span className="text-sm text-black">Balanced</span>
        </div>
        <Slider value={[temperature * 100]} max={100} step={1} onValueChange={([value]) => setTemperature(value / 100)} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-black">System Prompt</label>
        <Textarea
          placeholder="You are a helpful AI assistant."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="min-h-[100px]"
        />
        <p className="text-xs text-black mt-1">This prompt defines your assistant&apos;s personality and capabilities.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-black">Welcome Message</label>
        <Textarea
          placeholder="👋 Hi, I&apos;m an AI Assistant! I can help with information."
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          className="min-h-[80px]"
        />
        <p className="text-xs text-black mt-1">This is the first message users will see when they start a chat.</p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium text-black">Collect User Information</label>
            <p className="text-xs text-black">Enable a form to collect user info before chat</p>
          </div>
          <Switch checked={collectUserInfo} onCheckedChange={toggleCollectUserInfo} />
        </div>
        {collectUserInfo && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-black mb-3">Add Field Templates</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => addField('name')}>
                  <User className="mr-1 h-3 w-3" /> Name Field
                </Button>
                <Button variant="outline" size="sm" onClick={() => addField('email')}>
                  <Mail className="mr-1 h-3 w-3" /> Email Field
                </Button>
                <Button variant="outline" size="sm" onClick={() => addField('phone')}>
                  <Phone className="mr-1 h-3 w-3" /> Phone Number
                </Button>
                <Button variant="outline" size="sm" onClick={() => addField('custom')}>
                  <Plus className="mr-1 h-3 w-3" /> Custom Field
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-black">Active Fields</h4>
                {formFields.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={clearAllFields}>
                    Clear All
                  </Button>
                )}
              </div>
              {formFields.length > 0 ? (
                <div className="space-y-2">
                  {formFields.map((field) => (
                    <FormFieldItem
                      key={field.id}
                      field={field}
                      onToggleEdit={toggleEditLabel}
                      onUpdateLabel={updateFieldLabel}
                      onToggleRequired={toggleRequired}
                      onRemove={removeField}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <p className="text-sm text-black">No fields added. Use the templates above to add fields.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  )
}

interface FormFieldItemProps {
  field: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    isEditing?: boolean;
    isEditingAnswer?: boolean;
  };
  onToggleEdit: (id: string, isAnswer?: boolean) => void;
  onUpdateLabel: (id: string, newLabel: string) => void;
  onToggleRequired: (id: string) => void;
  onRemove: (id: string) => void;
}

const FormFieldItem: React.FC<FormFieldItemProps> = ({
  field, onToggleEdit, onUpdateLabel, onToggleRequired, onRemove
}) => (
  <div className="group relative p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
    <div className="w-full group editable-field">
      <div className="flex items-center justify-between mb-1">
        {field.isEditing ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              className="text-sm border rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={field.label}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUpdateLabel(field.id, e.currentTarget.value)
                else if (e.key === 'Escape') onToggleEdit(field.id)
              }}
              onBlur={(e) => onUpdateLabel(field.id, e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-gray-500">{field.required && <span className="text-red-500">*</span>}</span>
          </div>
        ) : (
          <div className="group flex items-center cursor-pointer" onClick={() => onToggleEdit(field.id)}>
            <div className="flex items-center" onClick={(e) => { e.stopPropagation(); onToggleEdit(field.id, false); }}>
              <h4 className="text-sm font-medium text-gray-900 group-hover:bg-gray-100 px-1 -mx-1 rounded">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </h4>
              <Edit2 className="ml-2 h-3 w-3 text-gray-400 group-hover:text-gray-600" />
            </div>
          </div>
        )}
        <label className="inline-flex items-center cursor-pointer">
          <span className="text-xs text-gray-500 mr-2">{field.required ? 'Required' : 'Optional'}</span>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={field.required} onChange={() => onToggleRequired(field.id)} />
            <div className={`w-8 h-4 rounded-full transition-colors ${field.required ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${field.required ? 'translate-x-4' : ''}`}></div>
            </div>
          </div>
        </label>
      </div>
      <div className="mt-1 flex items-center">
        <span className="text-sm text-gray-500">answer </span>
        {field.isEditingAnswer ? (
          <input
            type="text"
            className="text-sm text-gray-900 border-b border-dashed border-blue-500 bg-transparent focus:outline-none focus:border-blue-600 px-1 -ml-1"
            value={field.label}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onToggleEdit(field.id)
            }}
            onBlur={() => onToggleEdit(field.id)}
          />
        ) : (
          <span className="text-sm text-gray-500 hover:bg-gray-100 px-1 -mx-1 rounded cursor-text" onClick={(e) => { e.stopPropagation(); onToggleEdit(field.id, true); }}>
            {field.label}
          </span>
        )}
      </div>
    </div>
    <div className="mt-4 pt-3 border-t">
      <div className="flex items-center justify-end space-x-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs text-gray-600 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onToggleEdit(field.id); }}>
          <Edit2 className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>{field.isEditing ? 'Cancel' : 'Rename'}</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600" onClick={() => onRemove(field.id)}>
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  </div>
)

interface FineTuningTabProps {
  extractionUrl: string
  setExtractionUrl: (value: string) => void
  isExtracting: boolean
  extractedContents: ExtractedContent[]
  setExtractedContents: (contents: ExtractedContent[]) => void
  extractedLinks: Array<{url: string, text: string}>
  selectedContentIndex: number | null
  setSelectedContentIndex: (index: number | null) => void
  error: string | null
  handleExtract: () => Promise<void>
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  removeLink: (index: number) => void
}

const FineTuningTab: React.FC<FineTuningTabProps> = ({
  extractionUrl, setExtractionUrl, isExtracting, extractedContents, setExtractedContents,
  extractedLinks, selectedContentIndex, setSelectedContentIndex, error, handleExtract,
  handleFileUpload, removeLink
}) => (
  <TabsContent value="fine-tuning" className="space-y-6">
    <div className="p-4 bg-gray-50 rounded-lg mb-4">
      <h3 className="text-lg font-medium text-black">Fine-tuning Data</h3>
      <p className="text-sm text-black">Upload files or extract content from URLs to fine-tune your agent&apos;s knowledge base.</p>
    </div>
    <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
      <div className="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6">
        <div className="leading-none font-semibold flex items-center text-black">
          <Globe className="h-5 w-5 mr-2 text-blue-500" />
          Extract Links & Content
        </div>
        <div className="text-sm text-black">Extract links and content from websites to use as training data</div>
      </div>
      <div className="px-6">
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
              placeholder="Enter URL to extract links"
              value={extractionUrl}
              onChange={(e) => setExtractionUrl(e.target.value)}
              disabled={isExtracting}
            />
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 has-[>svg]:px-3 whitespace-nowrap"
              onClick={handleExtract}
              disabled={isExtracting}
            >
              <Globe className="h-4 w-4 mr-2" />
              Extract Content
            </button>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <div>
            <h4 className="text-sm font-medium mb-2 text-black">Extracted Links ({extractedLinks.length})</h4>
            {extractedLinks.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {extractedLinks.map((link, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div className="flex items-center text-sm truncate">
                      <Globe className="h-4 w-4 mr-2 text-black flex-shrink-0" />
                      <span className="truncate text-black">{link.text || link.url}</span>
                    </div>
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 ml-2 flex-shrink-0"
                      onClick={() => removeLink(index)}
                    >
                      <Trash2 className="h-4 w-4 text-black" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-black text-sm">No links extracted yet</div>
            )}
            {extractedContents.filter(c => c.url.startsWith('http')).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-black mb-2">URL Extracted Content ({extractedContents.filter(c => c.url.startsWith('http')).length})</h4>
                <ExtractedContentList
                  contents={extractedContents.filter(c => c.url.startsWith('http'))}
                  onRemove={(index) => {
                    const newContents = extractedContents.filter((_, i) => i !== index);
                    setExtractedContents(newContents);
                    if (selectedContentIndex === index) setSelectedContentIndex(null);
                    else if (selectedContentIndex !== null && selectedContentIndex > index) setSelectedContentIndex(selectedContentIndex - 1);
                  }}
                  selectedIndex={selectedContentIndex}
                  onSelect={setSelectedContentIndex}
                  isUrl={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <div className="mt-6">
      <label className="block text-sm font-medium mb-2 text-black">Upload Documents</label>
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isExtracting ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-white'}`}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50'); }}
          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileUpload({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
            disabled={isExtracting}
            accept=".txt,.md,.json,.pdf,.png,.jpg,.jpeg,.webp,.gif"
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer flex flex-col items-center ${isExtracting ? 'text-blue-500' : 'text-blue-500 hover:text-blue-700'}`}
          >
            {isExtracting ? (
              <>
                <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-black">Processing files...</p>
                <p className="text-xs text-gray-600 mt-1">This may take a moment for PDFs</p>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm text-black">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-600 mt-1">Supported formats: .txt, .md, .json, .pdf</p>
                <p className="text-xs text-gray-500 mt-1">(PDF text extraction is experimental)</p>
              </>
            )}
          </label>
        </div>
        {extractedContents.filter(c => !c.url.startsWith('http')).length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-black mb-2">Extracted Documents ({extractedContents.filter(c => !c.url.startsWith('http')).length})</h4>
            <ExtractedContentList
              contents={extractedContents.filter(c => !c.url.startsWith('http'))}
              onRemove={(index) => {
                const actualIndex = extractedContents.findIndex((c) => !c.url.startsWith('http') && extractedContents.filter(d => !d.url.startsWith('http')).indexOf(c) === index)
                const newContents = extractedContents.filter((_, i) => i !== actualIndex);
                setExtractedContents(newContents);
                if (selectedContentIndex === actualIndex) setSelectedContentIndex(null)
                else if (selectedContentIndex !== null && selectedContentIndex > actualIndex) setSelectedContentIndex(selectedContentIndex - 1)
              }}
              selectedIndex={selectedContentIndex}
              onSelect={setSelectedContentIndex}
              isUrl={false}
            />
          </div>
        )}
        {extractedContents.filter(c => !c.url.startsWith('http')).length === 0 && (
          <div className="mt-6 text-center py-4 text-black text-sm border border-dashed rounded-md bg-gray-50">
            <p>No documents extracted yet</p>
            <p className="text-xs text-gray-500 mt-1">Upload files to extract their content</p>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>
    </div>
  </TabsContent>
)

interface ExtractedContentListProps {
  contents: ExtractedContent[]
  onRemove: (index: number) => void
  selectedIndex: number | null
  onSelect: (index: number) => void
  isUrl: boolean
}

const ExtractedContentList: React.FC<ExtractedContentListProps> = ({
  contents, onRemove, selectedIndex, onSelect, isUrl
}) => (
  <div className="space-y-3">
    {contents.map((doc, index) => (
      <div key={doc.url} className="border rounded-md overflow-hidden shadow-sm">
        <div
          className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => onSelect(index)}
        >
          <div className="flex items-center min-w-0">
            {isUrl ? (
              <Globe className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate" title={doc.url}>{doc.url}</span>
            <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">({doc.text.length.toLocaleString()} chars)</span>
          </div>
          <div className="flex items-center">
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(doc.text); }}
              className="p-1 text-gray-500 hover:text-blue-500"
              title="Copy text"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(index); }}
              className="p-1 text-gray-500 hover:text-red-500 ml-1"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <ChevronDown className={`h-4 w-4 ml-1 text-gray-400 transition-transform ${selectedIndex === index ? 'transform rotate-180' : ''}`} />
          </div>
        </div>
        {selectedIndex === index && (
          <div className="p-3 bg-white border-t">
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60">{doc.text}</pre>
          </div>
        )}
      </div>
    ))}
  </div>
)

interface StyleTabProps {
  profileImage: string | null
  setProfileImage: (value: string | null) => void
  initials: string
  setInitials: (value: string) => void
  headerColor: string
  setHeaderColor: (value: string) => void
  accentColor: string
  setAccentColor: (value: string) => void
  backgroundColor: string
  setBackgroundColor: (value: string) => void
  isTopColorPopoverOpen: boolean
  setIsTopColorPopoverOpen: (value: boolean) => void
  isAccentColorPopoverOpen: boolean
  setIsAccentColorPopoverOpen: (value: boolean) => void
  isBackgroundColorPopoverOpen: boolean
  setIsBackgroundColorPopoverOpen: (value: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  isDragging: boolean
  setIsDragging: (value: boolean) => void
  position: { x: number; y: number }
  setPosition: (value: { x: number; y: number }) => void
  startPos: { x: number; y: number }
  setStartPos: (value: { x: number; y: number }) => void
  scale: number
  setScale: (value: number) => void
  colorPalette: string[]
}

const StyleTab: React.FC<StyleTabProps> = ({
  profileImage, setProfileImage, initials, setInitials, headerColor, setHeaderColor,
  accentColor, setAccentColor, backgroundColor, setBackgroundColor, isTopColorPopoverOpen,
  setIsTopColorPopoverOpen, isAccentColorPopoverOpen, setIsAccentColorPopoverOpen,
  isBackgroundColorPopoverOpen, setIsBackgroundColorPopoverOpen, fileInputRef, isDragging,
  setIsDragging, position, setPosition, startPos, setStartPos, scale, setScale, colorPalette
}) => {
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleImageUpload triggered');
    const file = e.target.files?.[0]
    if (!file) {
      console.error('No file selected')
      return
    }

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // Reset the file input to allow re-uploading the same file
    if (e.target) {
      e.target.value = ''
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      alert('Please upload a valid image file (JPEG, PNG, etc.)')
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      console.error('File too large:', file.size);
      alert('Image size should be less than 2MB')
      return
    }

    // Read the file
    const reader = new FileReader()
    
    reader.onloadstart = () => {
      console.log('Starting file read...')
    }

    reader.onload = (event) => {
      if (event.target?.result) {
        const result = event.target.result as string;
        console.log('File read successfully, setting profile image...', {
          resultLength: result.length,
          resultPrefix: result.substring(0, 50) + '...'
        });
        setProfileImage(result);
        setPosition({ x: 0, y: 0 });
        setScale(1);
        
        // Log the state after setting
        setTimeout(() => {
          console.log('Profile image state should be updated now');
        }, 100);
      } else {
        console.error('Failed to read file - no result');
        alert('Failed to process the image. Please try again.');
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      console.error('FileReader error details:', {
        error: reader.error,
        readyState: reader.readyState
      });
      alert('Error reading the file. Please try again.');
    };

    reader.onabort = () => {
      console.log('File reading was aborted');
    };

    try {
      console.log('Starting to read file as data URL...');
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error in file reader:', error);
      alert('An error occurred while processing the image.');
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(Math.min(Math.max(0.5, scale + (e.deltaY > 0 ? -0.1 : 0.1)), 3))
  }

  const handleInitialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInitials(e.target.value.slice(0, 2).toUpperCase() || 'AA')
  }

  return (
    <TabsContent value="style" className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2 text-black">Agent Avatar</label>
        <AvatarPreview
          profileImage={profileImage}
          headerColor={headerColor}
          position={position}
          scale={scale}
          isDragging={isDragging}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onUploadClick={() => fileInputRef.current?.click()}
        />
        <div className="flex-1">
          <Button variant="outline" className="flex items-center text-black mb-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {profileImage ? 'Change Photo' : 'Upload Photo'}
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          {!profileImage && (
            <div className="mt-1">
              <input
                type="text"
                placeholder="Enter initials (e.g., AA)"
                maxLength={2}
                onChange={handleInitialsChange}
                value={initials}
                className="text-xs p-1 border rounded w-20"
              />
              <p className="text-xs text-gray-500 mt-1">Or enter initials</p>
            </div>
          )}
          <p className="text-xs text-black mt-1">Recommended: PNG format, 512x512 pixels, max 2MB</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-black">Text Style</label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Font Family</span>
              <select className="p-2 border border-gray-300 rounded-md text-black" defaultValue="Roboto">
                <option value="Roboto">Roboto</option>
                <option value="Inter">Inter</option>
                <option value="Open Sans">Open Sans</option>
                <option value="System Default">System Default</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Size</span>
              <select className="p-2 border border-gray-300 rounded-md text-black" defaultValue="Medium">
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black">Alignment</span>
              <select className="p-2 border border-gray-300 rounded-md text-black" defaultValue="Left">
                <option value="Left">Left</option>
                <option value="Center">Center</option>
                <option value="Right">Right</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Chatbot Appearance</h3>
            <p className="text-sm text-gray-500 mt-1">Customize the appearance of your chatbot to match your brand or website design.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ColorPicker
              label="Header Color"
              color={headerColor}
              onColorChange={setHeaderColor}
              isOpen={isTopColorPopoverOpen}
              onOpenChange={setIsTopColorPopoverOpen}
              colorPalette={colorPalette}
            />
            <ColorPicker
              label="Accent Color"
              color={accentColor}
              onColorChange={setAccentColor}
              isOpen={isAccentColorPopoverOpen}
              onOpenChange={setIsAccentColorPopoverOpen}
              colorPalette={colorPalette}
            />
            <ColorPicker
              label="Background Color"
              color={backgroundColor}
              onColorChange={setBackgroundColor}
              isOpen={isBackgroundColorPopoverOpen}
              onOpenChange={setIsBackgroundColorPopoverOpen}
              colorPalette={colorPalette.filter(c => c !== '#000000')}
            />
          </div>
        </div>
      </div>
    </TabsContent>
  )
}

interface AvatarPreviewProps {
  profileImage: string | null
  headerColor: string
  position: { x: number; y: number }
  scale: number
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  onWheel: (e: React.WheelEvent) => void
  onUploadClick: () => void
}

const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  profileImage, headerColor, position, scale, isDragging,
  onMouseDown, onMouseMove, onMouseUp, onWheel, onUploadClick
}) => {
  // Debug log to check the profileImage prop
  console.log('AvatarPreview - profileImage:', profileImage ? 'Image exists' : 'No image');
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4">
        <div
          className="h-48 w-48 rounded-full flex items-center justify-center overflow-hidden relative group bg-gray-100 border-2 border-gray-200"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab', 
            touchAction: 'none',
            backgroundColor: profileImage ? 'transparent' : headerColor || '#3B82F6'
          }}
        >
          {profileImage ? (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '50%'
              }}
            >
              <div className="relative w-full h-full">
                <Image 
                  src={profileImage} 
                  alt="Profile preview"
                  fill
                  sizes="100vw"
                  className="object-cover object-center block"
                  draggable={false}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    console.error('Error loading image:', e);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-6xl">AA</span>
            </div>
          )}
          <div
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200 cursor-pointer"
            onClick={(e) => { 
              e.stopPropagation(); 
              console.log('Upload click handler called');
              onUploadClick(); 
            }}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-center p-2">
              <Upload className="h-8 w-8 text-white mx-auto mb-1" />
              <span className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                {profileImage ? 'Change Photo' : 'Upload Photo'}
              </span>
              {profileImage && (
                <p className="text-white text-xs mt-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  Drag to move • Scroll to zoom
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ColorPickerProps {
  label: string
  color: string
  onColorChange: (color: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  colorPalette: string[]
}

interface ColorSwatchProps {
  color: string
  onClick: () => void
  isSelected?: boolean
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ color, onClick, isSelected = false }) => (
  <button
    type="button"
    className={`w-6 h-6 rounded border-2 ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
    style={{ backgroundColor: color }}
    onClick={onClick}
    aria-label={`Select ${color} color`}
  />
)

const ColorPicker: React.FC<ColorPickerProps> = ({
  label, color, onColorChange, isOpen, onOpenChange, colorPalette
}) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {label === 'Header Color' && ' (Top bar)'}
        {label === 'Accent Color' && ' (Buttons, links)'}
        {label === 'Background Color' && ' (Chat area)'}
      </label>
      <div className="flex items-center space-x-2">
        <Popover open={isOpen} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-10 h-10 p-0 rounded-full overflow-hidden border-2 border-gray-300"
              onClick={() => onOpenChange(!isOpen)}
            >
              <div 
                className="w-full h-full"
                style={{ backgroundColor: color }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3">
            <div className="grid grid-cols-5 gap-2">
              {colorPalette.map((paletteColor) => (
                <ColorSwatch
                  key={paletteColor}
                  color={paletteColor}
                  onClick={() => {
                    onColorChange(paletteColor);
                    onOpenChange(false);
                  }}
                  isSelected={color === paletteColor}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded border flex-shrink-0" style={{ backgroundColor: color }} />
                <Input
                  id={`${label.toLowerCase().replace(' ', '-')}-input`}
                  value={color}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="font-mono text-sm h-8"
                  placeholder="#rrggbb"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1">
          <Input
            id={`${label.toLowerCase().replace(' ', '-')}-input`}
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="font-mono text-sm h-10"
            placeholder="#rrggbb"
          />
        </div>
      </div>
    </div>
  )
}

interface PluginsTabProps {
  plugins: typeof pluginLogos
  getAgentId: () => Promise<string>
}

const PluginsTab: React.FC<PluginsTabProps> = ({ plugins, getAgentId }) => {
  const router = useRouter();
  const [showEmbed, setShowEmbed] = React.useState(false)
  const [snippet, setSnippet] = React.useState('<script src="https://fghjyy.vercel.app/chat-widget.js" data-bot-id="USER_BOT_ID"></script>')
  const [isEmbedLoading, setIsEmbedLoading] = React.useState(false)
  const [embedError, setEmbedError] = React.useState<string | null>(null)
  const [embedTitle, setEmbedTitle] = React.useState('Embed Script')
  const [showDiscord, setShowDiscord] = React.useState(false)
  const [discordAgentId, setDiscordAgentId] = React.useState<string>('')
  const [discordClientId, setDiscordClientId] = React.useState('')
  const [discordToken, setDiscordToken] = React.useState('')
  const [discordLoading, setDiscordLoading] = React.useState(false)
  const [discordError, setDiscordError] = React.useState<string | null>(null)
  const [discordSaved, setDiscordSaved] = React.useState(false)
  const saveDiscordConfig = useMutation(api.discord.saveBotConfig)
  
  // Telegram state
  const [showTelegram, setShowTelegram] = React.useState(false)
  const [telegramAgentId, setTelegramAgentId] = React.useState<string>('')

  // Load existing Discord config for this agent (when dialog is open and agent id is available)
  // Only query when user is signed in to avoid Convex auth errors
  const { isSignedIn } = useUser();
  const myDiscordCfg = useQuery(
    api.discord.getMyBotConfig,
    (isSignedIn && showDiscord && discordAgentId)
      ? { agentId: discordAgentId as Id<'agents'> }
      : "skip"
  )

  React.useEffect(() => {
    if (myDiscordCfg) {
      if (typeof myDiscordCfg.clientId === 'string') setDiscordClientId(myDiscordCfg.clientId)
      if (myDiscordCfg.hasToken) setDiscordSaved(true)
    }
  }, [myDiscordCfg])

  const handleClick = async (pluginId: string) => {
    if (pluginId === "wordpress") {
      router.push('/integrations/wordpress');
      return;
    }
    if (pluginId === "discord") {
      try {
        const id = await getAgentId()
        setDiscordAgentId(id)
        setDiscordError(null)
        setDiscordSaved(false)
        setShowDiscord(true)
      } catch (err) {
        console.error('Failed to get agent id for Discord', err)
        setEmbedError('Could not save agent. Please fix required fields or sign in, then try again.')
      }
      return;
    }
    if (pluginId === "telegram") {
      try {
        const id = await getAgentId()
        setTelegramAgentId(id)
        setShowTelegram(true)
      } catch (e) {
        console.error('Failed to ensure agent before opening Telegram config', e)
      }
      return;
    }
    if (pluginId === "shopify") {
      setEmbedTitle('Shopify embed snippet')
      setEmbedError(null)
      setShowEmbed(true)
      setIsEmbedLoading(true)
      try {
        const id = await getAgentId()
        const origin = process.env.NEXT_PUBLIC_WIDGET_ORIGIN || 'https://fghjyy.vercel.app'
        setSnippet(`<script src="${origin}/widget.js" data-bot-id="${id}"></script>`)
      } catch (err) {
        console.error('Failed to get agent id for embed', err)
        setEmbedError('Could not save agent. Please fix required fields or sign in, then try again.')
      } finally {
        setIsEmbedLoading(false)
      }
      return;
    }
    if (pluginId === "html-css") {
      setEmbedTitle('Embed Script')
      setEmbedError(null)
      setShowEmbed(true)
      setIsEmbedLoading(true)
      try {
        const id = await getAgentId()
        const origin = process.env.NEXT_PUBLIC_WIDGET_ORIGIN || 'https://fghjyy.vercel.app'
        setSnippet(`<script src="${origin}/chat-widget.js" data-bot-id="${id}"></script>`)
      } catch (err) {
        console.error('Failed to get agent id for embed', err)
        setEmbedError('Could not save agent. Please fix required fields or sign in, then try again.')
      } finally {
        setIsEmbedLoading(false)
      }
    }
  }

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
    } catch (e) {
      console.error('Failed to copy snippet', e)
    }
  }

  return (
    <TabsContent value="plugins" className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-lg mb-2">
        <h3 className="text-base font-medium text-black">Available Plugins</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {plugins.map((plugin) => (
          <Card 
            key={plugin.id}
            onClick={() => handleClick(plugin.id)}
            className={(plugin.id === 'html-css' || plugin.id === 'wordpress' || plugin.id === 'shopify' || plugin.id === 'discord' || plugin.id === 'telegram') ? 'cursor-pointer' : undefined}
          >
            <CardContent className="p-3">
              <div className="flex items-center">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded bg-white border flex items-center justify-center mr-3 p-1">
                    <div className="relative h-10 w-10">
                      <Image
                        alt={`${plugin.name} logo`}
                        src={plugin.logoUrl}
                        fill
                        className="object-contain"
                        sizes="40px"
                        onError={(e) => {
                          const parent = (e.target as HTMLImageElement).closest('div');
                          if (parent) {
                            (parent as HTMLDivElement).className = "h-10 w-10 rounded bg-gray-100 flex items-center justify-center mr-3";
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-black">{plugin.name}</h4>
                  <p className="text-sm text-black">
                    {plugin.id === "wordpress" && "Embed chatbot on WordPress sites"}
                    {plugin.id === "shopify" && "Shopify embed snippet"}
                    {plugin.id === "whatsapp" && "Connect via WhatsApp Business API"}
                    {plugin.id === "html-css" && "HTML embed snippet"}
                    {plugin.id === "instagram" && "Instagram Direct Messages integration"}
                    {plugin.id === "messenger" && "Facebook Messenger integration via Meta"}
                    {plugin.id === "telegram" && "Telegram Bot API integration"}
                    {plugin.id === "discord" && "Discord bot integration"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <h3 className="text-base font-medium mb-2 text-black">Plugin Configuration</h3>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-black mb-2">Enable plugins above to configure their settings. Each plugin may require API keys or authentication tokens.</p>
          <Button variant="ghost" size="sm" className="text-black hover:bg-gray-100">
            <Puzzle className="mr-2 h-4 w-4" />
            View Plugin Documentation
          </Button>
        </div>
      </div>

      <Dialog open={showEmbed} onOpenChange={(open) => { setShowEmbed(open); if (!open) { setEmbedError(null); setEmbedTitle('Embed Script'); } }}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{embedTitle}</DialogTitle>
            <DialogDescription>Copy and paste this into your website&apos;s HTML.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isEmbedLoading ? (
              <div className="flex items-center gap-2 text-sm text-black"><RefreshCw className="h-4 w-4 animate-spin" /> Preparing your embed...</div>
            ) : embedError ? (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{embedError}</div>
            ) : (
              <pre className="bg-gray-100 text-black p-3 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
                <code>{snippet}</code>
              </pre>
            )}
            <div className="flex gap-2 justify-end">
              <Button onClick={copySnippet} variant="secondary" disabled={!!embedError || isEmbedLoading}>Copy</Button>
              <Button onClick={() => setShowEmbed(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiscord} onOpenChange={(open) => { setShowDiscord(open); if (!open) { setDiscordError(null); setDiscordSaved(false); setDiscordClientId(''); setDiscordToken(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Discord Bot</DialogTitle>
            <DialogDescription>
              Enter your Discord Application Client ID and Bot Token. We&apos;ll associate them with this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open Discord Developer Portal
              </a>
              {discordClientId?.trim() && (
                <a
                  href={`https://discord.com/developers/applications/${encodeURIComponent(discordClientId)}/bot`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open Bot Settings for this Client ID
                </a>
              )}
            </div>
            {discordLoading ? (
              <div className="flex items-center gap-2 text-sm text-black"><RefreshCw className="h-4 w-4 animate-spin" /> Preparing Discord configuration...</div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Agent ID</label>
                  <Input value={discordAgentId} readOnly className="text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Discord Client ID</label>
                  <Input value={discordClientId} onChange={(e) => setDiscordClientId(e.target.value)} placeholder="123456789012345678" className="text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Bot Token</label>
                  <Input type="password" value={discordToken} onChange={(e) => setDiscordToken(e.target.value)} placeholder="Bot token" className="text-black" />
                </div>
                {discordError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{discordError}</div>
                )}
                {discordSaved && (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">Saved. Your Discord bot is linked to this agent.</div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={async () => {
                      setDiscordError(null)
                      setDiscordSaved(false)
                      if (!discordClientId.trim() || !discordToken.trim()) {
                        setDiscordError('Please enter both Client ID and Bot Token.')
                        return
                      }
                      try {
                        setDiscordLoading(true)
                        // Persist to backend
                        await saveDiscordConfig({
                          agentId: discordAgentId as unknown as Id<'agents'>,
                          clientId: discordClientId.trim(),
                          token: discordToken.trim(),
                        })
                        setDiscordSaved(true)
                        // Skipping Railway provisioning per project preference. Bot can be run via HTTPS interactions or external runner.
                        // Build invite URL for convenience
                        const clientId = encodeURIComponent(discordClientId.trim())
                        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=3072`
                        if (typeof window !== 'undefined') {
                          window.open(inviteUrl, '_blank')
                        }
                      } catch (e) {
                        console.error('Failed to save Discord config', e)
                        setDiscordError(e instanceof Error ? e.message : 'Failed to save Discord configuration.')
                      } finally {
                        setDiscordLoading(false)
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => setShowDiscord(false)}>Close</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTelegram} onOpenChange={(open) => { setShowTelegram(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Telegram Bot</DialogTitle>
            <DialogDescription>
              Set up your Telegram bot to automatically respond to messages.
            </DialogDescription>
          </DialogHeader>
          <TelegramConfig agentId={telegramAgentId as Id<"agents">} />
        </DialogContent>
      </Dialog>
    </TabsContent>
  )
}

// Page Component
const CreateAgentPage = () => {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()

  const handleClose = () => {
    setIsOpen(false)
    router.back()
  }

  if (!isOpen) return null

  return <CreateAgentModal onClose={handleClose} />
}

export default CreateAgentPage