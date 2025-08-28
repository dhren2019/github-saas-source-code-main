import { db } from "@/server/db";
import axios from "axios";
import { Octokit } from "octokit";
import { aiSummariseCommit } from "./gemini";

// Helper to create an Octokit instance using provided token or environment
function makeOctokit(token?: string) {
    return new Octokit({ auth: token || process.env.GITHUB_TOKEN || '' });
}

// id                 String   @id @default(cuid())
// commitMessage      String
// commitHash         String
// commitAuthorName   String
// commitAuthorAvatar String
// commitDate         DateTime
// summary            String

type response = {
    commitHash: string;
    commitMessage: string;
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate: string;
};

export const getCommitHashes = async (
    githubUrl: string,
    token?: string,
): Promise<response[]> => {
    const [owner, repo] = githubUrl.split("/").slice(3, 5);
    if (!owner || !repo) {
        throw new Error("Invalid github url")
    }
    console.log(`Getting commits for ${owner}/${repo}, token present: ${!!token}`);
    
    const octokit = makeOctokit(token);
    try {
        const { data } = await octokit.rest.repos.listCommits({
            owner,
            repo,
        });
        
        console.log(`Found ${data.length} commits for ${owner}/${repo}`);
        
        //   need commit author, commit message, commit hash and commit time
        const sortedCommits = data.sort(
            (a: any, b: any) =>
                new Date(b.commit.author.date).getTime() -
                new Date(a.commit.author.date).getTime(),
        ) as any[];

        return sortedCommits.slice(0, 15).map((commit: any) => ({
            commitHash: commit.sha as string,
            commitMessage: commit.commit.message ?? "",
            commitAuthorName: commit.commit?.author?.name ?? "",
            commitAuthorAvatar: commit.author?.avatar_url ?? "",
            commitDate: commit.commit?.author?.date ?? "",
        }));
    } catch (error: any) {
        console.error(`Error fetching commits for ${owner}/${repo}:`, error?.message);
        console.error(`Status: ${error?.status}, Response: ${JSON.stringify(error?.response?.data)}`);
        throw error;
    }
};

export const pollRepo = async (projectId: string, token?: string) => {
    try {
        const { project, githubUrl } = await fetchProjectGitHubUrl(projectId);
        console.log(`Polling repo for project ${projectId}: ${githubUrl}, token present: ${!!token}`);
        
        const commitHases = await getCommitHashes(project?.githubUrl ?? "", token);
        const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHases);
        
        console.log(`Found ${unprocessedCommits.length} unprocessed commits`);
        
        if (unprocessedCommits.length === 0) {
            console.log("No new commits to process");
            return { count: 0 };
        }
        
        const summariesResponse = await Promise.allSettled(
            unprocessedCommits.map((hash) => {
                return summariseCommit(githubUrl, hash.commitHash, token);
            }),
        );
        
        // Filter out failed summaries and pair with their commits
        const validCommitsWithSummaries = summariesResponse
            .map((summary, idx) => ({
                summary: summary.status === "fulfilled" ? summary.value : null,
                commit: unprocessedCommits[idx]!,
            }))
            .filter(({ summary }) => summary && summary.trim().length > 0); // Only include commits with valid summaries
        
        console.log(`Got ${validCommitsWithSummaries.length} valid summaries out of ${unprocessedCommits.length} commits`);
        
        if (validCommitsWithSummaries.length === 0) {
            console.log("No valid commit summaries to save");
            return { count: 0 };
        }
        
        const commits = await db.commit.createMany({
            data: validCommitsWithSummaries.map(({ summary, commit }) => ({
                projectId: projectId,
                commitHash: commit.commitHash,
                summary: summary!,
                commitAuthorName: commit.commitAuthorName,
                commitDate: commit.commitDate,
                commitMessage: commit.commitMessage,
                commitAuthorAvatar: commit.commitAuthorAvatar,
            })),
        });
        
        console.log(`Successfully saved ${validCommitsWithSummaries.length} commits to database`);
        return commits;
        
    } catch (error: any) {
        console.error(`Error in pollRepo for project ${projectId}:`, error?.message);
        console.error(`Full error:`, error);
        return { count: 0, error: error?.message };
    }
};

async function fetchProjectGitHubUrl(projectId: string) {
    const project = await db.project.findUnique({
        where: {
            id: projectId
        }, select: {
            githubUrl: true
        }
    });
    const githubUrl = project?.githubUrl ?? "";
    return { project, githubUrl };
}

async function summariseCommit(githubUrl: string, commitHash: string, token?: string) {
    try {
        const [owner, repo] = githubUrl.split("/").slice(3, 5);
        if (!owner || !repo) {
            throw new Error("Invalid github url");
        }
        
        console.log(`Fetching diff for commit ${commitHash} from ${owner}/${repo}`);
        
        // Use the GitHub API to fetch the commit diff
        const headers: any = { 
            Accept: "application/vnd.github.v3.diff",
            'User-Agent': 'github-saas-app'
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits/${commitHash}`,
            { headers }
        );
        
        const data = response.data as string;
        console.log(`Got diff data, length: ${data?.length || 0} chars`);
        
        // Try AI summary first
        try {
            const aiSummary = await aiSummariseCommit(data);
            if (aiSummary && aiSummary.trim().length > 0) {
                console.log(`AI summary successful for ${commitHash}`);
                return aiSummary;
            }
        } catch (aiError: any) {
            console.log(`AI summary failed for ${commitHash}:`, aiError?.message);
        }
        
        // Fallback: use commit message or simple analysis
        console.log(`Using fallback summary for ${commitHash}`);
        return generateSimpleSummary(data);
        
    } catch (error: any) {
        console.error(`Error fetching/summarizing commit ${commitHash}:`, error?.message);
        return null;
    }
}

// Simple fallback summary generator
function generateSimpleSummary(diffData: string): string {
    if (!diffData || diffData.trim().length === 0) {
        return "No changes detected in diff";
    }
    
    const lines = diffData.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+')).length;
    const removedLines = lines.filter(line => line.startsWith('-')).length;
    const modifiedFiles = [...new Set(lines
        .filter(line => line.startsWith('diff --git'))
        .map(line => line.split(' ')[2]?.replace('a/', '') || 'unknown')
    )];
    
    return `Modified ${modifiedFiles.length} file(s): ${modifiedFiles.slice(0, 3).join(', ')}${modifiedFiles.length > 3 ? '...' : ''}. Added ${addedLines} lines, removed ${removedLines} lines.`;
}

async function filterUnprocessedCommits(projectId: string, commitHases: response[]) {
    const processedCommits = await db.commit.findMany({
        where: {
            projectId: projectId,
        },
    });
    const unprocessedCommits = commitHases.filter(
        (hash) => !processedCommits.some((commit) => commit.commitHash === hash.commitHash)
    );
    return unprocessedCommits;
}


// const githubUrl = "https://github.com/elliott-chong/normalhuman"
// const commitHases = await getCommitHashes(githubUrl);
// const summaries = await Promise.allSettled(
//     commitHases.map((hash) => summariseCommit(githubUrl, hash.commitHash))
// )
// console.log(summaries)