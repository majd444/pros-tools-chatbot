"use client"

import dynamic from 'next/dynamic';

// Dynamically import the AgentSettingsPage component with no SSR
const AgentSettings = dynamic(
  () => import('./AgentSettingsPage'),
  { ssr: false }
);

export default function AgentSettingsPage() {
  return <AgentSettings />;
}
