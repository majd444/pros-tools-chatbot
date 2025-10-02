"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { useRouter, useParams } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useUser } from "@clerk/nextjs"
import { useToast } from "../../../../components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { 
  Puzzle,
  Trash2,
  ArrowLeft
} from "lucide-react"
import SimpleChatForm from "@/components/simple-chat-form"
import TelegramConfig from "@/components/TelegramConfig"
import MetaConfig from "@/components/MetaConfig"
import DiscordConfig from "@/components/DiscordConfig"

// Types
type FormField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  value?: string;
  isEditing?: boolean;
};

type FormState = {
  name: string;
  welcomeMessage: string;
  collectUserInfo: boolean;
  systemPrompt: string;
  headerColor: string;
  accentColor: string;
  backgroundColor: string;
  temperature: number;
  formFields: FormField[];
  fontFamily?: 'Roboto' | 'Inter' | 'Open Sans' | 'System Default';
  fontSize?: 'Small' | 'Medium' | 'Large';
  textAlign?: 'Left' | 'Center' | 'Right';
  initials?: string;
};

interface ExtractedContent {
  url: string;
  text: string;
  structured?: {
    tabs: Array<{ id: string; label: string }>;
    inputs: Array<{ id: string; type: string; label: string; required: boolean }>;
    buttons: Array<{ id: string; type: string; label: string; action: string }>;
    links: Array<{ text: string; href?: string }>;
  };
}

