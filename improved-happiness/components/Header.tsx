import { Button } from "./ui/button"
import { Bot } from "lucide-react"

interface HeaderProps {
  onOpenAuth: (type: "login" | "signup") => void
}

const Header = ({ onOpenAuth }: HeaderProps) => {
  return (
    <header className="relative z-50 bg-white/90 backdrop-blur-md border-b border-white/20 sticky top-0 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">
            proaichats
          </span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Features</a>
          <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Pricing</a>
          <a href="#documentation" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Documentation</a>
        </nav>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => onOpenAuth("login")}
            className="text-gray-600 hover:text-blue-600 font-medium"
          >
            Sign In
          </Button>
          <Button
            onClick={() => onOpenAuth("signup")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Sign Up
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
