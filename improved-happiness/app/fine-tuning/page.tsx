"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/components/ui/use-toast";

interface FineTuningFormData {
  agentId: string;
  input: string;
  output: string;
  metadata?: Record<string, any>;
}

export default function FineTuningPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FineTuningFormData>({
    agentId: "",
    input: "",
    output: "",
    metadata: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the save fine-tuning output mutation
  const saveFineTuning = useMutation(api.fineTuning.saveFineTuningOutput);
  
  // Get the list of agents for the dropdown
  const agents = useQuery(api.agents.list) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agentId || !formData.input || !formData.output) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      await saveFineTuning({
        agentId: formData.agentId,
        input: formData.input,
        output: formData.output,
        metadata: formData.metadata,
      });

      toast({
        title: "Success",
        description: "Fine-tuning data saved successfully!",
      });

      // Reset form
      setFormData({
        agentId: "",
        input: "",
        output: "",
        metadata: {},
      });
    } catch (error) {
      console.error("Error saving fine-tuning data:", error);
      toast({
        title: "Error",
        description: "Failed to save fine-tuning data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload Fine-Tuning Data</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Agent <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.agentId}
            onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Input <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.input}
            onChange={(e) => setFormData({ ...formData, input: e.target.value })}
            className="w-full p-2 border rounded min-h-[100px]"
            placeholder="Enter the input/prompt..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Output <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.output}
            onChange={(e) => setFormData({ ...formData, output: e.target.value })}
            className="w-full p-2 border rounded min-h-[200px]"
            placeholder="Enter the expected output/response..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Metadata (JSON)
          </label>
          <textarea
            value={JSON.stringify(formData.metadata, null, 2)}
            onChange={(e) => {
              try {
                const metadata = JSON.parse(e.target.value);
                setFormData({ ...formData, metadata });
              } catch (error) {
                // Invalid JSON, don't update
              }
            }}
            className="w-full p-2 border rounded min-h-[100px] font-mono text-sm"
            placeholder='{"key": "value"}'
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Fine-Tuning Data"}
        </button>
      </form>
    </div>
  );
}