// Main Component
export default function AgentSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { user, isLoaded: isUserLoaded } = useUser();
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [showPluginModal, setShowPluginModal] = useState(false);
  const [currentPlugin, setCurrentPlugin] = useState<{id: string, name: string} | null>(null);
  const [activeTab, setActiveTab] = useState("configuration");
  // Discord configuration UI moved to components/DiscordConfig
  const [formState, setFormState] = useState<FormState>({
    name: "",
    welcomeMessage: "",
    collectUserInfo: false,
    systemPrompt: "You are a helpful AI assistant.",
    headerColor: "#3B82F6",
    accentColor: "#00D4FF",
    backgroundColor: "#FFFFFF",
    temperature: 0.7,
    formFields: [],
    fontFamily: 'Inter',
    fontSize: 'Medium',
    textAlign: 'Left',
    initials: ''
  });

  // File upload state
  const [extractionUrl, setExtractionUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedContents, setExtractedContents] = useState<ExtractedContent[]>([]);
  
  // Color picker popovers removed; inputs used directly
  const presetColors = [
    '#6B7280', '#EF4444', '#EC4899', '#8B5CF6', '#7C3AED',
    '#4F46E5', '#3B82F6', '#06B6D4', '#14B8A6', '#10B981',
    '#84CC16', '#F59E0B', '#F97316', '#FFFFFF'
  ];

  // Local type for knowledge entries
  type KnowledgeEntry = {
    _id: Id<"fineTuningOutputs">;
    input: string;
    output: string;
    createdAt: number;
    metadata?: unknown;
  };

  // Convex mutations
  const updateAgent = useMutation(api.agents.update);
  const saveFineTuning = useMutation(api.fineTuning.saveFineTuningOutput);
  const removeAgent = useMutation(api.agents.remove);
  const agent = useQuery(
    api.agents.get,
    (isUserLoaded && !!user) ? { id: params.id as Id<"agents"> } : "skip"
  );
  // Only query when authenticated to avoid edge cases and runtime errors in public path
  const shouldRunPrivate = isUserLoaded && !!user;
  const knowledgeEntriesPrivate = useQuery(
    api.fineTuning.getAgentFineTuningOutputs,
    shouldRunPrivate ? { agentId: String(params.id) } : "skip"
  );
  const knowledgeEntries = useMemo(() => (
    shouldRunPrivate && knowledgeEntriesPrivate ? knowledgeEntriesPrivate : []
  ), [shouldRunPrivate, knowledgeEntriesPrivate]);
  const [viewEntry, setViewEntry] = useState<KnowledgeEntry | null>(null);
  const [expandedLinks, setExpandedLinks] = useState<Set<number>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const urlEntries = useMemo(() => (knowledgeEntries || []).filter(e => (e.input || '').startsWith('url:')), [knowledgeEntries]);

  // Origin for embeds (defaults to localhost in SSR)
  const embedOrigin = useMemo(() => {
    if (process.env.NEXT_PUBLIC_WIDGET_ORIGIN) return process.env.NEXT_PUBLIC_WIDGET_ORIGIN as string;
    return 'https://fghjyy.vercel.app';
  }, []);

  // Update form state when agent data loads
  useEffect(() => {
    if (agent) {
      setFormState(prev => ({
        ...prev,
        name: agent.name || "",
        welcomeMessage: agent.welcomeMessage || "",
        collectUserInfo: agent.collectUserInfo || false,
        systemPrompt: agent.systemPrompt || "You are a helpful AI assistant.",
        headerColor: agent.headerColor || "#3B82F6",
        accentColor: agent.accentColor || "#00D4FF",
        backgroundColor: agent.backgroundColor || "#FFFFFF",
        temperature: agent.temperature || 0.7,
        formFields: agent.formFields || [],
        fontFamily: (agent as Partial<FormState>).fontFamily ?? 'Inter',
        fontSize: (agent as Partial<FormState>).fontSize ?? 'Medium',
        textAlign: (agent as Partial<FormState>).textAlign ?? 'Left',
        initials: (agent as Partial<FormState>).initials ?? ''
      }));
      setIsLoading(false);
    }
  }, [agent]);

  // Update form state helper
  const updateFormState = useCallback((updates: Partial<FormState>) => {
    setFormState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Configuration helpers (match create-agent behavior)
  const toggleCollectUserInfo = () => {
    setFormState(prev => ({
      ...prev,
      collectUserInfo: !prev.collectUserInfo,
      formFields: !prev.collectUserInfo ? prev.formFields : []
    }));
  };

  const addField = (type: string) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: type === 'name' ? 'Name' : type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'Field',
      required: true
    };
    setFormState(prev => ({ ...prev, formFields: [...(prev.formFields || []), newField] }));
  };

  const toggleRequired = (id: string) => {
    setFormState(prev => ({
      ...prev,
      formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, required: !f.required } : f)
    }));
  };

  const toggleEditLabel = (id: string) => {
    setFormState(prev => ({
      ...prev,
      formFields: (prev.formFields || []).map(f => ({ ...f, isEditing: f.id === id ? !f.isEditing : false }))
    }));
  };

  const updateFieldLabel = (id: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    setFormState(prev => ({
      ...prev,
      formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, label: newLabel.trim(), isEditing: false } : f)
    }));
  };

  const removeField = (id: string) => {
    setFormState(prev => ({
      ...prev,
      formFields: (prev.formFields || []).filter(f => f.id !== id)
    }));
  };

  const clearAllFields = () => {
    setFormState(prev => ({ ...prev, formFields: [] }));
  };

  // Handle plugin card click
  const handlePluginClick = (plugin: {id: string, name: string}) => {
    setCurrentPlugin(plugin);
    setShowPluginModal(true);
  };

  // Handle form submission
  const handleSave = async () => {
    if (!formState.name.trim()) {
      toast({
        title: "Error",
        description: "Agent name is required",
        className: "bg-red-500 text-white"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Ensure formFields is properly initialized and has at least one valid field
      const formFields = (Array.isArray(formState.formFields) ? formState.formFields : [])
        .filter(field => field && typeof field === 'object' && field.id)
        .map(field => ({
          id: String(field.id || `field-${Date.now()}`),
          type: String(field.type || 'text'),
          label: String(field.label || 'Untitled Field'),
          required: Boolean(field.required),
          value: field.value ? String(field.value) : ''
        }));
      
      // Add a default field if no valid fields exist
      const validatedFormFields = formFields.length > 0 ? formFields : [{
        id: `field-${Date.now()}`,
        type: 'text',
        label: 'Name',
        required: true,
        value: ''
      }];
      
      // Prepare the update data with all required fields
      const updateData = {
        id: params.id as Id<"agents">,
        name: String(formState.name || 'Untitled Agent').trim(),
        welcomeMessage: String(formState.welcomeMessage || '').trim(),
        systemPrompt: String(formState.systemPrompt || 'You are a helpful AI assistant.').trim(),
        temperature: typeof formState.temperature === 'number' ? 
          Math.max(0, Math.min(1, formState.temperature)) : 0.7,
        headerColor: /^#[0-9A-Fa-f]{6}$/.test(formState.headerColor) ? 
          formState.headerColor : "#3B82F6",
        accentColor: /^#[0-9A-Fa-f]{6}$/.test(formState.accentColor) ? 
          formState.accentColor : "#00D4FF",
        backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(formState.backgroundColor) ? 
          formState.backgroundColor : "#FFFFFF",
        collectUserInfo: Boolean(formState.collectUserInfo),
        formFields: validatedFormFields
      };
      
      console.log('Sending update data:', JSON.stringify(updateData, null, 2));
      
      const result = await updateAgent(updateData);
      console.log('Update result:', result);
      
      toast({
        title: "Success",
        description: "Agent updated successfully",
        className: "bg-green-500 text-white"
      });
      
      router.replace('/dashboard');
    } catch (error) {
      console.error("Error updating agent:", error);
      
      // Log more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        });
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? 
          `Failed to update agent: ${error.message}` : 
          "An unknown error occurred while updating the agent.",
        className: "bg-red-500 text-white"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle agent deletion
  const handleDelete = async () => {
    // Require authentication before allowing deletion
    if (!isUserLoaded || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to delete this agent.",
        className: "bg-yellow-500 text-white",
      });
      return;
    }
    const confirmed = window.confirm("Delete this agent? This action cannot be undone.");
    if (!confirmed) return;
    try {
      setIsLoading(true);
      await removeAgent({ id: params.id as Id<"agents"> });
      toast({
        title: "Agent deleted",
        description: "The agent and its knowledge were removed.",
        className: "bg-green-500 text-white",
      });
      router.replace("/dashboard");
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete agent",
        className: "bg-red-500 text-white",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Process files for upload
  const processFiles = useCallback(async (files: FileList): Promise<{ processedFiles: string[]; errors: string[] }> => {
    const errors: string[] = [];
    const processedFiles: string[] = [];
    const allowedExtensions = ['.txt', '.md', '.json', '.pdf'];
    const allowedTypes = ['text/', 'application/pdf'];

    for (const file of Array.from(files)) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isAllowedType = allowedTypes.some(type => file.type.startsWith(type)) || 
                           allowedExtensions.includes(`.${fileExt}`);
        
        if (!isAllowedType) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        processedFiles.push(file.name);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(errorMessage);
      }
    }

    return { processedFiles, errors };
  }, []);

  // Handle file upload: read contents and save into knowledge base
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      const { processedFiles, errors } = await processFiles(e.target.files);

      // Persist contents for allowed files
      const files = Array.from(e.target.files);
      const saves = files.map(async (file) => {
        // Skip disallowed types (already validated in processFiles)
        const isAllowed = [
          "text/plain",
          "text/markdown",
          "application/json",
          "application/pdf",
        ].includes(file.type) || /\.(txt|md|json|pdf)$/i.test(file.name);
        if (!isAllowed) return;

        let content = "";
        let metadata: Record<string, unknown> = { filename: file.name, mimeType: file.type, size: file.size };

        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          // PDF text extraction is experimental; store placeholder with metadata
          content = "[PDF uploaded: text extraction pending]";
          metadata = { ...metadata, note: "PDF extraction not implemented on client" };
        } else {
          // Read text for txt/md/json
          const text = await file.text();
          content = text;
          // Attempt to parse JSON for metadata enrichment
          if (file.type === "application/json" || /\.json$/i.test(file.name)) {
            try {
              const json = JSON.parse(text);
              metadata = { ...metadata, parsed: true, keys: Array.isArray(json) ? undefined : Object.keys(json) };
            } catch {
              metadata = { ...metadata, parsed: false };
            }
          }
        }

        await saveFineTuning({
          agentId: String(params.id),
          input: `file:${file.name}`,
          output: content,
          metadata,
        });
      });

      await Promise.all(saves);

      if (processedFiles.length > 0) {
        toast({
          title: "Saved to Knowledge Base",
          description: `Uploaded ${processedFiles.length} file(s) to the agent KB`,
          className: "bg-green-500 text-white",
        });
      }
      if (errors.length > 0) {
        toast({
          title: "Some files failed",
          description: `Issues: ${errors.join(", ")}`,
          className: "bg-red-500 text-white",
        });
      }
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        className: "bg-red-500 text-white",
      });
    } finally {
      // Reset file input so same file can be reselected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [processFiles, saveFineTuning, params.id, toast]);

  // Handle URL extraction via Next.js edge route: extract and persist into knowledge base
  const handleExtract = useCallback(async () => {
    if (!extractionUrl) return;
    // Allow extraction for preview even if not signed in; only saving is gated
    const canSave = !!(isUserLoaded && user);
    if (!canSave) {
      toast({
        title: 'Preview only',
        description: 'Not signed in. Extracted content will show below but will not be saved.',
        className: 'bg-yellow-500 text-white',
      });
    }

    try {
      setIsExtracting(true);
      // Call our Next.js extractor endpoint
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extractionUrl }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Extractor failed: ${resp.status} ${resp.statusText} ${errText}`);
      }
      const data: { success: boolean; text: string; structured?: unknown } = await resp.json();
      if (!data.success) throw new Error('Extractor returned unsuccessful result');

      // Guard against oversized saves
      const MAX_SAVE_CHARS = 200_000;
      const textToSave = (data.text || '').slice(0, MAX_SAVE_CHARS);

      // Persist to knowledge base only if signed in
      let insertedId: unknown = null;
      if (canSave) {
        insertedId = await saveFineTuning({
          agentId: String(params.id),
          input: `url:${extractionUrl}`,
          output: textToSave,
          metadata: { structured: data.structured, source: 'edge-extract', lengthOriginal: (data.text || '').length },
        });
        console.log('Saved fine-tuning entry with id:', insertedId);
      }

      // UI preview
      const preview: ExtractedContent = {
        url: extractionUrl,
        text: textToSave || '',
        structured: (data.structured ?? undefined) as ExtractedContent['structured'],
      };
      setExtractedContents(prev => [...prev, preview]);
      
      toast({
        title: canSave ? 'Saved to Knowledge Base' : 'Preview Ready',
        description: canSave 
          ? `Saved (${textToSave.length} chars of ${data.text.length}).`
          : `Extracted ${textToSave.length} chars. Sign in to save to your Knowledge Base.`,
        className: canSave ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
      });
    } catch (error) {
      console.error('Error extracting content:', error);
      toast({
        title: 'Error',
        description: 'Failed to extract or save content',
        className: 'bg-red-500 text-white'
      });
    } finally {
      setIsExtracting(false);
    }
  }, [extractionUrl, params.id, saveFineTuning, toast, isUserLoaded, user]);

  // Remove a link from extracted content list (used in Fine-tuning UI)
  const removeLink = useCallback((index: number) => {
    setExtractedContents(prev => prev.filter((_, i) => i !== index));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 bg-white flex flex-col h-screen w-screen">
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-black">Edit Agent</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="text-black hover:bg-gray-100"
            onClick={() => router.push('/dashboard')}
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
            disabled={isLoading || !isUserLoaded || !user}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/3 overflow-y-auto p-6 border-r border-gray-200">
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 mb-6 h-12 gap-4">
              <TabsTrigger value="configuration" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-20">Configuration</TabsTrigger>
              <TabsTrigger value="fine-tuning" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">Fine-tuning</TabsTrigger>
              <TabsTrigger value="style" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">Style</TabsTrigger>
              <TabsTrigger value="plugins" className="text-black data-[state=active]:text-black text-base h-10 flex items-center justify-center px-8">Plugins</TabsTrigger>
            </TabsList>
            
            <TabsContent value="configuration" className="mt-4">
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-black">Name</label>
                    <Input placeholder="AI Assistant" value={formState.name} onChange={(e) => updateFormState({ name: e.target.value })} />
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
                      <label className="block text-sm font-medium text-black">Temperature: {formState.temperature.toFixed(1)}</label>
                      <span className="text-sm text-black">Balanced</span>
                    </div>
                    <Slider value={[formState.temperature * 100]} max={100} step={1} onValueChange={([value]) => updateFormState({ temperature: value / 100 })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-black">System Prompt</label>
                    <Textarea
                      placeholder="You are a helpful AI assistant."
                      value={formState.systemPrompt}
                      onChange={(e) => updateFormState({ systemPrompt: e.target.value })}
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-black mt-1">This prompt defines your assistant&apos;s personality and capabilities.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-black">Welcome Message</label>
                    <Textarea
                      placeholder="👋 Hi, I&apos;m an AI Assistant! I can help with information."
                      value={formState.welcomeMessage}
                      onChange={(e) => updateFormState({ welcomeMessage: e.target.value })}
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
                      <Switch checked={formState.collectUserInfo} onCheckedChange={toggleCollectUserInfo} />
                    </div>
                    {formState.collectUserInfo && (
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-black mb-3">Add Field Templates</h4>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => addField('name')}>Name Field</Button>
                            <Button variant="outline" size="sm" onClick={() => addField('email')}>Email Field</Button>
                            <Button variant="outline" size="sm" onClick={() => addField('phone')}>Phone Number</Button>
                            <Button variant="outline" size="sm" onClick={() => addField('custom')}>Custom Field</Button>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-black">Active Fields</h4>
                            {formState.formFields.length > 0 && (
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={clearAllFields}>
                                Clear All
                              </Button>
                            )}
                          </div>
                          {formState.formFields.length > 0 ? (
                            <div className="space-y-2">
                              {formState.formFields.map((field) => (
                                <div key={field.id} className="group relative p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    {field.isEditing ? (
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="text"
                                          className="text-sm border rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          defaultValue={field.label}
                                          onKeyDown={(e) => {
                                            if ((e as React.KeyboardEvent<HTMLInputElement>).key === 'Enter') updateFieldLabel(field.id, (e.target as HTMLInputElement).value)
                                            else if ((e as React.KeyboardEvent<HTMLInputElement>).key === 'Escape') toggleEditLabel(field.id)
                                          }}
                                          onBlur={(e) => updateFieldLabel(field.id, e.target.value)}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-xs text-gray-500">{field.required && <span className="text-red-500">*</span>}</span>
                                      </div>
                                    ) : (
                                      <div className="group flex items-center cursor-pointer" onClick={() => toggleEditLabel(field.id)}>
                                        <div className="flex items-center">
                                          <h4 className="text-sm font-medium text-gray-900 group-hover:bg-gray-100 px-1 -mx-1 rounded">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                          </h4>
                                        </div>
                                      </div>
                                    )}
                                    <label className="inline-flex items-center cursor-pointer">
                                      <span className="text-xs text-gray-500 mr-2">{field.required ? 'Required' : 'Optional'}</span>
                                      <div className="relative" onClick={() => toggleRequired(field.id)}>
                                        <div className={`w-8 h-4 rounded-full transition-colors ${field.required ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${field.required ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                      </div>
                                    </label>
                                  </div>
                                  <div className="mt-1 flex items-center">
                                    <span className="text-xs text-gray-500 mr-2">{field.type}</span>
                                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => removeField(field.id)}>Remove</Button>
                                  </div>
                                </div>
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
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="fine-tuning" className="mt-4">
              {/* Header blurb */}
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <h3 className="text-lg font-medium text-black">Fine-tuning Data</h3>
                <p className="text-sm text-black">Upload files or extract content from URLs to fine-tune your agent&apos;s knowledge base.</p>
              </div>

              {/* Extract Links & Content card */}
              <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                <div className="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6">
                  <div className="leading-none font-semibold flex items-center text-black">
                    {/* Globe icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe h-5 w-5 mr-2 text-blue-500" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                    Extract Links &amp; Content
                  </div>
                  <div className="text-sm text-black">Extract links and content from websites to use as training data</div>
                </div>
                <div className="px-6">
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <input
                        className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-8"
                        placeholder="Enter URL to extract links"
                        type="text"
                        value={extractionUrl}
                        onChange={(e) => setExtractionUrl(e.target.value)}
                      />
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 has-[&>svg]:px-3 whitespace-nowrap"
                        onClick={handleExtract}
                        disabled={isExtracting}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe h-4 w-4 mr-2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                        {isExtracting ? 'Extracting...' : 'Extract Content'}
                      </button>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2 text-black">Extracted Links ({extractedContents.length})</h4>
                      {extractedContents.length === 0 ? (
                        <div className="text-center py-4 text-black text-sm">No links extracted yet</div>
                      ) : (
                        <div className="space-y-3 mt-2">
                          {extractedContents.map((item, index) => {
                            const isOpen = expandedLinks.has(index);
                            return (
                              <div key={index} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <a href={item.url} target="_blank" className="text-sm text-blue-600 hover:underline truncate max-w-[60%]" rel="noreferrer">{item.url}</a>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-all border bg-white hover:bg-gray-50 h-7 px-3 py-1 text-gray-700"
                                      onClick={() => setExpandedLinks(prev => {
                                        const next = new Set(prev);
                                        if (next.has(index)) next.delete(index); else next.add(index);
                                        return next;
                                      })}
                                    >
                                      {isOpen ? 'Hide' : 'Show'}
                                    </button>
                                    <Button variant="ghost" size="sm" onClick={() => removeLink(index)}>Remove</Button>
                                  </div>
                                </div>
                                <p className={`mt-2 text-xs text-gray-500 ${isOpen ? '' : 'line-clamp-3'}`}>{item.text}</p>
                                {isOpen && (
                                  <div className="mt-2 max-h-56 overflow-auto border rounded bg-white p-3">
                                    <pre className="whitespace-pre-wrap break-words text-xs text-gray-800">{item.text}</pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-2 text-black">Saved URL Entries {knowledgeEntries === undefined ? '' : `(${urlEntries.length})`}</h4>
                      {knowledgeEntries === undefined ? (
                        <div className="text-sm text-gray-600">Loading...</div>
                      ) : urlEntries.length === 0 ? (
                        <div className="text-sm text-gray-600">No URL entries yet</div>
                      ) : (
                        <div className="space-y-3 mt-2">
                          {urlEntries.map((entry) => (
                            <div key={entry._id} className="p-4 border rounded-lg bg-white">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-black truncate max-w-[70%]">
                                  {(entry.input || '').slice(0, 120)}
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-xs text-gray-500">
                                    {new Date(entry.createdAt).toLocaleString()}
                                  </div>
                                  <button
                                    className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-all border bg-white hover:bg-gray-50 h-7 px-3 py-1 text-gray-700"
                                    onClick={() => setExpandedEntries(prev => {
                                      const key = String(entry._id);
                                      const next = new Set(prev);
                                      if (next.has(key)) next.delete(key); else next.add(key);
                                      return next;
                                    })}
                                  >
                                    {expandedEntries.has(String(entry._id)) ? 'Hide' : 'Show'}
                                  </button>
                                  <button
                                    className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-all border bg-white hover:bg-gray-50 h-7 px-3 py-1 text-gray-700"
                                    onClick={() => setViewEntry(entry)}
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
                                {(entry.output || '').slice(0, 600)}
                              </p>
                              <div className="mt-2 text-xs text-gray-500">
                                Length: {entry.output?.length || 0} chars
                              </div>
                              {expandedEntries.has(String(entry._id)) && (
                                <div className="mt-2 max-h-64 overflow-auto border rounded bg-white p-3">
                                  <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{entry.output}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Documents */}
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2 text-black">Upload Documents</label>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-gray-300 hover:border-blue-400 bg-white">
                    <input
                      multiple
                      className="hidden"
                      id="file-upload"
                      accept=".txt,.md,.json,.pdf"
                      type="file"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center text-blue-500 hover:text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload h-6 w-6 mx-auto mb-2" aria-hidden="true"><path d="M12 3v12"></path><path d="m17 8-5-5-5 5"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path></svg>
                      <p className="text-sm text-black">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-600 mt-1">Supported formats: .txt, .md, .json, .pdf</p>
                      <p className="text-xs text-gray-500 mt-1">(PDF text extraction is experimental)</p>
                    </label>
                  </div>

                  {/* Knowledge Base Entries */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-2 text-black">Knowledge Base Entries</h4>
                    {knowledgeEntries === undefined ? (
                      <div className="text-sm text-gray-600">Loading...</div>
                    ) : knowledgeEntries.length === 0 ? (
                      <div className="text-center py-4 text-black text-sm border border-dashed rounded-md bg-gray-50">
                        <p>No knowledge entries yet</p>
                        <p className="text-xs text-gray-500 mt-1">Extract a URL or upload files to populate knowledge</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {knowledgeEntries.map((entry) => (
                          <div key={entry._id} className="p-4 border rounded-lg bg-white">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-black truncate max-w-[70%]">
                                {(entry.input || '').slice(0, 120)}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-xs text-gray-500">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </div>
                                <button
                                  className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-all border bg-white hover:bg-gray-50 h-7 px-3 py-1 text-gray-700"
                                  onClick={() => setExpandedEntries(prev => {
                                    const key = String(entry._id);
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key); else next.add(key);
                                    return next;
                                  })}
                                >
                                  {expandedEntries.has(String(entry._id)) ? 'Hide' : 'Show'}
                                </button>
                                <button
                                  className="inline-flex items-center justify-center gap-2 rounded-md text-xs font-medium transition-all border bg-white hover:bg-gray-50 h-7 px-3 py-1 text-gray-700"
                                  onClick={() => setViewEntry(entry)}
                                >
                                  View
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
                              {(entry.output || '').slice(0, 600)}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              Length: {entry.output?.length || 0} chars
                            </div>
                            {expandedEntries.has(String(entry._id)) && (
                              <div className="mt-2 max-h-64 overflow-auto border rounded bg-white p-3">
                                <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{entry.output}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* View full entry modal */}
              <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="truncate">{viewEntry?.input || 'Entry'}</DialogTitle>
                    <DialogDescription>
                      Saved {viewEntry ? new Date(viewEntry.createdAt).toLocaleString() : ''} • {viewEntry?.output?.length || 0} chars
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-2 border rounded bg-white p-3 overflow-auto max-h-[56vh]">
                    <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{viewEntry?.output}</pre>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="style" className="flex-1 outline-none space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-black">Agent Avatar</label>
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div
                      className="h-48 w-48 rounded-full flex items-center justify-center overflow-hidden relative group bg-gray-100 border-2 border-gray-200"
                      style={{ cursor: 'grab', touchAction: 'none', backgroundColor: formState.headerColor }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white font-bold text-6xl">{(formState.initials || formState.name || 'AA').slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200 cursor-pointer">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-center p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload h-8 w-8 text-white mx-auto mb-1" aria-hidden="true"><path d="M12 3v12"></path><path d="m17 8-5-5-5 5"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path></svg>
                          <span className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">Upload Photo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <button
                    className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[&>svg]:px-3 flex items-center text-black mb-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload h-4 w-4 mr-2" aria-hidden="true"><path d="M12 3v12"></path><path d="m17 8-5-5-5 5"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path></svg>
                    Upload Photo
                  </button>
                  <input accept="image/*" className="hidden" type="file" ref={fileInputRef} onChange={handleFileUpload} />
                  <div className="mt-1">
                    <input
                      placeholder="Enter initials (e.g., AA)"
                      maxLength={2}
                      className="text-xs p-1 border rounded w-20"
                      type="text"
                      value={(formState.initials || '').slice(0, 2).toUpperCase()}
                      onChange={(e) => updateFormState({ initials: e.target.value.toUpperCase().slice(0, 2) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Or enter initials</p>
                  </div>
                  <p className="text-xs text-black mt-1">Recommended: PNG format, 512x512 pixels, max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-black">Text Style</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-black">Font Family</span>
                      <select className="p-2 border border-gray-300 rounded-md text-black" value={formState.fontFamily} onChange={(e) => updateFormState({ fontFamily: e.target.value as FormState['fontFamily'] })}>
                        <option value="Roboto">Roboto</option>
                        <option value="Inter">Inter</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="System Default">System Default</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-black">Size</span>
                      <select className="p-2 border border-gray-300 rounded-md text-black" value={formState.fontSize} onChange={(e) => updateFormState({ fontSize: e.target.value as FormState['fontSize'] })}>
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-black">Alignment</span>
                      <select className="p-2 border border-gray-300 rounded-md text-black" value={formState.textAlign} onChange={(e) => updateFormState({ textAlign: e.target.value as FormState['textAlign'] })}>
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
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Header Color (Top bar)</label>
                      <div className="flex items-center space-x-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[&>svg]:px-3 w-10 h-10 p-0 rounded-full overflow-hidden border-2 border-gray-300"
                              type="button"
                              aria-label="Choose header color"
                            >
                              <div className="w-full h-full" style={{ backgroundColor: formState.headerColor }}></div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="center" className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border shadow-md outline-hidden w-48 p-3">
                            <div className="grid grid-cols-5 gap-2">
                              {presetColors.map((c) => (
                                <button
                                  type="button"
                                  key={`header-${c}`}
                                  className={`w-6 h-6 rounded border-2 ${formState.headerColor === c ? 'border-blue-500' : 'border-transparent'}`}
                                  aria-label={`Select ${c} color`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => updateFormState({ headerColor: c })}
                                />
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded border flex-shrink-0" style={{ backgroundColor: formState.headerColor }} />
                                <Input
                                  id="header-color-input"
                                  placeholder="#rrggbb"
                                  value={formState.headerColor}
                                  onChange={(e) => updateFormState({ headerColor: e.target.value })}
                                  className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-8"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <div className="flex-1">
                          <input
                            className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-10"
                            id="header-color-input"
                            placeholder="#rrggbb"
                            value={formState.headerColor}
                            onChange={(e) => updateFormState({ headerColor: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color (Buttons, links)</label>
                      <div className="flex items-center space-x-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[&>svg]:px-3 w-10 h-10 p-0 rounded-full overflow-hidden border-2 border-gray-300"
                              type="button"
                              aria-label="Choose accent color"
                            >
                              <div className="w-full h-full" style={{ backgroundColor: formState.accentColor }}></div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="center" className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border shadow-md outline-hidden w-48 p-3">
                            <div className="grid grid-cols-5 gap-2">
                              {presetColors.map((c) => (
                                <button
                                  type="button"
                                  key={`accent-${c}`}
                                  className={`w-6 h-6 rounded border-2 ${formState.accentColor === c ? 'border-blue-500' : 'border-transparent'}`}
                                  aria-label={`Select ${c} color`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => updateFormState({ accentColor: c })}
                                />
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded border flex-shrink-0" style={{ backgroundColor: formState.accentColor }} />
                                <Input
                                  id="accent-color-input"
                                  placeholder="#rrggbb"
                                  value={formState.accentColor}
                                  onChange={(e) => updateFormState({ accentColor: e.target.value })}
                                  className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-8"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <div className="flex-1">
                          <input
                            className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-10"
                            id="accent-color-input"
                            placeholder="#rrggbb"
                            value={formState.accentColor}
                            onChange={(e) => updateFormState({ accentColor: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Background Color (Chat area)</label>
                      <div className="flex items-center space-x-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[&>svg]:px-3 w-10 h-10 p-0 rounded-full overflow-hidden border-2 border-gray-300"
                              type="button"
                              aria-label="Choose background color"
                            >
                              <div className="w-full h-full" style={{ backgroundColor: formState.backgroundColor }}></div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="top" align="center" className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border shadow-md outline-hidden w-48 p-3">
                            <div className="grid grid-cols-5 gap-2">
                              {presetColors.map((c) => (
                                <button
                                  type="button"
                                  key={`bg-${c}`}
                                  className={`w-6 h-6 rounded border-2 ${formState.backgroundColor === c ? 'border-blue-500' : 'border-transparent'}`}
                                  aria-label={`Select ${c} color`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => updateFormState({ backgroundColor: c })}
                                />
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded border flex-shrink-0" style={{ backgroundColor: formState.backgroundColor }} />
                                <Input
                                  id="background-color-input"
                                  placeholder="#rrggbb"
                                  value={formState.backgroundColor}
                                  onChange={(e) => updateFormState({ backgroundColor: e.target.value })}
                                  className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-8"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <div className="flex-1">
                          <input
                            className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive font-mono text-sm h-10"
                            id="background-color-input"
                            placeholder="#rrggbb"
                            value={formState.backgroundColor}
                            onChange={(e) => updateFormState({ backgroundColor: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="plugins" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Available Plugins</h3>
                  <p className="text-sm text-gray-500">
                    Enable plugins to extend your agent&apos;s capabilities.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                    {[
                      { id: 'wordpress', name: 'WordPress' },
                      { id: 'shopify', name: 'Shopify' },
                      { id: 'whatsapp', name: 'WhatsApp' },
                      { id: 'html-css', name: 'HTML' },
                      { id: 'instagram', name: 'Instagram' },
                      { id: 'messenger', name: 'Messenger' },
                      { id: 'telegram', name: 'Telegram' },
                      { id: 'discord', name: 'Discord' },
                    ].map((plugin) => (
                      <div 
                        key={plugin.id} 
                        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handlePluginClick(plugin)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {plugin.id === 'shopify' ? (
                              <div className="h-10 w-10 rounded bg-white border flex items-center justify-center mr-3 p-1">
                                <div className="relative h-10 w-10">
                                  <Image
                                    alt="Shopify logo"
                                    src="https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg"
                                    className="object-contain h-full w-full"
                                    width={40}
                                    height={40}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                <Puzzle className="h-5 w-5 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-black">{plugin.name}</p>
                              <p className="text-xs text-black">
                                {plugin.id === 'shopify' ? 'Shopify embed snippet' : 'Plugin'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className="w-1/3 p-4 bg-gray-50 flex flex-col">
          <div className="flex-1 min-h-0">
            <div className="h-full border rounded-lg overflow-hidden">
              <div className="h-full w-full flex items-center justify-center p-4">
                <SimpleChatForm
                  formFields={(Array.isArray(formState.formFields) ? formState.formFields : []).map(f => ({
                    id: String(f.id),
                    label: String(f.label || 'Field'),
                    type: String(f.type || 'text'),
                    required: Boolean(f.required),
                    value: f.value ? String(f.value) : ''
                  }))}
                  onFormSubmitAction={async () => { return; }}
                  _assistantName={formState.name || 'AI Assistant'}
                  _welcomeMessage={formState.welcomeMessage || `👋 Thanks for your information! How can I help you today?`}
                  _headerColor={formState.headerColor}
                  _accentColor={formState.accentColor}
                  _backgroundColor={formState.backgroundColor}
                  _profileImage={''}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Agent'}
            </Button>
          </div>
        </div>
      </div>

      {/* Plugin Integration Modal */}
      <Dialog open={showPluginModal} onOpenChange={setShowPluginModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentPlugin?.name} Integration</DialogTitle>
            <DialogDescription>
              Add this code to your website to integrate the {currentPlugin?.name} plugin.
            </DialogDescription>
          </DialogHeader>
          {currentPlugin?.id === 'shopify' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Add to your Shopify theme</h4>
                <p className="text-sm text-gray-600 mb-2">Paste this snippet into your Shopify theme (for example: Online Store → Themes → Edit code → theme.liquid before <code>&lt;/body&gt;</code>, or use a Custom Liquid section).</p>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm whitespace-pre-wrap break-words">
{`<script src="${embedOrigin}/widget.js" data-bot-id="${params.id}"></script>`}
                </pre>
                <div className="flex justify-end mt-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`<script src="${embedOrigin}/widget.js" data-bot-id="${params.id}"></script>`)
                        toast({ title: 'Copied', description: 'Shopify snippet copied to clipboard.' })
                      } catch (e) {
                        console.error('Copy failed', e)
                        toast({ title: 'Copy failed', description: 'Unable to copy snippet.', variant: 'destructive' })
                      }
                    }}
                  >
                    Copy Snippet
                  </Button>
                </div>
              </div>
            </div>
          )}
          {currentPlugin?.id === 'discord' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Paste your Discord Client ID and Bot Token, save, then click the Invite link to add the bot to your server.
              </div>
              <DiscordConfig agentId={params.id as Id<"agents">} />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setShowPluginModal(false)}>Close</Button>
              </div>
            </div>
          )}
          {currentPlugin?.id === 'telegram' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Telegram Bot Configuration</h4>
                <p className="text-sm text-gray-600 mb-2">Connect a Telegram bot to this agent. The bot will be activated automatically after you save a valid bot token.</p>
              </div>
              <TelegramConfig agentId={params.id as Id<"agents">} />
            </div>
          )}
          {currentPlugin?.id === 'messenger' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Messenger Configuration</h4>
                <p className="text-sm text-gray-600 mb-2">Set your Page Access Token and Verify Token, then configure the webhook in the Meta Developer Console to point to the displayed URL.</p>
              </div>
              <MetaConfig agentId={params.id as Id<"agents">} />
            </div>
          )}
          {currentPlugin?.id === 'whatsapp' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">WhatsApp Cloud API Configuration</h4>
                <p className="text-sm text-gray-600 mb-2">Set your WhatsApp access token and Phone Number ID, then configure the webhook in the Meta Developer Console to point to the displayed URL.</p>
              </div>
              <MetaConfig agentId={params.id as Id<"agents">} />
            </div>
          )}
          {currentPlugin?.id === 'html-css' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Embed the widget</h4>
                <p className="text-sm text-gray-600 mb-2">Copy and paste this script tag into your site (typically before <code>&lt;/body&gt;</code>):</p>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm whitespace-pre-wrap break-words">
{`<script src="${embedOrigin}/chat-widget.js" data-bot-id="${params.id}"></script>`}
                </pre>
              </div>
            </div>
          )}
          
          {(currentPlugin?.id !== 'html-css' && currentPlugin?.id !== 'shopify' && currentPlugin?.id !== 'discord') && (
            <div className="text-center py-8">
              <p className="text-gray-500">Integration guide for {currentPlugin?.name} will be available soon.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
