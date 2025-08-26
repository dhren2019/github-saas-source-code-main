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

import { Bot, Calendar, ChevronDown, CreditCard, File, FolderTree, Home, Inbox, LayoutDashboard, Plus, Presentation, Search, Settings } from "lucide-react"
import Logo from "./logo"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import useProject from "@/hooks/use-project"
import { Skeleton } from "@/components/ui/skeleton"

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
    const router = useRouter()
    const { projects, projectId, setProjectId, isLoading } = useProject()
    const pathname = usePathname()
    const { open } = useSidebar()
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
                                                <div className={cn("rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary", {
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

        </Sidebar>
    )
}
