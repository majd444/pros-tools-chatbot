"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, User, Users, Settings, Puzzle } from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()

  const navigationItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/agent", label: "Agent", icon: User },
    { href: "/team", label: "Team", icon: Users },
    { href: "/plugins", label: "Plugins", icon: Puzzle },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-black">proaichats</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 text-sm rounded-md transition-colors ${
                active ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600" : "text-black hover:bg-gray-100"
              }`}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
            <span className="text-black">A</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-black">Account</p>
            <p className="text-xs text-black">Token number 0000</p>
          </div>
        </div>
      </div>
    </div>
  )
}
