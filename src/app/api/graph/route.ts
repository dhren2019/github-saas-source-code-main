import { NextRequest, NextResponse } from "next/server";
import madge from "madge";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    // For development, analyze current project
    // In production, you'd get the project path from your DB based on projectId
    const analysisPath = process.cwd();

    if (!fs.existsSync(analysisPath)) {
      return NextResponse.json({ error: "project not found" }, { status: 404 });
    }

    const madgeResult = await madge(analysisPath, {
      tsConfig: path.join(analysisPath, "tsconfig.json"),
      baseDir: analysisPath,
      includeNpm: false,
      exclude: ['node_modules', '.next', 'dist', 'build', 'public', 'prisma/migrations'],
      fileExtensions: ['js', 'ts', 'tsx', 'jsx'],
    }).then((r: any) => r.obj());

    // Convert madge output { "fileA.js": ["dep1","dep2"], ... } -> nodes/edges
    const allFiles = new Set([
      ...Object.keys(madgeResult),
      ...Object.values(madgeResult).flat()
    ]);

    const nodes = Array.from(allFiles).map((id) => ({
      id,
      label: path.basename(String(id)).replace(/\.(js|ts|tsx|jsx)$/, ''),
      fullPath: id,
      type: getFileType(String(id)),
      folder: path.dirname(String(id))
    }));

    const edges = Object.entries(madgeResult).flatMap(([from, tos]: [string, any]) =>
      (Array.isArray(tos) ? tos : []).map((to: string) => ({ source: from, target: to }))
    );

    return NextResponse.json({ 
      nodes: nodes.slice(0, 100), // Limit for performance
      edges: edges.slice(0, 200),
      total: { nodes: nodes.length, edges: edges.length }
    });
  } catch (err) {
    console.error("graph api error", err);
    return NextResponse.json({ 
      error: "analysis_failed", 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}

function getFileType(filePath: string): string {
  if (filePath.includes('/api/')) return 'api';
  if (filePath.includes('/components/')) return 'component';
  if (filePath.includes('/pages/') || filePath.includes('/app/')) return 'page';
  if (filePath.includes('/lib/') || filePath.includes('/utils/')) return 'utility';
  if (filePath.includes('/hooks/')) return 'hook';
  if (filePath.includes('/server/')) return 'server';
  return 'other';
}
