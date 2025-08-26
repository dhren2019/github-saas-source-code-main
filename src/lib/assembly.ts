import { AssemblyAI } from 'assemblyai';
import { readFileSync, writeFileSync } from 'fs'
const client = process.env.ASSEMBLYAI_API_KEY ? new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!,
}) : null;

const FILE_URL =
    'https://assembly.ai/sports_injuries.mp3';


function msToTime(ms: number): string {
    const seconds = ms / 1000;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}


export const processMeeting = async (audio_url: string) => {
    if (!client) {
        throw new Error('AssemblyAI API key not configured');
    }
    
    const transcript = await client.transcripts.transcribe({
        audio: audio_url,
        auto_chapters: true
    });
    const summaries = transcript.chapters?.map(chapter => ({
        start: msToTime(chapter.start),
        end: msToTime(chapter.end),
        gist: chapter.gist,
        headline: chapter.headline,
        summary: chapter.summary
    })) || [];
    if (!transcript.text) {
        throw new Error('No transcript text')
    }
    return {
        transcript, summaries
    }

};

// Example usage commented out to avoid running on module import
// processMeeting(FILE_URL);