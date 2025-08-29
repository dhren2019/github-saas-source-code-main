"use client";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import type { Commit, Project } from "@prisma/client";
import { ExternalLink, GitGraph, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { formatDistanceToNow } from "date-fns";

export default function CommitLog() {
    const { projectId, project } = useProject();
    const commitsQuery = api.project.getCommits.useQuery({ projectId }, { enabled: !!projectId });
    const commits = commitsQuery.data ?? [];

    // Filters state
    const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
    const [authorQuery, setAuthorQuery] = useState('');
    const [onlySummarized, setOnlySummarized] = useState(false);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    const filteredCommits = useMemo(() => {
        const now = Date.now();
        const rangeMs = (range: typeof timeRange) => {
            switch (range) {
                case '24h': return 24 * 60 * 60 * 1000;
                case '7d': return 7 * 24 * 60 * 60 * 1000;
                case '30d': return 30 * 24 * 60 * 60 * 1000;
                default: return Infinity;
            }
        };

        // If user supplied explicit dates, prioritize them
        let startMs: number | null = null;
        let endMs: number | null = null;
        if (startDate) {
            // start of day
            startMs = new Date(`${startDate}T00:00:00`).getTime();
        }
        if (endDate) {
            // end of day
            endMs = new Date(`${endDate}T23:59:59`).getTime();
        }

        // If no explicit range use preset
        if (startMs === null && endMs === null && timeRange !== 'all') {
            const cutoff = now - rangeMs(timeRange);
            startMs = cutoff;
        }

        return commits.filter((c: any) => {
            const commitDate = new Date(c.commitDate).getTime();

            if (startMs !== null && commitDate < startMs) return false;
            if (endMs !== null && commitDate > endMs) return false;

            if (authorQuery && !c.commitAuthorName?.toLowerCase().includes(authorQuery.toLowerCase())) return false;
            if (onlySummarized && (!c.summary || c.summary.trim().length === 0)) return false;
            return true;
        });
    }, [commits, timeRange, authorQuery, onlySummarized, startDate, endDate]);

    // preview of most recent commits
    return (
        <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground mr-2">Show:</label>
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="rounded-md border px-2 py-1 bg-white text-sm text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                        <option value="all">All</option>
                        <option value="24h">Last 24h</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                    <input value={authorQuery} onChange={(e) => setAuthorQuery(e.target.value)} placeholder="Filter by author" className="ml-2 rounded-md border px-2 py-1 bg-white text-sm text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                    <label className="ml-2 flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                        <input type="checkbox" className="accent-primary-600 dark:accent-primary-400" checked={onlySummarized} onChange={(e) => setOnlySummarized(e.target.checked)} />
                        Only with summary
                    </label>
                    <div className="ml-2 flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">From:</label>
                        <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value || null)} className="rounded-md border px-2 py-1 bg-white text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                        <label className="text-sm text-muted-foreground ml-2">To:</label>
                        <input type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value || null)} className="rounded-md border px-2 py-1 bg-white text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                    </div>
                    {startDate && endDate && new Date(startDate) > new Date(endDate) && (
                        <div className="text-xs text-red-500 dark:text-red-400 ml-2">The "From" date cannot be after the "To" date</div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => commitsQuery.refetch()} title="Refrescar commits">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refrescar
                    </Button>
                </div>
            </div>


            {commitsQuery.isLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando commits...</div>
            )}

            {!commitsQuery.isLoading && filteredCommits.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                    No hay commits que coincidan con los filtros.
                    <div className="mt-2">
                        <Button onClick={() => commitsQuery.refetch()}>Volver a comprobar</Button>
                    </div>
                </div>
            )}

            {!commitsQuery.isLoading && filteredCommits.length > 0 && (
                <ul role="list" className="space-y-6">
                    {filteredCommits.map((commit: any, commitIdx: number) => (
                        <li key={commit.id ?? commit.commitHash} className="relative flex gap-x-4">
                            <div
                                className={cn(
                                    commitIdx === filteredCommits.length - 1 ? "h-6" : "-bottom-6",
                                    "absolute left-0 top-0 flex w-6 justify-center",
                                )}
                            >
                                <div className="w-px translate-x-1 bg-gray-200" />
                            </div>
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={commit.commitAuthorAvatar}
                                    alt=""
                                    className="relative mt-3 h-8 w-8 flex-none rounded-full bg-gray-50"
                                />
                                <div className="flex-auto rounded-md bg-card p-3 ring-1 ring-inset ring-border">
                                    <div className="flex justify-between gap-x-4">
                                        <Link
                                            target="_blank"
                                            className="py-0.5 text-xs leading-5 text-gray-500"
                                            href={`${project?.githubUrl}/commits/${commit.commitHash}`}
                                        >
                                            <span className="font-medium text-gray-900">{commit.commitAuthorName}</span>{" "}
                                            <span className="inline-flex items-center">committed <ExternalLink className="ml-1 h-4 w-4" /></span>
                                        </Link>
                                        <time dateTime={new Date(commit.commitDate).toString()} className="flex-none py-0.5 text-xs leading-5 text-gray-500">
                                            {formatDistanceToNow(new Date(commit.commitDate), { addSuffix: true })}
                                        </time>
                                    </div>
                                    <span className="font-semibold">{commit.commitMessage}</span>
                                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-500">{commit.summary}</pre>
                                </div>
                            </>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
