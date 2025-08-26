import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    // Skip completely during build
    if (process.env.SKIP_ENV_VALIDATION === 'true') {
        return new NextResponse(JSON.stringify({ error: 'Build mode - process-meeting disabled' }), { 
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Lazy import to avoid build-time issues
    const { processMeeting } = await import("@/lib/assembly");
    const { getEmbeddings } = await import("@/lib/gemini");
    const { RecursiveCharacterTextSplitter } = await import("langchain/text_splitter");
    const { db } = await import("@/server/db");
    const { auth } = await import("@clerk/nextjs/server");
    const pLimit = (await import("p-limit")).default;
    const { z } = await import("zod");

    const bodyParser = z.object({
        audio_url: z.string(),
        projectId: z.string(),
        meetingId: z.string()
    })

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const body = await req.json();
        const { audio_url, projectId, meetingId } = bodyParser.parse(body);
        // mark meeting as processing immediately
        try {
            await db.meeting.update({ where: { id: meetingId }, data: { status: 'PROCESSING' } })
        } catch (err) {
            console.error('Failed to set meeting to PROCESSING', err)
        }
        // get the transcript and summaries
        const { transcript, summaries } = await processMeeting(audio_url);


        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 800,
            chunkOverlap: 130
        })
        // create documents from the transcript
        const docs = await splitter.createDocuments([transcript.text!])
        // get the embeddings
        const embeddings = await Promise.all(docs.map(async (doc) => {
            const embedding = await getEmbeddings(doc.pageContent)
            return { embedding, content: doc.pageContent }
        }))

        const limit = pLimit(10);
        // save the embeddings (ensure we return the promises from limit so Promise.all waits)
        const savePromises = embeddings.map((embedding) => {
            return limit(async () => {
                console.log('Creating MeetingEmbedding record for meeting:', meetingId?.toString?.() ?? meetingId)
                const meetingEmbedding = await db.meetingEmbedding.create({
                    data: {
                        meetingId,
                        content: embedding.content
                    }
                })

                // store vector using raw SQL (Postgres vector extension)
                await db.$executeRaw`
                    UPDATE "MeetingEmbedding"
                    SET "embedding" = ${embedding.embedding}::vector
                    WHERE id = ${meetingEmbedding.id}`;
            })
        })

        await Promise.all(savePromises)

        // save the issues
        await db.issue.createMany({
            data: summaries.map((summary) => ({
                start: summary.start,
                end: summary.end,
                gist: summary.gist,
                headline: summary.headline,
                summary: summary.summary,
                meetingId,
            })),
        });
        await db.meeting.update({
            where: { id: meetingId },
            data: {
                status: "COMPLETED",
                name: summaries[0]?.gist || "Untitled Meeting"
            },
        });

        return NextResponse.json({ meetingId }, { status: 200 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('process-meeting failed', error)
        // try to set meeting as PROCESSING failed -> set to PROCESSING to indicate something went wrong
        try {
            // keep the meeting in PROCESSING or you could add a FAILED enum later
            await db.meeting.update({ where: { id: (await req.json()).meetingId }, data: { status: 'PROCESSING' } })
        } catch (e) {
            console.error('Failed to update meeting status after error', e)
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}