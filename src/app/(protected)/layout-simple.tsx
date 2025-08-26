"use client"
import { AppSidebar } from "./app-sidebar-simple"
import React from "react"

export const dynamic = 'force-dynamic';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    
    React.useEffect(() => {
        setMounted(true);
    }, []);
    
    // Don't render Clerk components during SSR or if not mounted
    const shouldShowClerk = React.useMemo(() => {
        if (!mounted) return false;
        if (typeof window === 'undefined') return false;
        if (process.env.SKIP_ENV_VALIDATION === "true") return false;
        return true;
    }, [mounted]);
    
    return (
        <div className="flex h-screen bg-gray-100">
            <AppSidebar />
            <main className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="bg-white border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <h1 className="text-lg font-medium text-gray-900">Dashboard</h1>
                            <div className="flex items-center space-x-4">
                                {shouldShowClerk && (
                                    <div className="text-sm text-gray-500">
                                        User Profile
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Content */}
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
