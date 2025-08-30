import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { db } from "@/server/db";
import { loadGithubRepo } from "@/lib/github-loader";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    // Try to fetch project info from DB to get its githubUrl
    const project = await db.project.findUnique({ where: { id: projectId } });

    let files: Array<{ source: string; content: string }> = [];
    let fallbackWarning: string | null = null;

    if (project?.githubUrl) {
      // Prefer a token from env, but allow per-project token if stored
      const githubToken = (process.env.GITHUB_TOKEN as string | undefined) || (project as any)?.githubToken || undefined;
      // Mask token for logging so we can confirm which token (if any) is being used
      const mask = (t?: string) => {
        if (!t) return 'NO_TOKEN';
        const s = String(t);
        return s.length > 8 ? `${s.slice(0,4)}...${s.slice(-4)}` : '****';
      };
      console.log('graph api: loading repo', { projectId: projectId, githubUrl: project.githubUrl, token: mask(githubToken) });

      // retry with exponential backoff for transient errors
      const maxAttempts = 3;
      let attempt = 0;
      let loadedDocs: any[] | null = null;
      while (attempt < maxAttempts) {
        try {
          loadedDocs = await loadGithubRepo(project.githubUrl, githubToken);
          break;
        } catch (err: any) {
          attempt += 1;
          const msg = err?.message || String(err);
          const isRateLimit = /rate limit/i.test(msg) || /rate limited/i.test(msg) || err?.status === 403;
          const isAuthError = /bad credentials/i.test(msg) || /unauthorized/i.test(msg) || err?.status === 401;
          console.warn(`loadGithubRepo attempt ${attempt} failed`, { message: msg, isRateLimit, isAuthError });
          // If authentication failed (bad token), stop retrying and fall back to local src
          if (isAuthError) {
            fallbackWarning = githubToken
              ? 'Provided GitHub token is invalid (Bad credentials). Falling back to local src.'
              : 'GitHub authentication failed. Falling back to local src.';
            console.warn('graph api: auth failure for project', { projectId, githubUrl: project.githubUrl, tokenMask: mask(githubToken) });
            break;
          }
          // if rate-limited and we have no token, stop retrying early and set a helpful warning
          if (isRateLimit && !githubToken) {
            fallbackWarning = 'GitHub API rate limit exceeded and no GITHUB_TOKEN set. Falling back to local src.';
            break;
          }
          if (attempt < maxAttempts) {
            // exponential backoff
            const wait = 300 * Math.pow(2, attempt);
            await new Promise((res) => setTimeout(res, wait));
            continue;
          }
          // rethrow after last attempt
          throw err;
        }
      }

      if (loadedDocs && loadedDocs.length > 0) {
        files = loadedDocs.map((d: any) => ({ source: String(d.metadata?.source ?? d.metadata?.sourcePath ?? ''), content: String(d.pageContent ?? '') }));
      } else if (!loadedDocs) {
        console.warn('Failed to load github repo (no docs), falling back to local src');
      }
    }

    // If no files from repo, fallback to local src directory (useful in dev)
    if (files.length === 0) {
      const analysisPath = path.join(process.cwd(), 'src');
      if (!fs.existsSync(analysisPath)) {
        return NextResponse.json({ error: "project not found and no local src available" }, { status: 404 });
      }

      // Recursively read files from src
      const exts = ['.js', '.ts', '.tsx', '.jsx'];
      const walk = (dir: string, base = ''): void => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = path.posix.join(base, entry.name);
          if (entry.isDirectory()) {
            walk(full, rel);
          } else if (exts.includes(path.extname(entry.name))) {
            const content = fs.readFileSync(full, 'utf-8');
            files.push({ source: rel.replaceAll('\\', '/'), content });
          }
        }
      };
      walk(analysisPath, 'src');
    }

    // Build a lookup of available files (normalize to posix)
    const normalize = (p: string) => p.replaceAll('\\', '/');
    const fileMap = new Map<string, string>();
    for (const f of files) {
      const key = normalize(f.source).replace(/^\/?/, ''); // remove leading slash
      fileMap.set(key, f.content);
    }

    // Helper to resolve import paths to repo file keys
    const tryResolve = (importPath: string, fromFile: string): string | null => {
      // ignore external modules (not relative)
      if (!importPath.startsWith('.')) return null;
      const fromDir = path.posix.dirname(fromFile);
      const joined = path.posix.normalize(path.posix.join(fromDir, importPath));

      const candidates: string[] = [];
      // If import references exact file with extension
      candidates.push(joined);
      // try extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
        if (path.posix.extname(joined) === '') {
          candidates.push(joined + ext);
        }
      }

      for (const c of candidates) {
        const key = c.replace(/^\/?/, '');
        if (fileMap.has(key)) return key;
      }
      return null;
    };

    // Simple import/require regexes
    const importRegex = /import\s+(?:[^'"\n]+from\s+)?["']([^"']+)["']/g;
    const requireRegex = /require\(\s*["']([^"']+)["']\s*\)/g;
    const dynamicImportRegex = /import\(\s*["']([^"']+)["']\s*\)/g;

    const nodesSet = new Set<string>();
    const edges: Array<{ source: string; target: string }> = [];

    for (const [source, content] of fileMap.entries()) {
      nodesSet.add(source);

      const scan = (regex: RegExp) => {
        // reset lastIndex in case the same regex instance was used before
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          const imp = m[1];
          if (!imp || typeof imp !== 'string') continue; // guard against undefined capture
          const resolved = tryResolve(imp, source);
          if (resolved) {
            nodesSet.add(resolved);
            edges.push({ source, target: resolved });
          }
        }
      };

      scan(importRegex);
      scan(requireRegex);
      scan(dynamicImportRegex);
    }

    const allFiles = Array.from(nodesSet);

    const getFileType = (filePath: string): string => {
      const p = filePath.toLowerCase();
      // split path into segments to handle both 'src/app/...' and 'app/...' and repo sources
      const parts = p.split('/').filter(Boolean);
      // check common folders first
      if (parts.includes('api') || p.includes('/api/')) return 'api';
      if (parts.includes('components') || parts.includes('component')) return 'component';
      // detect pages: routes under app/ or pages/ or files named page.tsx
      if (
        parts.includes('pages') ||
        parts.includes('app') ||
        p.endsWith('/page.tsx') ||
        p.endsWith('page.tsx')
      ) return 'page';
      if (parts.includes('lib') || parts.includes('utils')) return 'utility';
      if (parts.includes('hooks')) return 'hook';
      if (parts.includes('server')) return 'server';
      return 'other';
    };

    const nodes = allFiles.map((id) => ({
      id,
      label: path.posix.basename(id).replace(/\.(js|ts|tsx|jsx)$/, ''),
      fullPath: id,
      type: getFileType(id),
      folder: path.posix.dirname(id)
    }));

    const total = { nodes: nodes.length, edges: edges.length };

    // limit for performance
    const body: any = {
      nodes: nodes.slice(0, 200),
      edges: edges.slice(0, 400),
      total
    };
    if (fallbackWarning) body.warning = fallbackWarning;
    return NextResponse.json(body);
  } catch (err) {
    console.error("graph api error", err instanceof Error ? err.stack : err);
    const details = err instanceof Error ? err.message : String(err);
    const bodyErr: any = { error: "analysis_failed", details };
    if (err instanceof Error && process.env.NODE_ENV !== 'production') {
      bodyErr.stack = err.stack;
    }
    return NextResponse.json(bodyErr, { status: 500 });
  }
}
