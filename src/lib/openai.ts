import { OpenAI } from 'openai'
import { loadGithubRepo } from './github-loader'

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const openAI = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

export const openAIEnabled = Boolean(openAI);

export const getSummary = async (doc: Awaited<ReturnType<typeof loadGithubRepo>>[number]) => {
    console.log("getting summary for", doc.metadata.source);
    if (!openAI) {
        console.warn('OPENAI_API_KEY not set — skipping summary for', doc.metadata.source);
        return null;
    }

    const code = doc.pageContent.slice(0, 10000); // Limit to 10000 characters

    try {
        const response = await openAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an intelligent senior software engineer who specialises in onboarding junior software engineers onto projects",
                },
                {
                    role: "user",
                    content: `You are onboarding a junior software engineer and explaining to them the purpose of the ${doc.metadata.source} file\nHere is the code:\n---\n${code}\n---\nGive a summary no more than 100 words of the code above`,
                },
            ],
        });

        console.log("got back summary", doc.metadata.source);
        return response.choices?.[0]?.message?.content ?? null;
    } catch (err) {
        console.warn('OpenAI summary call failed for', doc.metadata.source, err instanceof Error ? err.message : err);
        return null;
    }
}

export const aiSummariseCommit = async (diff: string) => {
    if (!openAI) {
        console.warn('OPENAI_API_KEY not set — skipping commit summarization');
        return null;
    }

    try {
        const response = await openAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert programmer, and you are trying to summarize a git diff.\nReminders about the git diff format:\nFor every file, there are a few metadata lines, like (for example):\n\`\`\`\ndiff --git a/lib/index.js b/lib/index.js\nindex aadf691..bfef603 100644\n--- a/lib/index.js\n+++ b/lib/index.js\n\`\`\`\nThis means that \`lib/index.js\` was modified in this commit. Note that this is only an example.\nThen there is a specifier of the lines that were modified.\nA line starting with \`+\` means it was added.\nA line that starting with \`-\` means that line was deleted.\nA line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.\nIt is not part of the diff.\n[...]\nEXAMPLE SUMMARY COMMENTS:\n\`\`\`\n* Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]\n* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]\n* Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]\n* Added an OpenAI API for completions [packages/utils/apis/openai.ts]\n* Lowered numeric tolerance for test files\n\`\`\`\nMost commits will have less comments than this examples list.\nThe last comment does not include the file names,\nbecause there were more than two relevant files in the hypothetical commit.\nDo not include parts of the example in your summary.\nIt is given only as an example of appropriate comments.`,
                },
                {
                    role: "user",
                    content: `Please summarise the following diff file: \n\n${diff}`,
                },
            ],
        });

        return response.choices?.[0]?.message?.content ?? null;
    } catch (err) {
        console.warn('OpenAI commit summary failed', err instanceof Error ? err.message : err);
        return null;
    }
};


export const getEmbeddings = async (text: string) => {
    if (!openAI) {
        console.warn('OPENAI_API_KEY not set — skipping embeddings');
        return null;
    }

    const payload = text.replaceAll("\n", " ");
    try {
        const response = await openAI.embeddings.create({
            model: "text-embedding-ada-002",
            input: payload,
        });
        return response.data?.[0]?.embedding ?? null;
    } catch (err) {
        console.warn('OpenAI embeddings failed', err instanceof Error ? err.message : err);
        return null;
    }
}

