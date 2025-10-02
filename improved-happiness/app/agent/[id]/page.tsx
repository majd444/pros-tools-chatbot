'use client';

import { notFound, useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';

// Agent type is inferred from the query response

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as unknown as string) ?? '';
  const agent = useQuery(api.agents.get, { id: id as Id<'agents'> });

  if (agent === null) {
    notFound();
  }

  if (agent === undefined) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <Button asChild variant="outline">
          <Link href={`/agent/${id}/settings`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Agent
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        {agent.profileImage ? (
          <div 
            className="h-16 w-16 rounded-full bg-cover bg-center"
            style={{ backgroundImage: `url(${agent.profileImage})` }}
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-medium text-primary">
            {agent.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          <p className="text-muted-foreground">
            Last updated: {formatDate(agent.updatedAt || agent.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Name</h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm">{agent.name}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Language Model</h3>
              <div className="relative">
                <div className="w-full p-3 bg-muted/50 rounded-md text-sm">
                  Llama 3.1 Nemetron Nano 8B (Free)
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Temperature</h3>
                <span className="text-sm text-muted-foreground">
                  {agent.temperature < 0.3 ? 'Precise' : agent.temperature < 0.7 ? 'Balanced' : 'Creative'}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${agent.temperature * 100}%` }}
                  />
                </div>
                <span className="text-sm font-mono w-8 text-right">
                  {agent.temperature.toFixed(1)}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">System Prompt</h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="whitespace-pre-wrap text-sm">{agent.systemPrompt}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This prompt defines your assistant&apos;s personality and capabilities.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Welcome Message</h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="whitespace-pre-wrap text-sm">{agent.welcomeMessage}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This is the first message users will see when they start a chat.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Information Collection</CardTitle>
          </CardHeader>
          <CardContent>
            {agent.collectUserInfo && agent.formFields.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agent.formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {field.type}
                        </Badge>
                      </div>
                      <div className="h-10 flex items-center px-3 text-sm rounded-md border bg-muted/50">
                        <span className="text-muted-foreground">
                          {field.required ? 'Required field' : 'Optional field'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No user information collection enabled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Header Color</h3>
                <div 
                  className="h-10 w-full rounded-md border"
                  style={{ backgroundColor: agent.headerColor }}
                />
                <p className="text-xs text-muted-foreground">{agent.headerColor}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Accent Color</h3>
                <div 
                  className="h-10 w-full rounded-md border"
                  style={{ backgroundColor: agent.accentColor }}
                />
                <p className="text-xs text-muted-foreground">{agent.accentColor}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Background Color</h3>
                <div 
                  className="h-10 w-full rounded-md border"
                  style={{ backgroundColor: agent.backgroundColor }}
                />
                <p className="text-xs text-muted-foreground">{agent.backgroundColor}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

