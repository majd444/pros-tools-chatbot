import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ArrowRight, Users, Bot, } from "lucide-react"

interface HeroProps {
  onOpenAuth: (type: "login" | "signup") => void
}

const Hero = ({ onOpenAuth }: HeroProps) => {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="container mx-auto px-4 text-center">
        <Badge className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 hover:bg-blue-200 transition-all duration-300 border-blue-200">
          <Bot className="w-4 h-4 mr-2" />
          No-Code AI Agent Platform
        </Badge>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="text-gray-900">Create and Manage Your</span>
          <br />
          <span className="text-gray-900">
            AI Agents
          </span>
          <br />
          <span className="text-gray-900">with Ease</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
          Build, customize, and deploy AI agents for your business needs without writing a single line of code. I&apos;ve been using this platform for a month and it&apos;s completely transformed how I handle customer support. The AI is incredibly intuitive and easy to train.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Button
            size="lg"
            onClick={() => onOpenAuth("signup")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg group shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Get Started for Free
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onOpenAuth("login")}
            className="border-2 border-gray-300 hover:border-blue-500 px-8 py-4 text-lg hover:bg-blue-50 transition-all duration-300"
          >
            <Users className="mr-2 h-5 w-5" />
            Sign In
          </Button>
        </div>
        
        <div className="relative max-w-6xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-6 md:p-8">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 md:p-8 border border-blue-100">
              {/* AI Assistant Demo */}
              <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">AI Assistant</h4>
                    <p className="text-sm text-green-500 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Online now
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 flex-1">
                      <p className="text-sm text-gray-800">Hello! I&apos;m your AI assistant. How can I help you today?</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                      <p className="text-sm text-gray-800">Can you help me find information about your product pricing?</p>
                    </div>
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 flex-1">
                      <p className="text-sm text-gray-800">Of course! Our pricing starts at $29/month for the Basic plan, which includes 3 AI agents and 1,000 messages per month. Would you like me to tell you about our other plans?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Background decorations */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute top-1/2 left-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-lg"></div>
    </section>
  )
}

export default Hero
