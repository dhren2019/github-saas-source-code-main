'use client'
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

const items = [
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Q&A",
        url: "/qa",
        icon: Bot,
    },
    {
        title: "Meetings",
        url: "/meetings",
        icon: Presentation,
    },
    {
        title: "Billing",
        url: "/billing",
        icon: CreditCard,
    },
]

export function AppSidebar() {
    const pathname = usePathname()

    return (
        <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Dionysus</h2>
            </div>

            {/* Navigation */}
            <div className="flex-1 p-4 space-y-2">
                {items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.url
                    
                    return (
                        <Link
                            key={item.title}
                            href={item.url}
                            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{item.title}</span>
                        </Link>
                    )
                })}

                {/* Create Project Button */}
                <div className="pt-4">
                    <Link
                        href="/create"
                        className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Create Project</span>
                    </Link>
                </div>
            </div>

            {/* Projects Section */}
            <div className="p-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Projects</h3>
                <div className="text-sm text-gray-400">No projects yet</div>
            </div>
        </div>
    )
}
