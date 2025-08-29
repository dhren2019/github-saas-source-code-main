'use client'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar"
import { UserButton } from "@clerk/nextjs"

import { Bot, Calendar, ChevronDown, CreditCard, File, FolderTree, Home, Inbox, LayoutDashboard, Plus, Presentation, Search, Settings, AlertTriangle, GitBranch } from "lucide-react"
import Logo from "./logo"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import useProject from "@/hooks/use-project"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/trpc/react"

const items = [
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Project Diagram",
        url: "/project-diagram",
        icon: GitBranch,
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
    const router = useRouter()
    const { projects, projectId, setProjectId, isLoading } = useProject()
    const pathname = usePathname()
    const { open } = useSidebar()
    const { data: credits } = api.project.getMyCredits.useQuery()
    
    const isLowCredits = credits !== undefined && credits < 10
    
    return (
        <Sidebar collapsible="icon" variant="floating">
            <SidebarHeader>
                <Logo />
            </SidebarHeader>
            <SidebarContent className="">
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url} className={cn({
                                            '!bg-primary !text-white': pathname === item.url,
                                        })}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {isLoading && (<>
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} className="w-full h-8" />
                                ))}
                            </>)}

                            {projects?.map((project) => (
                                <SidebarMenuItem key={project.id}>
                                    <SidebarMenuButton asChild>
                                        <div onClick={() => {
                                            setProjectId(project.id)
                                            router.push(`/dashboard`)
                                        }} className={cn({
                                            'cursor-pointer': true,
                                        })}>
                                            <div className="">
                                                <div className={cn("rounded-sm border size-6 flex items-center justify-center text-sm bg-card text-primary", {
                                                    'bg-primary text-white': projectId === project.id,
                                                })}>
                                                    {project.name[0]}
                                                </div>
                                            </div>
                                            <span>{project.name}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                            <div className="h-2"></div>
                            {open && (
                                <SidebarMenuItem key="create">
                                    <Link href="/create">
                                        <Button size='sm' variant={'outline'}>
                                            <Plus />
                                            <span>Create Project</span>
                                        </Button>
                                    </Link>
                                </SidebarMenuItem>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {!open && (
                    <>
                        <SidebarSeparator />
                        <SidebarTrigger className="text-stone-500 hover:text-stone-900 self-center" />
                    </>
                )}
            </SidebarContent>
            
            <SidebarFooter className="p-4">
                {open && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">Credits</span>
                            <span className={cn("text-sm font-semibold", {
                                "text-red-600": isLowCredits,
                                "text-slate-900": !isLowCredits
                            })}>
                                {credits ?? "..."}
                            </span>
                        </div>
                        
                        {isLowCredits && (
                            <>
                                <div className="flex items-start gap-2 text-xs text-red-600">
                                    <AlertTriangle className="size-3 mt-0.5 flex-shrink-0" />
                                    <span>Your credits are running low, buy more</span>
                                </div>
                                <Link href="/billing">
                                    <Button size="sm" variant="default" className="w-full text-xs">
                                        Buy credits
                                    </Button>
                                </Link>
                            </>
                        )}
                        
                        {!isLowCredits && credits !== undefined && (
                            <Link href="/billing">
                                <Button size="sm" variant="outline" className="w-full text-xs">
                                    Manage credits
                                </Button>
                            </Link>
                        )}
                    </div>
                )}
                
                {!open && (
                    <div className="flex justify-center">
                        <div className={cn("size-8 rounded-md border flex items-center justify-center text-xs font-semibold", {
                            "bg-red-50 border-red-200 text-red-600": isLowCredits,
                            "bg-slate-50 border-slate-200 text-slate-700": !isLowCredits
                        })}>
                            {credits ?? "..."}
                        </div>
                    </div>
                )}
            </SidebarFooter>
        </Sidebar>
    )
}
