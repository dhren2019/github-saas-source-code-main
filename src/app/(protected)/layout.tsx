"use client"
import React from "react"

export const dynamic = 'force-dynamic';

// Simplified sidebar component to avoid import issues in Vercel
function SimpleSidebar() {
    const items = [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Q&A", url: "/qa" },
        { title: "Meetings", url: "/meetings" },
        { title: "Billing", url: "/billing" },
    ]

    return (
        <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Dionysus</h2>
            </div>
            <div className="flex-1 p-4 space-y-2">
                {items.map((item) => (
                    <a
                        key={item.title}
                        href={item.url}
                        className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                        {item.title}
                    </a>
                ))}
                <div className="pt-4">
                    <a
                        href="/create"
                        className="block px-3 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
                    >
                        Create Project
                    </a>
                </div>
            </div>
        </div>
    )
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    
    React.useEffect(() => {
        setMounted(true);
    }, []);
    
    return (
        <div className="flex h-screen bg-gray-100">
            <SimpleSidebar />
            <main className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <h1 className="text-lg font-medium text-gray-900">Dashboard</h1>
                            <div className="flex items-center space-x-4">
                                {mounted && typeof window !== 'undefined' && process.env.SKIP_ENV_VALIDATION !== "true" && (
                                    <div className="text-sm text-gray-500">
                                        User Profile
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
