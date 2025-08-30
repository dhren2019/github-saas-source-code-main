import { api } from '@/trpc/react'
import { useLocalStorage } from 'usehooks-ts'
import React from 'react'
import { useRouter } from 'next/navigation'

const useProject = () => {
    const { data: projects, isLoading } = api.project.getAll.useQuery()
    const [projectId, setProjectId] = useLocalStorage('d-projectId', '')

    // sanitize projectId in case it was stored with extra quotes
    const cleanedProjectId = (projectId ?? '').replace(/^"|"$/g, '')

    // if the stored value had surrounding quotes, replace it with the cleaned value
    React.useEffect(() => {
        if (projectId && projectId !== cleanedProjectId) {
            setProjectId(cleanedProjectId)
        }
    }, [projectId, cleanedProjectId, setProjectId])

    const project = projects?.find(project => project.id === cleanedProjectId)
    const router = useRouter()

    // Only redirect to /create when projects have finished loading and no project is found.
    React.useEffect(() => {
        if (isLoading) return
        if (project) return
        const timeout = setTimeout(() => {
            router.push(`/create`)
        }, 1000)
        return () => clearTimeout(timeout)
    }, [project, isLoading, router])


    return {
        projects,
        projectId: cleanedProjectId,
        isLoading,
        setProjectId,
        project,
    }
}

export default useProject