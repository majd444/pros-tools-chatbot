import { Card, CardContent } from "./ui/card"
import { Bot, Brain, Database, Code2, BarChart3, Settings, Layers, TrendingUp, Clock, MessageSquare, Globe } from "lucide-react"

const Features = () => {
  const features = [
    {
      icon: Clock,
      title: "24/7 Availability",
      description: "Your AI agents work around the clock, all week long, ensuring your customers always get instant responses and support."
    },
    {
      icon: MessageSquare,
      title: "Multi-Platform Support",
      description: "Deploy on WhatsApp, Meta (Facebook/Instagram), Discord, WordPress, and any website seamlessly."
    },
    {
      icon: Bot,
      title: "Custom AI Agents",
      description: "Create and customize AI agents tailored to your specific business needs and use cases."
    },
    {
      icon: Brain,
      title: "Natural Conversations",
      description: "Engage users with natural, context-aware conversations powered by advanced language models."
    },
    {
      icon: Database,
      title: "Knowledge Base Integration",
      description: "Connect your agents to your existing knowledge base to provide accurate, up-to-date information."
    },
    {
      icon: Code2,
      title: "No-Code Builder",
      description: "Design and deploy AI agents without writing a single line of code using our intuitive interface."
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Track performance metrics and gain insights into how users interact with your AI agents."
    },
    {
      icon: Settings,
      title: "Advanced Configuration",
      description: "Fine-tune your agents with advanced settings for optimal performance and accuracy."
    },
    {
      icon: Layers,
      title: "Multi-Model Support",
      description: "Choose from various AI models to power your agents based on your specific requirements."
    },
    {
      icon: TrendingUp,
      title: "Continuous Learning",
      description: "Agents improve over time by learning from interactions and feedback."
    },
    {
      icon: Globe,
      title: "Website Integration",
      description: "Easily embed your AI agents on any website with our simple integration tools and APIs."
    },
    {
      icon: MessageSquare,
      title: "Cross-Platform Messaging",
      description: "Manage all customer conversations from WhatsApp, Meta platforms, Discord, and more in one dashboard."
    }
  ]

  return (
    <section id="features" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to build, deploy, and manage AI agents for your business. Work 24/7 all week with support for WhatsApp, Meta, Discord, WordPress, and website integration.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/80 backdrop-blur-sm hover:scale-105 group">
              <CardContent className="p-6">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
