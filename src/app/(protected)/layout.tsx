"use client"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { UserButton } from "@clerk/nextjs"
import SearchBar from "./search-bar"
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
        if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return false;
        return true;
    }, [mounted]);
    
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full m-2">
                <div className="flex items-center gap-2 border-sidebar-border bg-sidebar border shadow rounded-md p-2 px-4">
                    <SearchBar />
                    <div className="ml-auto"></div>
                    {shouldShowClerk && (
                        <UserButton />
                    )}
                </div>
                <div className="h-4"></div>
                <div className="border-sidebar-border bg-sidebar border shadow rounded-md overflow-y-scroll h-[calc(100vh-6rem)] p-4">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}
